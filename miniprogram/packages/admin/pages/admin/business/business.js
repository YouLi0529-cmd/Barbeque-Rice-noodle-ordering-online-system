const apiClient = require('../../../../../utils/apiClient')
const adminSound = require('../../../utils/adminSound')

const UI = {
  title: '\u8425\u4e1a\u7edf\u8ba1',
  currency: '\u00a5',
  refresh: '\u5237\u65b0',
  revenue: '\u8425\u4e1a\u989d',
  cashRevenue: '\u73b0\u91d1\u6536\u6b3e',
  onlineRevenue: '\u7f51\u94f6\u6536\u6b3e',
  otherRevenue: '\u5176\u4ed6\u6536\u6b3e',
  settledTables: '\u5df2\u7ed3\u7b97\u684c\u6570',
  arrivalPeople: '\u5230\u5e97\u4eba\u6570',
  peopleUnit: '\u4eba',
  dishSales: '\u83dc\u54c1\u552e\u51fa\u6570\u91cf',
  dish: '\u83dc\u54c1',
  category: '\u5206\u7c7b',
  soldQuantity: '\u552e\u51fa',
  salesAmount: '\u9500\u552e\u989d',
  searchDish: '\u641c\u7d22\u83dc\u54c1\u540d\u79f0',
  searchEmpty: '\u672a\u627e\u5230\u5339\u914d\u7684\u83dc\u54c1',
  empty: '\u8be5\u65f6\u95f4\u6bb5\u6682\u65e0\u5df2\u7ed3\u7b97\u8bb0\u5f55',
  loadFailed: '\u8425\u4e1a\u7edf\u8ba1\u52a0\u8f7d\u5931\u8d25',
  truncated: '\u5f53\u524d\u7edf\u8ba1\u4ec5\u5c55\u793a\u6700\u8fd1 1000 \u6761\u5df2\u7ed3\u7b97\u8ba2\u5355'
}

const RANGE_OPTIONS = [
  { key: 'today', label: '\u5f53\u65e5' },
  { key: 'yesterday', label: '\u6628\u65e5' },
  { key: '7d', label: '7\u5929' },
  { key: '1m', label: '1\u4e2a\u6708' },
  { key: '3m', label: '3\u4e2a\u6708' },
  { key: 'custom', label: '\u9009\u65e5\u671f' }
]

const DISH_SORT_OPTIONS = [
  { key: 'quantity', label: '\u6309\u9500\u91cf' },
  { key: 'amount', label: '\u6309\u9500\u552e\u989d' },
  { key: 'category', label: '\u6309\u5206\u7c7b' }
]

function formatMoney(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return '0'
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
}

function formatDateValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateLabel(value) {
  const match = String(value || '').match(/^\d{4}-(\d{2})-(\d{2})$/)
  if (!match) return '\u9009\u65e5\u671f'
  return `${Number(match[1])}/${Number(match[2])}`
}

function compareText(left, right) {
  return String(left || '').localeCompare(String(right || ''), 'zh-CN')
}

function normalizeDishes(dishes = [], sortBy = 'quantity', keyword = '') {
  const query = String(keyword || '').trim().toLowerCase()
  const normalized = (Array.isArray(dishes) ? dishes : []).map(item => ({
    ...item,
    name: String(item && item.name || '\u672a\u547d\u540d\u83dc\u54c1'),
    quantity: Number(item && item.quantity || 0),
    salesAmount: Number(item && item.salesAmount || 0),
    categoryText: String(item && item.categoryName || '\u672a\u5206\u7c7b')
  })).filter(item => {
    if (!query) return true
    return item.name.toLowerCase().includes(query) || item.categoryText.toLowerCase().includes(query)
  })

  normalized.sort((left, right) => {
    if (sortBy === 'amount') {
      if (right.salesAmount !== left.salesAmount) return right.salesAmount - left.salesAmount
      if (right.quantity !== left.quantity) return right.quantity - left.quantity
    } else if (sortBy === 'category') {
      const categoryOrder = compareText(left.categoryText, right.categoryText)
      if (categoryOrder !== 0) return categoryOrder
      if (right.quantity !== left.quantity) return right.quantity - left.quantity
      if (right.salesAmount !== left.salesAmount) return right.salesAmount - left.salesAmount
    } else {
      if (right.quantity !== left.quantity) return right.quantity - left.quantity
      if (right.salesAmount !== left.salesAmount) return right.salesAmount - left.salesAmount
    }
    return compareText(left.name, right.name)
  })

  return normalized.map((item, index) => ({
    ...item,
    rank: index + 1,
    quantityText: `${item.quantity}`,
    salesAmountText: formatMoney(item.salesAmount)
  }))
}

