const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const filename = require.resolve('../miniprogram/packages/order/pages/settle/settle.js')
const source = fs.readFileSync(filename, 'utf8')
const notice = '因本店所有菜品为新鲜拌制，上桌后概不退不换，望谅解！'
function harness({ camping = false, addon = false, legacy = false, index = null } = {}) {
  let definition
  const calls = [], dialogs = [], toasts = []
  const response = { success: true, orderId: 'created', order: { totalPrice: 30, finalPrice: 30,
    goods: [{ dishId: 'dish', dishName: '沙葱肥牛', price: 30, count: 1, tags: [] }] } }
  const api = { isEnabled: () => !legacy, async call(action, payload) { calls.push({ action, payload }); return response } }
  const context = {
    getApp: () => ({ globalData: {} }), getCurrentPages: () => index ? [index] : [],
    Page(value) { definition = value }, console: { error() {} }, setTimeout() {},
    require(name) { return name.includes('apiClient') ? api : { getCustomNavOptions: () => ({}) } },
    wx: { getStorageSync() {}, setStorageSync() {}, removeStorageSync() {}, navigateBack() {},
      showToast(value) { toasts.push(value) }, showModal(value) { dialogs.push(value) },
      cloud: { database: () => ({}), async callFunction({ name, data }) {
        calls.push({ action: name, payload: data }); return { result: response }
      } } }
  }
  vm.runInNewContext(source, context)
  const page = { ...definition, data: structuredClone(definition.data) }
  page.setData = update => Object.assign(page.data, update)
  Object.assign(page.data, {
    canSubmit: true, orderScene: camping ? 'camping' : 'dineIn', tableNumber: 'T11',
    sharedSessionId: 'table_T11', tableVisitId: 'visit', sharedCartVersion: 1,
    orderGoods: [{ dishId: 'dish', dishName: '沙葱肥牛', count: 1, price: 30, tags: [] }],
    totalPrice: 30, finalPrice: 30, isAddOnOrder: addon, addOnIndex: addon ? 1 : 0,
    appendToOrderId: addon ? 'root' : '', currentCardTitle: addon ? '加菜单1' : '首单',
    previousOrderCards: addon ? [{ cardId: 'root', title: '首单', goods: [], finalPrice: 42, goodsCount: 7, submitted: true }] : []
  })
  page.loadUserInfoFromDB = async () => {}
  page.deleteOrderDraft = async () => {}
  page.clearCart = () => {}
  page.clearSharedCart = async () => {}
  page.saveActiveOrderSession = () => {}
  return { page, calls, dialogs, toasts, api, response }
}
function sharedIndex() {
  return { route: 'packages/order/pages/index/index', data: {
    sharedCartVersion: 1, cartTotalPrice: 30,
    cart: { dish: { info: { _id: 'dish', name: '沙葱肥牛', price: 30 }, count: 1 } }
  }, async ensureSharedCartReadyForSubmit() {}, async fetchSharedCart() {} }
}

test('first order and every add-on open confirmation without submitting', () => {
  for (const addon of [false, true]) {
    const h = harness({ addon })
    h.page.submitOrder()
    h.page.submitOrder()
    assert.equal(h.page.data.showSubmitConfirmation, true)
    assert.equal(h.page.data.submitting, false)
    assert.equal(h.calls.length, 0)
    assert.ok(h.page.submitConfirmationSnapshot)
  }
})

test('review keeps the current order detail and dishes; confirmation after cancellation does nothing', async () => {
  const h = harness({ addon: true })
  const before = JSON.stringify(h.page.data.orderGoods)
  h.page.submitOrder()
  h.page.cancelSubmitConfirmation()
  await h.page.confirmSubmitOrder()
  assert.equal(h.page.data.showSubmitConfirmation, false)
  assert.equal(JSON.stringify(h.page.data.orderGoods), before)
  assert.equal(h.page.data.currentCardTitle, '加菜单1')
  assert.equal(h.calls.length, 0)
})

test('confirmation acquires a lock before awaiting profile loading and submits once', async () => {
  const h = harness()
  let release
  h.page.loadUserInfoFromDB = () => new Promise(resolve => { release = resolve })
  h.page.submitOrder()
  const submission = h.page.confirmSubmitOrder()
  assert.equal(h.page.data.submitting, true)
  h.page.confirmSubmitOrder()
  h.page.submitOrder()
  assert.equal(h.calls.length, 0)
  release()
  await submission
  assert.equal(h.calls.length, 1)
  assert.equal(h.page.data.orderSubmitted, true)
  h.page.submitOrder()
  assert.equal(h.calls.length, 1)
})

