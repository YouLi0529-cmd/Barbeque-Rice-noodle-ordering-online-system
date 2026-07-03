// packages/admin/pages/admin/admin.js
const apiClient = require('../../../../utils/apiClient')

const ADMIN_ROOT = '/packages/admin/pages/admin'
const ADMIN_TEXT = {
  heroTitle: '\u5f20\u5357\u70e4\u8089\u540e\u53f0',
  coreSection: '\u6838\u5fc3\u4e1a\u52a1',
  orderTitle: '\u8ba2\u5355\u7ba1\u7406',
  orderDesc: '\u67e5\u770b\u548c\u5904\u7406\u8ba2\u5355',
  dishTitle: '\u83dc\u54c1\u7ba1\u7406',
  dishDesc: '\u5206\u7c7b\u3001\u83dc\u54c1\u3001\u4e0a\u4e0b\u67b6',
  queueTitle: '\u6392\u961f\u7ba1\u7406',
  queueDesc: '\u53eb\u53f7\u3001\u8fc7\u53f7\u3001\u5165\u5ea7',
  reservationTitle: '\u9884\u7ea6\u7ba1\u7406',
  reservationDesc: '\u786e\u8ba4\u9884\u7ea6\u548c\u5230\u5e97\u8bb0\u5f55',
  outdoorTitle: '\u6237\u5916\u8ba2\u5355',
  outdoorDesc: '\u9732\u8425\u8ba2\u5355\u5904\u7406',
  grillTitle: '\u70e4\u67b6\u7ba1\u7406',
  grillDesc: '\u65b0\u589e\u3001\u542f\u7528\u3001\u505c\u7528',
  settingsSection: '\u5e97\u94fa\u8bbe\u7f6e',
  userTitle: '\u4f1a\u5458\u7ba1\u7406',
  userDesc: '\u7528\u6237\u8d44\u6599\u548c\u6d88\u8d39\u8bb0\u5f55',
  noticeTitle: '\u516c\u544a\u7ba1\u7406',
  noticeDesc: '\u9996\u9875\u901a\u77e5\u5185\u5bb9',
  tableCodeTitle: '\u684c\u7801\u7ba1\u7406',
  tableCodeDesc: '\u5802\u98df\u684c\u7801\u751f\u6210',
  shopInfoTitle: '\u5e97\u94fa\u8bbe\u7f6e',
  shopInfoDesc: '\u57fa\u7840\u8d44\u6599\u7ef4\u62a4',
  printerTitle: '\u6253\u5370\u673a\u7ba1\u7406',
  printerDesc: '\u5c0f\u7968\u6253\u5370\u914d\u7f6e',
  rechargeTitle: '\u5145\u503c\u9009\u9879',
  rechargeDesc: '\u6682\u65f6\u4fdd\u7559',
  changePassword: '\u4fee\u6539\u5bc6\u7801',
  back: '\u8fd4\u56de',
  setupAdminPassword: '\u8bbe\u7f6e\u7ba1\u7406\u5458\u5bc6\u7801',
  adminLogin: '\u7ba1\u7406\u5458\u767b\u5f55',
  setupPasswordPlaceholder: '\u8bf7\u8bbe\u7f6e\u7ba1\u7406\u5458\u5bc6\u7801\uff08\u81f3\u5c116\u4f4d\uff09',
  loginPasswordPlaceholder: '\u8bf7\u8f93\u5165\u7ba1\u7406\u5458\u5bc6\u7801',
  firstPasswordHint: '\u9996\u6b21\u8fdb\u5165\u540e\u53f0\uff0c\u8bf7\u5148\u8bbe\u7f6e\u7ba1\u7406\u5458\u5bc6\u7801\u3002',
  cancel: '\u53d6\u6d88',
  setup: '\u8bbe\u7f6e',
  login: '\u767b\u5f55',
  oldPasswordPlaceholder: '\u8bf7\u8f93\u5165\u539f\u5bc6\u7801',
  newPasswordPlaceholder: '\u8bf7\u8f93\u5165\u65b0\u5bc6\u7801\uff08\u81f3\u5c116\u4f4d\uff09',
  confirmPasswordPlaceholder: '\u8bf7\u518d\u6b21\u8f93\u5165\u65b0\u5bc6\u7801',
  confirm: '\u786e\u8ba4'
}

