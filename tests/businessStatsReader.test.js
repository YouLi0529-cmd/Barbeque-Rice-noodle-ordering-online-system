const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createBusinessStatsReader, mergeBusinessStatsIntervals } = require('../cloudfunctions/tenantApi/businessStatsReader')

const commands = Object.fromEntries(['gte', 'lt', 'gt', 'lte', 'neq'].map(op => [op, value => ({ op, value })]))
commands.and = values => ({ op: 'and', values })
function matches(row, condition) {
  if (condition.op === 'and') return condition.values.every(value => matches(row, value))
  return Object.entries(condition).every(([key, expected]) => {
    const actual = row[key]
    if (!expected || !expected.op) return actual === expected
    if (expected.op === 'neq') return actual !== expected.value
    if (expected.value instanceof Date && !(actual instanceof Date)) return false
    if (expected.op === 'gte') return actual >= expected.value
    if (expected.op === 'lt') return actual < expected.value
    if (expected.op === 'gt') return actual > expected.value
    if (expected.op === 'lte') return actual <= expected.value
    throw new Error('unexpected operator')
  })
}
const interval = (day, endDay = day) => ({
  startAt: Date.parse(`${day}T00:00:00+08:00`),
  endAt: Date.parse(`${endDay}T00:00:00+08:00`) + 86400000
})
const record = (id, day, extra = {}) => ({
  _id: id, type: 'order', storeId: 'zhangnan', checkoutAt: new Date(`${day}T12:00:00+08:00`), ...extra
})
function fixture(rows, options = {}) {
  const reads = []
  const db = { collection(collection) { return { where(condition) {
    let direction = 'asc', limit = 100, projection
    return {
      field(value) { projection = value; return this },
      orderBy(field, value) { assert.equal(field, '_id'); direction = value; return this },
      limit(value) { limit = value; return this },
      async get() {
        if (options.failAfter !== undefined && reads.length >= options.failAfter) throw new Error('index/network failure')
        const found = rows.filter(row => matches(row, condition)).sort((a, b) =>
          a._id.localeCompare(b._id) * (direction === 'asc' ? 1 : -1)).slice(0, limit)
        reads.push({ collection, ids: found.map(row => row._id), projection })
        if (options.onRead) options.onRead(reads.length, rows)
        return { data: projection ? found.map(row => ({ _id: row._id })) : found }
      }
    }
  } } } }
  return { read: createBusinessStatsReader({ db, _: commands }), reads }
}
const args = { collection: 'order', type: 'order', tenantId: 'zhangnan' }

test('old selected day is found behind thousands of newer records without downloading them', async () => {
  const rows = [record('old-sale', '2026-10-07'),
    ...Array.from({ length: 2300 }, (_, i) => record(`new-${i}`, '2026-10-19'))]
  const { read, reads } = fixture(rows)
  const found = await read({ ...args, intervals: [interval('2026-10-07')] })
  assert.deepEqual(found.map(row => row._id), ['old-sale'])
  assert.ok(reads.every(read => read.ids.every(id => id === 'old-sale')))
})

test('more than 1000 selected records are read completely and exactly once', async () => {
  const rows = Array.from({ length: 1207 }, (_, i) => record(String(i).padStart(5, '0'), '2026-10-07'))
  const { read } = fixture(rows)
  const found = await read({ ...args, intervals: [interval('2026-10-07')] })
  assert.equal(found.length, 1207)
  assert.equal(new Set(found.map(row => row._id)).size, 1207)
})

test('two distant tabs exclude intervening dates and overlapping ranges are merged', async () => {
  const { read, reads } = fixture([record('a', '2026-10-07'), record('gap', '2026-10-12'), record('b', '2026-10-19')])
  const found = await read({ ...args, intervals: [interval('2026-10-07'), interval('2026-10-19')] })
  assert.deepEqual(found.map(row => row._id), ['a', 'b'])
  assert.ok(reads.every(read => !read.ids.includes('gap')))
  assert.deepEqual(mergeBusinessStatsIntervals([interval('2026-10-07', '2026-10-09'), interval('2026-10-08', '2026-10-10')]),
    [interval('2026-10-07', '2026-10-10')])
})

test('Beijing midnight boundaries are inclusive at start and exclusive at end; deleted/other tenants excluded', async () => {
  const range = interval('2026-10-07')
  const { read } = fixture([
    record('start', '2026-10-07', { checkoutAt: new Date(range.startAt) }),
    record('last', '2026-10-07', { checkoutAt: new Date(range.endAt - 1) }),
    record('before', '2026-10-07', { checkoutAt: new Date(range.startAt - 1) }),
    record('end', '2026-10-07', { checkoutAt: new Date(range.endAt) }),
    record('deleted', '2026-10-07', { deleted: true }), record('tenant', '2026-10-07', { storeId: 'other' })
  ])
  assert.deepEqual((await read({ ...args, intervals: [range] })).map(row => row._id).sort(), ['last', 'start'])
})

test('joint payment records also paginate beyond 1000', async () => {
  const rows = Array.from({ length: 1003 }, (_, i) => record(String(i).padStart(5, '0'), '2026-10-07', { type: 'joint_checkout' }))
  const { read } = fixture(rows)
  assert.equal((await read({ ...args, collection: 'checkoutPayment', type: 'joint_checkout', intervals: [interval('2026-10-07')] })).length, 1003)
})

test('query failure never returns partial data or triggers a history-wide fallback', async () => {
  const { read, reads } = fixture([record('sale', '2026-10-07')], { failAfter: 2 })
  await assert.rejects(read({ ...args, intervals: [interval('2026-10-07')] }), /index\/network failure/)
  assert.equal(reads.length, 2)
})

test('overview wiring passes both requested date windows and retains existing calculation', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../cloudfunctions/tenantApi/index.js'), 'utf8')
  const code = source.slice(source.indexOf('async function listJointCheckoutPayments('), source.indexOf('const SETTLEMENT_HISTORY_DAYS'))
  const calls = []
  const context = vm.createContext({ Date, Promise,
    normalizeBusinessStatsRange: value => value,
    getBusinessStatsRangeStart: (range, now, date) => new Date(interval(date).startAt),
    getBusinessStatsRangeEnd: (range, now, date) => interval(date).endAt,
    ensureCollection: async () => {}, getTenantId: () => 'zhangnan',
    getTableArrivalSnapshot: async () => ({ peopleCount: 171 }),
    readBusinessStatsRecords: async input => { calls.push(input); return input.type === 'order' ? [record('sale', '2026-10-07')] : [] },
    buildBusinessStatsSnapshot: (orders, range, payments, date) => ({ date, count: orders.length, payments: payments.length })
  })
  vm.runInContext(code, context)
  const result = await context.adminGetBusinessStats({ revenueRange: 'custom', revenueDate: '2026-10-07', dishRange: 'custom', dishDate: '2026-10-19' })
  assert.equal(calls.length, 2)
  for (const call of calls) assert.deepEqual(JSON.parse(JSON.stringify(call.intervals)), [interval('2026-10-07'), interval('2026-10-19')])
  assert.equal(result.data.revenue.count, 1)
  assert.equal(result.data.arrival.peopleCount, 171)
  assert.equal(result.data.isTruncated, false)
})
