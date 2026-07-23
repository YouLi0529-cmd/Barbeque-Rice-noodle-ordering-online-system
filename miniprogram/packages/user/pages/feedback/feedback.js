const apiClient = require('../../../../utils/apiClient')
const { getCustomNavOptions } = require('../../../../utils/customNav')

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 44,
    navContentTop: 0,
    navContentHeight: 44,
    navTitleFontSize: 18,
    navIconSize: 14,
    navIconStroke: 2,
    content: '',
    submitting: false
  },

  onLoad() {
    this.setData(getCustomNavOptions())
  },

  onContentInput(e) {
    this.setData({
      content: String(e.detail.value || '').slice(0, 200)
    })
  },

  async submitFeedback() {
    const content = this.data.content.trim()
    if (!content) {
      wx.showToast({
        title: '请填写反馈内容',
        icon: 'none'
      })
      return
    }
    if (!apiClient.isEnabled()) {
      wx.showToast({
        title: '服务暂不可用',
        icon: 'none'
      })
      return
    }

    this.setData({ submitting: true })
    try {
      await apiClient.call('feedback.create', { content })
      wx.showToast({
        title: '已提交，感谢反馈',
        icon: 'success'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 900)
    } catch (err) {
      console.error('提交意见反馈失败', err)
      wx.showToast({
        title: '提交失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    wx.reLaunch({
      url: '/packages/user/pages/myhome/myhome'
    })
  }
})
