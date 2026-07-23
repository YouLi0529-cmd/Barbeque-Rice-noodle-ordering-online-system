const apiClient = require('../../../../utils/apiClient')
const { getCustomNavOptions } = require('../../../../utils/customNav')
const app = getApp()

function isWechatNicknamePlaceholder(value) {
  return String(value || '').trim() === '微信用户'
}

function formatPhone(phoneNumber) {
  const phone = String(phoneNumber || '').trim()
  if (phone.length === 11) return `${phone.slice(0, 3)}****${phone.slice(-4)}`
  return phone || '未授权'
}

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 44,
    navContentTop: 0,
    navContentHeight: 44,
    navTitleFontSize: 18,
    navIconSize: 14,
    navIconStroke: 2,
    userInfo: null,
    phoneDisplay: '未授权',
    accountStatus: '待完善',
    nickNameInput: '',
    birthDate: '',
    maxBirthDate: '',
    saving: false
  },

  onLoad() {
    const today = new Date()
    const maxBirthDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    this.setData({
      ...getCustomNavOptions(),
      maxBirthDate
    })
  },

  onShow() {
    this.loadAccount()
  },

  async loadAccount() {
    if (!apiClient.isEnabled()) return

    try {
      const result = await apiClient.call('user.me')
      const userInfo = result.data || null
      const completed = !!(userInfo && userInfo.profileCompleted && userInfo.status !== 0)
      this.setData({
        userInfo,
        phoneDisplay: formatPhone(userInfo && userInfo.phoneNumber),
        accountStatus: completed ? '已完善' : '待完善',
        nickNameInput: userInfo && userInfo.nickName || '',
        birthDate: userInfo && userInfo.birthDate || ''
      })
    } catch (err) {
      console.error('加载账号信息失败', err)
      wx.showToast({
        title: '账号信息加载失败',
        icon: 'none'
      })
    }
  },

  onNicknameInput(e) {
    this.setData({
      nickNameInput: String(e.detail.value || '').slice(0, 20)
    })
  },

  onBirthDateChange(e) {
    this.setData({
      birthDate: e.detail.value || ''
    })
  },

  chooseWechatNickname() {
    const focusNicknameInput = () => {
      this.setData({ nickNameInput: this.data.nickNameInput })
      wx.showToast({
        title: '请在昵称栏选择或输入',
        icon: 'none'
      })
    }

    if (typeof wx.getUserProfile !== 'function') {
      focusNicknameInput()
      return
    }

    wx.getUserProfile({
      desc: '用于填写微信昵称',
      success: res => {
        const nickName = String(res && res.userInfo && res.userInfo.nickName || '').trim()
        if (nickName && !isWechatNicknamePlaceholder(nickName)) {
          this.setData({ nickNameInput: nickName })
          return
        }
        wx.showToast({
          title: '微信未返回昵称，请填写',
          icon: 'none'
        })
        focusNicknameInput()
      },
      fail: err => {
        console.warn('get wechat nickname unavailable', err)
        focusNicknameInput()
      }
    })
  },

  async saveAccount() {
    const nickName = this.data.nickNameInput.trim()
    if (!nickName) {
      wx.showToast({
        title: '请输入账号名称',
        icon: 'none'
      })
      return
    }

    this.setData({ saving: true })
    try {
      const result = await apiClient.call('user.updateAccount', {
        nickName,
        birthDate: this.data.birthDate
      })
      const userInfo = result.data && result.data.user || this.data.userInfo
      app.globalData.userInfo = userInfo
      this.setData({
        userInfo,
        nickNameInput: userInfo && userInfo.nickName || nickName,
        birthDate: userInfo && userInfo.birthDate || this.data.birthDate
      })
      wx.showToast({
        title: '已保存',
        icon: 'success'
      })
    } catch (err) {
      console.error('保存账号信息失败', err)
      wx.showToast({
        title: err.message || '保存失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ saving: false })
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
