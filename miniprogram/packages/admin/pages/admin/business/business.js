const apiClient = require('../../../../../utils/apiClient')

const UI = {
  title: '\u8425\u4e1a\u7edf\u8ba1',
  currency: '\u00a5',
  refresh: '\u5237\u65b0',
  revenue: '\u8425\u4e1a\u989d',
  settledTables: '\u5df2\u7ed3\u7b97\u684c\u6570',
  dishSales: '\u83dc\u54c1\u552e\u51fa\u6570\u91cf',
  dish: '\u83dc\u54c1',
  category: '\u5206\u7c7b',
  soldQuantity: '\u552e\u51fa',
  salesAmount: '\u9500\u552e\u989d',
  empty: '\u8be5\u65f6\u95f4\u6bb5\u6682\u65e0\u5df2\u7ed3\u7b97\u8bb0\u5f55',
  loadFailed: '\u8425\u4e1a\u7edf\u8ba1\u52a0\u8f7d\u5931\u8d25',
  truncated: '\u5f53\u524d\u7edf\u8ba1\u4ec5\u5c55\u793a\u6700\u8fd1 1000 \u6761\u5df2\u7ed3\u7b97\u8ba2\u5355'
}

const RANGE_OPTIONS = [
  { key: 'today', label: '\u5f53\u65e5' },
  { key: '7d', label: '7\u5929\u5185' },
  { key: '14d', label: '14\u5929\u5185' },
  { key: '1m', label: '1\u4e2a\u6708' },
  { key: '3m', label: '3\u4e2a\u6708' }
]

function formatMoney(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return '0'
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
}

function normalizeDishes(dishes = []) {
  return (Array.isArray(dishes) ? dishes : []).map((item, index) => ({
    ...item,
    rank: index + 1,
    quantityText: `${Number(item.quantity || 0)}`,
    salesAmountText: formatMoney(item.salesAmount),
    categoryText: item.categoryName || '\u672a\u5206\u7c7b'
  }))
}

Page({
  data: {
    ui: UI,
    rangeOptions: RANGE_OPTIONS,
    revenueRange: 'today',
    dishRange: 'today',
    loading: true,
    refreshing: false,
    loadError: '',
    revenueText: '0',
    settledTableCount: 0,
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
        dishRange: this.data.dishRange
      })
      const data = res.data || {}
      const revenue = data.revenue || {}
      const dishes = data.dishes || {}
      this.setData({
        loading: false,
        refreshing: false,
        loadError: '',
        revenueText: formatMoney(revenue.revenue),
        settledTableCount: Number(revenue.settledTableCount || 0),
        dishList: normalizeDishes(dishes.dishes),
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
