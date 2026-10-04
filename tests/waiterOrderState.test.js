const test = require('node:test')
const assert = require('node:assert/strict')
const { hasOrderableGoods } = require('../cloudfunctions/tenantApi/waiterOrderState')

test('empty or fully refunded order does not occupy a table for waiter ordering', () => {
  assert.equal(hasOrderableGoods({ goods: [], status: 'cancelled' }), false)
  assert.equal(hasOrderableGoods({ goods: [{ dishId: 'dish-1', count: 0 }] }), false)
  assert.equal(hasOrderableGoods({ goods: [{ dishId: 'dish-1', count: 1 }] }), true)
})

test('a live order found through the joined table group remains a valid add-on target', () => {
  const groupOrders = [
    { _id: 'order-7', rootOrderId: 'order-7', tableNumber: '7', tableGroupId: 'merge-6-7', goods: [{ count: 2 }] }
  ]
  const activeGroupOrders = groupOrders.filter(hasOrderableGoods)

  assert.equal(activeGroupOrders.length, 1)
  assert.equal(activeGroupOrders[0].rootOrderId, 'order-7')
})
