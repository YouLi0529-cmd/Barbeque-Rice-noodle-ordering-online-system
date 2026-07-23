// packages/admin/pages/admin/admin.js
const apiClient = require('../../../../utils/apiClient')

const ADMIN_ROOT = '/packages/admin/pages/admin'
const RESERVATION_TIME_OPTIONS = ['11:00', '11:30', '12:00', '18:00', '19:00']
const RESERVATION_PEOPLE_OPTIONS = [2, 4, 8]
const RESERVATION_ROOM_OPTIONS = ['大厅', '包间', '天楼']
const WEEK_TEXT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function padNumber(value) {
  return value < 10 ? `0${value}` : `${value}`
}

function buildReservationWeekDates() {
  const today = new Date()
  return Array.from({ length: 7 }).map((item, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() + index)
    const month = date.getMonth() + 1
    const day = date.getDate()
    return {
      value: `${date.getFullYear()}-${padNumber(month)}-${padNumber(day)}`,
      week: index === 0 ? '\u4eca\u5929' : WEEK_TEXT[date.getDay()],
      day: `${month}/${day}`,
      text: `${month}\u6708${day}\u65e5`
    }
  })
}

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
  feedbackTitle: '\u610f\u89c1\u6536\u96c6',
  feedbackDesc: '\u67e5\u770b\u7528\u6237\u63d0\u4ea4\u7684\u53cd\u9988',
  reservationModalTitle: '\u65b0\u9884\u7ea6',
  reservationEmpty: '\u6682\u65e0\u65b0\u9884\u7ea6',
  reservationRefresh: '\u5237\u65b0',
  addReservation: '\u6dfb\u52a0\u9884\u7ea6',
  manualReservationTitle: '\u6dfb\u52a0\u9884\u7ea6',
  reservationPhonePlaceholder: '\u8bf7\u8f93\u5165\u624b\u673a\u53f7',
  reservationTime: '\u65f6\u6bb5',
  reservationCustomTime: '\u81ea\u5b9a\u4e49\u65f6\u95f4',
  reservationCustomPeople: '\u81ea\u5b9a\u4e49\u4eba\u6570',
  reservationPriority: '\u91cd\u70b9\u5173\u6ce8',
  reservationSave: '\u4fdd\u5b58\u9884\u7ea6',
  reservationCreated: '\u9884\u7ea6\u5df2\u6dfb\u52a0',
  reservationPhoneRequired: '\u8bf7\u586b\u5199\u624b\u673a\u53f7',
  reservationInfoRequired: '\u8bf7\u5b8c\u5584\u9884\u7ea6\u4fe1\u606f',
  reservationPhone: '\u624b\u673a',
  reservationDate: '\u5230\u5e97\u65f6\u95f4',
  reservationPeople: '\u4eba\u6570',
  reservationRoom: '\u623f\u95f4',
  reservationDetailTitle: '\u9884\u7ea6\u8be6\u60c5',
  confirmReservation: '\u786e\u8ba4\u9884\u7ea6',
  reservationConfirmed: '\u5df2\u786e\u8ba4\u9884\u7ea6',
  deleteReservation: '\u5220\u9664\u9884\u7ea6',
  reservationDeleted: '\u9884\u7ea6\u5df2\u5220\u9664',
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
    reservationUnreadCount: 0,
    reservationUnreadBadge: '',
    reservationLoading: false,
    showReservationModal: false,
    selectedReservation: null,
    showReservationDetailModal: false,
    confirmingReservation: false,
    deletingReservation: false,
    showManualReservationModal: false,
    savingManualReservation: false,
    manualWeekDates: [],
    manualTimeOptions: RESERVATION_TIME_OPTIONS,
    manualPeopleOptions: RESERVATION_PEOPLE_OPTIONS,
    manualRoomOptions: RESERVATION_ROOM_OPTIONS,
    manualPhone: '',
    manualDate: '',
    manualDateText: '',
    manualTime: '18:00',
    manualCustomTime: '18:30',
    manualIsCustomTime: false,
    manualPeople: 2,
    manualCustomPeople: '',
    manualIsCustomPeople: false,
    manualRoom: '大厅',
    manualPriority: false
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

  onNotificationsChange(event) {
    const count = Math.max(0, Number(event && event.detail && event.detail.pendingReservationCount || 0))
    this.setData({
      reservationUnreadCount: count,
      reservationUnreadBadge: count > 99 ? '99+' : String(count)
    })
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
      showManualReservationModal: false,
      selectedReservation: null
    })
  },

  openManualReservation() {
    const manualWeekDates = buildReservationWeekDates()
    const firstDate = manualWeekDates[0] || {}
    this.setData({
      showManualReservationModal: true,
      manualWeekDates,
      manualPhone: '',
      manualDate: firstDate.value || '',
      manualDateText: firstDate.text || '',
      manualTime: '18:00',
      manualCustomTime: '18:30',
      manualIsCustomTime: false,
      manualPeople: 2,
      manualCustomPeople: '',
      manualIsCustomPeople: false,
      manualRoom: '大厅',
      manualPriority: false
    })
  },

  closeManualReservation() {
    if (this.data.savingManualReservation) return
    this.setData({ showManualReservationModal: false })
  },

  onManualPhoneInput(e) {
    this.setData({ manualPhone: e.detail.value })
  },

  selectManualDate(e) {
    const value = e.currentTarget.dataset.value
    const date = (this.data.manualWeekDates || []).find(item => item.value === value)
    if (!date) return
    this.setData({
      manualDate: date.value,
      manualDateText: date.text
    })
  },

  selectManualTime(e) {
    const value = e.currentTarget.dataset.value
    if (!value) return
    this.setData({
      manualTime: value,
      manualIsCustomTime: false
    })
  },

  onManualCustomTimeChange(e) {
    const value = e.detail.value
    this.setData({
      manualCustomTime: value,
      manualTime: value,
      manualIsCustomTime: true
    })
  },

  selectManualPeople(e) {
    const value = Number(e.currentTarget.dataset.value)
    if (!Number.isFinite(value) || value <= 0) return
    this.setData({
      manualPeople: value,
      manualIsCustomPeople: false
    })
  },

  focusManualCustomPeople() {
    this.setData({ manualIsCustomPeople: true })
  },

  onManualCustomPeopleInput(e) {
    const value = e.detail.value
    const number = Number(value)
    this.setData({
      manualCustomPeople: value,
      manualPeople: Number.isFinite(number) && number > 0 ? number : this.data.manualPeople,
      manualIsCustomPeople: true
    })
  },

  selectManualRoom(e) {
    const value = e.currentTarget.dataset.value
    if (!value) return
    this.setData({ manualRoom: value })
  },

  toggleManualPriority() {
    this.setData({ manualPriority: !this.data.manualPriority })
  },

  async saveManualReservation() {
    if (this.data.savingManualReservation) return
    const phone = String(this.data.manualPhone || '').replace(/\s/g, '')
    const peopleCount = this.data.manualIsCustomPeople
      ? Number(this.data.manualCustomPeople)
      : Number(this.data.manualPeople)

    if (!phone) {
      wx.showToast({ title: ADMIN_TEXT.reservationPhoneRequired, icon: 'none' })
      return
    }
    if (!this.data.manualDate || !this.data.manualTime || !this.data.manualRoom || !Number.isFinite(peopleCount) || peopleCount <= 0) {
      wx.showToast({ title: ADMIN_TEXT.reservationInfoRequired, icon: 'none' })
      return
    }

    this.setData({ savingManualReservation: true })
    try {
      await apiClient.call('admin.collection.save', {
        collection: 'reservation',
        item: {
          reservationNo: `M${Date.now()}`,
          phone,
          phoneNumber: phone,
          reservationDate: this.data.manualDate,
          reservationDateText: this.data.manualDateText,
          reservationTime: this.data.manualTime,
          peopleCount,
          roomType: this.data.manualRoom,
          status: 'confirmed',
          confirmedAt: new Date().toISOString(),
          isPriority: this.data.manualPriority === true,
          source: 'admin'
        }
      })
      wx.showToast({ title: ADMIN_TEXT.reservationCreated, icon: 'success' })
      this.setData({
        savingManualReservation: false,
        showManualReservationModal: false
      })
      this.loadReservationList(true)
      const infoCenter = this.selectComponent('#admin-info-center')
      if (infoCenter) infoCenter.activate(true)
    } catch (err) {
      console.error('save manual reservation failed', err)
      this.setData({ savingManualReservation: false })
      wx.showToast({
        title: err.message || '\u6dfb\u52a0\u5931\u8d25',
        icon: 'none'
      })
    }
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
      const infoCenter = this.selectComponent('#admin-info-center')
      if (infoCenter) infoCenter.activate(true)
    } catch (err) {
      console.error('confirm reservation failed', err)
      this.setData({ confirmingReservation: false })
      wx.showToast({
        title: err.message || '\u786e\u8ba4\u5931\u8d25',
        icon: 'none'
      })
    }
  },

  deleteReservation() {
    const reservation = this.data.selectedReservation
    if (!reservation || !reservation._id || this.data.deletingReservation) return

    wx.showModal({
      title: ADMIN_TEXT.deleteReservation,
      content: '\u5220\u9664\u540e\u65e0\u6cd5\u6062\u590d\uff0c\u786e\u8ba4\u5220\u9664\u8be5\u9884\u7ea6\uff1f',
      confirmText: '\u5220\u9664',
      confirmColor: '#C9341C',
      success: async (result) => {
        if (!result.confirm) return

        this.setData({ deletingReservation: true })
        try {
          await apiClient.call('admin.collection.delete', {
            collection: 'reservation',
            id: reservation._id
          })
          wx.showToast({
            title: ADMIN_TEXT.reservationDeleted,
            icon: 'success'
          })
          this.setData({
            deletingReservation: false,
            showReservationDetailModal: false,
            selectedReservation: null
          })
          this.loadReservationList(true)
          const infoCenter = this.selectComponent('#admin-info-center')
          if (infoCenter) infoCenter.activate(true)
        } catch (err) {
          console.error('delete reservation failed', err)
          this.setData({ deletingReservation: false })
          wx.showToast({
            title: err.message || '\u5220\u9664\u5931\u8d25',
            icon: 'none'
          })
        }
      }
    })
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

  goToFeedback() {
    wx.navigateTo({ url: `${ADMIN_ROOT}/feedback/feedback` })
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
