const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const helpers = require('../miniprogram/utils/salesQuery')

function pageHarness(call) {
  let definition
  const messages = []
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../miniprogram/packages/admin/pages/admin/business/business.js'), 'utf8'), {
    require: name => name.includes('apiClient') ? { call } : name.includes('salesQuery') ? helpers : {},
    Page: value => { definition = value }, wx: { showToast: value => messages.push(value.title) }, console
  })
  const page = { ...definition, data: JSON.parse(JSON.stringify(definition.data)) }
  page.setData = (data, callback) => { Object.assign(page.data, data); if (callback) callback() }
  return { page, messages }
}

test('inline calendar opens both fields, handles leap years, month navigation and future dates', () => {
  const { page } = pageHarness(() => {})
  page.data.salesTodayDate = '2024-03-10'
  page.data.salesStartDate = '2024-02-28'
  page.openSalesDate({ currentTarget: { dataset: { field: 'start' } } })
  assert.equal(page.data.salesSelection, 'start')
  assert.equal(page.data.salesCalendarMonth, '2024-02')
  assert.equal(page.data.salesCalendarDays.filter(day => day.date).length, 29)
  page.selectSalesDate({ currentTarget: { dataset: { date: '2024-02-29' } } })
  assert.equal(page.data.salesStartDate, '2024-02-29')
  assert.equal(page.data.salesSelection, '')
  page.openSalesDate({ currentTarget: { dataset: { field: 'end' } } })
  assert.equal(page.data.salesCalendarMonth, '2024-03')
  page.selectSalesDate({ currentTarget: { dataset: { date: '2024-03-11' } } })
  assert.equal(page.data.salesEndDate, '')
  page.changeSalesMonth({ currentTarget: { dataset: { step: 1 } } })
  assert.equal(page.data.salesCalendarMonth, '2024-03')
  page.changeSalesMonth({ currentTarget: { dataset: { step: -1 } } })
  assert.equal(page.data.salesCalendarMonth, '2024-02')
  page.selectSalesDate({ currentTarget: { dataset: { date: '2024-02-29' } } })
  assert.equal(page.data.salesEndDate, '2024-02-29')
})

test('inline category choices select by identity and are blocked during queries', () => {
  const { page } = pageHarness(() => {})
  page.data.salesCategories = [{ key: 'group-buy', label: '团购' }, { key: 'category:a', label: '肉类' }]
  page.toggleSalesCategories()
  assert.equal(page.data.salesSelection, 'category')
  page.selectSalesCategory({ currentTarget: { dataset: { key: 'category:a' } } })
  assert.equal(page.data.salesCategoryKey, 'category:a')
  assert.equal(page.data.salesCategoryLabel, '肉类')
  assert.equal(page.data.salesSelection, '')
  page.data.salesQuerying = true
  page.toggleSalesCategories()
  assert.equal(page.data.salesSelection, '')
  page.selectSalesCategory({ currentTarget: { dataset: { key: 'group-buy' } } })
  assert.equal(page.data.salesCategoryKey, 'category:a')
})

test('page validates required dates, chronological order, and category before requesting data', async () => {
  const { page, messages } = pageHarness(() => { throw new Error('must not request') })
  await page.submitSalesQuery()
  page.data.salesStartDate = '2020-10-02'
  page.data.salesEndDate = '2020-10-01'
  await page.submitSalesQuery()
  page.data.salesEndDate = '2020-10-03'
  await page.submitSalesQuery()
  assert.deepEqual(messages, ['请选择查询时间段', '结束日期不能早于开始日期', '请选择查询品类'])
})

