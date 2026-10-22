const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createSalesQueryService, validateFilters, aggregateOrders } = require('../cloudfunctions/tenantApi/salesQueryService')
const pins = require('../cloudfunctions/tenantApi/salesQueryPackages.json')

const day = '2020-10-01'
const paidAt = new Date('2020-10-01T05:00:00Z')
const filters = { startDate: day, endDate: day, categoryKey: 'category:meat' }
const item = (extra = {}) => ({ dishId: 'beef', dishName: '牛肉', categoryId: 'meat', categoryName: '肉类', count: 1, price: 0, originalPrice: 25, ...extra })
const order = (id, extra = {}) => ({ _id: id, type: 'order', storeId: 'zhangnan', orderScene: 'dineIn',
  status: 'completed', checkoutAt: paidAt, goods: [item()], ...extra })
const clauses = {
  and: values => ({ op: 'and', values }), or: values => ({ op: 'or', values }),
  in: values => ({ op: 'in', values }), neq: value => ({ op: 'neq', value }),
  gt: value => ({ op: 'gt', value }), lte: value => ({ op: 'lte', value }),
  gte: value => ({ op: 'gte', value }), lt: value => ({ op: 'lt', value }), nor: values => ({ op: 'nor', values })
}

function matches(doc, query) {
  if (query.op === 'and') return query.values.every(value => matches(doc, value))
  if (query.op === 'or') return query.values.some(value => matches(doc, value))
  if (query.op === 'nor') return !query.values.some(value => matches(doc, value))
  return Object.entries(query).every(([key, condition]) => {
    const value = doc[key]
    if (!condition || !condition.op) return value === condition
    if (condition.op === 'in') return condition.values.includes(value)
    if (condition.op === 'neq') return value !== condition.value
    if (['gt', 'gte', 'lt', 'lte'].includes(condition.op) && condition.value instanceof Date && !(value instanceof Date)) return false
    if (condition.op === 'gt') return value > condition.value
    if (condition.op === 'lte') return value <= condition.value
    if (condition.op === 'gte') return value >= condition.value
    if (condition.op === 'lt') return value < condition.value
    throw new Error('unknown query operator')
  })
}

