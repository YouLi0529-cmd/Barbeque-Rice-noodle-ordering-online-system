// pages/queue/queue.js
Page({
  data: {
    peopleOptions: [
      { label: '2人', people_count: 2, table_type: 'small' },
      { label: '3-4人', people_count: 4, table_type: 'medium' },
      { label: '5-6人', people_count: 6, table_type: 'large' },
      { label: '7人以上', people_count: 7, table_type: 'xlarge' }
    ],
    selectedIndex: 0,
    nickname: '',
    phone: '',
    submitting: false,
    queueResult: null
  },

  selectPeople(e) {
    this.setData({
      selectedIndex: Number(e.currentTarget.dataset.index)
    })
  },

  onNicknameInput(e) {
    this.setData({
      nickname: e.detail.value
    })
  },

  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value
    })
  },

  async takeNumber() {
    if (this.data.submitting) return

    const nickname = this.data.nickname.trim()
    const phone = this.data.phone.trim()
    if (!nickname && !phone) {
      wx.showToast({ title: '请填写昵称或手机号', icon: 'none' })
      return
    }

    const option = this.data.peopleOptions[this.data.selectedIndex]
    this.setData({ submitting: true })
    wx.showLoading({ title: '取号中...' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'queueManage',
        data: {
          action: 'create',
          people_count: option.people_count,
          table_type: option.table_type,
          nickname,
          phone
        }
      })

      const result = res.result || {}
      if (!result.success) {
        throw new Error(result.message || '取号失败')
      }

      wx.hideLoading()
      this.setData({
        queueResult: result.data
      })
      wx.showToast({ title: '取号成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('取号失败', err)
      wx.showToast({ title: err.message || '取号失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