test('latest categories preserve management sort, rename by ID, and group buys first', async () => {
  let optionsPage = 0
  const { page } = pageHarness(async action => {
    assert.equal(action, 'admin.business.salesOptions')
    optionsPage++
    return { data: optionsPage === 1 ? { categories: [
      { key: 'category:a', name: '新名称', sort: 2, historical: false },
      { key: 'category:b', name: '新分类', sort: 1, historical: false }
    ], done: false, cursor: 'next' } : { categories: [
      { key: 'category:a', name: '旧名称', historical: true }, { key: 'category:gone', name: '已删除分类', historical: true }
    ], done: true } }
  })
  page.data.salesStartDate = '2020-10-01'
  page.data.salesEndDate = '2020-10-02'
  page.data.salesCategoryKey = 'category:a'
  await page.openSalesQuery()
  assert.deepEqual(page.data.salesCategories.map(value => value.label), ['团购', '新分类', '新名称', '已删除分类（历史分类）'])
  assert.equal(page.data.salesCategoryIndex, 2)
  assert.equal(page.data.salesStartDate, '2020-10-01')
  assert.equal(page.data.salesEndDate, '2020-10-02')
})

test('results are hidden until every page and verification has completed', async () => {
  let calls = 0
  let page
  const responses = [
    { rows: [{ id: 'a', name: '牛肉', quantity: 2, amountCents: 4000 }], cursor: 'orders-2', done: false, phase: 'orders' },
    { rows: [{ id: 'a', name: '牛肉', quantity: 3, amountCents: 7500 }], cursor: 'verify', done: false, phase: 'verify' },
    { rows: [], done: true, phase: 'verify' }
  ]
  const h = pageHarness(async (action, payload) => {
    assert.equal(action, 'admin.business.salesQuery')
    assert.equal(payload.startDate, '2020-10-01')
    assert.equal(page.data.salesView, 'filter')
    assert.equal(page.data.salesRows.length, 0)
    return { data: responses[calls++] }
  })
  page = h.page
  Object.assign(page.data, { salesView: 'filter', salesStartDate: '2020-10-01', salesEndDate: '2020-10-01', salesCategoryKey: 'category:a', salesCategoryLabel: '肉类' })
  await page.submitSalesQuery()
  assert.equal(calls, 3)
  assert.equal(page.data.salesView, 'result')
  assert.equal(page.data.salesTotalQuantity, 5)
  assert.equal(page.data.salesTotalAmount, '115.00')
})

test('verification failure discards partial sums and shows the backend error', async () => {
  let calls = 0
  const { page } = pageHarness(async () => {
    if (++calls === 1) return { data: { rows: [{ id: 'a', name: '牛肉', quantity: 1, amountCents: 2500 }], done: false, cursor: 'next' } }
    throw new Error('查询期间结算记录有变化，请重新查询')
  })
  Object.assign(page.data, { salesView: 'filter', salesStartDate: '2020-10-01', salesEndDate: '2020-10-01', salesCategoryKey: 'category:a' })
  await page.submitSalesQuery()
  assert.equal(page.data.salesView, 'filter')
  assert.equal(page.data.salesRows.length, 0)
  assert.equal(page.data.salesError, '查询期间结算记录有变化，请重新查询')
})

test('cancel prevents an in-flight response from reopening results', async () => {
  let resolve
  const { page } = pageHarness(() => new Promise(done => { resolve = done }))
  Object.assign(page.data, { salesView: 'filter', salesStartDate: '2020-10-01', salesEndDate: '2020-10-01', salesCategoryKey: 'group-buy' })
  const running = page.submitSalesQuery()
  page.cancelSalesQuery()
  resolve({ data: { rows: [], done: true } })
  await running
  assert.equal(page.data.salesView, '')
  assert.equal(page.data.salesQuerying, false)
})

test('group-buy result uses counts while cents and malformed response data are checked', () => {
  const map = new Map()
  helpers.mergeSalesRows(map, [{ id: 'a', name: '套餐', quantity: 2, amountCents: 0 }])
  const result = helpers.buildSalesResult(map)
  assert.equal(result.quantity, 2)
  assert.equal(result.amountText, '0.00')
  assert.throws(() => helpers.mergeSalesRows(map, [{ id: 'bad', quantity: 1 }]), /不完整/)
  assert.equal(helpers.validateSalesFilters('2020-02-30', '2020-03-01', 'group-buy'), '查询日期无效')
})
