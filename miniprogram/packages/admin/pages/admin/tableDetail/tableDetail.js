const apiClient = require('../../../../../utils/apiClient')

const UI = {
  pageTitle: '\u684c\u53f0\u8d26\u5355',
  tableUnit: '\u53f7\u684c',
  moneySymbol: '\uffe5',
  people: '\u4eba\u6570',
  modifyPeople: '\u4fee\u6539',
  diningTime: '\u7528\u9910',
  amount: '\u91d1\u989d',
  orderDetail: '\u8ba2\u5355\u8be6\u60c5',
  emptyBill: '\u8be5\u684c\u6682\u65e0\u5df2\u63d0\u4ea4\u83dc\u54c1',
  emptyTip: '\u987e\u5ba2\u63d0\u4ea4\u8ba2\u5355\u540e\uff0c\u8fd9\u91cc\u4f1a\u663e\u793a\u83dc\u54c1\u548c\u603b\u4ef7',
  loading: '\u52a0\u8f7d\u4e2d',
  total: '\u5408\u8ba1',
  dishes: '\u4ef6\u83dc\u54c1',
  back: '\u8fd4\u56de',
  refresh: '\u5237\u65b0',
  dishActions: '\u83dc\u54c1\u64cd\u4f5c',
  currentDish: '\u5f53\u524d\u9009\u4e2d',
  noSelectedDish: '\u5148\u70b9\u51fb\u5de6\u4fa7\u83dc\u54c1',
  urge: '\u50ac\u83dc',
  moveDish: '\u8f6c\u83dc',
  refundDish: '\u9000\u83dc',
  markDish: '\u5212\u83dc',
  serveDish: '\u8d77\u83dc',
  reprintKitchen: '\u8865\u6253\u5236\u4f5c\u5355',
  giftDish: '\u8d60\u83dc',
  mergeTable: '\u62fc\u684c',
  changeTable: '\u8f6c\u53f0',
  payTitle: '\u652f\u4ed8\u7ed3\u8d26',
  discountTitle: '\u9009\u62e9\u4f18\u60e0',
  paymentTitle: '\u652f\u4ed8\u65b9\u5f0f',
  billSummary: '\u8d26\u5355\u660e\u7ec6',
  priceTotal: '\u4ef7\u683c\u5408\u8ba1',
  receivable: '\u5e94\u6536',
  actualReceived: '\u5b9e\u6536',
  finishCheckout: '\u4ed8\u6b3e\u5b8c\u6210\uff0c\u786e\u5b9a\u7ed3\u8d26',
  sendSuccess: '\u5df2\u53d1\u9001\u540e\u53a8',
  noOrder: '\u6ca1\u6709\u53ef\u64cd\u4f5c\u7684\u8ba2\u5355',
  loadFailed: '\u8d26\u5355\u52a0\u8f7d\u5931\u8d25',
  actionTodo: '\u529f\u80fd\u5f85\u63a5\u5165',
  selectDishFirst: '\u8bf7\u5148\u9009\u62e9\u83dc\u54c1',
  peopleTodo: '\u4eba\u6570\u4fee\u6539\u5f85\u63a5\u5165',
  checkoutTodo: '\u7ed3\u8d26\u63a5\u53e3\u5f85\u63a5\u5165'
}

const STATUS = {
  empty: {
    text: '\u7a7a\u53f0',
    className: 'status-empty'
  },
  submitted: {
    text: '\u5df2\u63d0\u4ea4',
    className: 'status-submitted'
  },
  preparing: {
    text: '\u5236\u4f5c\u4e2d',
    className: 'status-preparing'
  },
  paid: {
    text: '\u5df2\u652f\u4ed8',
    className: 'status-paid'
  }
}

const DISH_ACTIONS = [
  UI.urge,
  UI.moveDish,
  UI.refundDish,
  UI.markDish,
  UI.serveDish,
  UI.reprintKitchen,
  UI.giftDish,
  UI.mergeTable,
  UI.changeTable
]

const TABLE_ACTIONS = new Set([UI.reprintKitchen, UI.mergeTable, UI.changeTable])

const DISCOUNT_OPTIONS = [
  { value: 'reduce', label: '\u8ba2\u5355\u51cf\u514d' },
  { value: 'discount', label: '\u8ba2\u5355\u6253\u6298' },
  { value: 'free', label: '\u514d\u5355' }
]

