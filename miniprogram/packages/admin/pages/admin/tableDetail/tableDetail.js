const apiClient = require('../../../../../utils/apiClient')

const TABLE_PAGE = '/packages/admin/pages/admin/table/table'

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
  noSelectedKitchenDish: '\u8bf7\u5148\u9009\u62e9\u8981\u53d1\u9001\u7684\u83dc\u54c1\u6216\u83dc\u5355',
  noSelectedUrgeDish: '\u8bf7\u5148\u9009\u62e9\u8981\u50ac\u83dc\u7684\u83dc\u54c1\u6216\u83dc\u5355',
  urge: '\u50ac\u83dc',
  moveDish: '\u8f6c\u83dc',
  editDish: '\u4fee\u6539',
  refundDish: '\u9000\u83dc',
  giftDish: '\u8d60\u83dc',
  mergeTable: '\u62fc\u684c',
  changeTable: '\u8f6c\u53f0',
  reprintGuestBill: '\u8865\u6253\u5ba2\u5355',
  changeTableStarted: '\u8bf7\u9009\u62e9\u65b0\u684c\u53f0',
  mergeTableStarted: '\u8bf7\u9009\u62e9\u8981\u62fc\u7684\u684c\u53f0',
  mergedTables: '\u5df2\u62fc',
  mergeDialogTitle: '\u9009\u62e9\u62fc\u684c\u684c\u53f0',
  mergeDialogTip: '\u53ef\u9009\u62e9\u7a7a\u684c\u6216\u672a\u7ed3\u8d26\u684c\u53f0',
  mergeEmpty: '\u6682\u65e0\u53ef\u62fc\u684c\u53f0',
  mergeConfirmTitle: '\u786e\u8ba4\u62fc\u684c',
  mergeConfirmPrefix: '\u786e\u5b9a\u5c06\u5f53\u524d\u684c\u4e0e',
  mergeConfirmSuffix: '\u5408\u5e76\u4e3a\u4e00\u684c\u5417',
  mergeSuccess: '\u5df2\u62fc\u684c',
  mergeFailed: '\u62fc\u684c\u5931\u8d25',
  selectMergeTableFirst: '\u8bf7\u9009\u62e9\u8981\u62fc\u7684\u684c\u53f0',
  selectedDishCount: '\u5df2\u9009',
  selectedDishUnit: '\u9879',
  payTitle: '\u652f\u4ed8\u7ed3\u8d26',
  discountTitle: '\u9009\u62e9\u4f18\u60e0',
  paymentTitle: '\u652f\u4ed8\u65b9\u5f0f',
  billSummary: '\u8d26\u5355\u660e\u7ec6',
  priceTotal: '\u4ef7\u683c\u5408\u8ba1',
  receivable: '\u5e94\u6536',
  actualReceived: '\u5b9e\u6536',
  finishCheckout: '\u4ed8\u6b3e\u5b8c\u6210\uff0c\u786e\u5b9a\u7ed3\u8d26',
  sendKitchen: '\u53d1\u9001\u540e\u53a8',
  refundSuccess: '\u5df2\u9000\u83dc',
  giftSuccess: '\u5df2\u8d60\u83dc',
  giftConfirmTitle: '\u786e\u8ba4\u8d60\u83dc',
  giftConfirmContent: '\u786e\u5b9a\u5c06\u9009\u4e2d\u83dc\u54c1\u5728\u672c\u6b21\u8ba2\u5355\u4e2d\u6309 0 \u5143\u7ed3\u7b97\u5417',
  sendKitchenConfirmTitle: '\u53d1\u9001\u540e\u53a8',
  sendKitchenConfirmContent: '\u786e\u5b9a\u53d1\u9001\u9009\u4e2d\u83dc\u54c1\u5230\u540e\u53a8\u5417',
  paidOrderCannotSendKitchen: '\u5df2\u7ed3\u8d26\u83dc\u54c1\u4e0d\u80fd\u53d1\u9001\u540e\u53a8',
  urgeSuccess: '\u5df2\u50ac\u83dc',
  urgeConfirmTitle: '\u786e\u8ba4\u50ac\u83dc',
  urgeConfirmContent: '\u786e\u5b9a\u5c06\u9009\u4e2d\u83dc\u54c1\u91cd\u65b0\u53d1\u9001\u7ed9\u540e\u53a8\u6253\u5370\u5417',
  refundConfirmTitle: '\u786e\u8ba4\u9000\u83dc',
  refundConfirmContent: '\u786e\u5b9a\u5c06\u9009\u4e2d\u83dc\u54c1\u4ece\u8ba2\u5355\u4e2d\u79fb\u9664\u5417',
  sendSuccess: '\u5df2\u53d1\u9001\u540e\u53a8',
  checkoutSuccess: '\u5df2\u7ed3\u8d26',
  checkoutConfirmTitle: '\u786e\u8ba4\u7ed3\u8d26',
  checkoutConfirmContent: '\u786e\u8ba4\u4ed8\u6b3e\u5b8c\u6210\u5e76\u7ed3\u675f\u8be5\u5355\u5417',
  noOrder: '\u6ca1\u6709\u53ef\u64cd\u4f5c\u7684\u8ba2\u5355',
  loadFailed: '\u8d26\u5355\u52a0\u8f7d\u5931\u8d25',
  actionTodo: '\u529f\u80fd\u5f85\u63a5\u5165',
  selectDishFirst: '\u8bf7\u5148\u9009\u62e9\u83dc\u54c1',
  peopleDialogTitle: '\u4fee\u6539\u5728\u684c\u4eba\u6570',
  peopleInputPlaceholder: '\u8bf7\u8f93\u5165\u5728\u684c\u4eba\u6570',
  peopleInvalid: '\u8bf7\u8f93\u5165 1-99 \u7684\u4eba\u6570',
  peopleSaveSuccess: '\u4eba\u6570\u5df2\u66f4\u65b0',
  peopleSaveFailed: '\u4eba\u6570\u4fee\u6539\u5931\u8d25',
  checkoutFailed: '\u7ed3\u8d26\u5931\u8d25',
  discountDialogTitle: '\u8f93\u5165\u6298\u6263',
  directReduceDialogTitle: '\u8f93\u5165\u76f4\u51cf\u91d1\u989d',
  discountRowLabel: '\u6298\u6263',
  discountInputPlaceholder: '\u8bf7\u8f93\u5165\u6298\u6263\uff0c\u5982 8.8\uff0c0\u4e3a\u514d\u5355',
  directReduceInputPlaceholder: '\u8bf7\u8f93\u5165\u76f4\u51cf\u91d1\u989d',
  discountCancel: '\u53d6\u6d88',
  discountConfirm: '\u786e\u5b9a',
  discountInvalid: '\u8bf7\u8f93\u5165 0-10 \u4e4b\u95f4\u7684\u6298\u6263',
  directReduceInvalid: '\u76f4\u51cf\u91d1\u989d\u4e0d\u80fd\u8d85\u8fc7\u6298\u540e\u91d1\u989d',
  editDishTitle: '\u4fee\u6539\u83dc\u54c1',
  editDishOptionsLabel: '\u53e3\u5473/\u9009\u9879',
  editDishRemarkLabel: '\u5907\u6ce8',
  editDishOptionsPlaceholder: '\u591a\u4e2a\u9009\u9879\u7528\u987f\u53f7\u9694\u5f00',
  editDishRemarkPlaceholder: '\u8bf7\u8f93\u5165\u5907\u6ce8',
  editDishSingleOnly: '\u4fee\u6539\u65f6\u53ea\u80fd\u9009\u4e00\u4e2a\u83dc\u54c1',
  editDishSuccess: '\u5df2\u4fee\u6539',
  editDishFailed: '\u4fee\u6539\u5931\u8d25'
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
  UI.editDish,
  UI.refundDish,
  UI.giftDish,
  UI.reprintGuestBill,
  UI.mergeTable,
  UI.changeTable
]

