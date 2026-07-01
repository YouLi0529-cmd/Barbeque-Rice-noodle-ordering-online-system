// packages/user/pages/orderdetail/orderdetail.js
const { getCustomNavOptions } = require('../../../../utils/customNav')

Page({
  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    navContentTop: 0,
    navContentHeight: 44,
    navTitleFontSize: 18,
    navIconSize: 14,
    navIconStroke: 2,
    order: null,
    goods: [],
    empty: false
  },

  onLoad() {
    this.setData(getCustomNavOptions())
    this.loadOrderDetail()
  },

  loadOrderDetail() {
    const order = wx.getStorageSync('selectedOrderDetail')
    if (!order || !order._id) {
      this.setData({ empty: true })
      return
    }

    const goods = this.normalizeGoods(order.goods || [])
    const goodsCount = goods.reduce((sum, item) => sum + (Number(item.count) || 0), 0)
    const finalPrice = order.finalPrice !== undefined && order.finalPrice !== null
      ? order.finalPrice
      : order.totalPrice

    const statusText = order.statusText || this.getOrderStatusText(order)
    const isCampingOrder = order.orderScene === 'camping'

    this.setData({
      order: {
        ...order,
        goodsCount,
        finalPriceText: order.finalPriceText || this.formatPrice(finalPrice),
        statusText,
        statusClass: order.statusClass || this.getOrderStatusClass(order),
        tableNumberText: order.tableNumberText || this.getOrderTableText(order),
        tableNumberValue: this.getTableNumberValue(order),
        orderNoText: this.getOrderNoText(order),
        isSavedOrder: !isCampingOrder && statusText === '已保存',
        isCompletedOrder: !isCampingOrder && statusText === '已完成'
      },
      goods,
      empty: false
    })
  },

  normalizeGoods(goods) {
    return goods.map((item, index) => {
      const dishName = item.dishName || item.goodsName || item.name || '菜品'
      const count = Number(item.count || 1)
      const price = Number(item.price || 0)
      const subtotal = Number(item.subtotal || price * count)
      const tags = Array.isArray(item.tags)
        ? item.tags
        : Array.isArray(item.tagLabels)
          ? item.tagLabels
          : []

      return {
        ...item,
        detailKey: item.dishId || item.goodsId || item._id || `goods-${index}`,
        dishName,
        shortName: dishName.slice(0, 1),
        dishImage: item.dishImage || item.image || item.img || '',
        count,
        subtotalText: this.formatPrice(subtotal),
        tagText: item.tagText || tags.join('、')
      }
    })
  },

  formatPrice(value) {
    const num = Number(value || 0)
    if (Number.isNaN(num)) {
      return '0'
    }
    return Number.isInteger(num) ? String(num) : num.toFixed(2)
  },

  getOrderStatusText(order) {
    const status = Number(order.status)
    if (status === 2) return '已完成'
    if (status === 3) return '已取消'
    if (order.pay_status === false || order.savedOnly === true || order.isDraft === true) {
      return '已保存'
    }
    return '已提交'
  },

  getOrderStatusClass(order) {
    const statusText = this.getOrderStatusText(order)
    if (statusText === '已保存') return 'status-saved'
    if (statusText === '已完成') return 'status-done'
    if (statusText === '已取消') return 'status-cancel'
    return 'status-submitted'
  },

  getOrderTableText(order) {
    if (order.orderScene === 'camping') {
      return '露营订单'
    }
    const tableNumber = order.tableNumber || order.tableCode || order.tableName || ''
    return tableNumber ? `桌位号：${tableNumber}` : '未绑定桌位'
  },

  getTableNumberValue(order) {
    if (order.orderScene === 'camping') {
      return '露营订单'
    }
    return order.tableNumber || order.tableCode || order.tableName || '未绑定'
  },

  getOrderNoText(order) {
    return order.rootOrderId || order._id || order.orderId || '暂无'
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    wx.redirectTo({
      url: '/packages/user/pages/myorder/myorder'
    })
  }
})
