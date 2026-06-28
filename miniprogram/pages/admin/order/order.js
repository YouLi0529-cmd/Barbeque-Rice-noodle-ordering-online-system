const db = wx.cloud.database()

Page({
  data: {
    orders: [],
    activeFilter: 'frontdesk',
    filters: [
      { label: '待前台确认', value: 'frontdesk' },
      { label: '未付款', value: 'unpaid' },
      { label: '厨房处理中', value: 'kitchen' },
      { label: '待交付', value: 'ready' },
      { label: '已完成', value: 'completed' },
      { label: '已取消', value: 'cancelled' },
      { label: '全部', value: 'all' },
      { label: '堂食', value: 'dineIn' },
      { label: '户外', value: 'outdoor' }
    ],
    summary: {
      frontdesk: 0,
      unpaid: 0,
      kitchen: 0,
      ready: 0
    },
    loadingOrders: false,
    lastRefreshText: '',
    showRemarkModal: false,
    remarkOrderId: '',
    remarkOrderIndex: -1,
    frontDeskRemark: ''
  },

  onLoad() {
    this.loadOrders({ initial: true })
  },

  onShow() {
    this.startAutoRefresh()
  },

  onHide() {
    this.clearAutoRefresh()
  },

  onUnload() {
    this.clearAutoRefresh()
  },

  formatTime(time) {
    if (!time) return ''
    const date = time instanceof Date ? time : new Date(time)
    const pad = n => (n < 10 ? `0${n}` : `${n}`)
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  },

  formatFullTime(time) {
    if (!time) return ''
    const date = time instanceof Date ? time : new Date(time)
    const pad = n => (n < 10 ? `0${n}` : `${n}`)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  },

  mapStatus(status) {
    const map = {
      waiting_pay: '待前台确认',
      paid: '待前台确认',
      pending_prepare: '已发厨房',
      preparing: '制作中',
      served: '已上菜',
      ready_pickup: '待自取',
      picked_up: '已取餐',
      completed: '已完成',
      cancelled: '已取消',
      0: '待前台确认',
      1: '处理中',
      2: '已完成',
      3: '已取消'
    }
    return map[status] || status || '待前台确认'
  },

  getOrderKind(order) {
    if (order.orderType === 'dineIn') {
      return `堂食订单${order.tableNumber ? ` / 桌号 ${order.tableNumber}` : ''}`
    }
    if (order.orderType === 'outdoor') {
      return `户外烧烤 / ${order.grillName || '未选择烤架'}`
    }
    if (order.orderType === 'takeOut') return '打包订单'
    return '点餐订单'
  },

  isPaid(order) {
    return !!(order.pay_status || order.payStatus)
  },

  isSentToKitchen(order) {
    if (order.frontDeskConfirmed || order.kitchenPrinted) return true
    return ['pending_prepare', 'preparing', 'served', 'ready_pickup', 'picked_up', 'completed'].indexOf(order.status) !== -1
  },

  isClosed(order) {
    return order.status === 'completed' || order.status === 'cancelled' || order.status === 2 || order.status === 3
  },

  isFrontdeskTodo(order) {
    return order.type === 'order' && !this.isClosed(order) && !this.isSentToKitchen(order)
  },

  isKitchenTodo(order) {
    return order.type === 'order' &&
      this.isSentToKitchen(order) &&
      (order.status === 'pending_prepare' || order.status === 'preparing')
  },

  isReadyTodo(order) {
    return order.type === 'order' && (order.status === 'served' || order.status === 'ready_pickup' || order.status === 'picked_up')
  },

  matchesFilter(order, filter) {
    if (order.type !== 'order') return false
    if (filter === 'frontdesk') return this.isFrontdeskTodo(order)
    if (filter === 'unpaid') return !this.isPaid(order) && !this.isClosed(order)
    if (filter === 'kitchen') return this.isKitchenTodo(order)
    if (filter === 'ready') return this.isReadyTodo(order)
    if (filter === 'completed') return order.status === 'completed' || order.status === 2
    if (filter === 'cancelled') return order.status === 'cancelled' || order.status === 3
    if (filter === 'dineIn') return order.orderType === 'dineIn'
    if (filter === 'outdoor') return order.orderType === 'outdoor'
    return true
  },

  getStatusClass(order) {
    if (this.isFrontdeskTodo(order)) return 'status-warning'
    if (order.status === 'preparing') return 'status-busy'
    if (order.status === 'served' || order.status === 'ready_pickup') return 'status-ready'
    if (order.status === 'completed' || order.status === 2) return 'status-done'
    if (order.status === 'cancelled' || order.status === 3) return 'status-cancelled'
    return 'status-normal'
  },

  getPrintText(order) {
    if (order.kitchenPrintStatus === 'failed' || order.printStatus === 3) return '打印失败'
    if (this.isSentToKitchen(order)) return '已发厨房'
    return '未发厨房'
  },

  getOrderActions(order) {
    if (this.isClosed(order)) return []

    const actions = []
    const paid = this.isPaid(order)
    const sent = this.isSentToKitchen(order)
    const status = order.status || 'waiting_pay'

    if (!sent) {
      actions.push({ label: '前台备注', action: 'editRemark', type: 'secondary' })
      actions.push({ label: '发送厨房', action: 'sendToKitchen', type: 'primary' })
      if (!paid) {
        actions.push({ label: '确认付款', action: 'confirmOfflinePaid', type: 'pay' })
      }
      actions.push({ label: '取消订单', action: 'cancelOrder', type: 'danger' })
      return actions
    }

    if (!paid) {
      actions.push({ label: '确认付款', action: 'confirmOfflinePaid', type: 'pay' })
    }

    if (status === 'pending_prepare' || status === 'waiting_pay' || status === 'paid') {
      actions.push({ label: '开始制作', action: 'updateStatus', status: 'preparing', type: 'primary' })
    } else if (status === 'preparing') {
      actions.push({
        label: order.orderType === 'dineIn' ? '标记已上菜' : '备好待自取',
        action: 'updateStatus',
        status: order.orderType === 'dineIn' ? 'served' : 'ready_pickup',
        type: 'primary'
      })
    } else if (status === 'served') {
      actions.push({ label: '完成订单', action: 'updateStatus', status: 'completed', type: 'primary' })
    } else if (status === 'ready_pickup') {
      actions.push({ label: '确认取餐', action: 'updateStatus', status: 'picked_up', type: 'primary' })
    } else if (status === 'picked_up') {
      actions.push({ label: '完成订单', action: 'updateStatus', status: 'completed', type: 'primary' })
    }

    actions.push({ label: '前台备注', action: 'editRemark', type: 'secondary' })
    actions.push({ label: '重打厨房单', action: 'reprintKitchenOrder', type: 'secondary' })
    actions.push({ label: '取消订单', action: 'cancelOrder', type: 'danger' })
    return actions
  },

  buildViewOrder(order) {
    const paid = this.isPaid(order)
    const sent = this.isSentToKitchen(order)
    const finalPrice = Number(order.finalPrice || 0)

    return {
      ...order,
      createTimeText: this.formatTime(order.createTime),
      createFullTimeText: this.formatFullTime(order.createTime),
      statusText: sent ? this.mapStatus(order.status) : '待前台确认',
      statusClass: this.getStatusClass(order),
      orderKindText: this.getOrderKind(order),
      payText: paid ? '已付款' : '未付款',
      kitchenText: sent ? '已发厨房' : '待发送',
      printText: this.getPrintText(order),
      finalPriceText: finalPrice.toFixed(2),
      frontDeskRemarkText: order.frontDeskRemark || '',
      isUrgent: this.isFrontdeskTodo(order),
      actions: this.getOrderActions(order)
    }
  },

  buildSummary(allOrders) {
    return {
      frontdesk: allOrders.filter(order => this.isFrontdeskTodo(order)).length,
      unpaid: allOrders.filter(order => !this.isPaid(order) && !this.isClosed(order)).length,
      kitchen: allOrders.filter(order => this.isKitchenTodo(order)).length,
      ready: allOrders.filter(order => this.isReadyTodo(order)).length
    }
  },

  notifyNewFrontdeskOrders(allOrders, options) {
    const pendingIds = allOrders
      .filter(order => this.isFrontdeskTodo(order))
      .map(order => order._id)

    if (!this.knownFrontdeskIds) {
      this.knownFrontdeskIds = pendingIds
      return
    }

    const newIds = pendingIds.filter(id => this.knownFrontdeskIds.indexOf(id) === -1)
    this.knownFrontdeskIds = pendingIds

    if (!options.initial && newIds.length) {
      wx.vibrateShort({ type: 'heavy' })
      wx.showToast({ title: `有 ${newIds.length} 个新点菜单`, icon: 'none' })
    }
  },

  async loadOrders(options = {}) {
    if (this.data.loadingOrders) return
    this.setData({ loadingOrders: true })

    try {
      const res = await db.collection('order')
        .orderBy('createTime', 'desc')
        .limit(100)
        .get()

      const allOrders = (res.data || [])
        .filter(order => order.type === 'order')
        .map(order => this.buildViewOrder(order))

      this.notifyNewFrontdeskOrders(allOrders, options)

      const activeFilter = this.data.activeFilter
      const list = allOrders.filter(order => this.matchesFilter(order, activeFilter))
      const now = new Date()
      const pad = n => (n < 10 ? `0${n}` : `${n}`)

      this.setData({
        orders: list,
        summary: this.buildSummary(allOrders),
        lastRefreshText: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
      })
    } catch (err) {
      console.error('加载订单失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loadingOrders: false })
      wx.hideLoading()
    }
  },

  onFilterChange(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      activeFilter: value,
      orders: []
    }, () => {
      this.loadOrders({ initial: true })
    })
  },

  refreshOrders() {
    this.loadOrders({ manual: true })
    wx.showToast({ title: '已刷新', icon: 'none' })
  },

  startAutoRefresh() {
    this.clearAutoRefresh()
    this.loadOrders({ initial: true })
    this.refreshTimer = setInterval(() => {
      this.loadOrders()
    }, 8000)
  },

  clearAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  },

  async callOrderAction(action, data, loadingTitle) {
    wx.showLoading({ title: loadingTitle || '处理中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateOrderStatus',
        data: {
          action,
          ...data
        }
      })

      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '操作失败')

      wx.hideLoading()
      if (result.data && result.data.printSuccess === false) {
        wx.showModal({
          title: '厨房打印失败',
          content: result.data.printError || result.message || '点菜单已确认，但厨房没有收到小票，请重打厨房单。',
          showCancel: false
        })
      } else {
        wx.showToast({ title: result.message || '操作成功', icon: 'success' })
      }
      this.loadOrders({ initial: true })
    } catch (err) {
      wx.hideLoading()
      console.error('订单操作失败', err)
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  },

  onActionTap(e) {
    const { action, status, label, index } = e.currentTarget.dataset
    const order = this.data.orders[index]
    if (!order) return

    if (action === 'editRemark') {
      this.openRemarkModal(index)
      return
    }

    if (action === 'sendToKitchen') {
      wx.showModal({
        title: '发送厨房',
        content: '确认点菜单无误，并把厨房小票打印出来？付款状态不会改变。',
        confirmText: '发送',
        success: res => {
          if (res.confirm) {
            this.callOrderAction('sendToKitchen', {
              id: order._id,
              frontDeskRemark: order.frontDeskRemarkText || ''
            }, '发送厨房...')
          }
        }
      })
      return
    }

    if (action === 'confirmOfflinePaid') {
      wx.showModal({
        title: '确认付款',
        content: '确认顾客已经线下付款？这个操作只更新付款状态，不影响厨房制作状态。',
        confirmText: '确认付款',
        success: res => {
          if (res.confirm) {
            this.callOrderAction('confirmOfflinePaid', { id: order._id }, '确认中...')
          }
        }
      })
      return
    }

    if (action === 'cancelOrder') {
      wx.showModal({
        title: '取消订单',
        content: '确认取消这个订单？取消后不会删除记录，方便后面对账。',
        confirmText: '取消订单',
        confirmColor: '#C9341C',
        success: res => {
          if (res.confirm) {
            this.callOrderAction('cancelOrder', { id: order._id }, '取消中...')
          }
        }
      })
      return
    }

    if (action === 'reprintKitchenOrder') {
      this.callOrderAction('reprintKitchenOrder', { id: order._id }, '重打中...')
      return
    }

    if (action === 'updateStatus') {
      wx.showModal({
        title: label || '更新状态',
        content: `确认将订单更新为「${this.mapStatus(status)}」？`,
        confirmText: '确认',
        success: res => {
          if (res.confirm) {
            this.callOrderAction('updateStatus', { id: order._id, status }, '更新中...')
          }
        }
      })
    }
  },

  openRemarkModal(index) {
    const order = this.data.orders[index]
    if (!order) return
    this.setData({
      showRemarkModal: true,
      remarkOrderId: order._id,
      remarkOrderIndex: index,
      frontDeskRemark: order.frontDeskRemarkText || ''
    })
  },

  onRemarkInput(e) {
    this.setData({ frontDeskRemark: e.detail.value })
  },

  closeRemarkModal() {
    this.setData({
      showRemarkModal: false,
      remarkOrderId: '',
      remarkOrderIndex: -1,
      frontDeskRemark: ''
    })
  },

  saveRemark() {
    const id = this.data.remarkOrderId
    if (!id) return

    this.callOrderAction('saveFrontDeskRemark', {
      id,
      frontDeskRemark: this.data.frontDeskRemark
    }, '保存中...')
    this.closeRemarkModal()
  },

  openOrderDetail(e) {
    const order = this.data.orders[e.currentTarget.dataset.index]
    if (!order) return

    const goodsText = (order.goods || [])
      .map(item => `${item.dishName || item.goodsName || '未命名菜品'} x${item.count || 1}`)
      .join('\n')

    const content = [
      `制作：${order.statusText}`,
      `付款：${order.payText}`,
      `厨房：${order.printText}`,
      `金额：￥${order.finalPriceText}`,
      `时间：${order.createFullTimeText}`,
      order.userPhone ? `电话：${order.userPhone}` : '',
      order.frontDeskRemarkText ? `前台备注：${order.frontDeskRemarkText}` : '',
      '',
      goodsText || '暂无菜品'
    ].filter(item => item !== '').join('\n')

    wx.showModal({
      title: order.orderKindText,
      content,
      showCancel: false
    })
  },

  stopPropagation() {}
})
