// pages/covertest/covertest.js
const { getCustomNavOptions } = require('../../utils/customNav')

const orderLoadingFrames = [
  '/images/orderloadinggif_frames/frame_00.png',
  '/images/orderloadinggif_frames/frame_01.png',
  '/images/orderloadinggif_frames/frame_02.png',
  '/images/orderloadinggif_frames/frame_03.png',
  '/images/orderloadinggif_frames/frame_04.png',
  '/images/orderloadinggif_frames/frame_05.png',
  '/images/orderloadinggif_frames/frame_06.png',
  '/images/orderloadinggif_frames/frame_07.png',
  '/images/orderloadinggif_frames/frame_08.png',
  '/images/orderloadinggif_frames/frame_09.png',
  '/images/orderloadinggif_frames/frame_10.png',
  '/images/orderloadinggif_frames/frame_11.png',
  '/images/orderloadinggif_frames/frame_12.png',
  '/images/orderloadinggif_frames/frame_13.png',
  '/images/orderloadinggif_frames/frame_14.png',
  '/images/orderloadinggif_frames/frame_15.png'
]

const campingLoadingFrames = [
  '/images/loadinggif_frames/frame_00.png',
  '/images/loadinggif_frames/frame_01.png',
  '/images/loadinggif_frames/frame_02.png',
  '/images/loadinggif_frames/frame_03.png',
  '/images/loadinggif_frames/frame_04.png',
  '/images/loadinggif_frames/frame_05.png',
  '/images/loadinggif_frames/frame_06.png',
  '/images/loadinggif_frames/frame_07.png',
  '/images/loadinggif_frames/frame_08.png',
  '/images/loadinggif_frames/frame_09.png',
  '/images/loadinggif_frames/frame_10.png',
  '/images/loadinggif_frames/frame_11.png',
  '/images/loadinggif_frames/frame_12.png',
  '/images/loadinggif_frames/frame_13.png',
  '/images/loadinggif_frames/frame_14.png',
  '/images/loadinggif_frames/frame_15.png',
  '/images/loadinggif_frames/frame_16.png'
]

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
    showContactModal: false,
    orderLoadingFrameIndex: 0,
    orderLoadingFrames,
    campingLoadingFrameIndex: 0,
    campingLoadingFrames
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

  goOrder() {
    if (this.data.orderTransitioning || this.data.planeState) return

    try {
      if (wx.preloadPage) {
        wx.preloadPage({
          url: 'pages/index/index'
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
        url: '/pages/index/index',
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
    const targetRoute = 'pages/campingorderfood/campingorderfood'
    const targetUrl = `/${targetRoute}`

    try {
      if (wx.preloadPage) {
        wx.preloadPage({
          url: targetRoute
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
    wx.navigateTo({
      url: '/pages/myorder/myorder'
    })
  },

  goMyHome() {
    wx.navigateTo({
      url: '/pages/myhome/myhome'
    })
  }
})
