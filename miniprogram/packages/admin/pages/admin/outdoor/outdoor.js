const apiClient = require('../../../../../utils/apiClient')

const UI = {
  title: '\u6237\u5916\u8ba2\u5355',
  subtitle: '\u9732\u8425\u8ba2\u5355\u5904\u7406',
  searchPlaceholder: '\u641c\u7d22\u5c3e\u53f7/\u8ba2\u5355\u53f7',
  search: '\u641c\u7d22',
  clear: '\u6e05\u7a7a',
  refresh: '\u5237\u65b0',
  empty: '\u6682\u65e0\u6237\u5916\u8ba2\u5355',
  selectTip: '\u8bf7\u5728\u5de6\u4fa7\u9009\u62e9\u4e00\u4e2a\u8ba2\u5355',
  moneySymbol: '\uffe5',
  loading: '\u52a0\u8f7d\u4e2d',
  sendKitchen: '\u53d1\u9001\u540e\u53a8',
  orderActions: '\u8ba2\u5355\u64cd\u4f5c',
  payTitle: '\u652f\u4ed8\u7ed3\u7b97',
  billSummary: '\u8d26\u5355\u660e\u7ec6',
  priceTotal: '\u4ef7\u683c\u5408\u8ba1',
  receivable: '\u5e94\u6536',
  actualReceived: '\u5b9e\u6536',
  paymentTitle: '\u652f\u4ed8\u65b9\u5f0f',
  confirmAllReturned: '\u786e\u8ba4\u5168\u90e8\u5f52\u8fd8',
  returnSuccess: '\u5df2\u786e\u8ba4\u5168\u90e8\u5f52\u8fd8',
  returnConfirmTitle: '\u786e\u8ba4\u5f52\u8fd8',
  returnConfirmContent: '\u786e\u8ba4\u8be5\u6237\u5916\u8ba2\u5355\u7684\u7269\u54c1\u5df2\u5168\u90e8\u5f52\u8fd8\u5417',
  returnRequiredBeforeCheckout: '\u8fd8\u672a\u786e\u5b9a\u7528\u5177\u662f\u5426\u5168\u90e8\u5f52\u8fd8\uff0c\u8bf7\u5148\u786e\u8ba4',
  finishCheckout: '\u4ed8\u6b3e\u5b8c\u6210\uff0c\u786e\u5b9a\u7ed3\u8d26',
  updated: '\u5df2\u66f4\u65b0',
  loadFailed: '\u8ba2\u5355\u52a0\u8f7d\u5931\u8d25',
  actionFailed: '\u64cd\u4f5c\u5931\u8d25',
  actionTodo: '\u529f\u80fd\u5f85\u63a5\u5165',
  checkoutSuccess: '\u5df2\u7ed3\u8d26',
  checkoutConfirmTitle: '\u786e\u8ba4\u7ed3\u8d26',
  checkoutConfirmContent: '\u786e\u8ba4\u6237\u5916\u8ba2\u5355\u5df2\u6536\u6b3e\u5e76\u5b8c\u6210\u5417',
  discountTitle: '\u9009\u62e9\u4f18\u60e0',
  discountDialogTitle: '\u8f93\u5165\u6298\u6263',
  discountInputPlaceholder: '\u8bf7\u8f93\u5165\u6298\u6263\uff0c\u5982 8.8\uff0c0\u4e3a\u514d\u5355',
  discountCancel: '\u53d6\u6d88',
  discountConfirm: '\u786e\u5b9a',
  discountInvalid: '\u8bf7\u8f93\u5165 0-10 \u4e4b\u95f4\u7684\u6298\u6263',
  noSelectedGoods: '\u8bf7\u5148\u9009\u62e9\u83dc\u54c1',
  refundDish: '\u9000\u83dc',
  giftDish: '\u8d60\u83dc',
  reprintGuestBill: '\u8865\u6253\u5ba2\u5355',
  refundSuccess: '\u5df2\u9000\u83dc',
  giftSuccess: '\u5df2\u8d60\u83dc',
  refundConfirmTitle: '\u786e\u8ba4\u9000\u83dc',
  refundConfirmContent: '\u786e\u5b9a\u5c06\u9009\u4e2d\u83dc\u54c1\u4ece\u8ba2\u5355\u4e2d\u79fb\u9664\u5417',
  giftConfirmTitle: '\u786e\u8ba4\u8d60\u83dc',
  giftConfirmContent: '\u786e\u5b9a\u5c06\u9009\u4e2d\u83dc\u54c1\u6309 0 \u5143\u7ed3\u7b97\u5417'
}

