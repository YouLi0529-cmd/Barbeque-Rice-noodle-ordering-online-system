// pages/reservation/reservation.js
Page({
  data: {
    reserveDate: '',
    reserveTime: '',
    timeOptions: ['11:30', '12:00', '12:30', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'],
    peopleCount: '',
    name: '',
    phone: '',
    remark: '',
    submitting: false
  },

  onLoad() {
    this.setData({
      reserveDate: this.getToday(),
      reserveTime: '18:00'
    })
  },

  getToday() {
    const date = new Date()
    const pad = n => (n < 10 ? `0${n}` : `${n}`)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  },

  onDateChange(e) {
    this.setData({ reserveDate: e.detail.value })
  },

  onTimeChange(e) {
    this.setData({
      reserveTime: this.data.timeOptions[Number(e.detail.value)]
    })
  },

  onPeopleInput(e) {
    this.setData({ peopleCount: e.detail.value })
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  async submitReservation() {
    if (this.data.submitting) return

    const name = this.data.name.trim()
    const phone = this.data.phone.trim()
    const peopleCount = Number(this.data.peopleCount)

    if (!this.data.reserveDate || !this.data.reserveTime) {
      wx.showToast({ title: '请选择日期和时间', icon: 'none' })
      return
    }
    if (!peopleCount || peopleCount <= 0) {
      wx.showToast({ title: '请填写人数', icon: 'none' })
      return
    }
    if (!name) {
      wx.showToast({ title: '请填写姓名', icon: 'none' })
      return
    }
    if (!phone) {
      wx.showToast({ title: '请填写手机号', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'reservationManage',
        data: {
          action: 'create',
          name,
          phone,
          people_count: peopleCount,
          reserve_date: this.data.reserveDate,
          reserve_time: this.data.reserveTime,
          remark: this.data.remark.trim()
        }
      })

      const result = res.result || {}
      if (!result.success) {
        throw new Error(result.message || '预约失败')
      }

      wx.hideLoading()
      wx.showModal({
        title: '预约已提交',
        content: '预约已提交，请等待商家确认。',
        showCancel: false
      })
      this.setData({
        peopleCount: '',
        name: '',
        phone: '',
        remark: ''
      })
    } catch (err) {
      wx.hideLoading()
      console.error('提交预约失败', err)
      wx.showToast({ title: err.message || '预约失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
