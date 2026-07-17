// packages/admin/pages/admin/admin.js
const apiClient = require('../../../../utils/apiClient')

const ADMIN_ROOT = '/packages/admin/pages/admin'
const ADMIN_TEXT = {
  heroTitle: '\u5f20\u5357\u70e4\u8089\u540e\u53f0',
  coreSection: '\u6838\u5fc3\u4e1a\u52a1',
  orderTitle: '\u684c\u53f0\u7ba1\u7406',
  orderDesc: '\u67e5\u770b\u684c\u53f0\u72b6\u6001\u548c\u5f53\u524d\u8d26\u5355',
  dishTitle: '\u83dc\u54c1\u7ba1\u7406',
  dishDesc: '\u5206\u7c7b\u3001\u83dc\u54c1\u3001\u4e0a\u4e0b\u67b6',
  queueTitle: '\u6392\u961f\u7ba1\u7406',
  queueDesc: '\u53eb\u53f7\u3001\u8fc7\u53f7\u3001\u5165\u5ea7',
  reservationTitle: '\u9884\u7ea6\u7ba1\u7406',
  reservationDesc: '\u786e\u8ba4\u9884\u7ea6\u548c\u5230\u5e97\u8bb0\u5f55',
  outdoorTitle: '\u6237\u5916\u8ba2\u5355',
  outdoorDesc: '\u9732\u8425\u8ba2\u5355\u5904\u7406',
  settingsSection: '\u5e97\u94fa\u8bbe\u7f6e',
  noticeTitle: '\u516c\u544a\u7ba1\u7406',
  noticeDesc: '\u9996\u9875\u901a\u77e5\u5185\u5bb9',
  tableCodeTitle: '\u684c\u7801\u7ba1\u7406',
  tableCodeDesc: '\u5802\u98df\u684c\u7801\u751f\u6210',
  printerTitle: '\u6253\u5370\u673a\u7ba1\u7406',
  printerDesc: '\u5c0f\u7968\u6253\u5370\u914d\u7f6e',
  reservationModalTitle: '\u65b0\u9884\u7ea6',
  reservationEmpty: '\u6682\u65e0\u65b0\u9884\u7ea6',
  reservationRefresh: '\u5237\u65b0',
  reservationPhone: '\u624b\u673a',
  reservationDate: '\u5230\u5e97\u65f6\u95f4',
  reservationPeople: '\u4eba\u6570',
  reservationRoom: '\u623f\u95f4',
  reservationDetailTitle: '\u9884\u7ea6\u8be6\u60c5',
  confirmReservation: '\u786e\u8ba4\u9884\u7ea6',
  reservationConfirmed: '\u5df2\u786e\u8ba4\u9884\u7ea6',
  changePassword: '\u4fee\u6539\u5bc6\u7801',
  close: '\u5173\u95ed',
  setupAdminPassword: '\u8bbe\u7f6e\u7ba1\u7406\u5458\u5bc6\u7801',
  adminLogin: '\u7ba1\u7406\u5458\u767b\u5f55',
  setupPasswordPlaceholder: '\u8bf7\u8bbe\u7f6e\u7ba1\u7406\u5458\u5bc6\u7801\uff08\u81f3\u5c116\u4f4d\uff09',
  loginPasswordPlaceholder: '\u8bf7\u8f93\u5165\u7ba1\u7406\u5458\u5bc6\u7801',
  firstPasswordHint: '\u9996\u6b21\u8fdb\u5165\u540e\u53f0\uff0c\u8bf7\u5148\u8bbe\u7f6e\u7ba1\u7406\u5458\u5bc6\u7801\u3002',
  cancel: '\u53d6\u6d88',
  setup: '\u8bbe\u7f6e',
  login: '\u767b\u5f55',
  loading: '\u52a0\u8f7d\u4e2d',
  oldPasswordPlaceholder: '\u8bf7\u8f93\u5165\u539f\u5bc6\u7801',
  newPasswordPlaceholder: '\u8bf7\u8f93\u5165\u65b0\u5bc6\u7801\uff08\u81f3\u5c116\u4f4d\uff09',
  confirmPasswordPlaceholder: '\u8bf7\u518d\u6b21\u8f93\u5165\u65b0\u5bc6\u7801',
  confirm: '\u786e\u8ba4'
}

const AUTH_REQUIRED_TIP = '\u5fc5\u987b\u767b\u5f55\u624d\u80fd\u8fdb\u5165\u540e\u53f0'
const PASSWORD_REQUIRED_TIP = '\u8bf7\u8f93\u5165\u5bc6\u7801'
const PASSWORD_LENGTH_TIP = '\u5bc6\u7801\u4e0d\u80fd\u5c11\u4e8e6\u4f4d'
const PASSWORD_ERROR_TIP = '\u5bc6\u7801\u9519\u8bef'

function formatReservation(item = {}) {
  const dateText = item.reservationDateText || item.reservationDate || ''
  const timeText = item.reservationTime || ''
  const digits = String(item.phone || item.phoneNumber || '').replace(/\D/g, '')
  const lastFour = digits.slice(-4)
  return {
    ...item,
    displayPhone: lastFour ? `\u5c3e\u53f7${lastFour}` : '\u672a\u8bb0\u5f55',
    detailPhone: item.phone || item.phoneNumber || '\u672a\u8bb0\u5f55',
    displayDateTime: `${dateText} ${timeText}`.trim() || '\u672a\u8bb0\u5f55',
    displayPeople: `${item.peopleCount || 0}\u4eba`,
    displayRoom: item.roomType || '\u672a\u9009\u62e9'
  }
}

