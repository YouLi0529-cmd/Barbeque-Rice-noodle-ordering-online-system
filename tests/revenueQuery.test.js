const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { createRevenueQueryService } = require('../cloudfunctions/tenantApi/revenueQueryService')
const { summarizeRevenue } = require('../miniprogram/utils/revenueSummary')
const { validateDateRange } = require('../cloudfunctions/tenantApi/salesQueryService')
const filters = require('../miniprogram/utils/salesQuery')
const source = fs.readFileSync(require.resolve('../cloudfunctions/tenantApi/index.js'), 'utf8')
const part = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))
const startAt = Date.parse('2026-11-01T00:00:00+08:00')
const endAt = Date.parse('2026-11-03T00:00:00+08:00')
function backend(orders = [], payments = [], options = {}) {
  const reads = []
  const commands = Object.fromEntries(['gte', 'lt', 'gt', 'lte', 'neq'].map(op => [op, value => ({ op, value })]))
  commands.and = values => ({ op: 'and', values })
  const matches = (row, condition) => {
    if (condition.op === 'and') return condition.values.every(value => matches(row, value))
    return Object.entries(condition).every(([key, expected]) => {
      const actual = row[key]
      if (!expected || !expected.op) return actual === expected
      if (expected.op === 'neq') return actual !== expected.value
      if (expected.op === 'gte') return actual >= expected.value
      if (expected.op === 'lt') return actual < expected.value
      if (expected.op === 'gt') return actual > expected.value
      if (expected.op === 'lte') return actual <= expected.value
    })
  }
  const db = { collection: collection => ({ where: condition => {
    let fields, direction = 'asc', limit = 100
    return {
      field(value) { fields = value; return this },
      orderBy(key, value) { direction = value; return this },
      limit(value) { limit = value; return this },
      async get() {
        const rows = (collection === 'order' ? orders : payments).filter(row => matches(row, condition))
          .sort((a, b) => a._id.localeCompare(b._id) * (direction === 'asc' ? 1 : -1)).slice(0, limit)
        reads.push({ collection, fields, rows: rows.length })
        if (options.failAfter && reads.length >= options.failAfter) throw new Error('injected database failure')
        return { data: rows.map(row => Object.fromEntries(Object.keys(fields).filter(key => key in row).map(key => [key, row[key]]))) }
      }
    }
  } }) }
  const context = vm.createContext({ Date, console, db, _: commands,
    createRevenueQueryService: options => createRevenueQueryService({ ...options, now: () => Date.parse('2026-11-09T12:00:00+08:00') }),
    validateDateRange, getTenantId: payload => payload.tenantId,
    roundMoney: value => Math.round((Number(value) + Number.EPSILON) * 100) / 100,
    getTimeValue: value => value ? new Date(value.$date || value).getTime() : 0,
    getBusinessStatsRangeStart() { throw new Error('explicit Beijing interval required') },
    getBusinessStatsRangeEnd() { throw new Error('explicit Beijing interval required') },
    normalizeBusinessStatsRange: value => value,
    isAdminPaidOrder: row => row.payStatus === true || row.pay_status === true || ['paid', 'completed'].includes(row.status),
    isCampingOrder: row => row.orderScene === 'camping' || row.orderType === 'camping',

  })
  vm.runInContext(part('function getBusinessStatsPaidTime(', 'function isDineInArrivalOrder(') + part('function getBusinessStatsGroupKey(', 'async function listJointCheckoutPayments(') +
    part('async function listJointCheckoutPayments(', 'async function adminGetBusinessStats('), context)
  return { context, reads, query: async () => {
    let cursor = '', result
    const collectedOrders = [], collectedPayments = []
    do {
      result = await context.adminQueryRevenue({ tenantId: 'zhangnan', adminAuthToken: 'admin', startDate: '2026-11-01', endDate: '2026-11-02', cursor, protocol: 2 })
      assert.equal(result.success, true, result.message)
      assert.equal(result.data.protocol, 2)
      assert.ok(Buffer.byteLength(result.data.cursor || '') < 4096)
      assert.ok(Buffer.byteLength(JSON.stringify(result.data)) < 60000)
      const wire = JSON.parse(JSON.stringify(result.data))
      collectedOrders.push(...wire.orders)
      collectedPayments.push(...wire.payments)
      cursor = result.data.cursor
    } while (!result.data.done)
    const amounts = summarizeRevenue(collectedOrders, collectedPayments, { startAt, endAt })
    const expected = context.buildBusinessStatsSnapshot(orders.filter(row => row.storeId === 'zhangnan'), 'custom', payments.filter(row => row.storeId === 'zhangnan'), '', { startAt, endAt })
    assert.equal(amounts.totalRevenue, expected.revenue)
    assert.equal(amounts.cashRevenue, expected.cashRevenue)
    assert.equal(amounts.onlineRevenue, expected.onlineRevenue)
    return { ...result, data: { ...result.data, ...amounts } }
  } }
}
const sale = (id, amount, extra = {}) => ({ _id: id, rootOrderId: id, type: 'order', storeId: 'zhangnan',
  checkoutAt: new Date(startAt), status: 'completed', checkoutReceivable: amount, paymentMethod: 'cash', goods: [], ...extra })