function fixture(orders, extra = {}, options = {}) {
  const data = {
    order: orders,
    dishCategory: [{ _id: 'meat', name: '肉类', menuType: 'dineIn', sort: 2 }],
    dish: [{ _id: 'beef', name: '牛肉', categoryId: 'meat', menuType: 'dineIn' }],
    mealPackage: pins.map(pack => ({ _id: pack.id, name: pack.name, menuType: 'dineIn', price: 0 })), ...extra
  }
  let reads = 0
  const readsLog = []
  const db = { collection(name) {
    return {
      doc(id) { return { async get() { reads++; return { data: data[name].find(doc => doc._id === id) || null } } } },
      where(condition) {
        let direction = 'asc', size = 100, field = '_id', projection
        return {
          orderBy(key, sort) { field = key; direction = sort; return this },
          limit(count) { size = count; return this },
          field(value) { projection = value; return this },
          async get() {
            reads++
            const rows = data[name].filter(doc => matches(doc, condition)).slice().sort((a, b) => (
              (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (direction === 'desc' ? -1 : 1)
            )).slice(0, Math.min(size, options.pageCap || size))
            readsLog.push({ collection: name, projection, count: rows.length })
            return { data: projection ? rows.map(row => Object.fromEntries(Object.keys(projection)
              .filter(key => projection[key] && row[key] !== undefined).map(key => [key, row[key]]))) : rows }
          }
        }
      }
    }
  } }
  const service = createSalesQueryService({ db, _: clauses, getTenantId: payload => payload.tenantId || 'zhangnan' })
  return { service, data, readsLog, get reads() { return reads } }
}

async function collect(service, payload = filters, method = 'query') {
  let cursor = '', calls = 0
  const rows = new Map(), categories = []
  while (true) {
    const result = await service[method]({ adminAuthToken: 'test-admin', ...payload, cursor })
    if (!result.success) return { error: result, rows, calls }
    calls++
    assert.ok(calls < 10000, 'query must advance')
    for (const row of result.data.rows || []) {
      const old = rows.get(row.id) || { quantity: 0, amountCents: 0 }
      rows.set(row.id, { ...old, ...row, quantity: old.quantity + row.quantity, amountCents: old.amountCents + row.amountCents })
    }
    categories.push(...(result.data.categories || []))
    if (result.data.done) return { rows, categories, calls, data: result.data }
    assert.notEqual(result.data.cursor, cursor)
    cursor = result.data.cursor
  }
}

test('Beijing dates include both entire days, including a one-day range', () => {
  const range = validateFilters({ ...filters, endDate: '2020-10-02' })
  assert.equal(range.startAt, Date.parse('2020-09-30T16:00:00Z'))
  assert.equal(range.endAt, Date.parse('2020-10-02T16:00:00Z'))
  const records = [order('a', { checkoutAt: new Date(range.startAt) }), order('b', { checkoutAt: new Date(range.endAt - 1) }),
    order('c', { checkoutAt: new Date(range.startAt - 1) }), order('d', { checkoutAt: new Date(range.endAt) })]
  assert.equal(aggregateOrders(records, range, Date.now(), 'zhangnan').rows[0].quantity, 2)
})

test('both required filters and real calendar dates are validated', async () => {
  const { service } = fixture([])
  for (const [input, message] of [
    [{ ...filters, startDate: '' }, '请选择查询时间段'],
    [{ ...filters, categoryKey: '' }, '请选择查询品类'],
    [{ ...filters, endDate: '2020-09-30' }, '结束日期不能早于开始日期'],
    [{ ...filters, startDate: '2020-02-30' }, '查询日期无效']
  ]) assert.equal((await service.query(input)).message, message)
})

test('historical menu prices include gifts and package dishes rather than zero charged prices', async () => {
  const { service } = fixture([
    order('a', { goods: [item({ count: 2, originalPrice: 20, isGift: true, subtotal: 0 })] }),
    order('b', { goods: [item({ count: 3, originalPrice: 25, packageId: pins[0].id, packageCount: 3 })] })
  ], { dish: [{ _id: 'beef', name: '改名后的牛肉', categoryId: 'meat', price: 999 }] })
  const result = await collect(service)
  assert.equal(result.rows.get('beef').quantity, 5)
  assert.equal(result.rows.get('beef').amountCents, 11500)
})

test('excludes unpaid, cancelled, deleted, camping, and other stores but includes paid cleared tables', async () => {
  const records = [order('valid'), order('unpaid', { status: 'submitted' }), order('cancelled', { status: 'cancelled', payStatus: true }),
    order('deleted', { deleted: true }), order('camping', { orderScene: 'camping' }), order('other', { storeId: 'other' }),
    order('cleared', { tableCleared: true }), order('flag', { status: 'submitted', pay_status: true })]
  const result = await collect(fixture(records).service)
  assert.equal(result.rows.get('beef').quantity, 3)
})

test('zero sales catalog dishes and deleted historical dishes are both retained', async () => {
  const result = await collect(fixture([order('a', { goods: [item({ dishId: 'deleted-dish', dishName: '已删除菜品' })] })]).service)
  assert.equal(result.rows.get('beef').quantity, 0)
  assert.equal(result.rows.get('deleted-dish').quantity, 1)
})

test('classification follows order snapshots after a dish changes category', async () => {
  const { service } = fixture([order('a')], { dish: [{ _id: 'beef', name: '牛肉', categoryId: 'new-category' }] })
  assert.equal((await collect(service)).rows.get('beef').quantity, 1)
  assert.equal((await collect(service, { ...filters, categoryKey: 'category:new-category' })).rows.get('beef').quantity, 0)
})

test('options discover new current categories and preserve deleted historical categories by identity', async () => {
  const { service } = fixture([order('a'), order('b', { goods: [item({ categoryId: 'gone', categoryName: '历史分类' })] })], {
    dishCategory: [{ _id: 'meat', name: '重命名分类', sort: 2 }, { _id: 'new', name: '新分类', sort: 1 }, { _id: 'camp', name: '露营', menuType: 'camping' }]
  })
  const result = await collect(service, {}, 'options')
  assert.ok(result.categories.some(category => category.key === 'category:new' && !category.historical))
  assert.ok(result.categories.some(category => category.key === 'category:gone' && category.historical))
  assert.ok(!result.categories.some(category => category.id === 'camp'))
})

test('options batch history requests without losing categories beyond a batch boundary', async () => {
  const records = Array.from({ length: 2301 }, (_, index) => order(String(index).padStart(5, '0')))
  records[2300].goods = [item({ categoryId: 'last-history', categoryName: '最后一页历史分类' })]
  const { service } = fixture(records)
  const result = await collect(service, {}, 'options')
  assert.equal(result.calls, 3)
  assert.equal(result.data.scannedOrders, 2301)
  assert.ok(result.categories.some(category => category.key === 'category:last-history'))
})

test('group buys count each order/package once, retain original sets after partial refunds, exclude future zero packages', async () => {
  const groupA = { packageId: pins[0].id, packageCount: 2 }
  const groupB = { packageId: pins[1].id, packageCount: 3 }
  const records = [order('a', { goods: [item({ ...groupA, count: 1 }), item({ ...groupA, dishId: 'second', count: 2 }), item(groupB)] }),
    order('b', { goods: [item({ packageId: 'future-free-package', packageCount: 100 })] }),
    order('fully-refunded', { goods: [], status: 'cancelled' }), order('empty-retained', { goods: [] })]
  const { service } = fixture(records, { mealPackage: [{ _id: pins[0].id, name: '套餐改名' }] })
  const result = await collect(service, { ...filters, categoryKey: 'group-buy' })
  assert.equal(result.rows.size, 4)
  assert.equal(result.rows.get(pins[0].id).quantity, 2)
  assert.equal(result.rows.get(pins[0].id).name, '套餐改名')
  assert.equal(result.rows.get(pins[1].id).quantity, 3)
  assert.equal(result.rows.get(pins[2].id).quantity, 0)
})

test('fresh queries reflect settlement dish, order, and entire record deletion', async () => {
  const { service, data } = fixture([order('a'), order('b')])
  assert.equal((await collect(service)).rows.get('beef').quantity, 2)
  data.order[0].goods = []
  assert.equal((await collect(service)).rows.get('beef').quantity, 1)
  data.order.splice(1, 1)
  assert.equal((await collect(service)).rows.get('beef').quantity, 0)
  data.order.length = 0
  assert.equal((await collect(service)).rows.get('beef').quantity, 0)
})

test('group-buy sets become zero when the last surviving package dish is removed from settlement', async () => {
  const { service, data } = fixture([order('a', { goods: [item({ packageId: pins[0].id, packageCount: 2 })] })])
  const query = { ...filters, categoryKey: 'group-buy' }
  assert.equal((await collect(service, query)).rows.get(pins[0].id).quantity, 2)
  data.order[0].goods = []
  assert.equal((await collect(service, query)).rows.get(pins[0].id).quantity, 0)
})

test('joint checkout and partial settlement audit snapshots do not duplicate goods', async () => {
  const { service } = fixture([
    order('a', { jointCheckoutId: 'joint', combinedSettlementEvents: [{ dishes: [item({ count: 99 })] }] }),
    order('b', { jointCheckoutId: 'joint', rootOrderId: 'a', addOnIndex: 1 }),
    order('unpaid-partial', { status: 'submitted', combinedSettlementEvents: [{ dishes: [item({ count: 99 })] }] })
  ])
  assert.equal((await collect(service)).rows.get('beef').quantity, 2)
})

test('reads more than 1000 records completely, with stable keyset pagination', async () => {
  const orders = Array.from({ length: 1107 }, (_, index) => order(String(index).padStart(5, '0'))).reverse()
  const result = await collect(fixture(orders).service)
  assert.equal(result.rows.get('beef').quantity, 1107)
  assert.equal(result.rows.get('beef').amountCents, 1107 * 2500)
  assert.equal(result.calls, 3, 'catalog + batched aggregation + batched verification')
})

test('batched queries retain all rows and verification across the 2000-record request boundary', async () => {
  const records = Array.from({ length: 2301 }, (_, index) => order(String(index).padStart(5, '0')))
  records[2300].goods = [item({ count: 3, originalPrice: 20 })]
  const { service, data } = fixture(records)
  const result = await collect(service)
  assert.equal(result.calls, 5)
  assert.equal(result.rows.get('beef').quantity, 2303)
  assert.equal(result.rows.get('beef').amountCents, 2300 * 2500 + 6000)
  assert.equal(result.data.scannedOrders, 2301)
  let cursor = '', modified = false
  for (let request = 0; request < 10; request++) {
    const response = await service.query({ ...filters, adminAuthToken: 'test-admin', cursor })
    if (!response.success) {
      assert.equal(response.code, 'SALES_DATA_CHANGED')
      return
    }
    assert.equal(response.data.done, false)
    if (response.data.phase === 'verify' && !modified) {
      data.order[2300].goods[0].count = 4
      modified = true
    }
    cursor = response.data.cursor
  }
  assert.fail('verification must reject the modified final batch')
})

test('date query loads goods only for matching dates, auditing other history with headers', async () => {
  const old = Array.from({ length: 1201 }, (_, index) => order(`old-${String(index).padStart(4, '0')}`,
    { checkoutAt: new Date('2020-09-01T05:00:00Z'), kitchenLogs: ['unused large data'] }))
  const { service, readsLog } = fixture([...old, order('selected')])
  const result = await collect(service)
  assert.equal(result.rows.get('beef').quantity, 1)
  assert.equal(result.data.queryPlan, 'date-range-v2')
  assert.equal(result.data.detailReads, 2, 'one selected order, aggregation and verification')
  assert.equal(result.data.headerReads, 2402)
  assert.ok(readsLog.filter(read => read.collection === 'order' && read.projection && read.projection.goods)
    .every(read => !read.projection.kitchenLogs))
})

test('legacy checkout types and fallback fields remain complete without duplicate matches', async () => {
  const records = [order('date'),
    order('number', { checkoutAt: paidAt.getTime() }),
    order('iso', { checkoutAt: paidAt.toISOString() }),
    order('offset-string', { checkoutAt: '2020-10-01T13:00:00+08:00' }),
    order('wrapped', { checkoutAt: { $date: paidAt.getTime() } }),
    ...['paidAt', 'payTime', 'finishTime', 'completedAt'].map((field, index) =>
      order(`fallback-${index}`, { checkoutAt: undefined, [field]: paidAt })),
    order('priority-outside', { checkoutAt: new Date('2020-09-01T00:00:00Z'), paidAt }),
    order('also-has-fallback', { checkoutAt: paidAt, paidAt })]
  const expected = aggregateOrders(records, validateFilters(filters), Date.now(), 'zhangnan')
  const result = await collect(fixture(records).service)
  assert.equal(result.rows.get('beef').quantity, expected.rows[0].quantity)
  assert.equal(result.rows.get('beef').quantity, 10)
  assert.equal(result.rows.get('beef').amountCents, 25000)
})

test('legacy query still rejects missing timestamps outside the indexed date stream', async () => {
  const result = await collect(fixture([order('selected'), order('unknown-date', { checkoutAt: null })]).service)
  assert.equal(result.error.code, 'SALES_HISTORY_INCOMPLETE')
  assert.match(result.error.message, /unknown-date/)
})

test('legacy audit remains complete when the database caps requested 1000-row pages at 100', async () => {
  const records = Array.from({ length: 1107 }, (_, index) => order(String(index).padStart(5, '0'),
    { checkoutAt: new Date('2020-09-01T00:00:00Z') }))
  records[1106].checkoutAt = undefined
  records[1106].payTime = paidAt
  const result = await collect(fixture(records, {}, { pageCap: 100 }).service)
  assert.equal(result.rows.get('beef').quantity, 1)
  assert.equal(result.data.headerReads, 2214)
  assert.equal(result.data.detailReads, 2)
})

test('money uses integer cents without accumulating floating point errors', async () => {
  const result = await collect(fixture([order('a', { goods: [item({ count: 3, originalPrice: 0.1 })] })]).service)
  assert.equal(result.rows.get('beef').amountCents, 30)
})

test('missing snapshots stop the query, never substitute current price or updateTime', async () => {
  const cases = [
    order('bad-price', { goods: [item({ originalPrice: undefined, isGift: true })] }),
    order('bad-category', { goods: [item({ categoryId: '', categoryName: '' })] }),
    order('bad-time', { checkoutAt: undefined, updateTime: paidAt }),
    order('bad-count', { goods: [item({ count: '2' })] })
  ]
  for (const value of cases) {
    const result = await collect(fixture([value]).service)
    assert.equal(result.error.code, 'SALES_HISTORY_INCOMPLETE')
    assert.ok(result.error.message.includes(value._id))
  }
})

test('inconsistent or missing group-buy package counts stop the query', async () => {
  for (const goods of [[item({ packageId: pins[0].id })], [item({ packageId: pins[0].id, packageCount: 2 }), item({ packageId: pins[0].id, packageCount: 1 })]]) {
    const result = await collect(fixture([order('bad', { goods })]).service, { ...filters, categoryKey: 'group-buy' })
    assert.equal(result.error.code, 'SALES_HISTORY_INCOMPLETE')
  }
})

test('changed records during pagination are rejected before results are declared complete', async () => {
  const { service, data } = fixture([order('a')])
  let cursor = '', changed = false
  while (true) {
    const result = await service.query({ ...filters, adminAuthToken: 'token', cursor })
    if (!result.success) { assert.equal(result.code, 'SALES_DATA_CHANGED'); break }
    assert.equal(result.data.done, false)
    if (result.data.phase === 'verify' && !changed) { data.order[0].goods[0].count = 2; changed = true }
    cursor = result.data.cursor
  }
})

test('continuation cursor is scoped to the admin, tenant, category and date range', async () => {
  const { service } = fixture([order('a')])
  const initial = await service.query({ ...filters, adminAuthToken: 'token' })
  for (const overrides of [{ endDate: '2020-10-02' }, { tenantId: 'other' }, { categoryKey: 'group-buy' }, { adminAuthToken: 'wrong' }]) {
    const result = await service.query({ ...filters, adminAuthToken: 'token', ...overrides, cursor: initial.data.cursor })
    assert.equal(result.success, false)
    assert.match(result.code, /^SALES_CURSOR_/)
  }
})

test('index or network errors return explicit failure rather than zero or partial data', async () => {
  const service = createSalesQueryService({ db: { collection() { throw new Error('index unavailable') } }, _: clauses, getTenantId: () => 'zhangnan' })
  const result = await service.query(filters)
  assert.equal(result.success, false)
  assert.equal(result.code, 'SALES_QUERY_FAILED')
  assert.equal(result.data, undefined)
})
