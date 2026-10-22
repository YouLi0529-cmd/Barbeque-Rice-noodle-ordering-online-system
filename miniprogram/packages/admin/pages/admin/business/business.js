const apiClient = require('../../../../../utils/apiClient')
const adminSound = require('../../../utils/adminSound')
const salesQuery = require('../../../../../utils/salesQuery')

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
    isTruncated: false,
    salesView: '',
    salesSelection: '',
    salesCalendarMonth: '',
    salesCalendarDays: [],
    salesWeekdays: ['日', '一', '二', '三', '四', '五', '六'],
    salesStartDate: '',
    salesEndDate: '',
    salesTodayDate: salesQuery.todayBeijing(),
    salesCategories: [],
    salesCategoryKey: '',
    salesCategoryLabel: '',
    salesCategoryIndex: -1,
    salesOptionsLoading: false,
    salesOptionsScanned: 0,
    salesOptionsError: '',
    salesQuerying: false,
    salesProgress: '',
    salesError: '',
    salesRows: [],
    salesTotalQuantity: 0,
    salesTotalAmount: '0.00',
    salesIsGroupBuy: false,
    salesResultCategory: '',
    salesResultDates: ''
  },

  onLoad() {
    this.loadStats()
  },

  onShow() {
    if (!this.data.loading && !this.data.refreshing) this.loadStats(true)
  },

  onUnload() {
    this.salesRequestToken = null
    this.salesOptionsToken = null
  },

  async openSalesQuery() {
    this.salesRequestToken = null
    const token = {}
    this.salesOptionsToken = token
    let categories = salesQuery.mergeCategories([], [])
    this.setData({ salesView: 'filter', salesSelection: '', salesCategories: categories, salesOptionsLoading: true,
      salesOptionsError: '', salesOptionsScanned: 0, salesError: '', salesQuerying: false, salesProgress: '', salesCategoryIndex: -1, salesTodayDate: salesQuery.todayBeijing() })
    try {
      let cursor = ''
      do {
        const res = await apiClient.call('admin.business.salesOptions', { cursor })
        if (this.salesOptionsToken !== token) return
        const data = res.data || {}
        categories = salesQuery.mergeCategories(categories, data.categories || [])
        const selectedIndex = categories.findIndex(item => item.key === this.data.salesCategoryKey)
        this.setData({ salesCategories: categories, salesCategoryIndex: selectedIndex,
          salesCategoryLabel: selectedIndex >= 0 ? categories[selectedIndex].label : '',
          salesOptionsScanned: Number(data.scannedOrders || 0) })
        if (data.done === true) break
        if (!data.cursor || data.cursor === cursor) throw new Error('分类查询未完成，请重新打开查询')
        cursor = data.cursor
      } while (true)
      const index = categories.findIndex(item => item.key === this.data.salesCategoryKey)
      this.setData({ salesCategoryKey: index >= 0 ? categories[index].key : '',
        salesCategoryLabel: index >= 0 ? categories[index].label : '', salesCategoryIndex: index })
    } catch (err) {
      if (this.salesOptionsToken !== token) return
      this.setData({ salesOptionsError: err.message || '品类加载失败，请重新打开查询' })
    } finally {
      if (this.salesOptionsToken === token) this.setData({ salesOptionsLoading: false })
    }
  },

  cancelSalesQuery() {
    this.salesOptionsToken = null
    this.salesRequestToken = null
    this.setData({ salesView: '', salesQuerying: false, salesOptionsLoading: false, salesRows: [], salesError: '' })
  },

  onSalesStartDate(e) { this.setData({ salesStartDate: e.detail.value, salesError: '' }) },
  onSalesEndDate(e) { this.setData({ salesEndDate: e.detail.value, salesError: '' }) },
  openSalesDate(e) {
    if (this.data.salesQuerying) return
    const field = e.currentTarget.dataset.field
    if (field !== 'start' && field !== 'end') return
    if (this.data.salesSelection === field) { this.setData({ salesSelection: '' }); return }
    const value = field === 'start' ? this.data.salesStartDate : this.data.salesEndDate
    this.setData({ salesSelection: field })
    this.renderSalesCalendar((value || this.data.salesTodayDate).slice(0, 7))
  },
  renderSalesCalendar(month) {
    const [year, number] = month.split('-').map(Number)
    const first = new Date(Date.UTC(year, number - 1, 1)).getUTCDay()
    const count = new Date(Date.UTC(year, number, 0)).getUTCDate()
    const days = Array.from({ length: first }, (_, index) => ({ key: `blank-${index}`, date: '', label: '' }))
    for (let day = 1; day <= count; day++) {
      const date = `${month}-${String(day).padStart(2, '0')}`
      days.push({ key: date, date, label: day, disabled: date > this.data.salesTodayDate })
    }
    this.setData({ salesCalendarMonth: month, salesCalendarDays: days })
  },
  changeSalesMonth(e) {
    const step = Number(e.currentTarget.dataset.step)
    if (step !== -1 && step !== 1) return
    const [year, month] = this.data.salesCalendarMonth.split('-').map(Number)
    const next = new Date(Date.UTC(year, month - 1 + step, 1)).toISOString().slice(0, 7)
    if (next < '1900-01' || next > this.data.salesTodayDate.slice(0, 7)) return
    this.renderSalesCalendar(next)
  },
  selectSalesDate(e) {
    if (this.data.salesQuerying) return
    const date = e.currentTarget.dataset.date
    if (!date || date > this.data.salesTodayDate) return
    const field = this.data.salesSelection === 'start' ? 'salesStartDate' : this.data.salesSelection === 'end' ? 'salesEndDate' : ''
    if (field) this.setData({ [field]: date, salesSelection: '', salesError: '' })
  },
  toggleSalesCategories() {
    if (this.data.salesQuerying || this.data.salesOptionsError) return
    this.setData({ salesSelection: this.data.salesSelection === 'category' ? '' : 'category' })
  },
  selectSalesCategory(e) {
    if (this.data.salesQuerying) return
    const index = this.data.salesCategories.findIndex(item => item.key === e.currentTarget.dataset.key)
    if (index < 0) return
    this.onSalesCategory({ detail: { value: index } })
    this.setData({ salesSelection: '' })
  },
  onSalesCategory(e) {
    const index = Number(e.detail.value)
    const category = this.data.salesCategories[index]
    if (!category) return
    this.setData({ salesCategoryKey: category.key, salesCategoryLabel: category.label, salesCategoryIndex: index, salesError: '' })
  },

  async submitSalesQuery() {
    if (this.data.salesQuerying) return
    const message = salesQuery.validateSalesFilters(this.data.salesStartDate, this.data.salesEndDate, this.data.salesCategoryKey)
    if (message) { wx.showToast({ title: message, icon: 'none' }); return }
    if (this.data.salesOptionsLoading || this.data.salesOptionsError) return
    const token = {}
    this.salesRequestToken = token
    const filters = { startDate: this.data.salesStartDate, endDate: this.data.salesEndDate, categoryKey: this.data.salesCategoryKey }
    const label = this.data.salesCategoryLabel
    const rows = new Map()
    this.setData({ salesQuerying: true, salesError: '', salesRows: [], salesProgress: '正在查询，请稍候…' })
    try {
      let cursor = ''
      do {
        const res = await apiClient.call('admin.business.salesQuery', { ...filters, cursor })
        if (this.salesRequestToken !== token) return
        const data = res.data || {}
        salesQuery.mergeSalesRows(rows, data.rows || [])
        this.setData({ salesProgress: data.phase === 'verify'
          ? '正在核对结算记录，请稍候…' : `正在查询，已检查 ${Number(data.scannedOrders || 0)} 条订单…` })
        if (data.done === true) break
        if (!data.cursor || data.cursor === cursor) throw new Error('查询尚未完成，请重新查询')
        cursor = data.cursor
      } while (true)
      const result = salesQuery.buildSalesResult(rows)
      this.setData({ salesView: 'result', salesRows: result.rows, salesTotalQuantity: result.quantity,
        salesTotalAmount: result.amountText, salesIsGroupBuy: filters.categoryKey === salesQuery.GROUP_BUY_KEY,
        salesResultCategory: label, salesResultDates: `${filters.startDate} 至 ${filters.endDate}` })
    } catch (err) {
      if (this.salesRequestToken !== token) return
      this.setData({ salesError: err.message || '销量查询失败，请重试', salesRows: [] })
    } finally {
      if (this.salesRequestToken === token) this.setData({ salesQuerying: false, salesProgress: '' })
    }
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
