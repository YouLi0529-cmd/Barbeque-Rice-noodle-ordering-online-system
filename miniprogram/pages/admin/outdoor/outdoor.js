// pages/admin/outdoor/outdoor.js
Page({
  data: {
    list: [],
    loading: false,
    statusActions: [
      { label: '待配菜', status: 'pending_prepare' },
      { label: '配菜中', status: 'preparing' },
      { label: '待自取', status: 'ready_pickup' },
      { label: '已取餐', status: 'picked_up' },
      { label: '待买单', status: 'waiting_pay' },
      { label: '取消', status: 'cancelled' }
    ]
  },

  onLoad() {
    this.loadList()
  },

  onShow() {
    this.loadList()
  },

  formatTime(time) {
    if (!time) return ''
    const date = time instanceof Date ? time : new Date(time)
    const pad = n => (n < 10 ? `0${n}` : `${n}`)
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
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
      cancelled: '已取消'
    }
    return map[status] || status || '未设置'
  },

  async loadList() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'outdoorManage',
        data: { action: 'listOutdoorOrders' }
      })
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '加载失败')
      const list = (result.data || []).map(order => ({
        ...order,
        statusText: this.mapStatus(order.status),
        payText: order.pay_status || order.payStatus ? '已付款' : '未付款',
        createTimeText: this.formatTime(order.createTime),
        finalPriceText: Number(order.finalPrice || 0).toFixed(2)
      }))
      this.setData({ list })
    } catch (err) {
      console.error('加载户外订单失败', err)
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async updateStatus(e) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    wx.showLoading({ title: '更新中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateOrderStatus',
        data: {
          action: 'updateStatus',
          id,
          status
        }
      })
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '更新失败')
      wx.hideLoading()
      wx.showToast({ title: '已更新', icon: 'success' })
      this.loadList()
    } catch (err) {
      wx.hideLoading()
      console.error('更新户外订单状态失败', err)
      wx.showToast({ title: err.message || '更新失败', icon: 'none' })
    }
  },

  async confirmPaid(e) {
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
      this.loadList()
    } catch (err) {
      wx.hideLoading()
      console.error('确认付款失败', err)
      wx.showToast({ title: err.message || '确认失败', icon: 'none' })
    }
  }
})
