// components/avatarNicknameModal/avatarNicknameModal.js
const apiClient = require('../../utils/apiClient')
const USE_TEST_PHONE = true
const TEST_PHONE_NUMBER = '13800000000'

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    showAvaModal: {
      type: Boolean,
      value: false,
    },
    loadingGif: {
      type: String,
      value: '/images/orderloadinggif-transparent.gif',
    },
    titleText: {
      type: String,
      value: '授权手机号完成下单',
    },
    descText: {
      type: String,
      value: '授权后将用会员卡号记录您的订单信息，无需单独设置昵称。',
    },
    confirmText: {
      type: String,
      value: '授权并提交',
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    avatarUrl: null,
    nickName: null,
    phoneNumber: null,
    phoneCode: null,
    realPhoneNumber: null, // 真实的手机号（用于提交）
    saving: false,
  },

  /**
   * 组件的方法列表
   */
  methods: {
    /**
     * 阻止页面滑动
     */
    catchtouchmove() { },

    /** 获取昵称信息 */
    bindblur(res) {
      const value = res.detail.value
      this.setData({
        nickName: value
      })
    },

    /** 获取手机号 */
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

      console.log('手机号授权结果：', e.detail)
      if (e.detail.code) {
        // 获取成功，调用云函数解密
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
          
          if (phoneResult && phoneResult.success && phoneResult.phoneNumber) {
            const phoneNumber = phoneResult.phoneNumber
            // 格式化显示手机号（中间4位用*代替，保护隐私）
           // const displayPhone = phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
            
            this.setData({
              phoneNumber: phoneNumber,
              phoneCode: e.detail.code,
              realPhoneNumber: phoneNumber // 保存真实手机号用于提交
            })
            
            await this.saveUserInfo()
          } else {
            const errorMsg = phoneResult?.message || '获取手机号失败，请重试'
            throw new Error(errorMsg)
          }
        } catch (err) {
          this.setData({
            saving: false
          })
          console.error('解密手机号失败', err)
          wx.showToast({
            title: err.message || '获取手机号失败',
            icon: 'none'
          })
        }
      } else {
        wx.showToast({
          title: '获取手机号失败',
          icon: 'none'
        })
      }
    },

    /**
     * 保存用户信息
     */
    async saveUserInfo() {
      const {
        avatarUrl,
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
            phoneNumber: phone
          })
          : (await wx.cloud.callFunction({
            name: 'completeUserProfile',
            data: {
              avatarUrl: avatarUrlForSave,
              phoneNumber: phone
            }
          })).result

        if (!profileResult || !profileResult.success) {
          throw new Error(profileResult?.error || profileResult?.message || '保存用户信息失败')
        }

        const user = profileResult.data.user
        app.globalData.userInfo = user

        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })

        // 通知父组件更新
        this.triggerEvent("saved", {
          avatarUrl: avatarUrlForSave,
          nickName: user.nickName,
          phoneNumber: phone,
          user
        })

        // 关闭弹窗
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

    /**
     * 设置信息按钮点击监听（保留用于兼容）
     */
    setBtnTap() {
      this.saveUserInfo()
    },

    /**
     * 关闭弹窗
     */
    closeModalTap() {
      this.setData({
        showAvaModal: false,
        nickName: null,
        avatarUrl: null,
        phoneNumber: null,
        phoneCode: null,
        realPhoneNumber: null,
        saving: false
      })
      this.triggerEvent("closed")
    },
  }
})