const TABLE_ACTIONS = new Set([UI.sendKitchen, UI.reprintGuestBill, UI.mergeTable, UI.changeTable])

const DISCOUNT_OPTIONS = [
  { value: 'discount', label: '\u6253\u6298' },
  { value: 'direct_reduce', label: '\u76f4\u51cf' }
]

const PAYMENT_OPTIONS = [
  { value: 'cash', label: '\u73b0\u91d1' },
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

function getDiningTime(scannedAt, finishedAt = 0) {
  const start = getNumber(scannedAt)
  if (!start) return '\u672a\u5f00\u53f0'
  const end = getNumber(finishedAt)
  const endTime = end && end > start ? end : Date.now()
  const minutes = Math.max(0, Math.floor((endTime - start) / 60000))
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
  const finishedAt = getNumber(options.finishedAt)

  return {
    areaKey: decode(options.areaKey),
    areaName: decode(options.areaName),
    tableKey: decode(options.tableKey),
    tableNumber: decode(options.tableNumber),
    status: statusKey,
    statusText: status.text,
    statusClass: status.className,
    totalPrice,
    peopleCount,
    maxPeople,
    priceText: formatPrice(totalPrice),
    peopleText: `${peopleCount}/${maxPeople}`,
    scannedAt,
    finishedAt,
    diningTimeText: getDiningTime(scannedAt, finishedAt),
    tableGroupId: options.tableGroupId || '',
    mergedTables: Array.isArray(options.mergedTables) ? options.mergedTables : [],
    mergedTableText: options.mergedTableText || ''
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
    scannedAt: table.scannedAt,
    finishedAt: table.finishedAt,
    tableGroupId: table.tableGroupId,
    mergedTables: table.mergedTables,
    mergedTableText: table.mergedTableText
  })
}

