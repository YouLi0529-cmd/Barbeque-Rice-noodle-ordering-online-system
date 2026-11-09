const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { createTableArrivalReader } = require('../cloudfunctions/tenantApi/tableArrivalReader')
const arrivalCount = require('../cloudfunctions/tenantApi/tableArrivalCount')

const startAt = Date.parse('2026-10-01T00:00:00+08:00')
const endAt = Date.parse('2026-11-01T00:00:00+08:00')
const inside = new Date(startAt + 3600000)
const commands = Object.fromEntries(['gte', 'lt', 'gt', 'lte', 'exists', 'in'].map(op => [op, value => ({ op, value })]))
commands.and = values => ({ op: 'and', values })
commands.or = values => ({ op: 'or', values })

function matches(row, condition) {
  if (condition.op === 'and') return condition.values.every(value => matches(row, value))
  if (condition.op === 'or') return condition.values.some(value => matches(row, value))
  return Object.entries(condition).every(([key, expected]) => {
    if (!expected || !expected.op) return row[key] === expected
    const actual = row[key]
    if (expected.op === 'exists') return Object.hasOwn(row, key) === expected.value
    if (expected.op === 'in') return expected.value.includes(actual)
    if (expected.op === 'gte') return actual >= expected.value
    if (expected.op === 'lt') return actual < expected.value
    if (expected.op === 'gt') return actual > expected.value
    if (expected.op === 'lte') return actual <= expected.value
    throw new Error('unexpected operator')
  })
}

function fixture(records, { cap = 1000, failAfter = Infinity, onRead } = {}) {
  const reads = []
  const db = { collection: name => ({ where: condition => {
    let fields, direction = 'asc', limit = 100
    return {
      field(value) { fields = value; return this },
      orderBy(key, value) { assert.equal(key, '_id'); direction = value; return this },
      limit(value) { limit = value; return this },
      async get() {
        if (reads.length >= failAfter) throw new Error('database unavailable')
        const rows = (records[name] || []).filter(row => matches(row, condition))
          .sort((a, b) => a._id.localeCompare(b._id) * (direction === 'asc' ? 1 : -1))
          .slice(0, Math.min(limit, cap))
        reads.push({ name, ids: rows.map(row => row._id), fields })
        if (onRead) onRead(reads.length, records)
        return { data: rows.map(row => Object.fromEntries(Object.keys(fields).filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]]))) }
      }
    }
  } }) }
  return { reader: createTableArrivalReader({ db, _: commands }), reads }
}

const order = (id, extra = {}) => ({ _id: id, type: 'order', tableNumber: '01', createTime: inside, peopleCount: 2, ...extra })
const session = (id, extra = {}) => ({ _id: id, tableNumber: '01', peopleConfirmed: true, peopleCount: 3,
  peopleConfirmedAt: inside, status: 'ordering', ...extra })

test('arrival order reads exceed 500 and 1000, including smaller server page caps', async () => {
  const rows = Array.from({ length: 1207 }, (_, i) => order(`o-${String(i).padStart(4, '0')}`, { goods: ['large payload'], kitchenLogs: ['unused'] }))
  for (const cap of [1000, 100]) {
    const h = fixture({ order: rows }, { cap })
    const result = await h.reader.orders(startAt, endAt)
    assert.equal(result.length, 1207)
    assert.equal(new Set(result.map(row => row._id)).size, 1207)
    assert.ok(result.every(row => row.peopleCount === 2 && row.goods === undefined && row.kitchenLogs === undefined))
  }
})

test('confirmed session reads exceed 200 and retain the timestamp fallback precedence', async () => {
  const rows = Array.from({ length: 1207 }, (_, i) => session(`s-${String(i).padStart(4, '0')}`))
  rows.push(session('legacy-created', { peopleConfirmedAt: null, createTime: inside }),
    session('legacy-updated', { peopleConfirmedAt: '', createTime: null, updateTime: inside }),
    { _id: 'legacy-missing', peopleConfirmed: true, tableNumber: '02', createTime: inside },
    session('outside-primary', { peopleConfirmedAt: new Date(endAt), createTime: inside }),
    session('outside-created', { peopleConfirmedAt: null, createTime: new Date(endAt), updateTime: inside }),
    session('unconfirmed', { peopleConfirmed: false }))
  const h = fixture({ tableOrderSession: rows }, { cap: 100 })
  const result = await h.reader.sessions(startAt, endAt)
  assert.equal(result.length, 1210)
  assert.equal(new Set(result.map(row => row._id)).size, 1210)
  assert.ok(result.every(row => !row._id.startsWith('outside-') && row._id !== 'unconfirmed'))
})

