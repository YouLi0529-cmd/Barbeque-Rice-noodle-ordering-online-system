const { openPrivacyPolicyDocument } = require('../../utils/privacyPolicyDocument')

Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    }
  },

  data: {
    checked: false
  },

  methods: {
    stopPropagation() {},

    catchMove() {},

    toggleChecked() {
      this.setData({ checked: !this.data.checked })
    },

    openPolicy() {
      openPrivacyPolicyDocument()
    },

    confirm() {
      if (!this.data.checked) {
        wx.showToast({
          title: '请先勾选并同意隐私政策',
          icon: 'none'
        })
        return
      }

      wx.setStorageSync('privacyPolicyConsentV1', true)
      this.setData({ checked: false })
      this.triggerEvent('confirmed')
    }
  }
})
