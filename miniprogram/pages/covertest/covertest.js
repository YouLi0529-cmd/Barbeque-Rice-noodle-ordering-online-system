// pages/covertest/covertest.js
const { getCustomNavOptions } = require('../../utils/customNav')

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 44,
    navContentTop: 0,
    navContentHeight: 44,
    navTitleFontSize: 18,
    navIconSize: 14,
    navIconStroke: 2,
    searchRowHeight: 38,
    searchRowTop: 50,
    shopNavTotalHeight: 84,
    planeState: '',
    orderTransitioning: false,
    showOrderPreview: false,
    showCampingPreview: false,
    showContactModal: false
  },

  refreshCustomNav() {
    const navOptions = getCustomNavOptions()
    const searchRowHeight = 38
    this.setData({
      ...navOptions,
      searchRowHeight,
      searchRowTop: navOptions.navBarHeight + 8,
      shopNavTotalHeight: navOptions.navBarHeight + searchRowHeight + 16
    })
  },

  onLoad() {
    this.refreshCustomNav()
  },

  onShow() {
    this.refreshCustomNav()
    this.stopOrderLoadingAnimation()
    this.stopCampingLoadingAnimation()
    this.setData({
      orderTransitioning: false,
      showOrderPreview: false
    })
  },

  startOrderLoadingAnimation() {
    // 使用原生 GIF，不再逐帧 setData。
  },

  stopOrderLoadingAnimation() {
    if (!this.orderLoadingTimer) return

    clearInterval(this.orderLoadingTimer)
    this.orderLoadingTimer = null
  },

  startCampingLoadingAnimation() {
    // 使用原生 GIF，不再逐帧 setData。
  },

  stopCampingLoadingAnimation() {
    if (!this.campingLoadingTimer) return

    clearInterval(this.campingLoadingTimer)
    this.campingLoadingTimer = null
  },

  preloadPackage(root) {
    try {
      if (wx.preloadSubpackage) {
        wx.preloadSubpackage({
          name: root,
          fail: err => console.warn('预加载分包失败', root, err)
        })
      }
    } catch (err) {
      console.warn('预加载分包异常', root, err)
    }
  },

  goOrder() {
    if (this.data.orderTransitioning || this.data.planeState) return
    this.preloadPackage('packages/order')

    try {
      if (wx.preloadPage) {
        wx.preloadPage({
          url: '/packages/order/pages/index/index'
        })
      }
    } catch (err) {
      console.warn('预加载点单页失败', err)
    }

    this.setData({
      orderTransitioning: true,
      showOrderPreview: true,
      showContactModal: false
    })
    this.startOrderLoadingAnimation()

    setTimeout(() => {
      wx.navigateTo({
        url: '/packages/order/pages/index/index',
        fail: () => {
          this.setData({
            orderTransitioning: false,
            showOrderPreview: false
          })
          this.stopOrderLoadingAnimation()
        }
      })
    }, 880)
  },

  goContact() {
    this.setData({
      showContactModal: true
    })
  },

  goCover() {
    this.setData({
      showContactModal: false
    })
  },

  closeContact() {
    this.setData({
      showContactModal: false
    })
  },

  stopPropagation() {},

  goCamping() {
    if (this.data.planeState) return
    const targetRoute = 'packages/camping/pages/campingorderfood/campingorderfood'
    const targetUrl = `/${targetRoute}`
    this.preloadPackage('packages/camping')

    try {
      if (wx.preloadPage) {
        wx.preloadPage({
          url: targetUrl
        })
      }
    } catch (err) {
      console.warn('预加载露营点单页失败', err)
    }

    this.setData({
      planeState: 'plane-launching',
      showCampingPreview: false
    })

    setTimeout(() => {
      this.setData({
        planeState: 'plane-covering'
      })
    }, 680)

    setTimeout(() => {
      this.setData({
        showCampingPreview: true
      })
      this.startCampingLoadingAnimation()
    }, 1220)

    setTimeout(() => {
      wx.navigateTo({
        url: targetUrl,
        complete: () => {
          this.setData({
            planeState: '',
            showCampingPreview: false
          })
          this.stopCampingLoadingAnimation()
        }
      })
    }, 1880)
  },

  goMyOrder() {
    this.preloadPackage('packages/user')
    wx.navigateTo({
      url: '/packages/user/pages/myorder/myorder'
    })
  },

  goMyHome() {
    this.preloadPackage('packages/user')
    wx.navigateTo({
      url: '/packages/user/pages/myhome/myhome'
    })
  }
})
