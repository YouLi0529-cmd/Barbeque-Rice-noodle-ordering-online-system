const test = require('node:test')
const assert = require('node:assert/strict')
const { getArrivalTableCountKey } = require('../cloudfunctions/tenantApi/tableArrivalCount')

test('joined tables count once even when each side has a different visit id', () => {
  const keys = new Set([
    getArrivalTableCountKey({ tableGroupId: 'merge-6-7', tableVisitId: 'visit-6', rootOrderId: 'order-6' }),
    getArrivalTableCountKey({ tableGroupId: 'merge-6-7', tableVisitId: 'visit-7', rootOrderId: 'order-7' })
  ])

  assert.equal(keys.size, 1)
  assert.equal([...keys][0], 'table-group:merge-6-7')
})

test('settled checkout batch is the shared key for a joined table', () => {
  const keys = new Set([
    getArrivalTableCountKey({ checkoutBatchId: 'checkout-55', tableGroupId: 'merge-6-7', tableVisitId: 'visit-6' }),
    getArrivalTableCountKey({ checkoutBatchId: 'checkout-55', tableGroupId: 'merge-6-7', tableVisitId: 'visit-7' })
  ])

  assert.equal(keys.size, 1)
  assert.equal([...keys][0], 'checkout:checkout-55')
})

test('transferred orders and their active session resolve to one dining visit', () => {
  const rootOrderGroupKeys = { 'root-order': 'visit:visit-after-transfer' }
  const orderKey = getArrivalTableCountKey({
    rootOrderId: 'root-order',
    tableVisitId: 'visit-after-transfer'
  }, { rootOrderGroupKeys })
  const sessionKey = getArrivalTableCountKey({
    _id: 'session-4',
    activeOrderRootId: 'root-order',
    visitId: 'visit-after-transfer'
  }, { isSession: true, rootOrderGroupKeys })

  assert.equal(orderKey, sessionKey)
  assert.equal(orderKey, 'visit:visit-after-transfer')
})

test('an active session for a joined table follows its order group over its local visit id', () => {
  const rootOrderGroupKeys = { 'joined-root': 'table-group:merge-6-7' }
  const joinedOrderKey = getArrivalTableCountKey({
    tableGroupId: 'merge-6-7',
    tableVisitId: 'visit-6'
  }, { rootOrderGroupKeys })
  const otherTableSessionKey = getArrivalTableCountKey({
    _id: 'session-7',
    activeOrderRootId: 'joined-root',
    visitId: 'visit-7'
  }, { isSession: true, rootOrderGroupKeys })

  assert.equal(joinedOrderKey, otherTableSessionKey)
  assert.equal(joinedOrderKey, 'table-group:merge-6-7')
})

test('ordinary tables remain distinct by visit, with session fallback when no visit exists', () => {
  assert.notEqual(
    getArrivalTableCountKey({ rootOrderId: 'order-1', tableVisitId: 'visit-1' }),
    getArrivalTableCountKey({ rootOrderId: 'order-2', tableVisitId: 'visit-2' })
  )
  assert.equal(
    getArrivalTableCountKey({ _id: 'session-empty', tableNumber: '5' }, { isSession: true }),
    'session:session-empty'
  )
})