Page({
  onAdminTap(event) {
    adminSound.playClick(event)
  },

  data: {
    ui: UI,
    rangeOptions: RANGE_OPTIONS,
    dishSortOptions: DISH_SORT_OPTIONS,
    todayDate: formatDateValue(),
    revenueRange: 'today',
    dishRange: 'today',
    revenueDate: formatDateValue(),
    dishDate: formatDateValue(),
    revenueDateLabel: formatDateLabel(formatDateValue()),
    dishDateLabel: formatDateLabel(formatDateValue()),
    dishSort: 'quantity',
    dishSearch: '',
    loading: true,
    refreshing: false,
    loadError: '',
    revenueText: '0',
    cashRevenueText: '0',
    onlineRevenueText: '0',
    otherRevenueText: '0',
    hasOtherRevenue: false,
    settledTableCount: 0,
    arrivalPeopleCount: 0,
    allDishes: [],
    dishList: [],
    isTruncated: false
  },

  onLoad() {
    this.loadStats()
  },

  onShow() {
    if (!this.data.loading && !this.data.refreshing) this.loadStats(true)
  },

  selectRevenueRange(e) {
    const value = e.currentTarget.dataset.value
    if (!value || value === this.data.revenueRange) return
    this.setData({ revenueRange: value }, () => this.loadStats())
  },

  selectDishRange(e) {
    const value = e.currentTarget.dataset.value
    if (!value || value === this.data.dishRange) return
    this.setData({ dishRange: value }, () => this.loadStats())
  },

  onRevenueDateChange(e) {
    const value = e.detail && e.detail.value
    if (!value) return
    this.setData({
      revenueRange: 'custom',
      revenueDate: value,
      revenueDateLabel: formatDateLabel(value)
    }, () => this.loadStats())
  },

  onDishDateChange(e) {
    const value = e.detail && e.detail.value
    if (!value) return
    this.setData({
      dishRange: 'custom',
      dishDate: value,
      dishDateLabel: formatDateLabel(value)
    }, () => this.loadStats())
  },

  selectDishSort(e) {
    const value = e.currentTarget.dataset.value
    if (!value || value === this.data.dishSort) return
    this.setData({ dishSort: value }, () => this.applyDishFilters())
  },

  onDishSearchInput(e) {
    const value = e.detail && e.detail.value || ''
    this.setData({ dishSearch: value }, () => this.applyDishFilters())
  },

  applyDishFilters() {
    this.setData({
      dishList: normalizeDishes(this.data.allDishes, this.data.dishSort, this.data.dishSearch)
    })
  },

  refreshStats() {
    if (this.data.loading || this.data.refreshing) return
    this.loadStats(false, true)
  },

  async loadStats(silent = false, manual = false) {
    if (this.data.loading && silent) return
    if (manual) this.setData({ refreshing: true })
    if (!silent && !manual) this.setData({ loading: true, loadError: '' })

    try {
      const res = await apiClient.call('admin.business.stats', {
        revenueRange: this.data.revenueRange,
        revenueDate: this.data.revenueDate,
        dishRange: this.data.dishRange,
        dishDate: this.data.dishDate
      })
      const data = res.data || {}
      const revenue = data.revenue || {}
      const dishes = data.dishes || {}
      const arrival = data.arrival || {}
      this.setData({
        loading: false,
        refreshing: false,
        loadError: '',
        revenueText: formatMoney(revenue.revenue),
        cashRevenueText: formatMoney(revenue.cashRevenue),
        onlineRevenueText: formatMoney(revenue.onlineRevenue),
        otherRevenueText: formatMoney(revenue.otherRevenue),
        hasOtherRevenue: Number(revenue.otherRevenue || 0) !== 0,
        settledTableCount: Number(revenue.settledTableCount || 0),
        arrivalPeopleCount: Math.max(0, Math.floor(Number(arrival.peopleCount || 0))),
        allDishes: Array.isArray(dishes.dishes) ? dishes.dishes : [],
        dishList: normalizeDishes(dishes.dishes, this.data.dishSort, this.data.dishSearch),
        isTruncated: data.isTruncated === true
      })
    } catch (err) {
      console.error('load business stats failed', err)
      this.setData({
        loading: false,
        refreshing: false,
        loadError: err.message || UI.loadFailed
      })
      if (!silent) wx.showToast({ title: UI.loadFailed, icon: 'none' })
    }
  }
})