const PAYMENT_OPTIONS = [
  { value: 'cash', label: '\u73b0\u91d1' },
  { value: 'account', label: '\u6302\u8d26' },
  { value: 'wechat_alipay', label: '\u5fae\u4fe1/\u652f\u4ed8\u5b9d' }
]

function decode(value) {
  if (value == null) return ''
  try {
    return decodeURIComponent(value)
  } catch (err) {
    return value
  }
}

function getNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function formatPrice(price) {
  const value = getNumber(price)
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1)
}

function getDiningTime(scannedAt) {
  const start = getNumber(scannedAt)
  if (!start) return '\u672a\u5f00\u53f0'
  const minutes = Math.max(0, Math.floor((Date.now() - start) / 60000))
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  if (hours <= 0) return `${minutes}\u5206\u949f`
  if (restMinutes <= 0) return `${hours}\u5c0f\u65f6`
  return `${hours}\u5c0f\u65f6${restMinutes}\u5206`
}

function buildTable(options) {
  const statusKey = decode(options.status) || 'empty'
  const status = STATUS[statusKey] || STATUS.empty
  const peopleCount = getNumber(options.peopleCount)
  const maxPeople = getNumber(options.maxPeople, 4)
  const totalPrice = getNumber(options.totalPrice)
  const scannedAt = getNumber(options.scannedAt)

  return {
    areaKey: decode(options.areaKey),
    areaName: decode(options.areaName),
    tableKey: decode(options.tableKey),
    tableNumber: decode(options.tableNumber),
    status: statusKey,
    statusText: status.text,
    statusClass: status.className,
    totalPrice,
    priceText: formatPrice(totalPrice),
    peopleText: `${peopleCount}/${maxPeople}`,
    diningTimeText: getDiningTime(scannedAt)
  }
}

function buildServerTable(table) {
  return buildTable({
    areaKey: table.areaKey,
    areaName: table.areaName,
    tableKey: table.tableKey,
    tableNumber: table.tableNumber,
    status: table.status,
    totalPrice: table.totalPrice,
    peopleCount: table.peopleCount,
    maxPeople: table.maxPeople,
    scannedAt: table.scannedAt
  })
}

function normalizeBillGroups(groups) {
  if (!Array.isArray(groups)) return []
  return groups.map((group, index) => {
    const groupId = group.id || group.orderId || `group-${index}`
    const goods = Array.isArray(group.goods) ? group.goods.map((goodsItem, goodsIndex) => ({
      ...goodsItem,
      rowId: `${groupId}-${goodsItem.dishId || goodsIndex}`,
      tagText: goodsItem.tagText || (Array.isArray(goodsItem.tags) ? goodsItem.tags.join('\u3001') : ''),
      subtotalText: goodsItem.subtotalText || formatPrice(goodsItem.subtotal)
    })) : []

    return {
      ...group,
      id: groupId,
      title: group.title || `\u70b9\u9910\u5355${index + 1}`,
      goods,
      goodsCount: Number(group.goodsCount || goods.reduce((sum, item) => sum + (Number(item.count) || 0), 0)),
      finalPriceText: group.finalPriceText || formatPrice(group.finalPrice)
    }
  })
}

function getOptionLabel(options, value) {
  const match = options.find((item) => item.value === value)
  return match ? match.label : ''
}

function buildPaySummary(totalPrice, paymentMethod, discountType) {
  const total = getNumber(totalPrice)
  const receivable = discountType === 'free' ? 0 : total
  const received = paymentMethod === 'account' ? 0 : receivable

  return {
    totalText: formatPrice(total),
    receivableText: formatPrice(receivable),
    paymentLabel: getOptionLabel(PAYMENT_OPTIONS, paymentMethod) || getOptionLabel(PAYMENT_OPTIONS, 'wechat_alipay'),
    receivedText: formatPrice(received)
  }
}