test('camping submits through its existing flow without showing the dine-in notice', async () => {
  for (const legacy of [false, true]) {
    const h = harness({ camping: true, legacy })
    await h.page.submitOrder()
    assert.equal(h.page.data.showSubmitConfirmation, false)
    assert.equal(h.calls.length, 1)
    assert.equal(h.page.data.orderSubmitted, true)
  }
})

test('changed shared dishes update the pending card and require another explicit confirmation', async () => {
  const index = sharedIndex(), h = harness({ addon: true, index })
  h.page.submitOrder()
  index.data.cart.dish.count = 2
  index.data.cartTotalPrice = 60
  index.data.sharedCartVersion = 2
  await h.page.confirmSubmitOrder()
  assert.equal(h.calls.length, 0)
  assert.equal(h.page.data.submitting, false)
  assert.equal(h.page.data.orderGoods[0].count, 2)
  assert.equal(h.page.data.orderCards[1].finalPrice, 60)
  assert.equal(h.page.data.orderCards[0].title, '首单')
  assert.match(h.dialogs[0].content, /菜品已变化，请重新核对/)
  h.page.submitOrder()
  await h.page.confirmSubmitOrder()
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].payload.orderGoods[0].count, 2)
  assert.equal(h.calls[0].payload.cartVersion, 2)
})

test('same-count changes to tags, package or cart version invalidate confirmation', async () => {
  const changes = [
    index => { index.data.cart.dish.tagLabels = ['加辣'] },
    index => { Object.assign(index.data.cart.dish, { packageId: 'package', packageCount: 1 }) },
    index => { index.data.sharedCartVersion = 2 }
  ]
  for (const change of changes) {
    const index = sharedIndex(), h = harness({ index })
    h.page.submitOrder()
    change(index)
    await h.page.confirmSubmitOrder()
    assert.equal(h.calls.length, 0)
    assert.match(h.dialogs[0].content, /重新核对/)
  }
})

test('display-only note prefixes and cart key ordering do not trigger a false change', async () => {
  const index = sharedIndex(), h = harness({ index })
  h.page.data.orderGoods[0].tags = ['少盐']
  index.data.cart.dish.tagLabels = ['备注：少盐']
  h.page.submitOrder()
  await h.page.confirmSubmitOrder()
  assert.equal(h.calls.length, 1)
})

test('a server cart-version race refreshes details and does not automatically resubmit', async () => {
  const index = sharedIndex(), h = harness({ index })
  h.api.call = async (action, payload) => {
    h.calls.push({ action, payload })
    throw Object.assign(new Error('cart changed'), { code: 'SHARED_CART_CHANGED' })
  }
  h.page.submitOrder()
  await h.page.confirmSubmitOrder()
  assert.equal(h.calls.length, 1)
  assert.equal(h.page.data.submitting, false)
  assert.equal(h.page.data.showSubmitConfirmation, false)
  assert.match(h.dialogs[0].content, /重新核对/)
})

test('submission failures release the lock and a retry presents the notice again', async () => {
  const h = harness()
  h.api.call = async () => { throw new Error('network failed') }
  h.page.submitOrder()
  await h.page.confirmSubmitOrder()
  assert.equal(h.page.data.submitting, false)
  assert.equal(h.page.data.orderSubmitted, false)
  h.page.submitOrder()
  assert.equal(h.page.data.showSubmitConfirmation, true)
})

test('leaving the page invalidates an open confirmation', async () => {
  const h = harness()
  h.page.submitOrder()
  h.page.onHide()
  await h.page.confirmSubmitOrder()
  assert.equal(h.page.data.showSubmitConfirmation, false)
  assert.equal(h.calls.length, 0)
})

test('legacy dine-in submission also waits for confirmation', async () => {
  const h = harness({ legacy: true })
  h.page.submitOrder()
  assert.equal(h.calls.length, 0)
  await h.page.confirmSubmitOrder()
  assert.equal(h.calls[0].action, 'doBuy')
})

test('notice copy and white review button are wired in the real page', () => {
  const wxml = fs.readFileSync(filename.replace('.js', '.wxml'), 'utf8')
  const css = fs.readFileSync(filename.replace('.js', '.wxss'), 'utf8')
  assert.ok(wxml.includes(notice))
  assert.match(wxml, /bindtap="cancelSubmitConfirmation">重新核对/)
  assert.match(wxml, /bindtap="confirmSubmitOrder">确认提交/)
  assert.match(wxml, /class="submit-confirm-mask" catchtap="catchSubmitConfirmationTap"/)
  assert.match(css, /\.submit-confirm-review\s*\{[^}]*background: #fff;/)
})