function normalizeBillGroups(groups) {
  if (!Array.isArray(groups)) return []
  return groups.map((group, index) => {
    const groupId = group.id || group.orderId || `group-${index}`
    const goods = Array.isArray(group.goods) ? group.goods.map((goodsItem, goodsIndex) => ({
      ...goodsItem,
      rowId: `${groupId}-${goodsItem.dishId || 'dish'}-${goodsIndex}`,
      tagText: goodsItem.tagText || (Array.isArray(goodsItem.tags) ? goodsItem.tags.join('\u3001') : ''),
      remarkText: goodsItem.remark ? `\u5907\u6ce8\uff1a${goodsItem.remark}` : '',
      kitchenSent: goodsItem.kitchenSent === true || goodsItem.kitchenStatus === 'sent',
      subtotalText: goodsItem.subtotalText || formatPrice(goodsItem.subtotal)
    })) : []

    return {
      ...group,
      id: groupId,
      title: group.title || `\u70b9\u9910\u5355${index + 1}`,
      canSendKitchen: group.canSendKitchen !== false &&
        group.status !== 'paid' &&
        group.status !== 'completed' &&
        group.statusText !== '\u5df2\u652f\u4ed8',
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

function buildPaySummary(totalPrice, paymentMethod, discountType, discountValue = '', directReduceValue = '') {
  const total = getNumber(totalPrice)
  const hasDiscountInput = discountValue !== '' && discountValue != null
  const discountNumber = getNumber(discountValue)
  const hasRateDiscount = (discountType === 'discount' || discountType === 'reduce') &&
    hasDiscountInput && discountNumber >= 0 && discountNumber <= 10
  const priceAfterRateDiscount = hasRateDiscount ? total * discountNumber / 10 : total
  const directReductionRaw = directReduceValue !== '' && directReduceValue != null
    ? directReduceValue
    : (discountType === 'direct_reduce' ? discountValue : '')
  const hasDirectReductionInput = directReductionRaw !== '' && directReductionRaw != null
  const directReductionNumber = getNumber(directReductionRaw)
  const hasDirectReduction = hasDirectReductionInput &&
    directReductionNumber >= 0 && directReductionNumber <= priceAfterRateDiscount
  const receivable = hasDirectReduction
    ? Math.max(0, priceAfterRateDiscount - directReductionNumber)
    : priceAfterRateDiscount
  const received = receivable
  const discountTextParts = []
  if (hasRateDiscount) discountTextParts.push(formatPrice(discountNumber) + '\u6298')
  if (hasDirectReduction) discountTextParts.push('\u76f4\u51cf\uffe5' + formatPrice(directReductionNumber))

  return {
    totalText: formatPrice(total),
    receivableText: formatPrice(receivable),
    discountText: discountTextParts.join(' + '),
    discountPriceText: formatPrice(receivable),
    paymentLabel: getOptionLabel(PAYMENT_OPTIONS, paymentMethod) || getOptionLabel(PAYMENT_OPTIONS, 'wechat_alipay'),
    receivedText: formatPrice(received)
  }
}

function isSameTable(left, right) {
  return left && right &&
    left.areaKey === right.areaKey &&
    left.tableNumber === right.tableNumber
}

function getSafeTableRef(table) {
  const source = table || {}
  const tableKeyParts = String(source.tableKey || '').split('-')
  const areaKey = source.areaKey || tableKeyParts[0] || ''
  const tableNumber = source.tableNumber || tableKeyParts[1] || ''
  return {
    areaKey,
    areaName: source.areaName || '',
    tableNumber,
    tableKey: source.tableKey || (areaKey && tableNumber ? `${areaKey}-${tableNumber}` : '')
  }
}

function formatMergeTableSections(sections, currentTable, selectedMap = {}) {
  return (sections || []).map(section => {
    const tables = (section.tables || [])
      .filter(table => {
        if (isSameTable(table, currentTable)) return false
        return table.status !== 'paid'
      })
      .map(table => {
        const status = STATUS[table.status] || STATUS.empty
        const tableKey = table.tableKey || `${table.areaKey}-${table.tableNumber}`
        return {
          ...table,
          tableKey,
          areaName: table.areaName || section.areaName || '',
          label: `${table.areaName || section.areaName || ''}${table.tableNumber}${UI.tableUnit}`,
          statusText: status.text,
          statusClass: status.className,
          priceText: formatPrice(table.totalPrice),
          peopleText: `${Number(table.peopleCount || 0)}/${Number(table.maxPeople || 0)}`,
          selected: !!selectedMap[tableKey]
        }
      })
    return {
      ...section,
      tables
    }
  }).filter(section => section.tables.length > 0)
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
    selectedDishIndex: -1,
    selectedDishMap: {},
    selectedDishCount: 0,
    selectedDishText: UI.noSelectedDish,
    selectedGroupId: '',
    dishActions: DISH_ACTIONS,
    discountOptions: DISCOUNT_OPTIONS,
    paymentOptions: PAYMENT_OPTIONS,
    discountType: '',
    discountInput: '',
    discountValue: '',
    directReduceValue: '',
    discountDialogType: '',
    showDiscountDialog: false,
    showPeopleDialog: false,
    showMergeDialog: false,
    mergeLoading: false,
    savingMerge: false,
    mergeTableSections: [],
    selectedMergeTableMap: {},
    selectedMergeTableCount: 0,
    peopleInput: '',
    paymentMethod: 'wechat_alipay',
    paySummary: buildPaySummary(0, 'wechat_alipay', '', '', ''),
    loading: false,
    sendingKitchen: false,
    urgingKitchen: false,
    savingPeople: false,
    savingDishEdit: false,
    showEditDishDialog: false,
    editDishTarget: null,
    editDishTitle: '',
    editDishOptionsInput: '',
    editDishRemark: '',
    checkingOut: false
  },

  onLoad(options) {
    const table = buildTable(options || {})
    this.setData({
      table,
      billGroups: [],
      itemCount: 0,
      totalPriceText: table.priceText,
      paySummary: buildPaySummary(table.totalPrice, this.data.paymentMethod, this.data.discountType, this.data.discountValue, this.data.directReduceValue)
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
        selectedDishRowId: '',
        selectedDishName: '',
        selectedDishIndex: -1,
        selectedDishMap: {},
        selectedDishCount: 0,
        selectedDishText: UI.noSelectedDish,
        selectedGroupId: '',
        paySummary: buildPaySummary(totalPrice, this.data.paymentMethod, this.data.discountType, this.data.discountValue, this.data.directReduceValue)
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

  getDishRecords() {
    const records = []
    ;(this.data.billGroups || []).forEach(group => {
      ;(group.goods || []).forEach((dish, dishIndex) => {
        records.push({
          rowId: dish.rowId,
          groupId: group.id,
          dishIndex,
          dishName: dish.dishName,
          canSendKitchen: group.canSendKitchen !== false
        })
      })
    })
    return records
  },

  getGroupDishRecords(groupId) {
    const group = (this.data.billGroups || []).find(item => item.id === groupId)
    if (!group) return []
    return (group.goods || []).map((dish, dishIndex) => ({
      rowId: dish.rowId,
      groupId: group.id,
      dishIndex,
      dishName: dish.dishName,
      canSendKitchen: group.canSendKitchen !== false
    }))
  },

  getSelectedDishItems(selectedMap = this.data.selectedDishMap) {
    const map = selectedMap || {}
    return this.getDishRecords().filter(item => map[item.rowId])
  },

  getDishByRecord(record) {
    if (!record) return null
    const group = (this.data.billGroups || []).find(item => item.id === record.groupId)
    if (!group || !Array.isArray(group.goods)) return null
    const dish = group.goods[record.dishIndex]
    if (!dish) return null
    return {
      group,
      dish
    }
  },

  getDishEditOptionsText(dish) {
    const remark = String(dish && dish.remark || '').trim()
    return (Array.isArray(dish && dish.tags) ? dish.tags : [])
      .filter(tag => {
        const text = String(tag || '').trim()
        if (!text) return false
        if (text === remark) return false
        return text.indexOf('\u5907\u6ce8\uff1a') !== 0 && text.indexOf('\u5907\u6ce8:') !== 0
      })
      .join('\u3001')
  },

  parseEditDishOptions(value) {
    return String(value || '')
      .split(/[\u3001\uff0c,\n]/)
      .map(item => item.trim())
      .filter(Boolean)
  },

  applySelectedDishMap(selectedMap) {
    const selectedDishMap = selectedMap || {}
    const selectedItems = this.getSelectedDishItems(selectedDishMap)
    const lastItem = selectedItems[selectedItems.length - 1] || {}
    const selectedDishText = selectedItems.length === 0
      ? UI.noSelectedDish
      : selectedItems.length === 1
        ? lastItem.dishName
        : `${UI.selectedDishCount}${selectedItems.length}${UI.selectedDishUnit}`
    const billGroups = (this.data.billGroups || []).map(group => {
      const goods = (group.goods || []).map(dish => ({
        ...dish,
        selected: !!selectedDishMap[dish.rowId]
      }))
      const selectedCount = goods.filter(dish => dish.selected).length
      return {
        ...group,
        goods,
        selected: goods.length > 0 && selectedCount === goods.length,
        partialSelected: selectedCount > 0 && selectedCount < goods.length
      }
    })

    this.setData({
      billGroups,
      selectedDishMap,
      selectedDishCount: selectedItems.length,
      selectedDishRowId: lastItem.rowId || '',
      selectedDishName: lastItem.dishName || '',
      selectedDishIndex: Number.isInteger(lastItem.dishIndex) ? lastItem.dishIndex : -1,
      selectedDishText,
      selectedGroupId: lastItem.groupId || ''
    })
  },

  getDishRecordFromDataset(dataset) {
    if (!dataset || !dataset.rowId) return null
    const dishIndex = Math.floor(Number(dataset.dishIndex))
    return {
      rowId: dataset.rowId,
      groupId: dataset.groupId || '',
      dishIndex: Number.isInteger(dishIndex) ? dishIndex : -1,
      dishName: dataset.dishName || ''
    }
  },

  selectDish(event) {
    this.toggleDishSelection(event)
  },

  toggleDishSelection(event) {
    if (this.ignoreNextDishTap) {
      this.ignoreNextDishTap = false
      return
    }
    const dataset = event.currentTarget.dataset || {}
    const record = this.getDishRecordFromDataset(dataset)
    if (!record) return

    const selectedDishMap = {
      ...(this.data.selectedDishMap || {})
    }
    if (selectedDishMap[record.rowId]) {
      delete selectedDishMap[record.rowId]
    } else {
      selectedDishMap[record.rowId] = true
    }
    this.applySelectedDishMap(selectedDishMap)
  },

  toggleGroupSelection(event) {
    const groupId = event.currentTarget.dataset.groupId || ''
    const groupRecords = this.getGroupDishRecords(groupId)
    if (groupRecords.length === 0) return

    const selectedDishMap = {
      ...(this.data.selectedDishMap || {})
    }
    const allSelected = groupRecords.every(item => selectedDishMap[item.rowId])

    groupRecords.forEach(item => {
      if (allSelected) {
        delete selectedDishMap[item.rowId]
      } else {
        selectedDishMap[item.rowId] = true
      }
    })
    this.applySelectedDishMap(selectedDishMap)
  },

  prepareDishRects() {
    wx.createSelectorQuery()
      .in(this)
      .selectAll('.dish-row')
      .boundingClientRect(rects => {
        this.dishRects = Array.isArray(rects) ? rects : []
      })
      .exec()
  },

  startDishDragSelect(event) {
    const touch = event.touches && event.touches[0]
    const record = this.getDishRecordFromDataset(event.currentTarget.dataset || {})
    if (!touch || !record) return

    this.dragSelectState = {
      active: true,
      moved: false,
      startX: touch.clientX,
      startY: touch.clientY,
      startRecord: record,
      touchedRows: {}
    }
    this.prepareDishRects()
  },

  addDragSelectedRecord(record) {
    if (!record || !record.rowId) return
    const state = this.dragSelectState
    if (!state || state.touchedRows[record.rowId]) return

    state.touchedRows[record.rowId] = true
    const selectedDishMap = {
      ...(this.data.selectedDishMap || {})
    }
    selectedDishMap[record.rowId] = true
    this.applySelectedDishMap(selectedDishMap)
  },

  getDishRecordByTouch(touch) {
    const rects = this.dishRects || []
    const records = this.getDishRecords()
    if (!touch || rects.length === 0 || records.length === 0) return null

    const rectIndex = rects.findIndex(rect => {
      const inY = touch.clientY >= rect.top && touch.clientY <= rect.bottom
      const inX = touch.clientX >= rect.left - 20 && touch.clientX <= rect.right + 20
      return inY && inX
    })
    return rectIndex >= 0 ? records[rectIndex] : null
  },

  moveDishDragSelect(event) {
    const state = this.dragSelectState
    const touch = event.touches && event.touches[0]
    if (!state || !state.active || !touch) return

    const moveDistance = Math.abs(touch.clientY - state.startY) + Math.abs(touch.clientX - state.startX)
    if (!state.moved && moveDistance < 8) return

    if (!state.moved) {
      state.moved = true
      this.addDragSelectedRecord(state.startRecord)
    }
    const record = this.getDishRecordByTouch(touch)
    this.addDragSelectedRecord(record)
  },

  endDishDragSelect() {
    const moved = this.dragSelectState && this.dragSelectState.moved
    this.dragSelectState = null
    if (moved) {
      this.ignoreNextDishTap = true
      setTimeout(() => {
        this.ignoreNextDishTap = false
      }, 120)
    }
  },

  editPeople() {
    const table = this.data.table || {}
    this.setData({
      showPeopleDialog: true,
      peopleInput: table.peopleCount ? String(table.peopleCount) : ''
    })
  },

  onPeopleInput(event) {
    this.setData({
      peopleInput: event.detail.value
    })
  },

  closePeopleDialog() {
    if (this.data.savingPeople) return
    this.setData({
      showPeopleDialog: false
    })
  },

  stopPeopleDialogTap() {},

  async confirmPeopleDialog() {
    if (this.data.savingPeople) return
    const peopleCount = Math.floor(Number(this.data.peopleInput))
    const table = this.data.table || {}

    if (!Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > 99) {
      wx.showToast({
        title: UI.peopleInvalid,
        icon: 'none'
      })
      return
    }
    if (!table.tableNumber) {
      wx.showToast({
        title: UI.noOrder,
        icon: 'none'
      })
      return
    }

    try {
      this.setData({ savingPeople: true })
      await apiClient.call('admin.table.updatePeople', {
        areaKey: table.areaKey,
        tableNumber: table.tableNumber,
        peopleCount
      })
      wx.showToast({
        title: UI.peopleSaveSuccess,
        icon: 'success'
      })
      this.setData({
        showPeopleDialog: false
      })
      await this.loadDetail(true)
    } catch (err) {
      console.error('update table people failed', err)
      wx.showToast({
        title: err.message || UI.peopleSaveFailed,
        icon: 'none'
      })
    } finally {
      this.setData({ savingPeople: false })
    }
  },

  async openMergeDialog() {
    const table = this.data.table || {}
    if (!table.tableNumber) {
      wx.showToast({
        title: UI.noOrder,
        icon: 'none'
      })
      return
    }

    this.setData({
      showMergeDialog: true,
      mergeLoading: true,
      mergeTableSections: [],
      selectedMergeTableMap: {},
      selectedMergeTableCount: 0
    })

    try {
      const res = await apiClient.call('admin.table.list')
      const sections = res && res.data && Array.isArray(res.data.sections)
        ? res.data.sections
        : []
      this.mergeRawSections = sections
      this.setData({
        mergeTableSections: formatMergeTableSections(sections, table, {}),
        mergeLoading: false
      })
    } catch (err) {
      console.error('load merge tables failed', err)
      this.setData({ mergeLoading: false })
      wx.showToast({
        title: UI.loadFailed,
        icon: 'none'
      })
    }
  },

  closeMergeDialog() {
    if (this.data.savingMerge) return
    this.setData({
      showMergeDialog: false
    })
  },

  stopMergeDialogTap() {},

  toggleMergeTable(event) {
    const tableKey = event.currentTarget.dataset.tableKey || ''
    if (!tableKey) return

    const selectedMergeTableMap = {
      ...(this.data.selectedMergeTableMap || {})
    }
    if (selectedMergeTableMap[tableKey]) {
      delete selectedMergeTableMap[tableKey]
    } else {
      selectedMergeTableMap[tableKey] = true
    }

    this.setData({
      selectedMergeTableMap,
      selectedMergeTableCount: Object.keys(selectedMergeTableMap).length,
      mergeTableSections: formatMergeTableSections(this.mergeRawSections || [], this.data.table || {}, selectedMergeTableMap)
    })
  },

  getSelectedMergeTables() {
    const selectedMap = this.data.selectedMergeTableMap || {}
    const selectedTables = []
    ;(this.data.mergeTableSections || []).forEach(section => {
      ;(section.tables || []).forEach(table => {
        if (selectedMap[table.tableKey]) {
          selectedTables.push({
            areaKey: table.areaKey,
            tableNumber: table.tableNumber
          })
        }
      })
    })
    return selectedTables
  },

  async confirmMergeTables() {
    if (this.data.savingMerge) return
    const table = this.data.table || {}
    const selectedTables = this.getSelectedMergeTables()

    if (selectedTables.length === 0) {
      wx.showToast({
        title: UI.selectMergeTableFirst,
        icon: 'none'
      })
      return
    }

    const selectedLabels = []
    ;(this.data.mergeTableSections || []).forEach(section => {
      ;(section.tables || []).forEach(item => {
        if ((this.data.selectedMergeTableMap || {})[item.tableKey]) {
          selectedLabels.push(item.label)
        }
      })
    })

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: UI.mergeConfirmTitle,
        content: `${UI.mergeConfirmPrefix}${selectedLabels.join('、')}${UI.mergeConfirmSuffix}`,
        confirmText: UI.mergeTable,
        cancelText: UI.discountCancel,
        success: res => resolve(res.confirm === true),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return

    try {
      this.setData({ savingMerge: true })
      await apiClient.call('admin.table.merge', {
        areaKey: table.areaKey,
        tableNumber: table.tableNumber,
        tables: selectedTables
      })
      wx.showToast({
        title: UI.mergeSuccess,
        icon: 'success'
      })
      this.setData({
        showMergeDialog: false,
        selectedMergeTableMap: {},
        selectedMergeTableCount: 0
      })
      await this.loadDetail(true)
    } catch (err) {
      console.error('merge tables failed', err)
      wx.showToast({
        title: err.message || UI.mergeFailed,
        icon: 'none'
      })
    } finally {
      this.setData({ savingMerge: false })
    }
  },

  startChangeTable() {
    const table = this.data.table || {}
    if (!table.tableNumber) {
      wx.showToast({
        title: UI.noOrder,
        icon: 'none'
      })
      return
    }

    wx.removeStorageSync('adminTableMerge')
    wx.setStorageSync('adminTableTransfer', {
      areaKey: table.areaKey,
      areaName: table.areaName,
      tableNumber: table.tableNumber,
      tableKey: table.tableKey,
      label: `${table.areaName}${table.tableNumber}${UI.tableUnit}`,
      createTime: Date.now()
    })
    wx.showToast({
      title: UI.changeTableStarted,
      icon: 'none'
    })

    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]
    if (prevPage && prevPage.route === 'packages/admin/pages/admin/table/table') {
      wx.navigateBack()
      return
    }

    wx.redirectTo({
      url: TABLE_PAGE
    })
  },

  startMergeTable() {
    const table = getSafeTableRef(this.data.table)
    if (!table.tableNumber) {
      wx.showToast({
        title: UI.noOrder,
        icon: 'none'
      })
      return
    }

    wx.removeStorageSync('adminTableTransfer')
    wx.setStorageSync('adminTableMerge', {
      areaKey: table.areaKey,
      areaName: table.areaName,
      tableNumber: table.tableNumber,
      tableKey: table.tableKey,
      label: `${table.areaName}${table.tableNumber}${UI.tableUnit}`,
      createTime: Date.now()
    })
    wx.showToast({
      title: UI.mergeTableStarted,
      icon: 'none'
    })

    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]
    if (prevPage && prevPage.route === 'packages/admin/pages/admin/table/table') {
      wx.navigateBack()
      return
    }

    wx.redirectTo({
      url: TABLE_PAGE
    })
  },

  async handleDishAction(event) {
    const action = event.currentTarget.dataset.action || ''
    if (!action) return

    if (!TABLE_ACTIONS.has(action) && this.data.selectedDishCount <= 0) {
      wx.showToast({
        title: UI.selectDishFirst,
        icon: 'none'
      })
      return
    }

    if (action === UI.sendKitchen) {
      await this.sendKitchen()
      return
    }
    if (action === UI.urge) {
      await this.urgeSelectedDish()
      return
    }
    if (action === UI.editDish) {
      this.openEditDishDialog()
      return
    }
    if (action === UI.refundDish) {
      await this.refundSelectedDish()
      return
    }
    if (action === UI.giftDish) {
      await this.giftSelectedDish()
      return
    }
    if (action === UI.mergeTable) {
      this.startMergeTable()
      return
    }
    if (action === UI.changeTable) {
      this.startChangeTable()
      return
    }

    wx.showToast({
      title: `${action}${UI.actionTodo}`,
      icon: 'none'
    })
  },

  selectDiscount(event) {
    const value = event.currentTarget.dataset.value || 'discount'
    const totalPrice = this.data.table.totalPrice
    if (value === 'direct_reduce' && this.data.directReduceValue !== '') {
      this.setData({
        directReduceValue: '',
        discountDialogType: '',
        showDiscountDialog: false,
        paySummary: buildPaySummary(totalPrice, this.data.paymentMethod, this.data.discountType, this.data.discountValue, '')
      })
      return
    }
    if (value === 'discount' && this.data.discountType === 'discount' && this.data.discountValue !== '') {
      this.setData({
        discountType: '',
        discountInput: '',
        discountValue: '',
        discountDialogType: '',
        showDiscountDialog: false,
        paySummary: buildPaySummary(totalPrice, this.data.paymentMethod, '', '', this.data.directReduceValue)
      })
      return
    }

    this.setData({
      discountDialogType: value,
      discountInput: '',
      showDiscountDialog: true
    })
  },

  onDiscountInput(event) {
    this.setData({
      discountInput: event.detail.value
    })
  },

  closeDiscountDialog() {
    this.setData({
      showDiscountDialog: false,
      discountDialogType: '',
      discountInput: ''
    })
  },

  stopDiscountDialogTap() {},

  confirmDiscountDialog() {
    const value = Number(this.data.discountInput)
    const type = this.data.discountDialogType || 'discount'
    const totalPrice = getNumber(this.data.table.totalPrice)
    const isDirectReduction = type === 'direct_reduce'
    const activeRateValue = type === 'discount' ? value : Number(this.data.discountValue)
    const hasActiveRate = type === 'discount'
      ? Number.isFinite(value) && value >= 0 && value <= 10
      : this.data.discountType === 'discount' && Number.isFinite(activeRateValue) && activeRateValue >= 0 && activeRateValue <= 10
    const priceAfterRateDiscount = hasActiveRate ? totalPrice * activeRateValue / 10 : totalPrice
    const isValid = isDirectReduction
      ? Number.isFinite(value) && value >= 0 && value <= priceAfterRateDiscount
      : Number.isFinite(value) && value >= 0 && value <= 10
    if (!isValid) {
      wx.showToast({
        title: isDirectReduction ? UI.directReduceInvalid : UI.discountInvalid,
        icon: 'none'
      })
      return
    }
    const activeDirectReduction = isDirectReduction ? value : Number(this.data.directReduceValue)
    const hasActiveDirectReduction = isDirectReduction
      ? true
      : this.data.directReduceValue !== '' && Number.isFinite(activeDirectReduction)
    if (!isDirectReduction && hasActiveDirectReduction && activeDirectReduction > priceAfterRateDiscount) {
      wx.showToast({
        title: UI.directReduceInvalid,
        icon: 'none'
      })
      return
    }

    const nextDiscountType = isDirectReduction ? this.data.discountType : 'discount'
    const nextDiscountValue = isDirectReduction ? this.data.discountValue : String(value)
    const nextDirectReduceValue = isDirectReduction ? String(value) : this.data.directReduceValue
    this.setData({
      discountType: nextDiscountType,
      discountValue: nextDiscountValue,
      directReduceValue: nextDirectReduceValue,
      discountDialogType: '',
      showDiscountDialog: false,
      paySummary: buildPaySummary(this.data.table.totalPrice, this.data.paymentMethod, nextDiscountType, nextDiscountValue, nextDirectReduceValue)
    })
  },
  selectPayment(event) {
    const value = event.currentTarget.dataset.value || 'wechat_alipay'
    this.setData({
      paymentMethod: value,
      paySummary: buildPaySummary(this.data.table.totalPrice, value, this.data.discountType, this.data.discountValue, this.data.directReduceValue)
    })
  },

  openEditDishDialog() {
    const selectedItems = this.getSelectedDishItems()
    if (selectedItems.length !== 1) {
      wx.showToast({
        title: selectedItems.length > 1 ? UI.editDishSingleOnly : UI.selectDishFirst,
        icon: 'none'
      })
      return
    }

    const selected = selectedItems[0]
    const detail = this.getDishByRecord(selected)
    if (!detail) {
      wx.showToast({
        title: UI.selectDishFirst,
        icon: 'none'
      })
      return
    }

    const dish = detail.dish
    this.setData({
      showEditDishDialog: true,
      editDishTarget: {
        orderId: selected.groupId,
        dishIndex: selected.dishIndex
      },
      editDishTitle: dish.dishName || selected.dishName || '',
      editDishOptionsInput: this.getDishEditOptionsText(dish),
      editDishRemark: dish.remark || ''
    })
  },

  closeEditDishDialog() {
    if (this.data.savingDishEdit) return
    this.setData({
      showEditDishDialog: false,
      editDishTarget: null,
      editDishTitle: '',
      editDishOptionsInput: '',
      editDishRemark: ''
    })
  },

  stopEditDishDialogTap() {},

  onEditDishOptionsInput(event) {
    this.setData({
      editDishOptionsInput: event.detail.value
    })
  },

  onEditDishRemarkInput(event) {
    this.setData({
      editDishRemark: event.detail.value
    })
  },

  async confirmEditDishDialog() {
    if (this.data.savingDishEdit) return
    const target = this.data.editDishTarget || {}

    try {
      this.setData({ savingDishEdit: true })
      await apiClient.call('admin.table.updateDish', {
        orderId: target.orderId,
        dishIndex: target.dishIndex,
        tags: this.parseEditDishOptions(this.data.editDishOptionsInput),
        remark: this.data.editDishRemark
      })
      wx.showToast({
        title: UI.editDishSuccess,
        icon: 'success'
      })
      this.setData({
        savingDishEdit: false,
        showEditDishDialog: false,
        editDishTarget: null,
        editDishTitle: '',
        editDishOptionsInput: '',
        editDishRemark: '',
        selectedDishRowId: '',
        selectedDishName: '',
        selectedDishIndex: -1,
        selectedDishMap: {},
        selectedDishCount: 0,
        selectedDishText: UI.noSelectedDish,
        selectedGroupId: ''
      })
      await this.loadDetail(true)
    } catch (err) {
      console.error('edit selected dish failed', err)
      this.setData({ savingDishEdit: false })
      wx.showToast({
        title: err.message || UI.editDishFailed,
        icon: 'none'
      })
    }
  },

  async refundSelectedDish() {
    const selectedItems = this.getSelectedDishItems()
    if (selectedItems.length === 0) {
      wx.showToast({
        title: UI.selectDishFirst,
        icon: 'none'
      })
      return
    }

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: UI.refundConfirmTitle,
        content: selectedItems.length > 1
          ? `\u786e\u5b9a\u5c06\u9009\u4e2d\u7684${selectedItems.length}\u4e2a\u83dc\u54c1\u4ece\u8ba2\u5355\u4e2d\u79fb\u9664\u5417`
          : UI.refundConfirmContent,
        confirmText: UI.refundDish,
        cancelText: '\u53d6\u6d88',
        success: res => resolve(res.confirm === true),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return

    try {
      await apiClient.call('admin.table.refundDishes', {
        items: selectedItems.map(item => ({
          orderId: item.groupId,
          dishIndex: item.dishIndex
        }))
      })
      wx.showToast({
        title: UI.refundSuccess,
        icon: 'success'
      })
      this.setData({
        selectedDishRowId: '',
        selectedDishName: '',
        selectedDishIndex: -1,
        selectedDishMap: {},
        selectedDishCount: 0,
        selectedDishText: UI.noSelectedDish,
        selectedGroupId: ''
      })
      await this.loadDetail(true)
    } catch (err) {
      console.error('refund selected dish failed', err)
      wx.showToast({
        title: err.message || '\u9000\u83dc\u5931\u8d25',
        icon: 'none'
      })
    }
  },

  async giftSelectedDish() {
    const selectedItems = this.getSelectedDishItems()
    if (selectedItems.length === 0) {
      wx.showToast({
        title: UI.selectDishFirst,
        icon: 'none'
      })
      return
    }

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: UI.giftConfirmTitle,
        content: selectedItems.length > 1
          ? `\u786e\u5b9a\u5c06\u9009\u4e2d\u7684${selectedItems.length}\u4e2a\u83dc\u54c1\u5728\u672c\u6b21\u8ba2\u5355\u4e2d\u6309 0 \u5143\u7ed3\u7b97\u5417`
          : UI.giftConfirmContent,
        confirmText: UI.giftDish,
        cancelText: '\u53d6\u6d88',
        success: res => resolve(res.confirm === true),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return

    try {
      await apiClient.call('admin.table.giftDishes', {
        items: selectedItems.map(item => ({
          orderId: item.groupId,
          dishIndex: item.dishIndex
        }))
      })
      wx.showToast({
        title: UI.giftSuccess,
        icon: 'success'
      })
      this.setData({
        selectedDishRowId: '',
        selectedDishName: '',
        selectedDishIndex: -1,
        selectedDishMap: {},
        selectedDishCount: 0,
        selectedDishText: UI.noSelectedDish,
        selectedGroupId: ''
      })
      await this.loadDetail(true)
    } catch (err) {
      console.error('gift selected dish failed', err)
      wx.showToast({
        title: err.message || '\u8d60\u83dc\u5931\u8d25',
        icon: 'none'
      })
    }
  },

  async urgeSelectedDish() {
    if (this.data.urgingKitchen) return
    const selectedItems = this.getSelectedDishItems()
    if (selectedItems.length === 0) {
      wx.showToast({
        title: UI.noSelectedUrgeDish,
        icon: 'none'
      })
      return
    }

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: UI.urgeConfirmTitle,
        content: selectedItems.length > 1
          ? `\u786e\u5b9a\u5c06\u9009\u4e2d\u7684${selectedItems.length}\u4e2a\u83dc\u54c1\u91cd\u65b0\u53d1\u9001\u7ed9\u540e\u53a8\u6253\u5370\u5417`
          : UI.urgeConfirmContent,
        confirmText: UI.urge,
        cancelText: '\u53d6\u6d88',
        success: res => resolve(res.confirm === true),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return

    try {
      this.setData({ urgingKitchen: true })
      const res = await apiClient.call('admin.table.urgeKitchenItems', {
        items: selectedItems.map(item => ({
          orderId: item.groupId,
          dishIndex: item.dishIndex
        }))
      })
      const updated = Number(res && res.data && res.data.urgedCount || 0)
      wx.showToast({
        title: updated > 0 ? UI.urgeSuccess : UI.noOrder,
        icon: updated > 0 ? 'success' : 'none'
      })
      this.setData({
        selectedDishRowId: '',
        selectedDishName: '',
        selectedDishIndex: -1,
        selectedDishMap: {},
        selectedDishCount: 0,
        selectedDishText: UI.noSelectedDish,
        selectedGroupId: ''
      })
      await this.loadDetail(true)
    } catch (err) {
      console.error('urge selected dish failed', err)
      wx.showToast({
        title: err.message || '\u50ac\u83dc\u5931\u8d25',
        icon: 'none'
      })
    } finally {
      this.setData({ urgingKitchen: false })
    }
  },

  async sendKitchen() {
    if (this.data.sendingKitchen) return
    const selectedItems = this.getSelectedDishItems()
    if (selectedItems.length === 0) {
      wx.showToast({
        title: UI.noSelectedKitchenDish,
        icon: 'none'
      })
      return
    }
    if (selectedItems.some(item => item.canSendKitchen === false)) {
      wx.showToast({
        title: UI.paidOrderCannotSendKitchen,
        icon: 'none'
      })
      await this.loadDetail(true)
      return
    }

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: UI.sendKitchenConfirmTitle,
        content: selectedItems.length > 1
          ? `\u786e\u5b9a\u53d1\u9001\u9009\u4e2d\u7684${selectedItems.length}\u4e2a\u83dc\u54c1\u5230\u540e\u53a8\u5417`
          : UI.sendKitchenConfirmContent,
        confirmText: UI.sendKitchen,
        cancelText: '\u53d6\u6d88',
        success: res => resolve(res.confirm === true),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return

    try {
      this.setData({ sendingKitchen: true })
      const res = await apiClient.call('admin.table.sendKitchenItems', {
        items: selectedItems.map(item => ({
          orderId: item.groupId,
          dishIndex: item.dishIndex
        }))
      })
      const updated = Number(res && res.data && res.data.sentCount || 0)
      wx.showToast({
        title: updated > 0 ? UI.sendSuccess : UI.noOrder,
        icon: updated > 0 ? 'success' : 'none'
      })
      this.setData({
        selectedDishRowId: '',
        selectedDishName: '',
        selectedDishIndex: -1,
        selectedDishMap: {},
        selectedDishCount: 0,
        selectedDishText: UI.noSelectedDish,
        selectedGroupId: ''
      })
      await this.loadDetail(true)
    } catch (err) {
      console.error('send table orders to kitchen failed', err)
      if (err.code === 'ORDER_PAID' || /paid order/.test(err.message || '')) {
        await this.loadDetail(true)
      }
      wx.showToast({
        title: err.code === 'ORDER_PAID' || /paid order/.test(err.message || '')
          ? UI.paidOrderCannotSendKitchen
          : err.message || '\u53d1\u9001\u5931\u8d25',
        icon: 'none'
      })
    } finally {
      this.setData({ sendingKitchen: false })
    }
  },

  async finishCheckout() {
    if (this.data.checkingOut) return
    const table = this.data.table || {}
    if (!table.tableNumber || this.data.billGroups.length === 0) {
      wx.showToast({
        title: UI.noOrder,
        icon: 'none'
      })
      return
    }

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: UI.checkoutConfirmTitle,
        content: UI.checkoutConfirmContent,
        confirmText: '\u7ed3\u8d26',
        cancelText: '\u53d6\u6d88',
        success: res => resolve(res.confirm === true),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return

    try {
      this.setData({ checkingOut: true })
      await apiClient.call('admin.table.finishCheckout', {
        areaKey: table.areaKey,
        tableNumber: table.tableNumber,
        paymentMethod: this.data.paymentMethod,
        discountType: this.data.discountType,
        discountValue: this.data.discountValue,
        directReduceValue: this.data.directReduceValue
      })
      wx.showToast({
        title: UI.checkoutSuccess,
        icon: 'success'
      })
      await this.loadDetail(true)
    } catch (err) {
      console.error('finish checkout failed', err)
      wx.showToast({
        title: err.message || UI.checkoutFailed,
        icon: 'none'
      })
    } finally {
      this.setData({ checkingOut: false })
    }
  }
})
