const { hasOrderableGoods } = require('./waiterOrderState')

function isPaid(order) {
  return order.payStatus === true || order.pay_status === true || ['paid', 'completed'].includes(order.status)
}

// A refunded first order may remain the identity of a visit. It is not a
// payable line, and must not be reactivated or assigned another visit's dishes.
function isRefundedVisitRoot(root, session) {
  return !!(root && session && root.type === 'order' && root.status === 'cancelled' &&
    !root.deleted && !root.tableCleared && !isPaid(root) && Array.isArray(root.goods) && root.goods.length === 0 &&
    Number(root.finalPrice) === 0 && Number(root.totalPrice) === 0 &&
    root._id === session.activeOrderRootId && root.tableVisitId && root.tableVisitId === session.visitId)
}

function hasLiveVisitAddOns(root, session, orders) {
  if (!isRefundedVisitRoot(root, session)) return false
  return orders.some(order => {
    if (!order || order._id === root._id || order.type !== 'order' || order.deleted || order.tableCleared ||
        isPaid(order) || ['cancelled', 'closed', '3'].includes(order.status) || !hasOrderableGoods(order)) return false
    if (order.rootOrderId !== root._id || order.tableVisitId !== session.visitId || order.storeId !== root.storeId) return false
    return order.tableNumber === root.tableNumber ||
      !!(session.tableGroupId && order.tableGroupId === session.tableGroupId && root.tableGroupId === session.tableGroupId)
  })
}

module.exports = { isRefundedVisitRoot, hasLiveVisitAddOns }
