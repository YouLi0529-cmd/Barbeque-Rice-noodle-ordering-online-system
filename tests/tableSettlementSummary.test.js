const assert = require('node:assert/strict')
const { test } = require('node:test')
const { getTableSettlementSummary } = require('../cloudfunctions/tenantApi/tableSettlementSummary')

test('uses the saved receivable once for a multi-order checkout batch', () => {
  const orders = [
    { _id: 'a', status: 'completed', checkoutBatchId: 'checkout-1', finalPrice: 200, checkoutTotalPrice: 316, checkoutReceivable: 310 },
    { _id: 'b', status: 'completed', checkoutBatchId: 'checkout-1', finalPrice: 116, checkoutTotalPrice: 316, checkoutReceivable: 310 }
  ]
  assert.deepEqual(getTableSettlementSummary(orders), {
    originalTotal: 316,
    reductionTotal: 6,
    receivedTotal: 310
  })
})

test('adds separate checkout batches and ignores unpaid orders', () => {
  const orders = [
    { _id: 'a', status: 'paid', checkoutBatchId: 'checkout-1', checkoutTotalPrice: 100, checkoutReceivable: 90 },
    { _id: 'b', status: 'paid', checkoutBatchId: 'checkout-2', checkoutTotalPrice: 50, checkoutReceivable: 50 },
    { _id: 'c', status: 'submitted', finalPrice: 70 }
  ]
  assert.deepEqual(getTableSettlementSummary(orders), {
    originalTotal: 150,
    reductionTotal: 10,
    receivedTotal: 140
  })
})

test('recognizes legacy paid flags when status was not normalized', () => {
  assert.deepEqual(getTableSettlementSummary([
    { _id: 'legacy', status: 'submitted', payStatus: true, checkoutTotalPrice: 316, receivedAmount: 310 }
  ]), {
    originalTotal: 316,
    reductionTotal: 6,
    receivedTotal: 310
  })
})
