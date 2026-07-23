const apiClient = require('../../../../../utils/apiClient')

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '暂无时间'
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatFeedback(item = {}) {
  return {
    ...item,
    displayUser: item.userCode ? `会员${item.userCode}` : '未完善账号',
    displayTime: formatTime(item.createTime),
    displayStatus: item.status === 'handled' ? '已处理' : '待查看'
  }
}

Page({
  data: {
    list: [],
    loading: false,
    keyword: ''
  },

  onLoad() {
    this.loadFeedback()
  },

  onShow() {
    this.loadFeedback(true)
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value || '' })
  },

  searchFeedback() {
    this.loadFeedback()
  },

  async loadFeedback(silent = false) {
    if (!silent) this.setData({ loading: true })
    try {
      const res = await apiClient.call('admin.collection.list', {
        collection: 'feedback',
        keyword: this.data.keyword.trim(),
        orderBy: 'createTime',
        order: 'desc',
        limit: 100
      })
      this.setData({
        list: (res.data || []).map(formatFeedback),
        loading: false
      })
    } catch (err) {
      console.error('load feedback failed', err)
      this.setData({ loading: false })
      if (!silent) {
        wx.showToast({
          title: err.message || '加载失败',
          icon: 'none'
        })
      }
    }
  },

  goBack() {
    wx.navigateBack()
  }
})
