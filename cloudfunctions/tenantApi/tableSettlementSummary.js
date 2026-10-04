function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function getTableSettlementSummary(orders = []) {
  const batches = new Map()
  ;(orders || []).filter(order => order && (
    order.pay_status === true ||
    order.payStatus === true ||
    order.status === 'paid' ||
    order.status === 'completed'
  ) && order.deleted !== true).forEach(order => {
    const batchId = String(order.checkoutBatchId || '').trim()
    const key = batchId || String(order.rootOrderId || order._id || '')
    if (!key) return
    if (!batches.has(key)) batches.set(key, [])
    batches.get(key).push(order)
  })
  if (!batches.size) return null

  let originalTotal = 0
  let receivedTotal = 0
  batches.forEach(batchOrders => {
    const storedOriginal = batchOrders.map(order => Number(order.checkoutTotalPrice))
      .filter(value => Number.isFinite(value) && value >= 0)
    const original = storedOriginal.length
      ? Math.max(...storedOriginal)
      : roundMoney(batchOrders.reduce((sum, order) => sum + Number(order.finalPrice || order.totalPrice || 0), 0))
    const storedReceived = batchOrders.map(order => Number(
      order.checkoutReceivable !== undefined && order.checkoutReceivable !== ''
        ? order.checkoutReceivable
        : order.receivedAmount
    )).filter(value => Number.isFinite(value) && value >= 0)
    const received = storedReceived.length ? Math.max(...storedReceived) : original
    originalTotal = roundMoney(originalTotal + original)
    receivedTotal = roundMoney(receivedTotal + received)
  })
  return {
    originalTotal,
    reductionTotal: roundMoney(Math.max(0, originalTotal - receivedTotal)),
    receivedTotal
  }
}

module.exports = { getTableSettlementSummary }