test('database date bounds include both selected dates and exclude unrelated history', async () => {
  const h = fixture({ order: [
    order('first', { createTime: new Date(startAt) }), order('last', { createTime: new Date(endAt - 1) }),
    order('before', { createTime: new Date(startAt - 1) }), order('after', { createTime: new Date(endAt) }),
    ...Array.from({ length: 1500 }, (_, i) => order(`old-${i}`, { createTime: new Date(startAt - 86400000) }))
  ] })
  assert.deepEqual((await h.reader.orders(startAt, endAt)).map(row => row._id), ['first', 'last'])
  assert.ok(h.reads.every(read => read.ids.every(id => id === 'first' || id === 'last')))
})

test('a database failure after the first page rejects instead of returning partial or zero arrivals', async () => {
  const h = fixture({ order: Array.from({ length: 1001 }, (_, i) => order(String(i).padStart(4, '0'))) }, { failAfter: 2 })
  await assert.rejects(h.reader.orders(startAt, endAt), /database unavailable/)
  const sessions = fixture({ tableOrderSession: [session('confirmed')] }, { failAfter: 0 })
  await assert.rejects(sessions.reader.sessions(startAt, endAt), /database unavailable/)
})

test('paging upper bound excludes later insertions without crowding out existing orders', async () => {
  const rows = Array.from({ length: 1001 }, (_, i) => order(String(i).padStart(4, '0')))
  const h = fixture({ order: rows }, { cap: 100, onRead(count) {
    if (count === 1) rows.push(order('zz-new'))
  } })
  const result = await h.reader.orders(startAt, endAt)
  assert.equal(result.length, 1001)
  assert.ok(!result.some(row => row._id === 'zz-new'))
})

test('normal entry point counts every page and keeps add-on and session people deduplicated', async () => {
  const rows = Array.from({ length: 601 }, (_, i) => order(`o-${String(i).padStart(4, '0')}`))
  rows.push(order('z-addon', { rootOrderId: 'o-0000', peopleCount: 5 }),
    order('deleted', { deleted: true }), order('camping', { orderScene: 'camping' }),
    order('cancelled', { status: 'cancelled' }), order('cleared-unpaid', { tableCleared: true }))
  const sessions = [session('linked', { activeOrderRootId: 'o-0000', peopleCount: 5 })]
  const h = fixture({ order: rows, tableOrderSession: sessions }, { cap: 100 })
  const source = fs.readFileSync(require.resolve('../cloudfunctions/tenantApi/index.js'), 'utf8')
  const code = source.slice(source.indexOf('function isDineInArrivalOrder('), source.indexOf('function getBusinessStatsGroupKey('))
  const context = vm.createContext({ ...arrivalCount, tableArrivalReader: h.reader,
    getBusinessStatsRangeStart: () => new Date(startAt), getBusinessStatsRangeEnd: () => endAt,
    getTimeValue: value => value ? new Date(value).getTime() : 0,
    getOrderTableRef: row => row.tableNumber ? { tableNumber: row.tableNumber } : null,
    isCampingOrder: row => row.orderScene === 'camping' || row.orderType === 'camping',
    isAdminPaidOrder: row => row.payStatus === true || row.pay_status === true || ['paid', 'completed'].includes(row.status),
    isActiveTableSession: row => row.status === 'ordering'
  })
  vm.runInContext(code, context)
  const result = await context.getTableArrivalSnapshot('custom', new Date(endAt), '2026-10-01')
  assert.equal(result.peopleCount, 601 * 2 + 3)
  assert.equal(result.tableCount, 601)
})
