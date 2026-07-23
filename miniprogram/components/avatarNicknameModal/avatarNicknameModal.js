// components/avatarNicknameModal/avatarNicknameModal.js
const apiClient = require('../../utils/apiClient')

// 开发阶段用于模拟手机号授权。正式发布前改为 false，并确认 phone.getNumber 可用。
const USE_TEST_PHONE = false
const TEST_PHONE_NUMBER = '13800000000'

function isWechatNicknamePlaceholder(value) {
  return String(value || '').trim() === '微信用户'
}

Component({
  properties: {
    showAvaModal: {
      type: Boolean,
      value: false
    },
    loadingGif: {
      type: String,
      value: '/images/orderloadinggif-transparent.gif'
    },
    titleText: {
      type: String,
      value: '授权微信手机号完成下单'
    },
    descText: {
      type: String,
      value: ''
    },
    confirmText: {
      type: String,
      value: '授权并提交'
    }
  },

  data: {
    avatarUrl: null,
    nickName: null,
    phoneNumber: null,
    phoneCode: null,
    realPhoneNumber: null,
    saving: false,
    nicknameInputFocus: false
  },

  methods: {
    catchtouchmove() {},

    onNicknameInput(res) {
      const value = String(res.detail.value || '').slice(0, 20)
      this.setData({
        nickName: value
      })
    },

    useWechatNickname() {
      const focusNicknameInput = () => {
        this.setData({ nicknameInputFocus: false }, () => {
          this.setData({ nicknameInputFocus: true })
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
            this.setData({ nickName })
            return
          }
          focusNicknameInput()
        },
        fail: err => {
          console.warn('get wechat nickname unavailable', err)
          focusNicknameInput()
        }
      })
    },

    async getphonenumber(e) {
      if (this.data.saving) {
        return
      }

      if (USE_TEST_PHONE) {
        this.setData({
          saving: true,
          phoneNumber: TEST_PHONE_NUMBER,
          realPhoneNumber: TEST_PHONE_NUMBER
        })
        await this.saveUserInfo()
        return
      }

      if (!e.detail || !e.detail.code) {
        const errMsg = String(e && e.detail && e.detail.errMsg || '')
        console.error('getPhoneNumber did not return authorization code', e && e.detail)
        wx.showToast({
          title: errMsg.includes('deny') ? '请允许授权手机号' : '微信未返回手机号',
          icon: 'none'
        })
        return
      }

      try {
        this.setData({
          saving: true
        })

        const phoneResult = apiClient.isEnabled()
          ? await apiClient.call('phone.getNumber', { code: e.detail.code })
          : (await wx.cloud.callFunction({
            name: 'getPhoneNumber',
            data: { code: e.detail.code }
          })).result

        if (!phoneResult || !phoneResult.success || !phoneResult.phoneNumber) {
          throw new Error(phoneResult?.message || '获取手机号失败，请重试')
        }

        const phoneNumber = phoneResult.phoneNumber
        this.setData({
          phoneNumber,
          phoneCode: e.detail.code,
          realPhoneNumber: phoneNumber
        })

        await this.saveUserInfo()
      } catch (err) {
        this.setData({
          saving: false
        })
        console.error('获取手机号失败', err)
        wx.showToast({
          title: err.message || '获取手机号失败',
          icon: 'none'
        })
      }
    },

    async saveUserInfo() {
      const {
        avatarUrl,
        nickName,
        phoneNumber,
        realPhoneNumber
      } = this.data

      if (!realPhoneNumber && !phoneNumber) {
        this.setData({
          saving: false
        })
        wx.showToast({
          title: '请授权手机号',
          icon: 'none'
        })
        return
      }

      const phone = realPhoneNumber || phoneNumber

      try {
        const app = getApp()
        const avatarUrlForSave = avatarUrl || ''

        const profileResult = apiClient.isEnabled()
          ? await apiClient.call('user.completeProfile', {
            avatarUrl: avatarUrlForSave,
            nickName: String(nickName || '').trim(),
            phoneNumber: phone
          })
          : (await wx.cloud.callFunction({
            name: 'completeUserProfile',
            data: {
              avatarUrl: avatarUrlForSave,
              nickName: String(nickName || '').trim(),
              phoneNumber: phone
            }
          })).result

        if (!profileResult || !profileResult.success) {
          throw new Error(profileResult?.error || profileResult?.message || '保存用户信息失败')
        }

        const user = profileResult.data && profileResult.data.user
        app.globalData.userInfo = user

        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })

        this.triggerEvent('saved', {
          avatarUrl: avatarUrlForSave,
          nickName: user && user.nickName,
          phoneNumber: phone,
          user
        })

        this.closeModalTap()
      } catch (err) {
        this.setData({
          saving: false
        })
        console.error('保存用户信息失败', err)
        wx.showToast({
          title: err.message || '保存失败，请重试',
          icon: 'none'
        })
      }
    },

    setBtnTap() {
      this.saveUserInfo()
    },

    closeModalTap() {
      this.setData({
        showAvaModal: false,
        nickName: null,
        avatarUrl: null,
        phoneNumber: null,
        phoneCode: null,
        realPhoneNumber: null,
        saving: false,
        nicknameInputFocus: false
      })
      this.triggerEvent('closed')
    }
  }
})
