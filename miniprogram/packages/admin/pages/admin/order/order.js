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
  return {
    ...item,
    paidTimeText: formatDetailDateTime(item.paidAt),
    totalText: formatMoney(item.totalPrice),
    receivableText: formatMoney(item.receivable),
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
    addDishForm: { dishName: '', unitPrice: '', count: '1' }
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
      detail: null
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
      addDishForm: { dishName: '', unitPrice: '', count: '1' }
    })
  },

  onAddDishInput(event) {
    const key = String(event.currentTarget.dataset.key || '')
    if (!['dishName', 'unitPrice', 'count'].includes(key)) return
    this.setData({ [`addDishForm.${key}`]: event.detail.value })
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
      this.setData({ addingToOrderId: '' })
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
    const dishName = String(form.dishName || '').trim()
    const unitPrice = Number(form.unitPrice)
    const count = Number(form.count)
    if (!dishName || !Number.isFinite(unitPrice) || !Number.isInteger(count) || count < 1) {
      wx.showToast({ title: '请填写菜名、单价和数量', icon: 'none' })
      return
    }
    this.submitSettlementEdit('addDish', { orderId, dishName, unitPrice, count })
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
  }
})