Page({
  data: {
    ui: ADMIN_TEXT,
    authChecked: false,
    isAuthorized: false,
    showAuthModal: false,
    isFirstTime: false,
    adminPassword: '',
    showPasswordModal: false,
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  },

  async onLoad(options = {}) {
    await this.prepareAdminAuth()

    if (options.changePassword === 'true' && this.data.isAuthorized) {
      this.showChangePassword()
    }
  },

  async prepareAdminAuth() {
    try {
      wx.showLoading({ title: '\u9a8c\u8bc1\u4e2d...' })
      const res = await apiClient.call('admin.status')
      const hasAdmin = !!(res.data && res.data.hasAdmin)

      wx.hideLoading()
      this.setData({
        authChecked: true,
        isAuthorized: false,
        showAuthModal: true,
        isFirstTime: !hasAdmin,
        adminPassword: ''
      })
    } catch (err) {
      wx.hideLoading()
      console.error('admin status failed', err)
      this.setData({
        authChecked: true,
        isAuthorized: false,
        showAuthModal: true,
        isFirstTime: false,
        adminPassword: ''
      })
      wx.showToast({
        title: '\u670d\u52a1\u8fde\u63a5\u5931\u8d25',
        icon: 'none'
      })
    }
  },

  onAdminPasswordInput(e) {
    this.setData({ adminPassword: e.detail.value })
  },

  closeAuthModal() {
    this.setData({
      showAuthModal: false,
      adminPassword: ''
    })
    this.goBack()
  },

  async confirmAdminAuth() {
    const password = String(this.data.adminPassword || '').trim()

    if (!password) {
      wx.showToast({ title: '\u8bf7\u8f93\u5165\u5bc6\u7801', icon: 'none' })
      return
    }

    if (password.length < 6) {
      wx.showToast({ title: '\u5bc6\u7801\u4e0d\u80fd\u5c11\u4e8e6\u4f4d', icon: 'none' })
      return
    }

    try {
      wx.showLoading({
        title: this.data.isFirstTime ? '\u8bbe\u7f6e\u4e2d...' : '\u767b\u5f55\u4e2d...'
      })

      const authRes = this.data.isFirstTime
        ? await apiClient.call('admin.setPassword', { password })
        : await apiClient.call('admin.login', { password })

      if (authRes.data && authRes.data.adminAuthToken) {
        wx.setStorageSync(apiClient.ADMIN_AUTH_TOKEN_KEY, authRes.data.adminAuthToken)
      }

      wx.hideLoading()
      this.setData({
        isAuthorized: true,
        showAuthModal: false,
        adminPassword: ''
      })
      wx.showToast({ title: '\u767b\u5f55\u6210\u529f', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('admin auth failed', err)
      wx.showToast({
        title: err.message || '\u64cd\u4f5c\u5931\u8d25',
        icon: 'none'
      })
    }
  },

  goToDish() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/dish/dish` })
  },

  goToUser() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/user/user` })
  },

  goToOrder() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/order/order` })
  },

  goToQueue() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/queue/queue` })
  },

  goToReservation() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/reservation/reservation` })
  },

  goToOutdoor() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/outdoor/outdoor` })
  },

  goToGrill() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/grill/grill` })
  },

  goToRechargeOptions() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/rechargeOptions/rechargeOptions` })
  },

  goToNotice() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/notice/notice` })
  },

  goToTableCode() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/tableCode/tableCode` })
  },

  goToPrinter() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/printer/printer` })
  },

  goToShopInfo() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/shopInfo/shopInfo` })
  },

  showChangePassword() {
    if (!this.data.isAuthorized) {
      this.setData({ showAuthModal: true })
      return
    }

    this.setData({
      showPasswordModal: true,
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
  },

  closePasswordModal() {
    this.setData({
      showPasswordModal: false,
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
  },

  stopPropagation() {},

  onOldPasswordInput(e) {
    this.setData({ oldPassword: e.detail.value })
  },

  onNewPasswordInput(e) {
    this.setData({ newPassword: e.detail.value })
  },

  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value })
  },

  async confirmChangePassword() {
    const oldPassword = String(this.data.oldPassword || '').trim()
    const newPassword = String(this.data.newPassword || '').trim()
    const confirmPassword = String(this.data.confirmPassword || '').trim()

    if (!oldPassword) {
      wx.showToast({ title: '\u8bf7\u8f93\u5165\u539f\u5bc6\u7801', icon: 'none' })
      return
    }

    if (newPassword.length < 6) {
      wx.showToast({ title: '\u65b0\u5bc6\u7801\u4e0d\u80fd\u5c11\u4e8e6\u4f4d', icon: 'none' })
      return
    }

    if (newPassword !== confirmPassword) {
      wx.showToast({ title: '\u4e24\u6b21\u5bc6\u7801\u4e0d\u4e00\u81f4', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '\u4fee\u6539\u4e2d...' })
      const authRes = await apiClient.call('admin.changePassword', {
        oldPassword,
        newPassword
      })
      if (authRes.data && authRes.data.adminAuthToken) {
        wx.setStorageSync(apiClient.ADMIN_AUTH_TOKEN_KEY, authRes.data.adminAuthToken)
      }

      wx.hideLoading()
      wx.showToast({ title: '\u5bc6\u7801\u5df2\u4fee\u6539', icon: 'success' })
      this.closePasswordModal()
    } catch (err) {
      wx.hideLoading()
      console.error('change admin password failed', err)
      wx.showToast({
        title: err.message || '\u4fee\u6539\u5931\u8d25',
        icon: 'none'
      })
    }
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    wx.reLaunch({
      url: '/pages/covertest/covertest'
    })
  }
})