test('date validation includes both Beijing days and is independent of host timezone', () => {
  assert.equal(filters.validateDateRange('', ''), '请选择查询时间段')
  assert.equal(filters.validateDateRange('2026-11-02', '2026-11-01'), '结束日期不能早于开始日期')
  assert.equal(filters.validateDateRange('2026-02-30', '2026-03-01'), '查询日期无效')
  assert.equal(filters.validateDateRange('2026-11-01', '2026-11-01'), '')
  assert.deepEqual(validateDateRange({ startDate: '2026-11-01', endDate: '2026-11-02' }), { startAt, endAt })
  assert.equal(validateDateRange({ startDate: '2026-11-01', endDate: '2026-11-01' }).endAt, startAt + 86400000)
  assert.throws(() => validateDateRange({ startDate: '2026-02-30', endDate: '2026-03-01' }), /查询日期无效/)
})

test('invalid backend dates return a validation error without any database reads', async () => {
  const h = backend()
  const result = await h.context.adminQueryRevenue({ startDate: '2026-11-02', endDate: '2026-11-01' })
  assert.equal(result.success, false)
  assert.equal(h.reads.length, 0)
})

test('cash, online, mixed, camping, boundaries and current store use actual settled amounts', async () => {
  const h = backend([
    sale('cash', 120, { checkoutCashAmount: 120, checkoutOnlineAmount: 0 }),
    sale('mixed', 80.25, { checkoutCashAmount: 20, checkoutOnlineAmount: 60.25 }),
    sale('camp', 50, { orderScene: 'camping', paymentMethod: 'wechat_alipay', checkoutAt: new Date(endAt - 1) }),
    sale('before', 999, { checkoutAt: new Date(startAt - 1) }),
    sale('after', 999, { checkoutAt: new Date(endAt) }),
    sale('deleted', 999, { deleted: true }), sale('foreign', 999, { storeId: 'other' }),
    sale('unpaid', 999, { status: 'pending_prepare' }), sale('cancelled', 999, { status: 'cancelled' })
  ])
  const result = await h.query()
  assert.equal(result.data.totalRevenue, 250.25)
  assert.equal(result.data.cashRevenue, 140)
  assert.equal(result.data.onlineRevenue, 110.25)
  assert.ok(h.reads.length >= 2)
  assert.ok(h.reads.every(read => !read.fields.goods))
})

test('add-on batches and split payments are deduplicated, deleted orders excluded on each query', async () => {
  const root = sale('root', 121, { checkoutBatchId: 'batch', checkoutCashAmount: 21, checkoutOnlineAmount: 100 })
  const addon = sale('addon', 121, { rootOrderId: 'root', checkoutBatchId: 'batch', checkoutCashAmount: 21, checkoutOnlineAmount: 100 })
  const partial = sale('partial', 999, { status: 'pending_prepare', combinedSettlementEvents: [
    { id: 'partial-event', type: 'combined_checkout', settledAt: new Date(startAt), receivedAmount: 10, cashAmount: 0, onlineAmount: 10, dishes: [] }
  ] })
  const h = backend([root, addon, partial])
  assert.equal((await h.query()).data.totalRevenue, 131)
  root.deleted = true
  addon.deleted = true
  assert.equal((await h.query()).data.totalRevenue, 10)
})

test('legacy joint payments and new per-table allocations follow existing overview accounting', async () => {
  const orders = [sale('joint-a', 40, { jointCheckoutId: 'joint', checkoutBatchId: 'a' }),
    sale('joint-b', 60, { jointCheckoutId: 'joint', checkoutBatchId: 'b' })]
  const payment = { _id: 'joint', type: 'joint_checkout', jointCheckoutId: 'joint', storeId: 'zhangnan',
    checkoutAt: new Date(startAt), receivable: 100, cashAmount: 30, onlineAmount: 70 }
  const result = (await backend(orders, [payment]).query()).data
  assert.equal(result.totalRevenue, 100)
  assert.equal(result.cashRevenue, 30)
  assert.equal(result.onlineRevenue, 70)
  const allocated = orders.map(row => ({ ...row, jointCheckoutAllocationVersion: 1, paymentMethod: 'wechat_alipay' }))
  assert.equal((await backend(allocated, [{ ...payment, allocationMode: 'per_table' }]).query()).data.onlineRevenue, 100)
})

