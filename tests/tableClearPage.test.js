const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const source = fs.readFileSync(require.resolve('../miniprogram/packages/admin/pages/admin/table/table.js'), 'utf8')
const method = source.slice(source.indexOf('  async confirmClearTable() {'), source.indexOf('\n  async transferToTable('))
function page({ confirm = true, failClear = false, merged = false, failPreview = false, failModal = false, unpaid = true, cart = true, ordering = true, noState = false } = {}) {
  const calls = [], dialogs = [], toasts = []
  let refreshed = 0
  const selected = { one: { areaKey: 'normal', tableNumber: '01' } }
  if (merged) selected.two = { areaKey: 'normal', tableNumber: '02' }
  const context = {
    UI: { clearSuccess: '已清台', clearSelectFirst: '请选桌', clearFailed: '失败' }, console: { error() {} },
    apiClient: { async call(action, payload) {
      calls.push({ action, payload })
      if (action === 'admin.table.clearPreview' && noState) throw Object.assign(new Error('该桌暂无需要清除的状态'), { code: 'NO_TABLE_STATE' })
      if (action === 'admin.table.clearPreview' && failPreview) throw { errMsg: 'request:fail timeout' }
      if (action === 'admin.table.clearPreview') return { data: {
        confirmationToken: 'snapshot', unpaidOrderCount: unpaid ? 1 : 0, unpaidAmount: unpaid ? 25 : 0, cartItemCount: cart ? 1 : 0,
        ordering, kitchenWarning: unpaid,
        tables: merged ? [{ areaKey: 'normal', tableNumber: '01', label: '01号桌' },
          { areaKey: 'normal', tableNumber: '02', label: '02号桌' }] : [{ areaKey: 'normal', tableNumber: '01', label: '01号桌' }]
      } }
      if (failClear) throw Object.assign(new Error('用餐已变化'), { code: 'TABLE_CLEAR_STATE_CHANGED' })
      return { success: true }
    } },
    wx: { showLoading() {}, hideLoading() {}, showToast(value) { toasts.push(value) }, showModal(value) {
      dialogs.push(value)
      if (String(value.confirmText || '').length > 4 || String(value.cancelText || '').length > 4) {
        value.fail({ errMsg: 'showModal:fail confirmText length should not larger than 4' })
        return
      }
      if (failModal) {
        value.fail({ errMsg: 'showModal:fail injected dialog failure' })
        return
      }
      value.success({ confirm })
    } }
  }
  const result = vm.runInNewContext('({' + method + '})', context)
  result.data = { selectedTableMap: selected, clearingTable: false }
  result.setData = update => Object.assign(result.data, update)
  result.loadTables = async () => { refreshed++ }
  return { result, calls, dialogs, toasts, get refreshed() { return refreshed } }
}

test('canceling force clear only previews and displays amount, group and kitchen warning', async () => {
  const h = page({ confirm: false, merged: true })
  await h.result.confirmClearTable()
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].action, 'admin.table.clearPreview')
  assert.match(h.dialogs[0].content, /01号桌、02号桌/)
  assert.match(h.dialogs[0].content, /25.00/)
  assert.match(h.dialogs[0].content, /后厨/)
  assert.equal(h.result.data.clearingTable, false)
})

test('a selected merge group executes once with the confirmed snapshot', async () => {
  const h = page({ merged: true })
  await h.result.confirmClearTable()
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls[1].action, 'admin.table.clear')
  assert.equal(h.calls[1].payload.confirmationToken, 'snapshot')
  assert.equal(h.calls[1].payload.confirm, true)
  assert.equal(h.result.data.selectedTableCount, 0)
  assert.equal(h.refreshed, 1)
})

test('a rejected clear immediately reloads table colors and keeps the selection for review', async () => {
  const h = page({ failClear: true })
  await h.result.confirmClearTable()
  assert.equal(h.refreshed, 1)
  assert.equal(h.toasts[0].title, '用餐已变化')
  assert.ok(h.result.data.selectedTableMap.one)
  assert.equal(h.result.data.clearingTable, false)
})


test('preview timeout reports the failure, never clears orders, and releases the button', async () => {
  const h = page({ failPreview: true })
  await h.result.confirmClearTable()
  assert.equal(h.dialogs.length, 0)
  assert.equal(h.calls.length, 1)
  assert.match(h.toasts[0].title, /清台请求超时/)
  assert.equal(h.result.data.clearingTable, false)
  assert.equal(h.refreshed, 1)
})


test('modal API failure is reported instead of silently treated as a user cancellation', async () => {
  const h = page({ failModal: true })
  await h.result.confirmClearTable()
  assert.equal(h.calls.length, 1)
  assert.match(h.toasts[0].title, /清台确认框未能打开/)
  assert.ok(h.result.data.selectedTableMap.one)
  assert.equal(h.result.data.clearingTable, false)
})


for (const scenario of [
  { name: 'paid table', unpaid: false, cart: false, ordering: false },
  { name: 'abandoned ordering session', unpaid: false, cart: true, ordering: true },
  { name: 'unpaid table', unpaid: true, cart: false },
  { name: 'merged unpaid tables', merged: true, unpaid: true }
]) {
  test(`${scenario.name}: confirmation buttons meet native limits and clear can execute`, async () => {
    const h = page(scenario)
    await h.result.confirmClearTable()
    assert.equal(h.dialogs.length, 1)
    assert.equal(h.dialogs[0].confirmText, scenario.unpaid ? '作废清台' : '确认清台')
    assert.ok(h.dialogs[0].confirmText.length <= 4)
    assert.ok(String(h.dialogs[0].cancelText || '取消').length <= 4)
    assert.equal(h.calls.at(-1).action, 'admin.table.clear')
    assert.equal(h.toasts.at(-1).title, '已清台')
  })
}

test('already-cleared table displays a completion hint without requesting another clear', async () => {
  const h = page({ noState: true })
  await h.result.confirmClearTable()
  assert.equal(h.dialogs.length, 0)
  assert.equal(h.calls.length, 1)
  assert.equal(h.toasts[0].title, '所选桌台已清台')
  assert.equal(h.result.data.clearingTable, false)
})

test('no selection and a repeated click during clear do not start a clear request', async () => {
  const h = page()
  h.result.data.selectedTableMap = {}
  await h.result.confirmClearTable()
  assert.equal(h.toasts[0].title, '请选桌')
  assert.equal(h.calls.length, 0)
  h.result.data.clearingTable = true
  await h.result.confirmClearTable()
  assert.equal(h.calls.length, 0)
})