Page({
  data: {
    ui: ADMIN_TEXT,
    authChecked: false,
    isAuthorized: false,
    showAuthModal: false,
    isFirstTime: false,
    adminPassword: '',
    authRequiredTip: '',
    showPasswordModal: false,
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    reservationList: [],
    reservationLoading: false,
    showReservationModal: false,
    selectedReservation: null,
    showReservationDetailModal: false,
    confirmingReservation: false
  },

  async onLoad(options = {}) {
    if (options.adminRoot !== '1' && getCurrentPages().length > 1) {
      const changePassword = options.changePassword === 'true' ? '&changePassword=true' : ''
      wx.reLaunch({
        url: `${ADMIN_ROOT}/admin?adminRoot=1${changePassword}`
      })
      return
    }

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
        adminPassword: '',
        authRequiredTip: ''
      })
    } catch (err) {
      wx.hideLoading()
      console.error('admin status failed', err)
      this.setData({
        authChecked: true,
        isAuthorized: false,
        showAuthModal: true,
        isFirstTime: false,
        adminPassword: '',
        authRequiredTip: ''
      })
      wx.showToast({
        title: '\u670d\u52a1\u8fde\u63a5\u5931\u8d25',
        icon: 'none'
      })
    }
  },

  onAdminPasswordInput(e) {
    this.setData({
      adminPassword: e.detail.value,
      authRequiredTip: ''
    })
  },

  closeAuthModal() {
    this.setData({
      authRequiredTip: AUTH_REQUIRED_TIP
    })
  },

  async confirmAdminAuth() {
    const password = String(this.data.adminPassword || '').trim()

    if (!password) {
      this.setData({ authRequiredTip: PASSWORD_REQUIRED_TIP })
      return
    }

    if (password.length < 6) {
      this.setData({ authRequiredTip: PASSWORD_LENGTH_TIP })
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
        adminPassword: '',
        authRequiredTip: ''
      }, () => {
        const infoCenter = this.selectComponent('#admin-info-center')
        if (infoCenter) infoCenter.activate()
      })
      wx.showToast({ title: '\u767b\u5f55\u6210\u529f', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('admin auth failed', err)
      this.setData({
        authRequiredTip: PASSWORD_ERROR_TIP
      })
    }
  },

  goToDish() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/dish/dish` })
  },

  goToOrder() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/table/table` })
  },

  goToQueue() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/queue/queue` })
  },

  goToReservation() {
    if (!this.data.isAuthorized) {
      this.setData({ showAuthModal: true })
      return
    }
    this.setData({ showReservationModal: true })
    this.loadReservationList()
  },

  async loadReservationList(silent = false) {
    if (silent && silent.currentTarget) silent = false
    if (!this.data.isAuthorized) return
    if (!silent) {
      this.setData({ reservationLoading: true })
    }

    try {
      const res = await apiClient.call('admin.collection.list', {
        collection: 'reservation',
        filters: { status: 'pending' },
        orderBy: 'createTime',
        order: 'desc',
        limit: 100
      })
      const reservationList = (res.data || []).map(formatReservation)
      this.setData({
        reservationList,
        reservationLoading: false
      })
    } catch (err) {
      console.error('load reservations failed', err)
      this.setData({ reservationLoading: false })
      if (!silent) {
        wx.showToast({
          title: err.message || '\u9884\u7ea6\u52a0\u8f7d\u5931\u8d25',
          icon: 'none'
        })
      }
    }
  },

  closeReservationModal() {
    this.setData({
      showReservationModal: false,
      showReservationDetailModal: false,
      selectedReservation: null
    })
  },

  openReservationDetail(e) {
    const index = Number(e.currentTarget.dataset.index)
    const selectedReservation = this.data.reservationList[index]
    if (!selectedReservation) return
    this.setData({
      selectedReservation,
      showReservationDetailModal: true
    })
  },

  closeReservationDetailModal() {
    this.setData({
      showReservationDetailModal: false,
      selectedReservation: null
    })
  },

  async confirmReservation() {
    const reservation = this.data.selectedReservation
    if (!reservation || !reservation._id || this.data.confirmingReservation) return

    this.setData({ confirmingReservation: true })

    try {
      await apiClient.call('admin.collection.update', {
        collection: 'reservation',
        id: reservation._id,
        data: {
          status: 'confirmed',
          confirmedAt: new Date().toISOString()
        }
      })
      wx.showToast({
        title: ADMIN_TEXT.reservationConfirmed,
        icon: 'success'
      })
      this.setData({
        confirmingReservation: false,
        showReservationDetailModal: false,
        selectedReservation: null
      })
      this.loadReservationList(true)
    } catch (err) {
      console.error('confirm reservation failed', err)
      this.setData({ confirmingReservation: false })
      wx.showToast({
        title: err.message || '\u786e\u8ba4\u5931\u8d25',
        icon: 'none'
      })
    }
  },

  goToOutdoor() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/outdoor/outdoor` })
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

})
