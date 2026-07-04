const apiClient = require('../../../../../utils/apiClient')

const UI = {
  title: '\u684c\u53f0\u7ba1\u7406',
  moneySymbol: '\uffe5',
  tableUnit: '\u53f7\u684c',
  emptyTime: '\u672a\u5f00\u53f0',
  loadFailed: '\u684c\u53f0\u8ba2\u5355\u52a0\u8f7d\u5931\u8d25'
}

const TABLE_DETAIL_PAGE = '/packages/admin/pages/admin/tableDetail/tableDetail'

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

function getBaseTableSections() {
  return [
    {
      areaKey: 'normal',
      areaName: '\u666e\u901a',
      maxPeople: 4,
      count: 15
    },
    {
      areaKey: 'vip',
      areaName: 'VIP',
      maxPeople: 8,
      count: 5
    },
    {
      areaKey: 'sky',
      areaName: '\u5929\u697c',
      maxPeople: 4,
      count: 13
    }
  ].map(createTableSection)
}

function createTableSection(section) {
  const tables = Array.from({ length: section.count }, (_, index) => {
    const tableNumber = String(index + 1).padStart(2, '0')
    return {
      tableKey: `${section.areaKey}-${tableNumber}`,
      areaKey: section.areaKey,
      areaName: section.areaName,
      tableNumber,
      status: 'empty',
      totalPrice: 0,
      peopleCount: 0,
      maxPeople: section.maxPeople,
      scannedAt: 0
    }
  })
  return {
    areaKey: section.areaKey,
    areaName: section.areaName,
    tables
  }
}

function getDiningTime(scannedAt) {
  if (!scannedAt) return UI.emptyTime
  const minutes = Math.max(0, Math.floor((Date.now() - scannedAt) / 60000))
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  if (hours <= 0) return `${restMinutes}\u5206\u949f`
  if (restMinutes <= 0) return `${hours}\u5c0f\u65f6`
  return `${hours}\u5c0f\u65f6${restMinutes}\u5206`
}

function formatPrice(price) {
  const value = Number(price || 0)
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1)
}

function formatTable(item) {
  const status = STATUS[item.status] || STATUS.empty
  return {
    ...item,
    statusText: status.text,
    statusClass: status.className,
    priceText: formatPrice(item.totalPrice),
    peopleText: `${Number(item.peopleCount || 0)}/${Number(item.maxPeople || 0)}`,
    diningTimeText: getDiningTime(item.scannedAt)
  }
}

Page({
  data: {
    ui: UI,
    loading: false,
    legends: Object.keys(STATUS).map(key => ({
      key,
      text: STATUS[key].text,
      className: STATUS[key].className
    })),
    tableSections: []
  },

  onLoad() {
    this.rawTables = getBaseTableSections()
    this.refreshTables()
    this.loadTables()
    this.timer = setInterval(() => {
      this.loadTables(true)
    }, 15000)
    this.clockTimer = setInterval(() => {
      this.refreshTables()
    }, 60000)
  },

  onShow() {
    this.loadTables(true)
  },

  onUnload() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.clockTimer) {
      clearInterval(this.clockTimer)
      this.clockTimer = null
    }
  },

  async loadTables(silent = false) {
    try {
      if (!silent) {
        this.setData({ loading: true })
      }

      const res = await apiClient.call('admin.table.list')
      const sections = res && res.data && Array.isArray(res.data.sections)
        ? res.data.sections
        : []

      if (sections.length > 0) {
        this.rawTables = sections
        this.refreshTables()
      }
    } catch (err) {
      console.error('load admin table orders failed', err)
      this.refreshTables()
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

  refreshTables() {
    this.setData({
      tableSections: (this.rawTables || []).map(section => ({
        ...section,
        tables: (section.tables || []).map(formatTable)
      }))
    })
  },

  openTable(e) {
    const data = e.currentTarget.dataset || {}
    const query = [
      ['areaKey', data.areaKey],
      ['areaName', data.area],
      ['tableNumber', data.table],
      ['tableKey', data.tableKey],
      ['status', data.status],
      ['totalPrice', data.price],
      ['peopleCount', data.people],
      ['maxPeople', data.max],
      ['scannedAt', data.scanned]
    ].map(([key, value]) => `${key}=${encodeURIComponent(value == null ? '' : value)}`).join('&')

    wx.navigateTo({
      url: `${TABLE_DETAIL_PAGE}?${query}`
    })
  }
})
