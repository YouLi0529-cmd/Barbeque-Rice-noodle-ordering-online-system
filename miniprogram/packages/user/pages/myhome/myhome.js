// packages/user/pages/myhome/myhome.js
const app = getApp()
const apiClient = require('../../../../utils/apiClient')
const db = apiClient.isEnabled() ? null : wx.cloud.database()
const { getCustomNavOptions } = require('../../../../utils/customNav')

Page({
  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    navContentTop: 0,
    navContentHeight: 44,
    navTitleFontSize: 18,
    userInfo: null, // 用户信息
    showAuthModal: false, // 显示授权弹窗
    version: '', // 版本号
    actionLoading: false,
    actionLoadingText: '',
    actionLoadingGif: '/images/orderloadinggif-transparent.gif'
  },

  showActionLoading(text = '加载中') {
    this.setData({
      actionLoading: true,
      actionLoadingText: text
    })
  },

  hideActionLoading() {
    this.setData({
      actionLoading: false,
      actionLoadingText: ''
    })
  },

  catchActionLoadingMove() {},

  onLoad() {
    this.setData(getCustomNavOptions())
    this.loadUserInfo()
    this.getVersion()
  },

  onShow() {
    this.loadUserInfo().then((user) => {
      if (!this.isProfileCompleted(user)) {
        this.setData({
          showAuthModal: true
        })
      }
    })
  },

  goCover() {
    wx.reLaunch({
      url: '/pages/covertest/covertest'
    })
  },

  goMyOrder() {
    wx.reLaunch({
      url: '/packages/user/pages/myorder/myorder'
    })
  },

  goMyHome() {},

  // 加载用户信息
  async loadUserInfo() {
    try {
      const openid = app.globalData.openid
      if (!openid) {
        this.setData({
          userInfo: null
        })
        app.globalData.userInfo = null
        return null
      }

      if (apiClient.isEnabled()) {
        const result = await apiClient.call('user.me')
        const user = result.data || null
        this.setData({
          userInfo: user
        })
        app.globalData.userInfo = user
        return user
      }

      const res = await db.collection('user').where({
        _openid: openid
      }).get()
      
      if (res.data && res.data.length > 0) {
        const user = res.data[0]
        this.setData({
          userInfo: user
        })
        
        // 同时更新全局数据，确保其他页面也能获取最新信息
        app.globalData.userInfo = user
        return user
      }

      this.setData({
        userInfo: null
      })
      app.globalData.userInfo = null
      return null
    } catch (err) {
      console.error('获取用户信息失败', err)
      return null
    }
  },

  isProfileCompleted(userInfo) {
    return !!(
      userInfo &&
      userInfo.userCode &&
      userInfo.profileCompleted === true &&
      userInfo.status === 1
    )
  },

  // 显示授权弹窗
  showAuthModal() {
    this.setData({
      showAuthModal: true
    })
  },

  // 用户信息保存成功回调
  onUserInfoSaved(e) {
    if (e.detail && e.detail.user) {
      app.globalData.userInfo = e.detail.user
      this.setData({
        userInfo: e.detail.user,
        showAuthModal: false
      })
    }
    // 刷新用户信息
    this.loadUserInfo()
  },

  onAuthModalClosed() {
    this.setData({
      showAuthModal: false
    })
  },

  // 跳转到订单页面
  goToOrder(e) {
    const status = e.currentTarget.dataset.status
    wx.navigateTo({
      url: '/packages/user/pages/myorder/myorder'
    })
  },

  goAbout() {
    wx.navigateTo({
      url: '/packages/user/pages/about/about'
    })
  },

  // 联系客服
  // 联系客服
  contactService() {
    // 使用button的open-type="contact"功能
    // 这里可以添加额外的逻辑，比如统计点击次数等
  },

  // 获取版本号
  getVersion() {
    const accountInfo = wx.getAccountInfoSync()
    const version = accountInfo.miniProgram.version || '1.0.0'
    this.setData({
      version: version
    })
  }
})
