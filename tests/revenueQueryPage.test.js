const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const salesQuery = require('../miniprogram/utils/salesQuery')
const revenueSummary = require('../miniprogram/utils/revenueSummary')
const source = fs.readFileSync(require.resolve('../miniprogram/packages/admin/pages/admin/business/business.js'), 'utf8')
function page(response) {
  let definition
  const calls = [], toasts = []
  vm.runInNewContext(source, {
    require: name => name.endsWith('apiClient') ? { call: async (action, payload) => {
      calls.push({ action, payload })
      if (response) return response(action, payload)
      return { data: { totalRevenue: 120.25, cashRevenue: 20, onlineRevenue: 100.25 } }
    } } : name.endsWith('revenueSummary') ? revenueSummary : name.endsWith('salesQuery') ? salesQuery : { playClick() {} },
    Page: value => { definition = value }, wx: { showToast: value => toasts.push(value) }, console
  })
  definition.data = structuredClone(definition.data)
  definition.setData = (update, callback) => { Object.assign(definition.data, update); if (callback) callback() }
  definition.data.salesStartDate = '2026-11-01'
  definition.data.salesEndDate = '2026-11-02'
  return { page: definition, calls, toasts }
}

test('revenue entry opens date filters immediately without loading any categories', () => {
  const h = page()
  h.page.openRevenueQuery()
  assert.equal(h.page.data.queryMode, 'revenue')
  assert.equal(h.page.data.salesView, 'filter')
  assert.equal(h.page.data.salesOptionsLoading, false)
  assert.equal(h.calls.length, 0)
  h.page.openSalesDate({ currentTarget: { dataset: { field: 'start' } } })
  assert.equal(h.page.data.salesSelection, 'start')
  assert.equal(h.page.data.salesCalendarMonth, '2026-11')
  h.page.selectSalesDate({ currentTarget: { dataset: { date: '2026-11-02' } } })
  assert.equal(h.page.data.salesStartDate, '2026-11-02')
})

test('query button routes to revenue endpoint without requiring a category and preserves dates on return', async () => {
  const h = page()
  h.page.openRevenueQuery()
  await h.page.submitSalesQuery()
  assert.equal(h.calls[0].action, 'admin.business.revenueQuery')
  assert.equal(h.calls[0].payload.endDate, '2026-11-02')
  assert.equal(h.page.data.salesView, 'result')
  assert.equal(h.page.data.revenueResultTotal, '120.25')
  assert.equal(h.page.data.revenueResultCash, '20.00')
  assert.equal(h.page.data.revenueResultOnline, '100.25')
  assert.equal(h.page.data.revenueResultDates, '2026-11-01 至 2026-11-02')
  h.page.openRevenueQuery()
  assert.equal(h.page.data.salesStartDate, '2026-11-01')
  assert.equal(h.page.data.salesView, 'filter')
})

test('missing or reversed dates stop before sending any request', async () => {
  const h = page()
  h.page.openRevenueQuery()
  h.page.data.salesEndDate = ''
  await h.page.submitSalesQuery()
  assert.equal(h.toasts[0].title, '请选择查询时间段')
  h.page.data.salesEndDate = '2026-10-31'
  await h.page.submitSalesQuery()
  assert.equal(h.toasts[1].title, '结束日期不能早于开始日期')
  assert.equal(h.calls.length, 0)
})

test('cancel or unload during a pending query prevents late results from replacing the page', async () => {
  for (const end of ['cancelSalesQuery', 'onUnload']) {
    let finish
    const h = page(() => new Promise(resolve => { finish = resolve }))
    h.page.openRevenueQuery()
    const pending = h.page.submitSalesQuery()
    assert.equal(h.page.data.salesQuerying, true)
    await h.page.submitSalesQuery()
    assert.equal(h.calls.length, 1)
    h.page[end]()
    finish({ data: { totalRevenue: 10, cashRevenue: 10, onlineRevenue: 0 } })
    await pending
    assert.notEqual(h.page.data.salesView, 'result')
  }
})

test('query failures and malformed results stay in filter view and allow retry', async () => {
  for (const response of [async () => { throw new Error('network failed') }, async () => ({ data: {} })]) {
    const h = page(response)
    h.page.openRevenueQuery()
    await h.page.submitSalesQuery()
    assert.equal(h.page.data.salesView, 'filter')
    assert.equal(h.page.data.salesQuerying, false)
    assert.ok(h.page.data.salesError)
  }
})

test('returning to sales query still loads categories and requires the category filter', async () => {
  const h = page(async () => ({ data: { categories: [], done: true } }))
  h.page.openRevenueQuery()
  await h.page.openSalesQuery()
  assert.equal(h.page.data.queryMode, 'sales')
  assert.equal(h.calls[0].action, 'admin.business.salesOptions')
  await h.page.submitSalesQuery()
  assert.equal(h.toasts[0].title, '请选择查询品类')
})


test('revenue continuation shows progress and displays totals only after completion', async () => {
  let requests = 0
  const h = page(async () => {
    requests++
    if (requests === 1) return { data: { done: false, cursor: 'next', scannedOrders: 1000, phase: 'verify' } }
    return { data: { done: true, totalRevenue: 12, cashRevenue: 2, onlineRevenue: 10 } }
  })
  h.page.openRevenueQuery()
  await h.page.submitSalesQuery()
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls[1].payload.cursor, 'next')
  assert.equal(h.page.data.salesView, 'result')
  assert.equal(h.page.data.revenueResultTotal, '12.00')
})

test('a stalled revenue continuation stays in filters with an explicit error', async () => {
  const h = page(async () => ({ data: { done: false, cursor: 'same', scannedOrders: 1000 } }))
  h.page.openRevenueQuery()
  await h.page.submitSalesQuery()
  assert.equal(h.calls.length, 2)
  assert.equal(h.page.data.salesView, 'filter')
  assert.match(h.page.data.salesError, /查询尚未完成/)
})


test('bounded protocol collects cross-page groups locally and never uploads accumulated records', async () => {
  let count = 0
  const h = page(async (action, payload) => {
    assert.equal(payload.protocol, 2)
    assert.deepEqual(Object.keys(payload).sort(), ['cursor', 'endDate', 'protocol', 'startDate'])
    count++
    const row = { _id: String(count), type: 'order', status: 'completed', checkoutAt: '2026-11-01T10:00:00+08:00', checkoutBatchId: 'one', checkoutReceivable: 121, checkoutCashAmount: 21, checkoutOnlineAmount: 100 }
    return { data: { protocol: 2, orders: count <= 2 ? [row] : [], payments: [], done: count === 3, cursor: count === 3 ? '' : String(count) } }
  })
  h.page.openRevenueQuery()
  await h.page.submitSalesQuery()
  assert.equal(count, 3)
  assert.equal(h.page.data.salesView, 'result')
  assert.equal(h.page.data.revenueResultTotal, '121.00')
  assert.equal(h.page.data.revenueResultCash, '21.00')
  assert.equal(h.page.data.revenueResultOnline, '100.00')
})

test('verification failure after received pages never displays partial totals', async () => {
  let count = 0
  const h = page(async () => {
    if (++count === 2) throw new Error('查询期间结算记录有变化，请重新查询')
    return { data: { protocol: 2, orders: [{ _id: '1' }], payments: [], done: false, cursor: 'next' } }
  })
  h.page.openRevenueQuery()
  await h.page.submitSalesQuery()
  assert.equal(h.page.data.salesView, 'filter')
  assert.match(h.page.data.salesError, /结算记录有变化/)
})