Page({
  data: {
    ui: UI,
    table: {},
    billGroups: [],
    itemCount: 0,
    totalPriceText: '0',
    selectedDishRowId: '',
    selectedDishName: '',
    selectedDishText: UI.noSelectedDish,
    selectedGroupId: '',
    dishActions: DISH_ACTIONS,
    discountOptions: DISCOUNT_OPTIONS,
    paymentOptions: PAYMENT_OPTIONS,
    discountType: '',
    paymentMethod: 'wechat_alipay',
    paySummary: buildPaySummary(0, 'wechat_alipay', ''),
    loading: false,
    sendingKitchen: false
  },

  onLoad(options) {
    const table = buildTable(options || {})
    this.setData({
      table,
      billGroups: [],
      itemCount: 0,
      totalPriceText: table.priceText,
      paySummary: buildPaySummary(table.totalPrice, this.data.paymentMethod, this.data.discountType)
    })
    this.loadDetail()
  },

  onShow() {
    if (this.data.table && this.data.table.tableNumber) {
      this.loadDetail(true)
    }
  },

  async loadDetail(silent = false) {
    if (typeof silent !== 'boolean') silent = false
    const table = this.data.table || {}
    if (!table.tableNumber) return

    try {
      if (!silent) {
        this.setData({ loading: true })
      }

      const res = await apiClient.call('admin.table.detail', {
        areaKey: table.areaKey,
        tableNumber: table.tableNumber
      })
      const data = res.data || {}
      const nextTable = data.table ? buildServerTable(data.table) : table
      const billGroups = normalizeBillGroups(data.billGroups)
      const totalPrice = getNumber(data.totalPrice, nextTable.totalPrice)
      const totalPriceText = data.totalPriceText || formatPrice(totalPrice)
      nextTable.totalPrice = totalPrice
      nextTable.priceText = totalPriceText

      this.setData({
        table: nextTable,
        billGroups,
        itemCount: Number(data.itemCount || billGroups.reduce((sum, group) => sum + Number(group.goodsCount || 0), 0)),
        totalPriceText,
        paySummary: buildPaySummary(totalPrice, this.data.paymentMethod, this.data.discountType)
      })
    } catch (err) {
      console.error('load admin table detail failed', err)
      if (!silent) {
        wx.showToast({
          title: UI.loadFailed,
          icon: 'none'
        })
      }
    } finally {
      if (!silent) {
        this.setData({ loading: false })
      }
    }
  },

  goBack() {
    wx.navigateBack()
  },

  selectDish(event) {
    const dataset = event.currentTarget.dataset || {}
    const dishName = dataset.dishName || ''
    this.setData({
      selectedDishRowId: dataset.rowId || '',
      selectedDishName: dishName,
      selectedDishText: dishName || UI.noSelectedDish,
      selectedGroupId: dataset.groupId || ''
    })
  },

  editPeople() {
    wx.showToast({
      title: UI.peopleTodo,
      icon: 'none'
    })
  },

  async handleDishAction(event) {
    const action = event.currentTarget.dataset.action || ''
    if (!action) return

    if (!TABLE_ACTIONS.has(action) && !this.data.selectedDishRowId) {
      wx.showToast({
        title: UI.selectDishFirst,
        icon: 'none'
      })
      return
    }

    if (action === UI.reprintKitchen) {
      await this.sendKitchen()
      return
    }

    wx.showToast({
      title: `${action}${UI.actionTodo}`,
      icon: 'none'
    })
  },

  selectDiscount(event) {
    const value = event.currentTarget.dataset.value || ''
    const nextValue = this.data.discountType === value ? '' : value
    this.setData({
      discountType: nextValue,
      paySummary: buildPaySummary(this.data.table.totalPrice, this.data.paymentMethod, nextValue)
    })
  },

  selectPayment(event) {
    const value = event.currentTarget.dataset.value || 'wechat_alipay'
    this.setData({
      paymentMethod: value,
      paySummary: buildPaySummary(this.data.table.totalPrice, value, this.data.discountType)
    })
  },

  async sendKitchen() {
    if (this.data.sendingKitchen) return
    const table = this.data.table || {}
    if (!table.tableNumber || this.data.billGroups.length === 0) {
      wx.showToast({
        title: UI.noOrder,
        icon: 'none'
      })
      return
    }

    try {
      this.setData({ sendingKitchen: true })
      const res = await apiClient.call('admin.table.sendKitchen', {
        areaKey: table.areaKey,
        tableNumber: table.tableNumber
      })
      const updated = Number(res && res.data && res.data.updated || 0)
      wx.showToast({
        title: updated > 0 ? UI.sendSuccess : UI.noOrder,
        icon: updated > 0 ? 'success' : 'none'
      })
      await this.loadDetail(true)
    } catch (err) {
      console.error('send table orders to kitchen failed', err)
      wx.showToast({
        title: err.message || '\u53d1\u9001\u5931\u8d25',
        icon: 'none'
      })
    } finally {
      this.setData({ sendingKitchen: false })
    }
  },

  finishCheckout() {
    wx.showToast({
      title: UI.checkoutTodo,
      icon: 'none'
    })
  }
})