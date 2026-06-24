// pages/admin/order/order.js
const db = wx.cloud.database()

Page({
  data: {
    orders: [],
    activeFilter: 'all',
    filters: [
      { label: '全部', value: 'all' },
      { label: '堂食', value: 'dineIn' },
      { label: '户外', value: 'outdoor' },
      { label: '未付款', value: 'unpaid' },
      { label: '已付款', value: 'paid' },
      { label: '待配菜', value: 'pending_prepare' },
      { label: '配菜中', value: 'preparing' },
      { label: '待自取', value: 'ready_pickup' },
      { label: '已取餐', value: 'picked_up' },
      { label: '已取消', value: 'cancelled' }
    ],
    loadingOrders: false
  },

  onLoad() {
    this.loadOrders()
  },

  onShow() {
    this.startAutoRefresh()
  },

  onHide() {
    this.clearAutoRefresh()
  },

  onUnload() {
    this.clearAutoRefresh()
  },

  formatTime(time) {
    if (!time) return ''
    const date = time instanceof Date ? time : new Date(time)
    const pad = n => (n < 10 ? `0${n}` : `${n}`)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  },

  mapStatus(status) {
    const map = {
      pending_prepare: '待配菜',
      preparing: '配菜中',
      served: '已出菜',
      ready_pickup: '待自取',
      picked_up: '已取餐',
      waiting_pay: '待买单',
      paid: '已付款',
      cancelled: '已取消',
      0: '待支付',
      1: '处理中',
      2: '已完成',
      3: '已取消'
    }
    return map[status] || status || '处理中'
  },

  getOrderKind(order) {
    if (order.type === 'recharge') return '充值订单'
    if (order.orderType === 'dineIn') return `堂食订单${order.tableNumber ? ` / 桌号 ${order.tableNumber}` : ''}`
    if (order.orderType === 'outdoor') return `户外烧烤 / 烤架 ${order.grillName || '未选择'} / 顾客自取`
    if (order.orderType === 'takeOut') return '打包订单'
    return '点餐订单'
  },

  matchesFilter(order, filter) {
    const isPaid = !!(order.pay_status || order.payStatus)
    if (filter === 'all') return true
    if (filter === 'dineIn') return order.type === 'order' && order.orderType === 'dineIn'
    if (filter === 'outdoor') return order.type === 'order' && order.orderType === 'outdoor'
    if (filter === 'unpaid') return order.type === 'order' && !isPaid
    if (filter === 'paid') return isPaid
    if (filter === 'cancelled') return order.status === 'cancelled' || order.status === 3
    return order.type === 'order' && order.status === filter
  },

  async loadOrders() {
    if (this.data.loadingOrders) return
    this.setData({ loadingOrders: true })

    try {
      const res = await db.collection('order')
        .orderBy('createTime', 'desc')
        .limit(100)
        .get()

      const activeFilter = this.data.activeFilter
      const list = (res.data || [])
        .filter(order => this.matchesFilter(order, activeFilter))
        .map(order => ({
          ...order,
          createTimeText: this.formatTime(order.createTime),
          statusText: this.mapStatus(order.status),
          orderKindText: this.getOrderKind(order),
          payText: order.pay_status || order.payStatus ? '已付款' : '未付款',
          finalPriceText: Number(order.type === 'recharge' ? order.amount : order.finalPrice || 0).toFixed(2)
        }))

      this.setData({ orders: list })
    } catch (err) {
      console.error('加载订单失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loadingOrders: false })
      wx.hideLoading()
    }
  },

  onFilterChange(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      activeFilter: value,
      orders: []
    }, () => {
      this.loadOrders()
    })
  },

  refreshOrders() {
    this.loadOrders()
    wx.showToast({ title: '已刷新', icon: 'none' })
  },

  startAutoRefresh() {
    this.clearAutoRefresh()
    this.loadOrders()
    this.refreshTimer = setInterval(() => {
      this.loadOrders()
    }, 10000)
  },

  clearAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  },

  async confirmOfflinePaid(e) {
    const id = e.currentTarget.dataset.id
    wx.showLoading({ title: '确认中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateOrderStatus',
        data: {
          action: 'confirmOfflinePaid',
          id,
          status: 'paid'
        }
      })
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '确认失败')
      wx.hideLoading()
      wx.showToast({ title: '已确认付款', icon: 'success' })
      this.loadOrders()
    } catch (err) {
      wx.hideLoading()
      console.error('确认线下付款失败', err)
      wx.showToast({ title: err.message || '确认失败', icon: 'none' })
    }
  },

  stopPropagation() {},

  deleteOrder(e) {
    const order = e.currentTarget.dataset.order
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个订单吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '删除中...' })
          await db.collection('order').doc(order._id).remove()
          wx.hideLoading()
          wx.showToast({ title: '删除成功', icon: 'success' })
          this.loadOrders()
        } catch (err) {
          wx.hideLoading()
          console.error('删除失败', err)
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  }
})
