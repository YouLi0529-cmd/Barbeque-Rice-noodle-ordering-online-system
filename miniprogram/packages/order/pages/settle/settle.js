// packages/order/pages/settle/settle.js
const app = getApp()
const apiClient = require('../../../../utils/apiClient')
const db = apiClient.isEnabled() ? null : wx.cloud.database()
const { getCustomNavOptions } = require('../../../../utils/customNav')

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 44,
    navContentTop: 0,
    navContentHeight: 44,
    navTitleFontSize: 18,
    navIconSize: 14,
    navIconStroke: 2,
    orderGoods: [],
    orderGoodsCount: 0,
    totalPrice: 0,
    finalPrice: 0,
    orderType: 'dineIn',
    tableNumber: '',
    payMethod: 'wechat',
    orderScene: 'dineIn',
    userInfo: null,
    submitting: false,
    canSubmit: false,
    showAuthModal: false,
    orderSubmitted: false,
    submittedOrderId: '',
    submitLoadingGif: '/images/orderloadinggif-transparent.gif',
    orderCards: [],
    previousOrderCards: [],
    sessionTotalPrice: 0,
    sessionGoodsCount: 0,
    activeOrderSession: null,
    sharedSessionId: '',
    appendToOrderId: '',
    isAddOnOrder: false,
    addOnIndex: 0,
    currentCardTitle: '首单'
  },

  onLoad() {
    this.setData(getCustomNavOptions())
    this.loadCartData()
    this.loadUserInfo()
  },

  onShow() {
    this.loadUserInfo()
    this.updateCanSubmit()
  },

  buildOrderCard(options) {
    const goods = Array.isArray(options.goods) ? options.goods : []
    const goodsCount = options.goodsCount !== undefined
      ? Number(options.goodsCount) || 0
      : goods.reduce((sum, item) => sum + (Number(item.count) || 0), 0)
    const finalPrice = Number(options.finalPrice || options.totalPrice || 0)

    return {
      cardId: options.cardId || options.orderId || `pending-${Date.now()}`,
      orderId: options.orderId || '',
      title: options.title || '首单',
      goods,
      goodsCount,
      totalPrice: Number(options.totalPrice || finalPrice),
      finalPrice,
      submitted: options.submitted === true,
      isAddOnOrder: options.isAddOnOrder === true
    }
  },

  normalizeStoredCards(cards) {
    if (!Array.isArray(cards)) {
      return []
    }

    return cards.map((card, index) => {
      const goods = Array.isArray(card.goods) ? card.goods.map(goodsItem => {
        const tags = Array.isArray(goodsItem.tags) ? goodsItem.tags : []
        return {
          ...goodsItem,
          tags,
          tagText: goodsItem.tagText || tags.join('、'),
          subtotal: Number(goodsItem.subtotal || 0).toFixed(2)
        }
      }) : []

      return this.buildOrderCard({
        ...card,
        cardId: card.cardId || card.orderId || `stored-${index}`,
        goods,
        submitted: true
      })
    })
  },

  getOrderCardsData(orderCards) {
    const cards = Array.isArray(orderCards) ? orderCards : []
    return {
      orderCards: cards,
      sessionTotalPrice: cards.reduce((sum, card) => sum + (Number(card.finalPrice) || 0), 0),
      sessionGoodsCount: cards.reduce((sum, card) => sum + (Number(card.goodsCount) || 0), 0)
    }
  },

  getValidActiveOrderSession(cartData) {
    const session = cartData.activeOrderSession || wx.getStorageSync('activeOrderSession')
    if (!session || !session.rootOrderId) {
      return null
    }

    const orderScene = cartData.orderScene === 'camping' || cartData.orderType === 'camping'
      ? 'camping'
      : 'dineIn'

    if (session.orderScene !== orderScene) {
      return null
    }

    if (orderScene !== 'camping') {
      const sessionTable = String(session.tableNumber || '')
      const currentTable = String(cartData.tableNumber || '')
      if (!sessionTable || sessionTable !== currentTable) {
        return null
      }
    }

    const cards = this.normalizeStoredCards(session.cards)
    if (cards.length === 0) {
      return null
    }

    return {
      ...session,
      cards
    }
  },

  saveActiveOrderSession(orderCards, submittedOrderId) {
    const submittedCards = (orderCards || []).filter(card => card.submitted)
    if (submittedCards.length === 0) {
      return
    }

    const rootOrderId = this.data.appendToOrderId || submittedOrderId
    const session = {
      rootOrderId,
      orderScene: this.data.orderScene,
      orderType: this.data.orderType,
      tableNumber: this.data.orderScene === 'camping' ? '' : this.data.tableNumber,
      cards: submittedCards,
      addOnCount: Math.max(submittedCards.length - 1, 0),
      updateTime: Date.now()
    }

    wx.setStorageSync('activeOrderSession', session)
    this.setData({
      activeOrderSession: session,
      appendToOrderId: rootOrderId
    })
  },

  loadCartData() {
    try {
      const cartData = wx.getStorageSync('settleCartData')
      if (!cartData) {
        wx.showToast({
          title: '购物车为空',
          icon: 'none'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
        return
      }

      const goodsList = []
      let orderGoodsCount = 0
      for (let cartKey in cartData.cart) {
        const item = cartData.cart[cartKey]
        let tagsArray = []

        if (item.tagLabels && Array.isArray(item.tagLabels)) {
          tagsArray = item.tagLabels
        } else if (item.tags && typeof item.tags === 'object') {
          Object.keys(item.tags).forEach(tagId => {
            const value = item.tags[tagId]
            if (Array.isArray(value)) {
              tagsArray.push(...value)
            } else if (value) {
              tagsArray.push(value)
            }
          })
        }

        const subtotal = (item.info.price * item.count).toFixed(2)
        orderGoodsCount += Number(item.count) || 0

        const displayTags = tagsArray.map(tag => String(tag).replace(/^备注[:：]/, ''))

        goodsList.push({
          dishId: item.dishId || item.info._id,
          dishName: item.info.name,
          dishImage: item.info.image,
          price: item.info.price,
          count: item.count,
          tags: displayTags,
          tagText: displayTags.join('、'),
          subtotal
        })
      }

      const totalPrice = Number(cartData.totalPrice) || 0
      const orderScene = cartData.orderScene === 'camping' || cartData.orderType === 'camping'
        ? 'camping'
        : 'dineIn'
      const activeOrderSession = this.getValidActiveOrderSession(cartData)
      const savedCards = activeOrderSession ? activeOrderSession.cards : []
      const addOnIndex = activeOrderSession ? Number(activeOrderSession.addOnCount || Math.max(savedCards.length - 1, 0)) + 1 : 0
      const currentCardTitle = activeOrderSession ? `加菜单${addOnIndex}` : '首单'
      const pendingCard = this.buildOrderCard({
        cardId: 'pending-current-order',
        title: currentCardTitle,
        goods: goodsList,
        goodsCount: orderGoodsCount,
        totalPrice,
        finalPrice: totalPrice,
        submitted: false,
        isAddOnOrder: !!activeOrderSession
      })

      this.setData({
        orderGoods: goodsList,
        orderGoodsCount,
        totalPrice,
        finalPrice: totalPrice,
        tableNumber: cartData.tableNumber || '',
        orderType: cartData.orderType || 'dineIn',
        orderScene,
        sharedSessionId: cartData.sharedSessionId || '',
        submitLoadingGif: orderScene === 'camping'
          ? '/images/loadinggif-cutout-transparent.gif'
          : '/images/orderloadinggif-transparent.gif',
        activeOrderSession,
        appendToOrderId: activeOrderSession ? activeOrderSession.rootOrderId : '',
        isAddOnOrder: !!activeOrderSession,
        addOnIndex,
        currentCardTitle,
        previousOrderCards: savedCards,
        ...this.getOrderCardsData([pendingCard])
      })

      wx.removeStorageSync('settleCartData')
      this.updateCanSubmit()
    } catch (err) {
      console.error('加载购物车数据失败', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  async loadUserInfo() {
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo
      })
    }
  },

  async loadUserInfoFromDB() {
    try {
      if (apiClient.isEnabled()) {
        const result = await apiClient.call('user.me')
        const user = result.data || null
        if (user) {
          app.globalData.userInfo = user
          this.setData({
            userInfo: user
          })
        }
        return
      }

      const openid = app.globalData.openid
      const res = await db.collection('user').where({
        _openid: openid
      }).get()

      if (res.data && res.data.length > 0) {
        const user = res.data[0]
        app.globalData.userInfo = user
        this.setData({
          userInfo: user
        })
      }
    } catch (err) {
      console.error('从数据库加载用户信息失败', err)
    }
  },

  selectOrderType(e) {
    const orderType = e.currentTarget.dataset.value
    this.setData({ orderType })
    this.updateCanSubmit()
  },

  scanTableCode() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode', 'barCode', 'wxCode'],
      success: (res) => {
        let tableNumber = ''

        if (res.path) {
          const queryStr = res.path.split('?')[1]
          if (queryStr) {
            const params = queryStr.split('&')
            for (let param of params) {
              const [key, value] = param.split('=')
              if (key === 'scene' && value) {
                tableNumber = decodeURIComponent(value).trim()
                break
              }
            }
          }
        }

        if (tableNumber) {
          this.setData({ tableNumber })
          this.updateCanSubmit()
        } else {
          wx.showToast({
            title: '未能识别桌码',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        console.error('扫码失败', err)
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({
            title: '扫码失败',
            icon: 'none'
          })
        }
      }
    })
  },

  updateCanSubmit() {
    const { tableNumber, orderGoods, orderScene } = this.data
    const needTableNumber = orderScene !== 'camping'
    this.setData({
      canSubmit: (!needTableNumber || !!tableNumber) && Array.isArray(orderGoods) && orderGoods.length > 0
    })
  },

  isProfileCompleted(userInfo) {
    return !!(
      userInfo &&
      userInfo.nickName &&
      userInfo.phoneNumber &&
      userInfo.userCode &&
      userInfo.profileCompleted === true &&
      userInfo.status === 1
    )
  },

  async submitOrder() {
    if (!this.data.canSubmit || this.data.submitting) {
      return
    }

    await this.loadUserInfoFromDB()

    const userInfo = this.data.userInfo
    if (!this.isProfileCompleted(userInfo)) {
      this.setData({
        showAuthModal: true
      })
      return
    }

    if (this.data.orderScene !== 'camping' && !this.data.tableNumber) {
      wx.showToast({
        title: '请先扫描桌码',
        icon: 'none'
      })
      return
    }

    this.setData({ submitting: true })

    try {
      const orderPayload = {
        orderGoods: this.data.orderGoods,
        totalPrice: this.data.totalPrice,
        finalPrice: this.data.finalPrice,
        tableNumber: this.data.orderScene === 'camping' ? '' : this.data.tableNumber,
        orderType: this.data.orderType,
        orderScene: this.data.orderScene,
        sharedSessionId: this.data.sharedSessionId,
        parentOrderId: this.data.appendToOrderId,
        addOnIndex: this.data.addOnIndex,
        orderCardTitle: this.data.currentCardTitle
      }
      const doBuyResult = apiClient.isEnabled()
        ? await apiClient.call('order.create', orderPayload)
        : (await wx.cloud.callFunction({
          name: 'doBuy',
          data: orderPayload
        })).result

      if (!doBuyResult || !doBuyResult.success) {
        const errorMsg = doBuyResult?.error || doBuyResult?.message || '下单失败'
        throw new Error(errorMsg)
      }

      const orderId = doBuyResult.orderId
      const serverOrder = doBuyResult.order || {}
      const serverFinalPrice = Number(
        doBuyResult.order && doBuyResult.order.finalPrice !== undefined
          ? doBuyResult.order.finalPrice
          : this.data.finalPrice
      )

      if (this.data.orderScene !== 'camping') {
        await this.deleteOrderDraft()
        await this.clearSharedCart()
      }
      this.clearCart()

      const submittedGoods = Array.isArray(serverOrder.goods)
        ? serverOrder.goods.map(item => {
            const tags = Array.isArray(item.tags) ? item.tags : []
            return {
              dishId: item.dishId,
              dishName: item.dishName,
              dishImage: item.dishImage,
              price: item.price,
              count: item.count,
              tags,
              tagText: tags.join('、'),
              subtotal: Number(item.subtotal || 0).toFixed(2)
            }
          })
        : this.data.orderGoods
      const submittedGoodsCount = submittedGoods.reduce((sum, item) => {
        return sum + (Number(item.count) || 0)
      }, 0)
      const submittedCard = this.buildOrderCard({
        cardId: orderId,
        orderId,
        title: this.data.currentCardTitle,
        goods: submittedGoods,
        goodsCount: submittedGoodsCount,
        totalPrice: Number(serverOrder.totalPrice || serverFinalPrice),
        finalPrice: serverFinalPrice,
        submitted: true,
        isAddOnOrder: this.data.isAddOnOrder
      })
      const submittedCards = Array.isArray(this.data.previousOrderCards)
        ? this.data.previousOrderCards
        : []
      const orderCards = submittedCards.concat(submittedCard)

      this.setData({
        orderGoods: submittedGoods,
        orderGoodsCount: submittedGoodsCount,
        finalPrice: serverFinalPrice,
        totalPrice: Number(serverOrder.totalPrice || serverFinalPrice),
        orderSubmitted: true,
        submittedOrderId: orderId,
        previousOrderCards: orderCards,
        ...this.getOrderCardsData(orderCards)
      })
      this.saveActiveOrderSession(orderCards, orderId)

      wx.showToast({
        title: '提交成功',
        icon: 'success'
      })
    } catch (err) {
      console.error('创建订单失败', err)
      wx.showToast({
        title: err.message || '下单失败',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  catchSubmitLoadingMove() {},

  editOrder() {
    wx.navigateBack()
  },

  checkoutOrder() {
    if (!this.data.orderSubmitted) {
      return
    }

    wx.showModal({
      title: '订单已提交',
      content: '请联系店员结账。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  addMoreDishes() {
    const targetUrl = this.data.orderScene === 'camping'
      ? '/packages/camping/pages/campingorderfood/campingorderfood'
      : '/packages/order/pages/index/index'
    const pages = getCurrentPages()

    if (pages.length > 1) {
      wx.navigateBack()
      return
    }

    wx.navigateTo({
      url: targetUrl
    })
  },

  async deleteOrderDraft() {
    try {
      if (apiClient.isEnabled()) {
        await apiClient.call('orderDraft.delete', {
          action: 'delete'
        })
        return
      }

      await wx.cloud.callFunction({
        name: 'orderDraft',
        data: {
          action: 'delete'
        }
      })
    } catch (err) {
      console.error('删除预点单草稿失败', err)
    }
  },

  async clearSharedCart() {
    if (!this.data.sharedSessionId) return

    try {
      if (apiClient.isEnabled()) {
        await apiClient.call('sharedCart.clear', {
          action: 'clear',
          sessionId: this.data.sharedSessionId,
          tableNumber: this.data.tableNumber
        })
        return
      }

      await wx.cloud.callFunction({
        name: 'sharedCart',
        data: {
          action: 'clear',
          sessionId: this.data.sharedSessionId,
          tableNumber: this.data.tableNumber
        }
      })
    } catch (err) {
      console.error('清空共同点单购物车失败', err)
    }
  },

  clearCart() {
    const pages = getCurrentPages()
    const indexPage = pages.find(page => page.route === 'packages/order/pages/index/index')
    if (indexPage) {
      indexPage.updateCart({})
    }
    const campingPage = pages.find(page => page.route === 'packages/camping/pages/campingorderfood/campingorderfood')
    if (campingPage) {
      campingPage.updateCart({})
    }
  },

  async onUserInfoSaved() {
    this.setData({
      showAuthModal: false
    })
    await this.loadUserInfoFromDB()
    this.submitOrder()
  }
})
