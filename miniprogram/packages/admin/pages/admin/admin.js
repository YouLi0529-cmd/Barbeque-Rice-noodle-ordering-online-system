// packages/admin/pages/admin/admin.js
const db = wx.cloud.database()

const ADMIN_ROOT = '/packages/admin/pages/admin'

Page({
  data: {
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

  async onLoad(options) {
    await this.prepareAdminAuth()

    if (options.changePassword === 'true' && this.data.isAuthorized) {
      this.showChangePassword()
    }
  },

  async prepareAdminAuth() {
    try {
      wx.showLoading({ title: '验证中...' })
      const res = await db.collection('admin').limit(1).get()
      const hasAdmin = res.data && res.data.length > 0

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
      console.error('检查管理员失败', err)
      this.setData({
        authChecked: true,
        isAuthorized: false,
        showAuthModal: true,
        isFirstTime: true,
        adminPassword: ''
      })
    }
  },

  onAdminPasswordInput(e) {
    this.setData({ adminPassword: e.detail.value })
  },

  closeAuthModal() {
    const pages = getCurrentPages()
    this.setData({
      showAuthModal: false,
      adminPassword: ''
    })

    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    wx.reLaunch({
      url: '/pages/covertest/covertest'
    })
  },

  async confirmAdminAuth() {
    const password = this.data.adminPassword.trim()
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }
    if (password.length < 6) {
      wx.showToast({ title: '密码长度不能少于6位', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: this.data.isFirstTime ? '设置中...' : '登录中...' })
      const res = await db.collection('admin').limit(1).get()
      const admin = res.data && res.data[0]

      if (this.data.isFirstTime) {
        if (admin) {
          wx.hideLoading()
          this.setData({
            isFirstTime: false,
            adminPassword: ''
          })
          wx.showToast({ title: '管理员已存在，请登录', icon: 'none' })
          return
        }

        await db.collection('admin').add({
          data: {
            password,
            createTime: new Date(),
            updateTime: new Date()
          }
        })
      } else if (!admin || admin.password !== password) {
        wx.hideLoading()
        wx.showToast({ title: admin ? '密码错误' : '管理员未设置', icon: 'none' })
        return
      }

      wx.hideLoading()
      this.setData({
        isAuthorized: true,
        showAuthModal: false,
        adminPassword: ''
      })
      wx.showToast({ title: '登录成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('管理员验证失败', err)
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    }
  },

  // 菜品管理
  goToDish() {
    wx.navigateTo({
      url: `${ADMIN_ROOT}/dish/dish`
    })
  },

  // 用户管理
  goToUser() {
    wx.navigateTo({
      url: `${ADMIN_ROOT}/user/user`
    })
  },

  // 订单管理
  goToOrder() {
    wx.navigateTo({
      url: `${ADMIN_ROOT}/order/order`
    })
  },

  // 排队管理
  goToQueue() {
    wx.navigateTo({
      url: `${ADMIN_ROOT}/queue/queue`
    })
  },

  // 预约管理
  goToReservation() {
    wx.navigateTo({
      url: `${ADMIN_ROOT}/reservation/reservation`
    })
  },

  // 户外订单
  goToOutdoor() {
    wx.navigateTo({
      url: `${ADMIN_ROOT}/outdoor/outdoor`
    })
  },

  // 烤架管理
  goToGrill() {
    wx.navigateTo({
      url: `${ADMIN_ROOT}/grill/grill`
    })
  },

  // 充值选项管理
  goToRechargeOptions() {
    wx.navigateTo({
      url: `${ADMIN_ROOT}/rechargeOptions/rechargeOptions`
    })
  },

  // 公告管理
  goToNotice() {
    wx.navigateTo({
      url: `${ADMIN_ROOT}/notice/notice`
    })
  },

  // 桌码管理
  goToTableCode() {
    wx.navigateTo({
      url: `${ADMIN_ROOT}/tableCode/tableCode`
    })
  },

  // 打印机管理
  goToPrinter() {
    wx.navigateTo({
      url: `${ADMIN_ROOT}/printer/printer`
    })
  },

  // 店铺设置
  goToShopInfo() {
    wx.navigateTo({
      url: `${ADMIN_ROOT}/shopInfo/shopInfo`
    })
  },

  // 显示修改密码弹窗
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

  // 关闭密码弹窗
  closePasswordModal() {
    this.setData({
      showPasswordModal: false
    })
  },

  // 阻止冒泡
  stopPropagation() {},

  // 输入旧密码
  onOldPasswordInput(e) {
    this.setData({
      oldPassword: e.detail.value
    })
  },

  // 输入新密码
  onNewPasswordInput(e) {
    this.setData({
      newPassword: e.detail.value
    })
  },

  // 输入确认密码
  onConfirmPasswordInput(e) {
    this.setData({
      confirmPassword: e.detail.value
    })
  },

  // 确认修改密码
  async confirmChangePassword() {
    const { oldPassword, newPassword, confirmPassword } = this.data

    if (!oldPassword) {
      wx.showToast({
        title: '请输入原密码',
        icon: 'none'
      })
      return
    }

    if (!newPassword) {
      wx.showToast({
        title: '请输入新密码',
        icon: 'none'
      })
      return
    }

    if (newPassword.length < 6) {
      wx.showToast({
        title: '新密码长度不能少于6位',
        icon: 'none'
      })
      return
    }

    if (newPassword !== confirmPassword) {
      wx.showToast({
        title: '两次密码输入不一致',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '修改中...' })

      // 查询管理员信息
      const res = await db.collection('admin').get()

      if (res.data.length === 0) {
        wx.hideLoading()
        wx.showToast({
          title: '管理员不存在',
          icon: 'none'
        })
        return
      }

      const admin = res.data[0]

      // 验证旧密码
      if (admin.password !== oldPassword) {
        wx.hideLoading()
        wx.showToast({
          title: '原密码错误',
          icon: 'none'
        })
        return
      }

      // 更新密码
      await db.collection('admin').doc(admin._id).update({
        data: {
          password: newPassword,
          updateTime: new Date()
        }
      })

      wx.hideLoading()
      wx.showToast({
        title: '密码修改成功',
        icon: 'success'
      })

      this.closePasswordModal()
    } catch (err) {
      wx.hideLoading()
      console.error('修改密码失败', err)
      wx.showToast({
        title: '修改失败，请重试',
        icon: 'none'
      })
    }
  },

  // 返回上一页
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
