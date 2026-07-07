// packages/user/pages/orderdetail/orderdetail.js
const { getCustomNavOptions } = require('../../../../utils/customNav')
const apiClient = require('../../../../utils/apiClient')

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

  async loadOrderDetail() {
    let order = wx.getStorageSync('selectedOrderDetail')
    if (!order || !order._id) {
      this.setData({ empty: true })
      return
    }

    if (apiClient.isEnabled()) {
      try {
        const result = await apiClient.call('order.detail', {
          orderId: order._id,
          rootOrderId: order.rootOrderId || order._id
        })
        const orders = result.data || []
        if (orders.length > 0) {
          order = this.mergeOrderGroup(orders)
        }
      } catch (err) {
        console.error('刷新订单详情失败', err)
      }
    }

    if (this.isExpiredSavedOrder(order)) {
      wx.removeStorageSync('selectedOrderDetail')
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
        createTimeText: order.createTimeText || this.formatTime(order.createTime),
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

  mergeOrderGroup(orders) {
    const rootOrderId = orders[0].rootOrderId || orders[0]._id
    const rootOrder = orders.find(item => item._id === rootOrderId || item.isAddOnOrder !== true) || orders[0]
    const goods = orders.reduce((list, item) => {
      return list.concat(Array.isArray(item.goods) ? item.goods : [])
    }, [])
    const totalPrice = orders.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0)
    const finalPrice = orders.reduce((sum, item) => {
      return sum + Number(item.finalPrice || item.totalPrice || 0)
    }, 0)

    return {
      ...rootOrder,
      rootOrderId,
      orderIds: orders.map(item => item._id).filter(Boolean),
      goods,
      totalPrice,
      finalPrice,
      pay_status: orders.every(item => item.pay_status !== false),
      status: this.getMergedStatus(orders)
    }
  },

  getMergedStatus(orders) {
    if (orders.length > 0 && orders.every(order => this.isOrderCancelled(order))) return 'cancelled'
    if (orders.length > 0 && orders.every(order => this.isOrderCompleted(order))) return 'completed'
    const rootOrder = orders.find(order => order.isAddOnOrder !== true) || orders[0] || {}
    return rootOrder.status
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

  formatTime(time) {
    if (!time) return ''
    const source = time && time.$date ? time.$date : time
    const date = source instanceof Date ? source : new Date(source)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (n) => (n < 10 ? '0' + n : n)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  },

  getTimeValue(time) {
    if (!time) return 0
    const source = time && time.$date ? time.$date : time
    const date = source instanceof Date ? source : new Date(source)
    const value = date.getTime()
    return Number.isNaN(value) ? 0 : value
  },

  isSavedOrder(order) {
    return order && (order.savedOnly === true || order.isDraft === true || !!order.expiresAt)
  },

  isExpiredSavedOrder(order) {
    if (!this.isSavedOrder(order)) {
      return false
    }
    const expiresAt = this.getTimeValue(order.expiresAt)
    return expiresAt > 0 && expiresAt <= Date.now()
  },

  isOrderCompleted(order) {
    const status = String(order && order.status != null ? order.status : '').toLowerCase()
    return !!order && (
      order.pay_status === true ||
      order.payStatus === true ||
      order.checkoutStatus === 'finished' ||
      status === 'completed' ||
      status === 'paid' ||
      Number(order.status) === 2
    )
  },

  isOrderCancelled(order) {
    const status = String(order && order.status != null ? order.status : '').toLowerCase()
    return !!order && (
      status === 'cancelled' ||
      Number(order.status) === 3
    )
  },

  getOrderStatusText(order) {
    if (this.isSavedOrder(order)) {
      return '已保存'
    }
    if (this.isOrderCompleted(order)) return '已完成'
    if (this.isOrderCancelled(order)) return '已取消'
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
