function hasOrderableGoods(order = {}) {
  return Array.isArray(order.goods) && order.goods.some(item =>
    item && Math.floor(Number(item.count) || 0) > 0
  )
}

module.exports = { hasOrderableGoods }
