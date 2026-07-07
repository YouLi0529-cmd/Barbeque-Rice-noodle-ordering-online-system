const app = getApp()
const apiClient = require('../../../../utils/apiClient')
const { getCustomNavOptions } = require('../../../../utils/customNav')

const WEEK_TEXT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const TIME_OPTIONS = ['11:00', '11:30', '12:00', '18:00', '19:00']
const PEOPLE_OPTIONS = [2, 4, 8]
const ROOM_OPTIONS = ['大厅', '包间', '天楼']

function pad(value) {
  return value < 10 ? `0${value}` : `${value}`
}

function formatDateValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function buildWeekDates() {
  const today = new Date()
  return Array.from({ length: 7 }).map((item, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() + index)
    const month = date.getMonth() + 1
    const day = date.getDate()
    return {
      value: formatDateValue(date),
      week: index === 0 ? '今天' : WEEK_TEXT[date.getDay()],
      day: `${month}/${day}`,
      text: `${month}月${day}日`
    }
  })
}

Page({
  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    navContentTop: 0,
    navContentHeight: 44,
    navTitleFontSize: 18,
    navIconSize: 14,
    navIconStroke: 2,
    weekDates: [],
    timeOptions: TIME_OPTIONS,
    peopleOptions: PEOPLE_OPTIONS,
    roomOptions: ROOM_OPTIONS,
    selectedDate: '',
    selectedDateText: '',
    selectedTime: '18:00',
    customTime: '18:30',
    isCustomTime: false,
    selectedPeople: 2,
    customPeople: '',
    isCustomPeople: false,
    selectedRoom: '大厅',
    userInfo: null,
    showAuthModal: false,
    pendingReservationSubmit: false,
    actionLoadingGif: '/images/orderloadinggif-transparent.gif'
  },

  onLoad() {
    const weekDates = buildWeekDates()
    const firstDate = weekDates[0] || {}
    this.setData({
      ...getCustomNavOptions(),
      weekDates,
      selectedDate: firstDate.value || '',
      selectedDateText: firstDate.text || ''
    })
    this.loadUserInfo()
  },

  onShow() {
    this.loadUserInfo()
  },

  async loadUserInfo() {
    try {
      if (apiClient.isEnabled()) {
        const result = await apiClient.call('user.me')
        const user = result.data || null
        app.globalData.userInfo = user
        this.setData({ userInfo: user })
        return user
      }

      const openid = app.globalData.openid
      if (!openid || !wx.cloud) {
        this.setData({ userInfo: null })
        return null
      }

      const res = await wx.cloud.database().collection('user').where({
        _openid: openid
      }).get()
      const user = res.data && res.data.length ? res.data[0] : null
      app.globalData.userInfo = user
      this.setData({ userInfo: user })
      return user
    } catch (err) {
      console.error('加载预约用户信息失败', err)
      return this.data.userInfo || app.globalData.userInfo || null
    }
  },

  hasUserPhone(user) {
    return !!(user && (user.phoneNumber || user.phone || user.userPhone))
  },

  getReservationPeople() {
    if (!this.data.isCustomPeople) return Number(this.data.selectedPeople || 0)
    const number = Number(this.data.customPeople)
    return Number.isFinite(number) && number > 0 ? number : 0
  },

  selectDate(e) {
    const value = e.currentTarget.dataset.value
    const match = this.data.weekDates.find(item => item.value === value)
    if (!match) return
    this.setData({
      selectedDate: match.value,
      selectedDateText: match.text
    })
  },

  selectTime(e) {
    const value = e.currentTarget.dataset.value
    if (!value) return
    this.setData({
      selectedTime: value,
      isCustomTime: false
    })
  },

  onCustomTimeChange(e) {
    const value = e.detail.value
    this.setData({
      customTime: value,
      selectedTime: value,
      isCustomTime: true
    })
  },

  selectPeople(e) {
    const value = Number(e.currentTarget.dataset.value)
    if (!Number.isFinite(value)) return
    this.setData({
      selectedPeople: value,
      isCustomPeople: false
    })
  },

  focusCustomPeople() {
    this.setData({
      isCustomPeople: true
    })
  },

  onCustomPeopleInput(e) {
    const value = e.detail.value
    const number = Number(value)
    this.setData({
      customPeople: value,
      selectedPeople: Number.isFinite(number) && number > 0 ? number : this.data.selectedPeople,
      isCustomPeople: true
    })
  },

  selectRoom(e) {
    const value = e.currentTarget.dataset.value
    if (!value) return
    this.setData({
      selectedRoom: value
    })
  },

  async submitReservation() {
    const people = this.getReservationPeople()
    if (!this.data.selectedDate || !this.data.selectedTime || !people || !this.data.selectedRoom) {
      wx.showToast({
        title: '请完善预约信息',
        icon: 'none'
      })
      return
    }

    const user = this.hasUserPhone(this.data.userInfo)
      ? this.data.userInfo
      : await this.loadUserInfo()

    if (!this.hasUserPhone(user)) {
      this.setData({
        pendingReservationSubmit: true,
        showAuthModal: true
      })
      wx.showToast({
        title: '请先授权手机号',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '提交中' })
      await apiClient.call('reservation.create', {
        selectedDate: this.data.selectedDate,
        selectedDateText: this.data.selectedDateText,
        selectedTime: this.data.selectedTime,
        peopleCount: people,
        roomType: this.data.selectedRoom
      })
      wx.hideLoading()
      wx.showToast({
        title: '预约已提交',
        icon: 'success'
      })
    } catch (err) {
      wx.hideLoading()
      console.error('提交预约失败', err)
      wx.showToast({
        title: err.message || '提交失败',
        icon: 'none'
      })
    }
  },

  onUserInfoSaved(e) {
    const user = e.detail && e.detail.user ? e.detail.user : null
    if (user) {
      app.globalData.userInfo = user
      this.setData({
        userInfo: user,
        showAuthModal: false
      })
    }

    this.loadUserInfo().then(() => {
      if (!this.data.pendingReservationSubmit) return
      this.setData({ pendingReservationSubmit: false })
      this.submitReservation()
    })
  },

  onAuthModalClosed() {
    this.setData({
      showAuthModal: false,
      pendingReservationSubmit: false
    })
  },

  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.reLaunch({
          url: '/pages/covertest/covertest'
        })
      }
    })
  }
})
