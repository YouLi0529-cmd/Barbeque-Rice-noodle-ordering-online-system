const apiClient = require('../../../../../utils/apiClient')
const adminSound = require('../../../utils/adminSound')

const UI = {
  title: '\u7ed3\u7b97\u8bb0\u5f55',
  refresh: '\u5237\u65b0',
  date: '\u7ed3\u7b97\u65e5\u671f',
  recordCount: '\u7b14\u5df2\u7ed3\u7b97',
  empty: '\u8be5\u65e5\u6682\u65e0\u7ed3\u7b97\u8bb0\u5f55',
  selectTip: '\u70b9\u9009\u5de6\u4fa7\u8bb0\u5f55\u67e5\u770b\u8d26\u5355\u660e\u7ec6',
  detailTitle: '\u7ed3\u7b97\u660e\u7ec6',
  total: '\u8ba2\u5355\u91d1\u989d',
  discount: '\u6253\u6298',
  directReduce: '\u76f4\u51cf',
  receivable: '\u5b9e\u6536\u91d1\u989d',
  payment: '\u652f\u4ed8\u65b9\u5f0f',
  editPayment: '\u9009\u62e9\u652f\u4ed8\u65b9\u5f0f',
  editReceivable: '\u4fee\u6539\u5b9e\u6536\u91d1\u989d',
  amountHint: '\u8bf7\u8f93\u5165\u5b9e\u9645\u6536\u6b3e\u91d1\u989d',
  mixedCash: '\u73b0\u91d1\u6536\u6b3e',
  mixedOnline: '\u5fae\u4fe1/\u652f\u4ed8\u5b9d\u6536\u6b3e',
  mixedHint: '\u53e6\u4e00\u79cd\u65b9\u5f0f\u5c06\u81ea\u52a8\u8865\u8db3\u5b9e\u6536\u91d1\u989d',
  mixedInvalid: '\u91d1\u989d\u4e0d\u80fd\u5927\u4e8e\u5b9e\u6536\u91d1\u989d',
  cancel: '\u53d6\u6d88',
  confirm: '\u786e\u5b9a',
  edit: '\u4fee\u6539',
  people: '\u7528\u9910\u4eba\u6570',
  settledAt: '\u7ed3\u7b97\u65f6\u95f4',
  loadFailed: '\u7ed3\u7b97\u8bb0\u5f55\u52a0\u8f7d\u5931\u8d25',
  detailFailed: '\u8d26\u5355\u660e\u7ec6\u52a0\u8f7d\u5931\u8d25',
  moreHint: '\u5df2\u8bfb\u53d6\u5f53\u65e5\u6700\u524d 500 \u6761\u8ba2\u5355'
}

function pad(value) {
  return value < 10 ? `0${value}` : String(value)
}

function toDateValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatMoney(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return '0'
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
}

function formatDateTime(value) {
  const time = Number(value || 0)
  if (!time) return '\u672a\u8bb0\u5f55'
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) return '\u672a\u8bb0\u5f55'
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDetailDateTime(value) {
  const time = Number(value || 0)
  if (!time) return '\u672a\u8bb0\u5f55'
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) return '\u672a\u8bb0\u5f55'
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function normalizeRecord(item = {}) {
  return {
    ...item,
    paidTimeText: formatDateTime(item.paidAt),
    totalText: formatMoney(item.totalPrice),
    receivableText: formatMoney(item.receivable)
  }
}

function normalizeDetail(item = {}) {
  const cashReceived = Number(item.cashReceived)
  const onlineReceived = Number(item.onlineReceived)
  return {
    ...item,
    paidTimeText: formatDetailDateTime(item.paidAt),
    totalText: formatMoney(item.totalPrice),
    receivableText: formatMoney(item.receivable),
    cashReceivedText: formatMoney(Number.isFinite(cashReceived) ? cashReceived : 0),
    onlineReceivedText: formatMoney(Number.isFinite(onlineReceived) ? onlineReceived : 0),
    directReduceText: item.directReduceText ? formatMoney(item.directReduceText) : '',
    orderGroups: (Array.isArray(item.orderGroups) ? item.orderGroups : []).map(group => ({
      ...group,
      totalText: formatMoney(group.totalPrice),
      goods: (Array.isArray(group.goods) ? group.goods : []).map(good => ({
        ...good,
        subtotalText: formatMoney(good.subtotal)
      }))
    }))
  }
}

