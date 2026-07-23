// packages/user/pages/about/about.js
const apiClient = require('../../../../utils/apiClient')
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
    navIconStroke: 2,
    showRevokeModal: false,
    revoking: false
  },

  onLoad() {
    this.setData(getCustomNavOptions())
  },

  goPrivacy() {
    openPrivacyPolicyDocument()
  },

  openRevokeModal() {
    this.setData({ showRevokeModal: true })
  },

  closeRevokeModal() {
    if (this.data.revoking) return
    this.setData({ showRevokeModal: false })
  },

  stopPropagation() {},

  async confirmRevokeAuthorization() {
    if (this.data.revoking) return
    this.setData({ revoking: true })

    try {
      await apiClient.call('user.revokeAuthorization')
      wx.removeStorageSync('privacyPolicyConsentV1')
      wx.setStorageSync('profileAuthorizationRevoked', true)
      wx.removeStorageSync('openid')
      apiClient.clearAuth()

      const app = getApp()
      app.globalData.openid = ''
      app.globalData.openidReady = false
      app.globalData.openidPromise = null
      app.globalData.userInfo = null
      app.globalData.userInfoReady = false
      app.globalData.userInfoPromise = null

      wx.exitMiniProgram({
        fail: () => {
          wx.reLaunch({ url: '/pages/covertest/covertest' })
        }
      })
    } catch (err) {
      console.error('revoke privacy authorization failed', err)
      this.setData({ revoking: false })
      const message = String(err && err.message || '')
      wx.showToast({
        title: message.includes('unknown action') ? '撤销服务尚未部署' : (err.message || '撤销失败，请重试'),
        icon: 'none'
      })
    }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后将清除本机登录状态。再次登录时需重新授权手机号，以确定会员账号。',
      confirmText: '退出登录',
      confirmColor: '#a74834',
      success: res => {
        if (!res.confirm) return

        wx.setStorageSync('manualLoggedOut', true)
        wx.removeStorageSync('openid')
        apiClient.clearAuth()

        const app = getApp()
        app.globalData.openid = ''
        app.globalData.openidReady = false
        app.globalData.openidPromise = null
        app.globalData.userInfo = null
        app.globalData.userInfoReady = false
        app.globalData.userInfoPromise = null

        wx.reLaunch({
          url: '/pages/covertest/covertest'
        })
      }
    })
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
