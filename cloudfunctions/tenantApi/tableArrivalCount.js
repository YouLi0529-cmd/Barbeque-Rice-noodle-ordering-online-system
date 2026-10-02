function text(value) {
  return String(value || '').trim()
}

function getArrivalTableCountKey(record = {}, options = {}) {
  const isSession = options.isSession === true
  const rootOrderGroupKeys = options.rootOrderGroupKeys || {}
  const checkoutBatchId = text(record.checkoutBatchId)
  if (checkoutBatchId) return `checkout:${checkoutBatchId}`

  const tableGroupId = text(record.tableGroupId)
  if (tableGroupId) return `table-group:${tableGroupId}`

  const rootOrderId = text(isSession
    ? record.activeOrderRootId
    : (record.rootOrderId || record._id))
  const linkedGroupKey = rootOrderId ? text(rootOrderGroupKeys[rootOrderId]) : ''
  if (linkedGroupKey.startsWith('table-group:')) return linkedGroupKey

  const visitId = text(isSession ? record.visitId : record.tableVisitId)
  if (visitId) return `visit:${visitId}`
  if (linkedGroupKey) return linkedGroupKey
  if (rootOrderId) return `order:${rootOrderId}`

  const sessionId = text(record._id || record.tableNumber)
  return sessionId ? `session:${sessionId}` : ''
}

module.exports = { getArrivalTableCountKey }