test('empty range returns three zero amounts', async () => {
  const result = await backend().query()
  assert.equal(result.data.totalRevenue, 0)
  assert.equal(result.data.cashRevenue, 0)
  assert.equal(result.data.onlineRevenue, 0)
})


test('large ranges use bounded header pages and retain cross-page checkout groups', async () => {
  const orders = Array.from({ length: 1207 }, (_, i) => sale(String(i).padStart(5, '0'), 12.25))
  // Repeated checkout values on the first/last order belong to one checkout.
  orders[0].checkoutBatchId = 'shared'
  orders[1206].checkoutBatchId = 'shared'
  const h = backend(orders)
  const result = await h.query()
  assert.equal(result.data.totalRevenue, 1206 * 12.25)
  assert.ok(h.reads.filter(read => read.collection === 'order').length < 80)
  assert.ok(h.reads.every(read => !read.fields.goods && !read.fields.kitchenLogs))
})

test('continuation tokens bind to the original tenant, dates and administrator session', async () => {
  const h = backend([sale('one', 10)])
  const payload = { protocol: 2, tenantId: 'zhangnan', adminAuthToken: 'admin', startDate: '2026-11-01', endDate: '2026-11-02' }
  const first = await h.context.adminQueryRevenue(payload)
  assert.equal(first.data.done, false)
  for (const change of [{ tenantId: 'other' }, { startDate: '2026-10-01' }, { adminAuthToken: 'other' }]) {
    const rejected = await h.context.adminQueryRevenue({ ...payload, ...change, cursor: first.data.cursor })
    assert.equal(rejected.success, false)
    assert.match(rejected.code, /^REVENUE_CURSOR_/)
  }
})

test('deleted or changed settlements during continuation cannot return stale totals', async () => {
  for (const change of [order => { order.deleted = true }, order => { order.checkoutReceivable = 99 }]) {
    const orders = [sale('one', 10)]
    const h = backend(orders)
    const payload = { protocol: 2, tenantId: 'zhangnan', adminAuthToken: 'admin', startDate: '2026-11-01', endDate: '2026-11-02' }
    let result = await h.context.adminQueryRevenue(payload)
    change(orders[0])
    for (let i = 0; i < 8 && result.success && !result.data.done; i++) {
      result = await h.context.adminQueryRevenue({ ...payload, cursor: result.data.cursor })
    }
    assert.equal(result.success, false)
    assert.equal(result.code, 'REVENUE_DATA_CHANGED')
  }
})

test('database failure rejects the range instead of displaying partial success', async () => {
  const h = backend([sale('one', 10)], [], { failAfter: 2 })
  await assert.rejects(h.query(), /injected database failure/)
})


test('a full month of large financial headers keeps every request and response bounded', async () => {
  const crypto = require('node:crypto')
  const orders = Array.from({ length: 12000 }, (_, i) => sale(String(i).padStart(8, '0'), 12.25, {
    checkoutBatchId: crypto.createHash('sha256').update(String(i)).digest('hex'),
    combinedSettlementEvents: [{ type: 'unrelated', id: crypto.randomBytes(160).toString('hex'), dishes: ['x'.repeat(10000)] }]
  }))
  orders[11999].checkoutBatchId = orders[0].checkoutBatchId
  const result = await backend(orders).query()
  assert.equal(result.data.totalRevenue, 11999 * 12.25)
})

test('legacy clients receive an actionable update error before any database reads', async () => {
  const h = backend()
  const result = await h.context.adminQueryRevenue({ tenantId: 'zhangnan', startDate: '2026-11-01', endDate: '2026-11-02' })
  assert.equal(result.code, 'REVENUE_CLIENT_UPDATE_REQUIRED')
  assert.equal(h.reads.length, 0)
})

test('financial fallback and duplicate event rules match the existing overview', async () => {
  const rows = [
    sale('a', 0, { checkoutReceivable: undefined, receivedAmount: undefined, finalPrice: 23.45, rootOrderId: 'root', discountType: 'discount', discountValue: 8, directReduceValue: 1 }),
    sale('b', 0, { checkoutReceivable: undefined, receivedAmount: undefined, finalPrice: 12.35, rootOrderId: 'root' }),
    sale('c', 21, { combinedSettlementEvents: [{ id: 'event', type: 'combined_checkout', settledAt: { $date: startAt }, receivedAmount: 2.55, paymentMethod: 'cash', dishes: [] }] }),
    sale('d', 22, { combinedSettlementEvents: [{ id: 'event', type: 'combined_checkout', settledAt: { $date: startAt }, receivedAmount: 3.25, paymentMethod: 'online', dishes: [] }] })
  ]
  const result = await backend(rows).query()
  assert.equal(result.data.totalRevenue, 73.89)
})
