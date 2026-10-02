const test = require('node:test')
const assert = require('node:assert/strict')
const sharedCartSync = require('../miniprogram/utils/sharedCartSync')
const customerReceiptState = require('../cloudfunctions/tenantApi/customerReceiptState')

test('retries a transient shared-cart write and resolves after confirmation', async () => {
  let attempts = 0
  const result = await sharedCartSync.retryWithBackoff(async () => {
    attempts += 1
    if (attempts < 2) throw new Error('temporary network failure')
    return { success: true, cartVersion: 4 }
  }, { maxAttempts: 3, delays: [0, 0] })

  assert.equal(attempts, 2)
  assert.equal(result.cartVersion, 4)
})

test('stops after the configured retry limit', async () => {
  let attempts = 0
  await assert.rejects(() => sharedCartSync.retryWithBackoff(async () => {
    attempts += 1
    throw new Error('offline')
  }, { maxAttempts: 3, delays: [0, 0] }), /offline/)
  assert.equal(attempts, 3)
})

test('matches exact cart keys and quantities before allowing order submission', () => {
  const cart = {
    dishA: { count: 1 },
    dishB: { count: 3 },
    dishC: { count: 4 }
  }
  const serverItems = [
    { cartKey: 'dishA', count: 1 },
    { cartKey: 'dishB', count: 3 },
    { cartKey: 'dishC', count: 4 }
  ]

  assert.equal(sharedCartSync.hasSameCartCounts(cart, serverItems), true)
  assert.equal(sharedCartSync.hasSameCartCounts(cart, serverItems.map(item => (
    item.cartKey === 'dishB' ? { ...item, count: 1 } : item
  ))), false)
  assert.equal(sharedCartSync.hasSameCartCounts(cart, serverItems.slice(0, 2)), false)
})

test('customer receipt anchor ignores display labels and uses the first committed order', () => {
  const firstOrder = customerReceiptState.getCustomerReceiptOrderId({}, 'order-first')
  const laterAddOn = customerReceiptState.getCustomerReceiptOrderId({
    activeOrderRootId: firstOrder,
    addOnCount: 5
  }, 'order-add-on-6', firstOrder)

  assert.equal(firstOrder, 'order-first')
  assert.equal(laterAddOn, firstOrder)
  assert.equal(customerReceiptState.getCustomerReceiptEventKey(firstOrder), 'auto-submit:order-first')
})

test('a missing task stays pending while an existing queued task survives later orders', () => {
  const pending = customerReceiptState.buildCustomerReceiptSessionFields({}, 'order-first')
  const queued = customerReceiptState.buildCustomerReceiptSessionFields({
    customerReceiptOrderId: 'order-first',
    customerReceiptStatus: 'queued',
    customerReceiptJobIds: ['print-job-1'],
    customerReceiptAttemptCount: 2
  }, 'order-first')
  const newVisit = customerReceiptState.buildCustomerReceiptSessionFields({
    customerReceiptOrderId: 'old-order',
    customerReceiptStatus: 'queued',
    customerReceiptJobIds: ['old-job']
  }, 'new-order')

  assert.equal(pending.customerReceiptStatus, 'pending')
  assert.equal(queued.customerReceiptStatus, 'queued')
  assert.deepEqual(queued.customerReceiptJobIds, ['print-job-1'])
  assert.equal(newVisit.customerReceiptStatus, 'pending')
  assert.deepEqual(newVisit.customerReceiptJobIds, [])
})

test('customer receipt task creation retries with the same idempotency event', async () => {
  let attempts = 0
  const eventKeys = []
  const eventKey = customerReceiptState.getCustomerReceiptEventKey('first-order')
  const result = await customerReceiptState.retryCustomerReceiptQueue(async () => {
    attempts += 1
    eventKeys.push(eventKey)
    if (attempts === 1) return { jobs: [], error: 'temporary database error' }
    return { jobs: [{ _id: 'stable-print-job', status: 'queued' }], skipped: false }
  }, { maxAttempts: 3, delays: [0, 0], wait: async () => {} })

  assert.equal(attempts, 2)
  assert.deepEqual(eventKeys, [eventKey, eventKey])
  assert.equal(result.jobs[0]._id, 'stable-print-job')
})

test('unavailable cashier printer remains pending without repeated queue attempts', async () => {
  let attempts = 0
  const result = await customerReceiptState.retryCustomerReceiptQueue(async () => {
    attempts += 1
    return { jobs: [], skipped: true, reason: 'cashier printer unavailable' }
  }, { maxAttempts: 3, delays: [0, 0], wait: async () => {} })

  assert.equal(attempts, 1)
  assert.equal(result.skipped, true)
})

test('a receipt queue failure remains pending after bounded retries', async () => {
  let attempts = 0
  const result = await customerReceiptState.retryCustomerReceiptQueue(async () => {
    attempts += 1
    return { jobs: [], error: 'temporary database error' }
  }, { maxAttempts: 3, delays: [0, 0], wait: async () => {} })

  assert.equal(attempts, 3)
  assert.equal(result.jobs.length, 0)
  assert.match(result.error, /temporary database error/)
})
