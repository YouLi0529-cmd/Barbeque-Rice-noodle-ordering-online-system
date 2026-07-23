const { getCustomNavOptions } = require('../../../../utils/customNav')
const { openPrivacyPolicyDocument } = require('../../../../utils/privacyPolicyDocument')

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 44,
    navContentTop: 0,
    navContentHeight: 44,
    navTitleFontSize: 18,
    navIconSize: 14,
    navIconStroke: 2
  },

  onLoad() {
    this.setData(getCustomNavOptions())
  },

  openDocument() {
    openPrivacyPolicyDocument()
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
