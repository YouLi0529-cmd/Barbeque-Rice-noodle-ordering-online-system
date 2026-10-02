// packages/user/pages/myorder/myorder.js
const app = getApp()
const apiClient = require('../../../../utils/apiClient')
const db = apiClient.isEnabled() ? null : wx.cloud.database()
const { getCustomNavOptions } = require('../../../../utils/customNav')

Page({
  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    navContentTop: 0,
    navContentHeight: 44,
    navTitleFontSize: 18,
    tabs: ['堂食', '露营', '预点单'],
    currentTab: 0,
    orderList: [], // 订单列表
    // 分页相关
    orderPage: 0,
    orderPageSize: 20,
    orderHasMore: true,
    loadingOrders: false,
    ordersLoaded: false,
    actionLoading: false,
    actionLoadingText: '',
    actionLoadingGif: '/images/orderloadinggif-transparent.gif'
  },

  showActionLoading(text = '加载中') {
    this.setData({
      actionLoading: true,
      actionLoadingText: text
    })
  },

  hideActionLoading() {
    this.setData({
      actionLoading: false,
      actionLoadingText: ''
    })
  },

  catchActionLoadingMove() {},

  onLoad(options = {}) {
    this.setData(getCustomNavOptions())
    if (options.tab === 'draft') {
      this.setData({ currentTab: 2 })
    }
    this.loadOrders()
  },

  onShow() {
    this.loadUserInfo()
    this.loadOrders()
  },

  goCover() {
    wx.reLaunch({
      url: '/pages/covertest/covertest'
    })
  },

  goMyOrder() {},

  goMyHome() {
    wx.reLaunch({
      url: '/packages/user/pages/myhome/myhome'
    })
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      if (apiClient.isEnabled()) {
        const result = await apiClient.call('user.me')
        const user = result.data || null
        if (user) {
          this.setData({
            userInfo: user
          })
          app.globalData.userInfo = user
        }
        return
      }

      const openid = app.globalData.openid
      const res = await db.collection('user').where({
        _openid: openid
      }).get()
      
      if (res.data && res.data.length > 0) {
        const user = res.data[0]
        this.setData({
          userInfo: user
        })
      }
    } catch (err) {
      console.error('获取用户信息失败', err)
    }
  },
  // 切换标签
  switchTab(e) {
    const index = Number(e.currentTarget.dataset.index)
    this.setData({
      currentTab: index,
      // 重置分页状态
      orderPage: 0,
      orderHasMore: true,
      orderList: [],
      ordersLoaded: false
    })
    this.loadOrders()
  },

  // 加载订单列表
  async loadOrders(append = false) {
    if (this.data.loadingOrders) {
      return
    }

    if (this.data.currentTab === 2) {
      this.loadOrderDraft()
      return
    }

    if (!append) {
      this.setData({ ordersLoaded: false })
      this.showActionLoading('加载中')
    }
    
    try {
      this.setData({ loadingOrders: true })

      const currentScene = this.data.currentTab === 1 ? 'camping' : 'dineIn'
      const pageSize = this.data.orderPageSize
      const page = append ? this.data.orderPage + 1 : 0
      const skip = page * pageSize
      let res

      if (apiClient.isEnabled()) {
        res = await apiClient.call('order.list', {
          orderScene: currentScene,
          page,
          limit: pageSize
        })
      } else {
        const openid = app.globalData.openid
        let query = {
          _openid: openid,
          type: 'order'
        }
        if (currentScene === 'camping') {
          query.orderScene = 'camping'
        }

        res = await db.collection('order')
          .where(query)
          .orderBy('createTime', 'desc')
          .skip(skip)
          .limit(pageSize)
          .get()
      }

      // 格式化时间，避免界面显示 [object Object]
      const formatTime = (time) => {
        if (!time) return ''
        const source = time && time.$date ? time.$date : time
        const date = source instanceof Date ? source : new Date(source)
        if (Number.isNaN(date.getTime())) return ''
        const pad = (n) => (n < 10 ? '0' + n : n)
        const y = date.getFullYear()
        const m = pad(date.getMonth() + 1)
        const d = pad(date.getDate())
        const hh = pad(date.getHours())
        const mm = pad(date.getMinutes())
        return `${y}-${m}-${d} ${hh}:${mm}`
      }

      const rawList = res.data || []
      const sceneOrders = rawList
        .filter(order => {
          const orderScene = order.orderScene || 'dineIn'
          return order.deleted !== true && orderScene === currentScene && !this.isExpiredSavedOrder(order)
        })
      const groupedOrders = this.groupOrdersByRoot(sceneOrders)
      const mergedOrders = append
        ? this.groupOrdersByRoot(this.data.orderList.concat(groupedOrders))
        : groupedOrders
      const list = mergedOrders
        .map(order => this.normalizeOrder({
          ...order,
          orderScene: order.orderScene || 'dineIn'
        }, formatTime))
      
      const newList = list
      const hasMore = rawList.length === pageSize
      
      this.setData({
        orderList: newList,
        orderPage: page,
        orderHasMore: hasMore,
        ordersLoaded: true
      })
    } catch (err) {
      console.error('加载订单失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.hideActionLoading()
      this.setData({ loadingOrders: false })
    }
  },

  async loadOrderDraft() {
    if (this.data.loadingOrders) return
    this.setData({
      loadingOrders: true,
      ordersLoaded: false,
      orderHasMore: false
    })
    this.showActionLoading('加载中')
    try {
      const result = apiClient.isEnabled()
        ? await apiClient.call('orderDraft.get')
        : (await wx.cloud.callFunction({ name: 'orderDraft', data: { action: 'get' } })).result
      const draft = result && result.data
      const orderList = draft ? [this.normalizeDraft(draft)] : []
      this.setData({
        orderList,
        orderPage: 0,
        orderHasMore: false,
        ordersLoaded: true
      })
    } catch (err) {
      console.error('加载预点单失败', err)
      this.setData({ orderList: [], ordersLoaded: true })
      wx.showToast({ title: err.message || '加载预点单失败', icon: 'none' })
    } finally {
      this.hideActionLoading()
      this.setData({ loadingOrders: false })
    }
  },

  normalizeDraft(draft = {}) {
    const cart = draft.cart && typeof draft.cart === 'object' ? draft.cart : {}
    const goods = Object.keys(cart).map((key) => {
      const item = cart[key] || {}
      const info = item.info || {}
      const count = Math.max(1, Math.floor(Number(item.count || 0)))
      const price = Number(item.displayPrice !== undefined ? item.displayPrice : info.price || 0)
      return {
        dishId: item.dishId || info._id || key,
        dishName: info.name || '菜品',
        dishImage: info.image || '',
        price,
        count,
        subtotal: Number(item.subtotal !== undefined ? item.subtotal : price * count),
        tags: Array.isArray(item.tagLabels) ? item.tagLabels : []
      }
    }).filter(item => item.dishId)
    const totalPrice = Number(draft.totalPrice)
    const total = Number.isFinite(totalPrice)
      ? totalPrice
      : goods.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
    const formatTime = (time) => {
      const source = time && time.$date ? time.$date : time
      const date = source instanceof Date ? source : new Date(source)
      if (Number.isNaN(date.getTime())) return ''
      const pad = value => (value < 10 ? `0${value}` : String(value))
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
    return this.normalizeOrder({
      _id: String(draft._id || 'order-draft'),
      isDraft: true,
      savedOnly: true,
      draftCart: cart,
      orderScene: 'dineIn',
      goods,
      totalPrice: total,
      finalPrice: total,
      createTime: draft.updateTime || draft.createTime,
      expiresAt: draft.expiresAt
    }, formatTime)
  },

  // 触底加载更多
  onReachBottom() {
    if (this.data.orderHasMore && !this.data.loadingOrders) {
      this.loadOrders(true)
    }
  },

  groupOrdersByRoot(orders) {
    const groupMap = {}

    orders.forEach(order => {
      const rootOrderId = order.rootOrderId || order.parentOrderId || order._id
      if (!groupMap[rootOrderId]) {
        groupMap[rootOrderId] = []
      }
      groupMap[rootOrderId].push(order)
    })

    return Object.keys(groupMap).map(rootOrderId => {
      const group = groupMap[rootOrderId]
      const rootOrder = group.find(order => {
        return order._id === rootOrderId || order.isAddOnOrder !== true
      }) || this.getEarliestOrder(group)
      const latestOrder = this.getLatestOrder(group)
      const goods = group.reduce((list, order) => {
        return list.concat(Array.isArray(order.goods) ? order.goods : [])
      }, [])
      const totalPrice = group.reduce((sum, order) => {
        return sum + Number(order.totalPrice || 0)
      }, 0)
      const finalPrice = group.reduce((sum, order) => {
        return sum + Number(order.finalPrice || order.totalPrice || 0)
      }, 0)

      return {
        ...rootOrder,
        rootOrderId,
        orderIds: group.reduce((ids, order) => {
          if (Array.isArray(order.orderIds)) {
            return ids.concat(order.orderIds)
          }
          return order._id ? ids.concat(order._id) : ids
        }, []).filter((orderId, index, list) => list.indexOf(orderId) === index),
        goods,
        totalPrice,
        finalPrice,
        createTime: rootOrder.createTime || this.getEarliestOrder(group).createTime,
        latestCreateTime: latestOrder.createTime,
        pay_status: group.every(order => order.pay_status !== false),
        status: this.getMergedStatus(group)
      }
    }).sort((a, b) => {
      return this.getTimeValue(b.latestCreateTime || b.createTime) - this.getTimeValue(a.latestCreateTime || a.createTime)
    })
  },

  getEarliestOrder(orders) {
    return orders.reduce((earliest, order) => {
      return this.getTimeValue(order.createTime) < this.getTimeValue(earliest.createTime) ? order : earliest
    }, orders[0] || {})
  },

  getLatestOrder(orders) {
    return orders.reduce((latest, order) => {
      return this.getTimeValue(order.createTime) > this.getTimeValue(latest.createTime) ? order : latest
    }, orders[0] || {})
  },

  getTimeValue(time) {
    if (!time) return 0
    const source = time && time.$date ? time.$date : time
    const date = source instanceof Date ? source : new Date(source)
    const value = date.getTime()
    return Number.isNaN(value) ? 0 : value
  },

  isSavedOrder(order) {
    return order && (order.savedOnly === true || order.isDraft === true || !!order.expiresAt)
  },

  isExpiredSavedOrder(order) {
    if (!this.isSavedOrder(order)) {
      return false
    }
    const expiresAt = this.getTimeValue(order.expiresAt)
    return expiresAt > 0 && expiresAt <= Date.now()
  },

  isOrderCompleted(order) {
    const status = String(order && order.status != null ? order.status : '').toLowerCase()
    return !!order && (
      order.pay_status === true ||
      order.payStatus === true ||
      order.checkoutStatus === 'finished' ||
      status === 'completed' ||
      status === 'paid' ||
      Number(order.status) === 2
    )
  },

  isOrderCancelled(order) {
    const status = String(order && order.status != null ? order.status : '').toLowerCase()
    return !!order && (
      status === 'cancelled' ||
      Number(order.status) === 3
    )
  },

  getMergedStatus(orders) {
    if (orders.length > 0 && orders.every(order => this.isOrderCancelled(order))) return 'cancelled'
    if (orders.length > 0 && orders.every(order => this.isOrderCompleted(order))) return 'completed'
    const rootOrder = orders.find(order => order.isAddOnOrder !== true) || orders[0] || {}
    return rootOrder.status
  },

  normalizeOrder(order, formatTime) {
    const goods = this.normalizeGoods(order)
    const goodsCount = goods.reduce((sum, item) => sum + (Number(item.count) || 0), 0)
    const finalPrice = order.finalPrice !== undefined && order.finalPrice !== null
      ? order.finalPrice
      : order.totalPrice

    return {
      ...order,
      goods,
      goodsCount,
      previewGoods: goods.slice(0, 3),
      hasMoreGoods: goods.length > 3,
      finalPriceText: this.formatPrice(finalPrice),
      createTimeText: order.createTime ? formatTime(order.createTime) : '',
      statusText: this.getOrderStatusText(order),
      statusClass: this.getOrderStatusClass(order),
      tableNumberText: this.getOrderTableText(order)
    }
  },

  normalizeGoods(order) {
    const rawGoods = Array.isArray(order.goods)
      ? order.goods
      : Array.isArray(order.orderGoods)
        ? order.orderGoods
        : []

    return rawGoods.map((item, index) => {
      const dishName = item.dishName || item.goodsName || item.name || '菜品'
      const rawCount = Number(
        item.count !== undefined
          ? item.count
          : item.num !== undefined
            ? item.num
            : item.quantity
      )
      const count = rawCount > 0 ? rawCount : 1
      const price = Number(item.price || item.dishPrice || item.unitPrice || 0)
      const subtotal = Number(item.subtotal || item.totalPrice || price * count)
      const tags = Array.isArray(item.tags)
        ? item.tags
        : Array.isArray(item.tagLabels)
          ? item.tagLabels
          : []

      return {
        ...item,
        previewKey: item.dishId || item.goodsId || item._id || `${order._id || 'order'}-${index}`,
        dishId: item.dishId || item.goodsId || item._id || `${order._id || 'order'}-${index}`,
        dishName,
        shortName: dishName.slice(0, 1) || '菜',
        dishImage: item.dishImage || item.image || item.img || '',
        count,
        price,
        subtotal,
        tags,
        tagText: item.tagText || tags.join('、')
      }
    })
  },

  formatPrice(value) {
    const num = Number(value || 0)
    if (Number.isNaN(num)) {
      return '0'
    }
    return Number.isInteger(num) ? String(num) : num.toFixed(2)
  },

  // 堂食：已保存 / 已提交 / 已完成；其它状态只做兜底展示。
  getOrderStatusText(order) {
    if (this.isSavedOrder(order)) {
      return '已保存'
    }
    if (this.isOrderCompleted(order)) {
      return '已完成'
    }
    if (this.isOrderCancelled(order)) {
      return '已取消'
    }
    return '已提交'
  },

  getOrderStatusClass(order) {
    const statusText = this.getOrderStatusText(order)
    if (statusText === '已保存') return 'status-saved'
    if (statusText === '已完成') return 'status-done'
    if (statusText === '已取消') return 'status-cancel'
    return 'status-submitted'
  },

  getOrderTableText(order) {
    if (this.isSavedOrder(order)) {
      return ''
    }
    if (order.orderScene === 'camping') {
      return '露营订单'
    }
    const tableNumber = order.tableNumber || order.tableCode || order.tableName || ''
    return tableNumber ? `桌位号：${tableNumber}` : '未绑定桌位'
  },

  // 查看订单详情
  viewOrderDetail(e) {
    const order = e.currentTarget.dataset.order
    if (this.isSavedOrder(order)) {
      this.restoreOrderDraft(order)
      return
    }
    if (!order || !order._id) {
      wx.showToast({ title: '订单信息异常', icon: 'none' })
      return
    }

    wx.setStorageSync('selectedOrderDetail', order)
    wx.navigateTo({
      url: '/packages/user/pages/orderdetail/orderdetail'
    })
  },

  restoreOrderDraft(order) {
    const cart = order && order.draftCart
    if (!cart || Object.keys(cart).length === 0) {
      wx.showToast({ title: '预点单内容已失效', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/packages/order/pages/index/index?restoreDraft=1'
    })
  },

  deleteOrderDraft(e) {
    const order = e.currentTarget.dataset.order
    if (!this.isSavedOrder(order)) return
    wx.showModal({
      title: '删除预点单',
      content: '删除后无法恢复，确定删除吗？',
      confirmText: '删除',
      confirmColor: '#b98535',
      success: async result => {
        if (!result.confirm) return
        this.showActionLoading('处理中')
        try {
          if (apiClient.isEnabled()) {
            await apiClient.call('orderDraft.delete')
          } else {
            await wx.cloud.callFunction({ name: 'orderDraft', data: { action: 'delete' } })
          }
          this.setData({ orderList: [] })
          wx.showToast({ title: '已删除', icon: 'success' })
        } catch (err) {
          console.error('删除预点单失败', err)
          wx.showToast({ title: err.message || '删除失败', icon: 'none' })
        } finally {
          this.hideActionLoading()
        }
      }
    })
  },

  deleteOrder(e) {
    const order = e.currentTarget.dataset.order
    if (!order || !order._id) {
      wx.showToast({ title: '订单信息异常', icon: 'none' })
      return
    }

    wx.showModal({
      title: '删除订单',
      content: '删除后这条记录不会在订单页显示，确定删除吗？',
      confirmText: '删除',
      confirmColor: '#b98535',
      success: async (res) => {
        if (res.confirm) {
          await this.doDeleteOrder(order)
        }
      }
    })
  },

  async doDeleteOrder(order) {
    this.showActionLoading('处理中')

    try {
      const orderIds = Array.isArray(order.orderIds) && order.orderIds.length > 0
        ? order.orderIds
        : [order._id]

      if (apiClient.isEnabled()) {
        await apiClient.call('order.delete', {
          orderIds
        })
      } else {
        await Promise.all(orderIds.map(orderId => {
          return db.collection('order').doc(orderId).update({
            data: {
              deleted: true,
              updateTime: new Date()
            }
          })
        }))
      }

      const rootOrderId = order.rootOrderId || order._id
      const orderList = this.data.orderList.filter(item => {
        return (item.rootOrderId || item._id) !== rootOrderId
      })
      this.setData({ orderList })
      wx.showToast({ title: '已删除', icon: 'success' })
    } catch (err) {
      console.error('删除订单失败', err)
      wx.showToast({ title: '删除失败', icon: 'none' })
    } finally {
      this.hideActionLoading()
    }
  },

  // 取消订单
  cancelOrder(e) {
    const order = e.currentTarget.dataset.order

    const canCancel = (order.status === 'waiting_pay' || Number(order.status) === 0) &&
      !order.frontDeskConfirmed &&
      !order.kitchenPrinted

    if (!canCancel) {
      wx.showToast({ title: '该订单无法取消', icon: 'none' })
      return
    }
    
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这个订单吗？',
      success: async (res) => {
        if (res.confirm) {
          await this.doCancelOrder(order)
        }
      }
    })
  },

  // 执行取消订单
  async doCancelOrder(order) {
    this.showActionLoading('处理中')
    
    try {
      if (apiClient.isEnabled()) {
        await apiClient.call('order.cancel', {
          orderId: order._id
        })
      } else {
        // 更新订单状态
        await db.collection('order').doc(order._id).update({
          data: {
            status: 3 // 已取消
          }
        })
      }
      
      this.hideActionLoading()
      wx.showToast({ title: '订单已取消', icon: 'success' })
      
      // 刷新订单列表
      setTimeout(() => {
        this.loadOrders()
      }, 1500)
      
    } catch (err) {
      console.error('取消订单失败', err)
      this.hideActionLoading()
      wx.showToast({ title: '取消失败', icon: 'none' })
    }
  }
})
