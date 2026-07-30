const apiClient = require('../../../../../utils/apiClient')

const UI = {
  batchManage: '\u6279\u91cf\u5220\u9664',
  batchCancel: '\u53d6\u6d88',
  batchDelete: '\u5220\u9664\u5df2\u9009',
  noSelection: '\u8bf7\u5148\u9009\u62e9\u53cd\u9988',
  deleteTitle: '\u5220\u9664\u610f\u89c1\u53cd\u9988',
  deleteContent: '\u786e\u5b9a\u5220\u9664\u9009\u4e2d\u53cd\u9988\u5417\uff1f\u5220\u9664\u540e\u4e0d\u53ef\u6062\u590d',
  deleteSuccess: '\u5df2\u5220\u9664\u9009\u4e2d\u53cd\u9988'
}

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
    ui: UI,
    list: [],
    loading: false,
    keyword: '',
    batchSelecting: false,
    selectedFeedbackMap: {},
    selectedFeedbackCount: 0,
    deletingFeedback: false
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
      const list = (res.data || []).map(formatFeedback)
      const selectedFeedbackMap = this.data.batchSelecting
        ? list.reduce((result, item) => {
          if (this.data.selectedFeedbackMap && this.data.selectedFeedbackMap[item._id]) result[item._id] = true
          return result
        }, {})
        : {}
      this.setData({
        list,
        selectedFeedbackMap,
        selectedFeedbackCount: Object.keys(selectedFeedbackMap).length,
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

  toggleBatchMode() {
    if (this.data.deletingFeedback) return
    this.setData({
      batchSelecting: !this.data.batchSelecting,
      selectedFeedbackMap: {},
      selectedFeedbackCount: 0
    })
  },

  toggleFeedbackSelection(e) {
    if (!this.data.batchSelecting) return
    const id = e.currentTarget.dataset.id
    if (!id) return
    const selectedFeedbackMap = {
      ...(this.data.selectedFeedbackMap || {})
    }
    if (selectedFeedbackMap[id]) delete selectedFeedbackMap[id]
    else selectedFeedbackMap[id] = true
    this.setData({
      selectedFeedbackMap,
      selectedFeedbackCount: Object.keys(selectedFeedbackMap).length
    })
  },

  async deleteSelectedFeedback() {
    if (this.data.deletingFeedback) return
    const ids = Object.keys(this.data.selectedFeedbackMap || {})
    if (!ids.length) {
      wx.showToast({ title: UI.noSelection, icon: 'none' })
      return
    }

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: UI.deleteTitle,
        content: UI.deleteContent,
        confirmColor: '#b15b18',
        success: res => resolve(res.confirm === true),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return

    try {
      this.setData({ deletingFeedback: true })
      await apiClient.call('admin.collection.batchDelete', {
        collection: 'feedback',
        ids
      })
      wx.showToast({ title: UI.deleteSuccess, icon: 'success' })
      this.setData({
        batchSelecting: false,
        selectedFeedbackMap: {},
        selectedFeedbackCount: 0
      })
      this.loadFeedback(true)
    } catch (err) {
      console.error('batch delete feedback failed', err)
      wx.showToast({ title: err.message || '删除失败', icon: 'none' })
    } finally {
      this.setData({ deletingFeedback: false })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})