const STATUS_TEXT = {
  saved: '\u5df2\u4fdd\u5b58',
  waiting_pay: '\u5df2\u63d0\u4ea4',
  submitted: '\u5df2\u63d0\u4ea4',
  preparing: '\u914d\u83dc\u4e2d',
  ready_pickup: '\u5f85\u81ea\u53d6',
  completed: '\u5df2\u5b8c\u6210',
  paid: '\u5df2\u652f\u4ed8',
  cancelled: '\u5df2\u53d6\u6d88'
}

const ORDER_ACTIONS = [
  { label: UI.refundDish, action: 'refund' },
  { label: UI.giftDish, action: 'gift' },
  { label: UI.reprintGuestBill, action: 'reprintGuestBill' }
]

const DISCOUNT_OPTIONS = [
  { value: 'reduce', label: '\u8ba2\u5355\u51cf\u514d' }
]

const PAYMENT_OPTIONS = [
  { value: 'cash', label: '\u73b0\u91d1' },
  { value: 'wechat_alipay', label: '\u5fae\u4fe1/\u652f\u4ed8\u5b9d' }
]

function pad(value) {
  return value < 10 ? `0${value}` : `${value}`
}

function formatTime(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatPrice(value) {
  const number = Number(value || 0)
  if (!Number.isFinite(number)) return '0'
  return Number.isInteger(number) ? String(number) : number.toFixed(2)
}

function formatMoney(value) {
  return `${UI.moneySymbol}${formatPrice(value)}`
}

function getNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function firstNumber(values) {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (value === undefined || value === null || value === '') continue
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return null
}

function getCount(item) {
  const count = Number(item.count || item.num || item.quantity || item.qty || 1)
  return Number.isFinite(count) && count > 0 ? count : 1
}

function getGoodsName(item, index) {
  return item.dishName || item.name || item.goodsName || item.title || `\u83dc\u54c1${index + 1}`
}

function getGoodsOptions(item) {
  const options = []
  if (item.taste) options.push(item.taste)
  if (item.sugar) options.push(item.sugar)
  if (item.temperature) options.push(item.temperature)
  if (item.remark) options.push(item.remark)
  if (Array.isArray(item.options)) {
    item.options.forEach(option => {
      if (typeof option === 'string') options.push(option)
      else if (option && option.name) options.push(option.name)
      else if (option && option.value) options.push(option.value)
    })
  }
  return options.filter(Boolean).join('\u3001')
}

function getLineTotal(item) {
  if (item.gifted || item.isGift) return 0
  const explicitTotal = firstNumber([
    item.finalPrice,
    item.totalPrice,
    item.subtotal,
    item.amount
  ])
  if (explicitTotal !== null) return explicitTotal
  return getNumber(item.price || item.salePrice) * getCount(item)
}

function getGoodsSource(order) {
  if (Array.isArray(order.orderGoods)) return { field: 'orderGoods', goods: order.orderGoods }
  if (Array.isArray(order.goodsList)) return { field: 'goodsList', goods: order.goodsList }
  if (Array.isArray(order.goods)) return { field: 'goods', goods: order.goods }
  if (Array.isArray(order.items)) return { field: 'items', goods: order.items }
  return { field: 'goods', goods: [] }
}

function normalizeGoods(order, selectedGoodsMap = {}) {
  const source = getGoodsSource(order).goods
  if (!Array.isArray(source)) return []

  return source.map((item, index) => {
    const count = getCount(item)
    const total = getLineTotal(item)
    const key = `${item._id || item.dishId || item.id || 'dish'}-${index}`

    return {
      key,
      sourceIndex: index,
      name: getGoodsName(item, index),
      count,
      optionText: getGoodsOptions(item),
      subtotalText: formatPrice(total),
      selected: !!selectedGoodsMap[key]
    }
  })
}

function calculateGoodsTotal(goods) {
  return (goods || []).reduce((sum, item) => sum + getLineTotal(item), 0)
}

function getStatusText(order) {
  if (!order) return ''
  if (order.payStatus === true && order.status === 'completed') return STATUS_TEXT.paid
  if (order.status === 'paid') return STATUS_TEXT.submitted
  if (order.payStatus === true) return STATUS_TEXT.submitted
  return STATUS_TEXT[order.status] || order.status || '\u5f85\u5904\u7406'
}

function getOutdoorPointText(order) {
  return order.grillName || order.outdoorPointName || order.outdoorPointId || '\u6237\u5916\u81ea\u53d6'
}

function getOrderPhone(order) {
  return order.userPhone ||
    order.phoneNumber ||
    order.phone ||
    order.contactPhone ||
    order.userSnapshot && order.userSnapshot.phoneNumber ||
    order.userSnapshot && order.userSnapshot.phone ||
    ''
}

function getOrderDisplayName(order) {
  const digits = String(getOrderPhone(order) || '').replace(/\D/g, '')
  const lastFour = digits.slice(-4)
  if (lastFour) return `\u5c3e\u53f7${lastFour}`
  return order.orderNo || order._id || '\u6237\u5916\u8ba2\u5355'
}

function getOrderTotal(order) {
  return order && order.finalPrice !== undefined ? order.finalPrice : order && order.totalPrice
}

function getOptionLabel(options, value) {
  const match = options.find(item => item.value === value)
  return match ? match.label : ''
}

function buildPaySummary(totalPrice, paymentMethod, discountType, discountValue = '') {
  const total = getNumber(totalPrice)
  const hasDiscountInput = discountValue !== '' && discountValue != null
  const discountNumber = getNumber(discountValue)
  const hasDiscount = discountType === 'reduce' && hasDiscountInput && discountNumber >= 0 && discountNumber <= 10
  const receivable = hasDiscount ? total * discountNumber / 10 : total

  return {
    totalText: formatPrice(total),
    receivable,
    receivableText: formatPrice(receivable),
    discountText: hasDiscount ? `${formatPrice(discountNumber)}\u6298` : '',
    paymentLabel: getOptionLabel(PAYMENT_OPTIONS, paymentMethod) || getOptionLabel(PAYMENT_OPTIONS, 'wechat_alipay'),
    receivedText: formatPrice(receivable)
  }
}

function formatOrderItem(order) {
  const goodsList = normalizeGoods(order)
  const goodsCount = goodsList.reduce((sum, goods) => sum + goods.count, 0)
  const total = getOrderTotal(order)

  return {
    ...order,
    _displayTitle: getOrderDisplayName(order),
    _displayStatus: getStatusText(order),
    _outdoorPointText: getOutdoorPointText(order),
    _createTimeText: formatTime(order.createTime) || '\u672a\u8bb0\u5f55\u65f6\u95f4',
    _priceText: formatMoney(total),
    _goodsCountText: `${goodsCount}\u4ef6\u83dc\u54c1`
  }
}

Page({
  data: {
    ui: UI,
    list: [],
    keyword: '',
    loading: false,
    saving: false,
    selectedOrderId: '',
    selectedOrder: null,
    orderTitle: '',
    statusText: '',
    outdoorPointText: '',
    createTimeText: '',
    totalPriceText: '0',
    goodsCountText: '0\u4ef6\u83dc\u54c1',
    goodsList: [],
    selectedGoodsMap: {},
    selectedGoodsCount: 0,
    orderActions: ORDER_ACTIONS,
    discountOptions: DISCOUNT_OPTIONS,
    paymentOptions: PAYMENT_OPTIONS,
    discountType: '',
    discountInput: '',
    discountValue: '',
    showDiscountDialog: false,
    paymentMethod: 'wechat_alipay',
    paySummary: buildPaySummary(0, 'wechat_alipay', '', '')
  },

  onLoad() {
    this.loadList()
  },

  async loadList(options = {}) {
    if (options && options.currentTarget) options = {}
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const res = await apiClient.call('admin.collection.list', {
        collection: 'order',
        keyword: this.data.keyword,
        filters: { orderType: 'camping' },
        orderBy: 'createTime',
        order: 'desc',
        limit: 100
      })
      const list = (res.data || []).map(formatOrderItem)
      const selectedId = options.selectedId || this.data.selectedOrderId
      const selectedOrder = list.find(item => item._id === selectedId) || list[0] || null

      this.setData({
        list,
        loading: false
      }, () => this.applyOrder(selectedOrder, {
        resetSelection: options.resetSelection !== false,
        resetPay: options.resetPay !== false
      }))
    } catch (err) {
      console.error('load outdoor orders failed', err)
      this.setData({ loading: false })
      wx.showToast({ title: err.message || UI.loadFailed, icon: 'none' })
    }
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  doSearch() {
    this.loadList({ selectedId: '', resetSelection: true, resetPay: true })
  },

  clearSearch() {
    this.setData({ keyword: '' }, () => this.loadList({ selectedId: '', resetSelection: true, resetPay: true }))
  },

  selectOrder(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const order = this.data.list.find(item => item._id === id)
    this.applyOrder(order || null, {
      resetSelection: true,
      resetPay: true
    })
  },

  applyOrder(order, options = {}) {
    if (!order) {
      this.setData({
        selectedOrder: null,
        selectedOrderId: '',
        orderTitle: '',
        statusText: '',
        outdoorPointText: '',
        createTimeText: '',
        totalPriceText: '0',
        goodsCountText: '0\u4ef6\u83dc\u54c1',
        goodsList: [],
        selectedGoodsMap: {},
        selectedGoodsCount: 0,
        discountType: '',
        discountInput: '',
        discountValue: '',
        showDiscountDialog: false,
        paySummary: buildPaySummary(0, this.data.paymentMethod, '', '')
      })
      return
    }

    const selectedGoodsMap = options.resetSelection ? {} : this.data.selectedGoodsMap || {}
    const discountType = options.resetPay ? '' : this.data.discountType
    const discountValue = options.resetPay ? '' : this.data.discountValue
    const discountInput = options.resetPay ? '' : this.data.discountInput
    const goodsList = normalizeGoods(order, selectedGoodsMap)
    const goodsCount = goodsList.reduce((sum, goods) => sum + goods.count, 0)
    const totalPrice = getOrderTotal(order)
    const paySummary = buildPaySummary(totalPrice, this.data.paymentMethod, discountType, discountValue)

    this.setData({
      selectedOrder: order,
      selectedOrderId: order._id || '',
      orderTitle: getOrderDisplayName(order),
      statusText: getStatusText(order),
      outdoorPointText: getOutdoorPointText(order),
      createTimeText: formatTime(order.createTime) || '\u672a\u8bb0\u5f55\u65f6\u95f4',
      totalPriceText: formatPrice(totalPrice),
      goodsCountText: `${goodsCount}\u4ef6\u83dc\u54c1`,
      goodsList,
      selectedGoodsMap,
      selectedGoodsCount: goodsList.filter(item => item.selected).length,
      discountType,
      discountInput,
      discountValue,
      showDiscountDialog: false,
      paySummary
    })
  },

  async updateOrder(data, successText = UI.updated) {
    const order = this.data.selectedOrder
    if (!order || !order._id) return
    this.setData({ saving: true })

    try {
      await apiClient.call('admin.collection.update', {
        collection: 'order',
        id: order._id,
        data
      })
      wx.showToast({ title: successText, icon: 'success' })
      this.setData({
        saving: false,
        selectedGoodsMap: {},
        selectedGoodsCount: 0
      }, () => this.loadList({
        selectedId: order._id,
        resetSelection: true,
        resetPay: false
      }))
    } catch (err) {
      console.error('update outdoor order failed', err)
      this.setData({ saving: false })
      wx.showToast({ title: err.message || UI.actionFailed, icon: 'none' })
    }
  },

  runOrderAction(e) {
    const index = Number(e.currentTarget.dataset.index || 0)
    const action = this.data.orderActions[index]
    if (!action) return
    if (action.action === 'refund') {
      this.refundSelectedGoods()
      return
    }
    if (action.action === 'gift') {
      this.giftSelectedGoods()
      return
    }
    if (action.action === 'reprintGuestBill') {
      this.reprintGuestBill()
    }
  },

  applySelectedGoodsMap(selectedGoodsMap) {
    const goodsList = (this.data.goodsList || []).map(item => ({
      ...item,
      selected: !!selectedGoodsMap[item.key]
    }))
    this.setData({
      selectedGoodsMap,
      selectedGoodsCount: goodsList.filter(item => item.selected).length,
      goodsList
    })
  },

  toggleGoodsSelection(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    const selectedGoodsMap = {
      ...(this.data.selectedGoodsMap || {})
    }
    if (selectedGoodsMap[key]) delete selectedGoodsMap[key]
    else selectedGoodsMap[key] = true
    this.applySelectedGoodsMap(selectedGoodsMap)
  },

  getSelectedSourceIndexes() {
    const selectedGoodsMap = this.data.selectedGoodsMap || {}
    return (this.data.goodsList || [])
      .filter(item => selectedGoodsMap[item.key])
      .map(item => item.sourceIndex)
  },

  updateOrderGoods(nextGoods, successText) {
    const order = this.data.selectedOrder
    if (!order) return
    const source = getGoodsSource(order)
    const total = calculateGoodsTotal(nextGoods)
    this.updateOrder({
      [source.field]: nextGoods,
      totalPrice: total,
      finalPrice: total
    }, successText)
  },

  refundSelectedGoods() {
    const selectedIndexes = this.getSelectedSourceIndexes()
    if (!selectedIndexes.length) {
      wx.showToast({ title: UI.noSelectedGoods, icon: 'none' })
      return
    }

    wx.showModal({
      title: UI.refundConfirmTitle,
      content: UI.refundConfirmContent,
      success: res => {
        if (!res.confirm) return
        const source = getGoodsSource(this.data.selectedOrder)
        const selectedSet = new Set(selectedIndexes)
        const nextGoods = source.goods.filter((item, index) => !selectedSet.has(index))
        this.updateOrderGoods(nextGoods, UI.refundSuccess)
      }
    })
  },

  giftSelectedGoods() {
    const selectedIndexes = this.getSelectedSourceIndexes()
    if (!selectedIndexes.length) {
      wx.showToast({ title: UI.noSelectedGoods, icon: 'none' })
      return
    }

    wx.showModal({
      title: UI.giftConfirmTitle,
      content: UI.giftConfirmContent,
      success: res => {
        if (!res.confirm) return
        const source = getGoodsSource(this.data.selectedOrder)
        const selectedSet = new Set(selectedIndexes)
        const nextGoods = source.goods.map((item, index) => {
          if (!selectedSet.has(index)) return item
          return {
            ...item,
            gifted: true,
            finalPrice: 0,
            totalPrice: 0,
            subtotal: 0,
            amount: 0
          }
        })
        this.updateOrderGoods(nextGoods, UI.giftSuccess)
      }
    })
  },

  selectDiscount(e) {
    const value = e.currentTarget.dataset.value
    if (!value) return
    const totalPrice = getOrderTotal(this.data.selectedOrder)

    if (this.data.discountType === value && this.data.discountValue !== '') {
      this.setData({
        discountType: '',
        discountValue: '',
        discountInput: '',
        paySummary: buildPaySummary(totalPrice, this.data.paymentMethod, '', '')
      })
      return
    }

    this.setData({
      discountType: value,
      showDiscountDialog: true,
      discountInput: this.data.discountValue || ''
    })
  },

  closeDiscountDialog() {
    this.setData({ showDiscountDialog: false })
  },

  stopDiscountDialogTap() {},

  onDiscountInput(e) {
    this.setData({ discountInput: e.detail.value })
  },

  confirmDiscountDialog() {
    const value = this.data.discountInput
    const number = Number(value)
    if (!Number.isFinite(number) || number < 0 || number > 10) {
      wx.showToast({ title: UI.discountInvalid, icon: 'none' })
      return
    }
    const totalPrice = getOrderTotal(this.data.selectedOrder)
    this.setData({
      discountValue: value,
      showDiscountDialog: false,
      paySummary: buildPaySummary(totalPrice, this.data.paymentMethod, this.data.discountType, value)
    })
  },

  selectPayment(e) {
    const value = e.currentTarget.dataset.value
    if (!value) return
    const totalPrice = getOrderTotal(this.data.selectedOrder)
    this.setData({
      paymentMethod: value,
      paySummary: buildPaySummary(totalPrice, value, this.data.discountType, this.data.discountValue)
    })
  },

  sendKitchen() {
    wx.showToast({
      title: UI.actionTodo,
      icon: 'none'
    })
  },

  reprintGuestBill() {
    wx.showToast({
      title: UI.actionTodo,
      icon: 'none'
    })
  },

  confirmAllReturned() {
    if (!this.data.selectedOrder) return
    wx.showModal({
      title: UI.returnConfirmTitle,
      content: UI.returnConfirmContent,
      success: res => {
        if (!res.confirm) return
        this.updateOrder({
          allReturned: true,
          returnStatus: 'all_returned',
          returnedAt: new Date().toISOString()
        }, UI.returnSuccess)
      }
    })
  },

  finishCheckout() {
    if (!this.data.selectedOrder) return
    if (!this.data.selectedOrder.allReturned && this.data.selectedOrder.returnStatus !== 'all_returned') {
      wx.showToast({
        title: UI.returnRequiredBeforeCheckout,
        icon: 'none'
      })
      return
    }
    wx.showModal({
      title: UI.checkoutConfirmTitle,
      content: UI.checkoutConfirmContent,
      success: res => {
        if (!res.confirm) return
        this.updateOrder({
          payStatus: true,
          pay_status: true,
          status: 'completed',
          payMethod: this.data.paymentMethod,
          discountType: this.data.discountType,
          discountValue: this.data.discountValue,
          receivedAmount: this.data.paySummary.receivable
        }, UI.checkoutSuccess)
      }
    })
  }
})