Page({
  data: {
    ui: UI,
    selectedDate: '',
    minDate: '',
    maxDate: '',
    loading: true,
    refreshing: false,
    detailLoading: false,
    records: [],
    selectedRecordId: '',
    detail: null,
    loadError: '',
    isTruncated: false,
    addingToOrderId: '',
    addDishForm: { dishId: '', keyword: '', count: '1', selectedDish: null },
    addDishResults: [],
    addDishSearching: false,
    paymentOptions: [
      { value: 'cash', label: '\u73b0\u91d1' },
      { value: 'mixed', label: '\u6df7\u5408\u652f\u4ed8' },
      { value: 'wechat_alipay', label: '\u5fae\u4fe1/\u652f\u4ed8\u5b9d' }
    ],
    showPaymentPicker: false,
    showAmountModal: false,
    amountInput: '',
    showMixedPaymentDialog: false,
    mixedPaymentEditingChannel: '',
    mixedPaymentInput: ''
  },

  onAdminTap(event) {
    adminSound.playClick(event)
  },

  onLoad() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const earliest = new Date(today)
    earliest.setDate(earliest.getDate() - 59)
    this.setData({
      selectedDate: toDateValue(today),
      minDate: toDateValue(earliest),
      maxDate: toDateValue(today)
    }, () => this.loadRecords())
  },

  onDateChange(event) {
    const date = event.detail && event.detail.value
    if (!date || date === this.data.selectedDate) return
    this.setData({
      selectedDate: date,
      selectedRecordId: '',
      detail: null
    }, () => this.loadRecords())
  },

  refreshRecords() {
    if (this.data.loading || this.data.refreshing) return
    this.loadRecords(true)
  },

  async loadRecords(manual = false) {
    if (!this.data.selectedDate) return
    this.setData({
      loading: !manual,
      refreshing: manual,
      loadError: ''
    })
    try {
      const res = await apiClient.call('admin.settlement.list', {
        date: this.data.selectedDate
      })
      this.setData({
        loading: false,
        refreshing: false,
        records: (res.data && res.data.records || []).map(normalizeRecord),
        isTruncated: !!(res.data && res.data.isTruncated),
        loadError: ''
      })
    } catch (err) {
      console.error('load settlement records failed', err)
      this.setData({
        loading: false,
        refreshing: false,
        records: [],
        selectedRecordId: '',
        detail: null,
        loadError: err.message || UI.loadFailed
      })
      wx.showToast({ title: UI.loadFailed, icon: 'none' })
    }
  },

  async selectRecord(event) {
    const recordId = String(event.currentTarget.dataset.id || '')
    if (!recordId || this.data.detailLoading) return
    if (recordId === this.data.selectedRecordId && this.data.detail) return

    this.setData({
      selectedRecordId: recordId,
      detailLoading: true,
      detail: null,
      showPaymentPicker: false,
      showAmountModal: false,
      showMixedPaymentDialog: false
    })
    try {
      const res = await apiClient.call('admin.settlement.detail', {
        date: this.data.selectedDate,
        recordId
      })
      this.setData({
        detailLoading: false,
        detail: normalizeDetail(res.data || {})
      })
    } catch (err) {
      console.error('load settlement detail failed', err)
      this.setData({
        detailLoading: false,
        selectedRecordId: '',
        detail: null
      })
      wx.showToast({ title: UI.detailFailed, icon: 'none' })
    }
  },

  toggleAddDish(event) {
    const orderId = String(event.currentTarget.dataset.id || '')
    this.setData({
      addingToOrderId: this.data.addingToOrderId === orderId ? '' : orderId,
      addDishForm: { dishId: '', keyword: '', count: '1', selectedDish: null },
      addDishResults: [],
      addDishSearching: false
    })
  },

  onAddDishInput(event) {
    const key = String(event.currentTarget.dataset.key || '')
    if (key === 'count') {
      this.setData({ 'addDishForm.count': event.detail.value })
      return
    }
    if (key !== 'keyword') return
    const keyword = String(event.detail.value || '').trim()
    this.setData({
      'addDishForm.keyword': event.detail.value,
      'addDishForm.dishId': '',
      'addDishForm.selectedDish': null,
      addDishResults: [],
      addDishSearching: !!keyword
    })
    if (!keyword) return
    const requestId = (this._settlementDishSearchRequestId || 0) + 1
    this._settlementDishSearchRequestId = requestId
    clearTimeout(this._settlementDishSearchTimer)
    this._settlementDishSearchTimer = setTimeout(async () => {
      try {
        const res = await apiClient.call('admin.dish.list', {
          menuType: this.data.detail && this.data.detail.scene === 'camping' ? 'camping' : 'dineIn',
          keyword,
          limit: 50
        })
        if (requestId !== this._settlementDishSearchRequestId) return
        this.setData({ addDishResults: (res.data || []).filter(dish => dish && dish.status !== 0), addDishSearching: false })
      } catch (err) {
        if (requestId !== this._settlementDishSearchRequestId) return
        console.error('search settlement menu dishes failed', err)
        this.setData({ addDishResults: [], addDishSearching: false })
        wx.showToast({ title: err.message || '\u83dc\u5355\u641c\u7d22\u5931\u8d25', icon: 'none' })
      }
    }, 250)
  },

  selectSettlementDish(event) {
    const dishId = String(event.currentTarget.dataset.id || '')
    const dish = (this.data.addDishResults || []).find(item => String(item._id || '') === dishId)
    if (!dish) return
    this._settlementDishSearchRequestId = (this._settlementDishSearchRequestId || 0) + 1
    clearTimeout(this._settlementDishSearchTimer)
    this.setData({
      addDishForm: { ...this.data.addDishForm, dishId, selectedDish: dish, keyword: dish.name || '' },
      addDishResults: [],
      addDishSearching: false
    })
  },

  async submitSettlementEdit(operation, extra = {}) {
    const detail = this.data.detail
    if (!detail || !this.data.selectedRecordId) return
    try {
      wx.showLoading({ title: '正在保存' })
      await apiClient.call('admin.settlement.edit', {
        date: this.data.selectedDate,
        recordId: this.data.selectedRecordId,
        operation,
        ...extra
      })
      wx.hideLoading()
      this.setData({
        addingToOrderId: '',
        showPaymentPicker: false,
        showAmountModal: false,
        showMixedPaymentDialog: false
      })
      await this.loadRecords(true)
      const nextRecord = this.data.records.find(item => item.id === this.data.selectedRecordId)
      if (nextRecord) {
        this.setData({ detailLoading: true })
        const result = await apiClient.call('admin.settlement.detail', { date: this.data.selectedDate, recordId: this.data.selectedRecordId })
        this.setData({ detail: normalizeDetail(result.data || {}), detailLoading: false })
      } else {
        this.setData({ selectedRecordId: '', detail: null })
      }
      wx.showToast({ title: '已更新结算记录', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '修改失败', icon: 'none' })
    }
  },

  addSettlementDish(event) {
    const orderId = String(event.currentTarget.dataset.id || '')
    const form = this.data.addDishForm || {}
    const dishId = String(form.dishId || '').trim()
    const count = Number(form.count)
    if (!dishId || !Number.isInteger(count) || count < 1 || count > 99) {
      wx.showToast({ title: '\u8bf7\u9009\u62e9\u83dc\u5355\u83dc\u54c1\u5e76\u586b\u5199\u6709\u6548\u6570\u91cf', icon: 'none' })
      return
    }
    this.submitSettlementEdit('addDish', { orderId, dishId, count })
  },

  deleteSettlementDish(event) {
    const { orderId, goodsIndex } = event.currentTarget.dataset
    wx.showModal({
      title: '删除菜品',
      content: '删除后会直接改写该结算记录和营业统计，且无法恢复。',
      success: result => { if (result.confirm) this.submitSettlementEdit('deleteDish', { orderId, goodsIndex: Number(goodsIndex) }) }
    })
  },

  deleteSettlementOrder(event) {
    const orderId = String(event.currentTarget.dataset.id || '')
    wx.showModal({
      title: '删除订单',
      content: '将永久删除这笔已结账订单，并重算同一结账记录金额；此操作无法恢复。',
      success: result => { if (result.confirm) this.submitSettlementEdit('deleteOrder', { orderId }) }
    })
  },

  deleteSettlementRecord() {
    if (!this.data.detail) return
    wx.showModal({
      title: '删除整笔结算',
      content: '将永久删除该结算记录关联的全部订单，并从营业统计中移除；此操作无法恢复。',
      success: result => { if (result.confirm) this.submitSettlementEdit('deleteRecord') }
    })
  },

  togglePaymentPicker() {
    if (!this.data.detail) return
    this.setData({ showPaymentPicker: !this.data.showPaymentPicker })
  },

  stopSettlementPickerTap() {},

  selectSettlementPayment(event) {
    const paymentMethod = String(event.currentTarget.dataset.value || '')
    if (!paymentMethod) return
    if (paymentMethod === this.data.detail.paymentMethod) {
      this.setData({ showPaymentPicker: false })
      return
    }
    if (paymentMethod === 'mixed') {
      this.setData({
        showPaymentPicker: false,
        mixedPaymentEditingChannel: 'cash',
        mixedPaymentInput: '0',
        showMixedPaymentDialog: true
      })
      return
    }
    this.setData({ showPaymentPicker: false, showMixedPaymentDialog: false })
    this.submitSettlementEdit('updatePaymentMethod', { paymentMethod })
  },

  openSettlementMixedPaymentDialog(event) {
    const detail = this.data.detail
    if (!detail || detail.paymentMethod !== 'mixed') return
    const channel = event.currentTarget.dataset.channel === 'online' ? 'online' : 'cash'
    this.setData({
      showPaymentPicker: false,
      mixedPaymentEditingChannel: channel,
      mixedPaymentInput: channel === 'online' ? detail.onlineReceivedText : detail.cashReceivedText,
      showMixedPaymentDialog: true
    })
  },

  closeSettlementMixedPaymentDialog() {
    this.setData({
      showMixedPaymentDialog: false,
      mixedPaymentEditingChannel: '',
      mixedPaymentInput: ''
    })
  },

  stopSettlementMixedPaymentDialogTap() {},

  onSettlementMixedPaymentInput(event) {
    this.setData({ mixedPaymentInput: event.detail.value })
  },

  saveSettlementMixedPayment() {
    const detail = this.data.detail
    const amount = Number(this.data.mixedPaymentInput)
    const receivable = Number(detail && detail.receivable)
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(receivable) || amount > receivable) {
      wx.showToast({ title: UI.mixedInvalid, icon: 'none' })
      return
    }
    const channel = this.data.mixedPaymentEditingChannel === 'online' ? 'online' : 'cash'
    this.submitSettlementEdit('updatePaymentMethod', {
      paymentMethod: 'mixed',
      mixedPaymentChannel: channel,
      mixedPaymentAmount: Math.round(amount * 100) / 100
    })
  },

  openSettlementAmountModal() {
    const detail = this.data.detail
    if (!detail) return
    this.setData({
      showPaymentPicker: false,
      showAmountModal: true,
      amountInput: formatMoney(detail.receivable)
    })
  },

  closeSettlementAmountModal() {
    this.setData({ showAmountModal: false })
  },

  stopSettlementAmountModalTap() {},

  onSettlementAmountInput(event) {
    this.setData({ amountInput: event.detail.value })
  },

  saveSettlementAmount() {
    const receivedAmount = Number(this.data.amountInput)
    if (!Number.isFinite(receivedAmount) || receivedAmount < 0 || receivedAmount > 1000000) {
      wx.showToast({ title: '\u8bf7\u8f93\u5165 0-1000000 \u4e4b\u95f4\u7684\u91d1\u989d', icon: 'none' })
      return
    }
    this.submitSettlementEdit('updateReceivable', { receivedAmount })
  }
})
