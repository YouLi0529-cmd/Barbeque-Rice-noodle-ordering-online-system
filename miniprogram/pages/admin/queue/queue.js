// pages/admin/queue/queue.js
Page({
  data: {
    list: [],
    loading: false
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
      waiting: '等待中',
      called: '已叫号',
      seated: '已入座',
      skipped: '已过号',
      cancelled: '已取消'
    }
    return map[status] || status || '未知'
  },

  async loadList() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'queueManage',
        data: {
          action: 'list',
          statuses: ['waiting', 'called', 'skipped']
        }
      })
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '加载失败')
      const list = (result.data || []).map(item => ({
        ...item,
        statusText: this.mapStatus(item.status),
        createTimeText: this.formatTime(item.createTime)
      }))
      this.setData({ list })
    } catch (err) {
      console.error('加载排队列表失败', err)
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async operate(e) {
    const id = e.currentTarget.dataset.id
    const action = e.currentTarget.dataset.action
    wx.showLoading({ title: '处理中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'queueManage',
        data: { action, id }
      })
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '操作失败')
      wx.hideLoading()
      wx.showToast({ title: '已更新', icon: 'success' })
      this.loadList()
    } catch (err) {
      wx.hideLoading()
      console.error('队列操作失败', err)
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  }
})
