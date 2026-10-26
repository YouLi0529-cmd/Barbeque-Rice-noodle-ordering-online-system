'use strict'

const crypto = require('crypto')

function normalizeBillVersion(value) {
  if (value === undefined || value === null) return 0
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('invalid bill version')
  return number
}

function nextBillVersion(session) {
  const current = normalizeBillVersion(session && session.billVersion)
  if (current >= Number.MAX_SAFE_INTEGER) throw new Error('bill version exhausted')
  return current + 1
}

function getBillSnapshot(session) {
  const visitId = String(session && session.visitId || '').trim()
  if (!visitId) return null
  try {
    return { visitId, billVersion: normalizeBillVersion(session.billVersion) }
  } catch (_) {
    return null
  }
}

function matchesBillSnapshot(session, snapshot) {
  const current = getBillSnapshot(session)
  if (!current || !snapshot || typeof snapshot !== 'object') return false
  if (!Number.isSafeInteger(snapshot.billVersion) || snapshot.billVersion < 0) return false
  return current.visitId === String(snapshot.visitId || '').trim() &&
    current.billVersion === snapshot.billVersion
}

function getOrderBillFingerprint(order) {
  if (!order) return ''
  return JSON.stringify({
    id: order._id || '',
    tableNumber: order.tableNumber || '',
    tableVisitId: order.tableVisitId || '',
    rootOrderId: order.rootOrderId || '',
    tableGroupId: order.tableGroupId || '',
    status: order.status,
    deleted: order.deleted === true,
    tableCleared: order.tableCleared === true,
    payStatus: order.payStatus === true,
    pay_status: order.pay_status === true,
    totalPrice: order.totalPrice,
    finalPrice: order.finalPrice,
    goods: order.goods
  })
}

function getCheckoutBillDigest(orders) {
  const rows = (orders || []).map(order => ({
    id: String(order._id || ''), tableNumber: order.tableNumber, tableVisitId: order.tableVisitId,
    rootOrderId: order.rootOrderId, tableGroupId: order.tableGroupId, status: order.status,
    deleted: order.deleted, tableCleared: order.tableCleared, payStatus: order.payStatus,
    pay_status: order.pay_status, totalPrice: order.totalPrice, finalPrice: order.finalPrice,
    goods: (Array.isArray(order.goods) ? order.goods : []).map(item => Object.keys(item || {}).sort().reduce((out, key) => {
      if (!/^kitchen/i.test(key)) out[key] = item[key]
      return out
    }, {}))
  })).sort((a, b) => a.id.localeCompare(b.id))
  return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')
}

module.exports = { normalizeBillVersion, nextBillVersion, getBillSnapshot, matchesBillSnapshot, getOrderBillFingerprint, getCheckoutBillDigest }
