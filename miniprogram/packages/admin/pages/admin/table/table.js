const apiClient = require('../../../../../utils/apiClient')

const UI = {
  title: '\u684c\u53f0\u7ba1\u7406',
  moneySymbol: '\uffe5',
  tableUnit: '\u53f7\u684c',
  emptyTime: '\u672a\u5f00\u53f0',
  loadFailed: '\u684c\u53f0\u8ba2\u5355\u52a0\u8f7d\u5931\u8d25',
  transferTitle: '\u8f6c\u53f0\u4e2d',
  transferTip: '\u8bf7\u70b9\u51fb\u987e\u5ba2\u8981\u6362\u5230\u7684\u7a7a\u684c',
  cancelTransfer: '\u53d6\u6d88\u8f6c\u53f0',
  transferSameTable: '\u76ee\u6807\u684c\u4e0d\u80fd\u662f\u539f\u684c',
  transferTargetOccupied: '\u76ee\u6807\u684c\u4e0d\u662f\u7a7a\u53f0\uff0c\u8bf7\u4f7f\u7528\u62fc\u684c',
  transferConfirmTitle: '\u786e\u8ba4\u8f6c\u53f0',
  transferConfirmPrefix: '\u786e\u5b9a\u5c06',
  transferConfirmMiddle: '\u8f6c\u5230',
  transferConfirmSuffix: '\u5417',
  transferSuccess: '\u5df2\u8f6c\u53f0',
  transferFailed: '\u8f6c\u53f0\u5931\u8d25',
  mergeTitle: '\u62fc\u684c\u4e2d',
  mergeTip: '\u8bf7\u70b9\u51fb\u8981\u5408\u5e76\u7684\u684c\u53f0\uff0c\u53ef\u591a\u9009\u7a7a\u684c',
  cancelMerge: '\u53d6\u6d88\u62fc\u684c',
  confirmMerge: '\u786e\u8ba4\u62fc\u684c',
  mergeSelected: '\u5df2\u9009',
  mergeUnit: '\u684c',
  mergeSameTable: '\u539f\u684c\u5df2\u81ea\u52a8\u5305\u542b',
  mergeSelectFirst: '\u8bf7\u5148\u9009\u62e9\u8981\u62fc\u7684\u684c\u53f0',
  mergeConfirmTitle: '\u786e\u8ba4\u62fc\u684c',
  mergeConfirmPrefix: '\u786e\u5b9a\u5c06',
  mergeConfirmMiddle: '\u4e0e\u9009\u4e2d\u7684',
  mergeConfirmSuffix: '\u5f20\u684c\u5408\u5e76\u5417',
  mergeSuccess: '\u5df2\u62fc\u684c',
  mergeFailed: '\u62fc\u684c\u5931\u8d25',
  reservationReminderTitle: '\u9884\u7ea6\u63d0\u9192',
  reservationLoadFailed: '\u9884\u7ea6\u63d0\u9192\u52a0\u8f7d\u5931\u8d25',
  reservationArrived: '\u5df2\u5230\u5e97',
  reservationCancel: '\u53d6\u6d88',
  reservationArrivedSuccess: '\u5df2\u6807\u8bb0\u5230\u5e97',
  reservationCancelSuccess: '\u5df2\u53d6\u6d88\u9884\u7ea6',
  reservationUpdateFailed: '\u9884\u7ea6\u5904\u7406\u5931\u8d25',
  reservationSelectFirst: '\u8bf7\u5148\u9009\u62e9\u9884\u7ea6'
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
      scannedAt: 0,
      finishedAt: 0
    }
  })
  return {
    areaKey: section.areaKey,
    areaName: section.areaName,
    tables
  }
}

function getDiningTime(scannedAt, finishedAt = 0) {
  if (!scannedAt) return UI.emptyTime
  const endTime = finishedAt && finishedAt > scannedAt ? finishedAt : Date.now()
  const minutes = Math.max(0, Math.floor((endTime - scannedAt) / 60000))
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

function isSameTable(left, right) {
  return left && right &&
    left.areaKey === right.areaKey &&
    left.tableNumber === right.tableNumber
}

function formatTable(item, selectedMap = {}, mergeSource = null) {
  const status = STATUS[item.status] || STATUS.empty
  const tableKey = item.tableKey || `${item.areaKey}-${item.tableNumber}`
  return {
    ...item,
    tableKey,
    statusText: status.text,
    statusClass: status.className,
    priceText: formatPrice(item.totalPrice),
    peopleText: `${Number(item.peopleCount || 0)}/${Number(item.maxPeople || 0)}`,
    diningTimeText: getDiningTime(item.scannedAt, item.finishedAt),
    mergeSelected: !!selectedMap[tableKey],
    mergeSource: isSameTable(item, mergeSource)
  }
}

function padDatePart(value) {
  return String(value).padStart(2, '0')
}

function getTodayValue() {
  const now = new Date()
  return `${now.getFullYear()}${padDatePart(now.getMonth() + 1)}${padDatePart(now.getDate())}`
}

function getReservationDateValue(item = {}) {
  const value = String(item.reservationDate || '').replace(/\D/g, '')
  if (value.length >= 8) return value.slice(0, 8)
  return ''
}

function isUpcomingReservation(item = {}) {
  const time = getReservationTime(item)
  if (time) return time > Date.now() - 15 * 60 * 1000
  const dateValue = getReservationDateValue(item)
  return !dateValue || dateValue >= getTodayValue()
}

function getReservationTime(item = {}) {
  const dateMatch = String(item.reservationDate || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  const timeMatch = String(item.reservationTime || '').match(/(\d{1,2})(?:[:\uff1a\u70b9](\d{1,2}))?/)
  if (!dateMatch || !timeMatch) return 0
  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2] || 0)
  const time = new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function isReservationExpired(item = {}) {
  const time = getReservationTime(item)
  return !!time && Date.now() - time > 15 * 60 * 1000
}

function formatReservationReminder(item = {}) {
  const dateText = item.reservationDateText || item.reservationDate || ''
  const timeText = item.reservationTime || ''
  const digits = String(item.phone || item.phoneNumber || '').replace(/\D/g, '')
  const lastFour = digits.slice(-4)
  return {
    ...item,
    displayPhone: lastFour ? `\u5c3e\u53f7${lastFour}` : '\u672a\u8bb0\u5f55',
    displayDateTime: `${dateText} ${timeText}`.trim() || '\u672a\u8bb0\u5f55',
    displayPeople: `${item.peopleCount || 0}\u4eba`,
    displayRoom: item.roomType || '\u672a\u9009\u62e9'
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
    tableSections: [],
    transferMode: false,
    transferSource: null,
    transferSourceText: '',
    transferring: false,
    mergeMode: false,
    mergeSource: null,
    mergeSourceText: '',
    mergeSourceKey: '',
    selectedMergeTableMap: {},
    selectedMergeTableCount: 0,
    merging: false,
    reservationReminders: [],
    selectedReservationReminderId: ''
  },

  onLoad() {
    this.rawTables = getBaseTableSections()
    this.syncTransferState()
    this.syncMergeState()
    this.refreshTables()
    this.loadTables()
    this.loadReservationReminders(true)
    this.timer = setInterval(() => {
      this.loadTables(true)
      this.loadReservationReminders(true)
    }, 15000)
    this.clockTimer = setInterval(() => {
      this.refreshTables()
    }, 60000)
  },

  onShow() {
    this.syncTransferState()
    this.syncMergeState()
    this.loadTables(true)
    this.loadReservationReminders(true)
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

  async loadReservationReminders(silent = false) {
    try {
      const res = await apiClient.call('admin.collection.list', {
        collection: 'reservation',
        filters: { status: 'confirmed' },
        orderBy: 'createTime',
        order: 'desc',
        limit: 100
      })
      const reservations = res.data || []
      const expiredReservations = reservations.filter(isReservationExpired)
      if (expiredReservations.length > 0) {
        this.autoCancelExpiredReservations(expiredReservations)
      }

      const reservationReminders = reservations
        .filter(item => !isReservationExpired(item))
        .filter(isUpcomingReservation)
        .map(formatReservationReminder)
        .sort((a, b) => {
          const leftTime = getReservationTime(a) || Number.MAX_SAFE_INTEGER
          const rightTime = getReservationTime(b) || Number.MAX_SAFE_INTEGER
          if (leftTime !== rightTime) return leftTime - rightTime
          return String(a.createTime || '').localeCompare(String(b.createTime || ''))
        })
      const selectedReservationReminderId = reservationReminders.some(item => item._id === this.data.selectedReservationReminderId)
        ? this.data.selectedReservationReminderId
        : ''

      this.setData({
        reservationReminders,
        selectedReservationReminderId
      })
    } catch (err) {
      console.error('load table reservation reminders failed', err)
      if (!silent) {
        wx.showToast({
          title: UI.reservationLoadFailed,
          icon: 'none'
        })
      }
    }
  },

  async autoCancelExpiredReservations(reservations = []) {
    if (this.autoCancellingReservations) return
    const targets = reservations.filter(item => item && item._id)
    if (targets.length === 0) return

    this.autoCancellingReservations = true
    const cancelledAt = new Date().toISOString()
    try {
      await Promise.all(targets.map(item => apiClient.call('admin.collection.update', {
        collection: 'reservation',
        id: item._id,
        data: {
          status: 'cancelled',
          cancelledAt,
          cancelReason: 'expired_15_minutes'
        }
      }).catch(err => {
        console.error('auto cancel expired reservation failed', err)
      })))
    } finally {
      this.autoCancellingReservations = false
    }
  },

  selectReservationReminder(e) {
    const id = e.currentTarget.dataset && e.currentTarget.dataset.id
    if (!id) return
    this.setData({
      selectedReservationReminderId: id
    })
  },

  async handleReservationAction(e) {
    const data = e.currentTarget.dataset || {}
    const status = data.status
    const id = this.data.selectedReservationReminderId
    if (status !== 'arrived' && status !== 'cancelled') return
    if (!id) {
      wx.showToast({
        title: UI.reservationSelectFirst,
        icon: 'none'
      })
      return
    }
    if (this.updatingReservationStatus) return

    const now = new Date().toISOString()
    const updateData = status === 'arrived'
      ? { status: 'arrived', arrivedAt: now }
      : { status: 'cancelled', cancelledAt: now, cancelReason: 'admin_cancel' }

    this.updatingReservationStatus = true
    try {
      await apiClient.call('admin.collection.update', {
        collection: 'reservation',
        id,
        data: updateData
      })

      this.setData({
        reservationReminders: (this.data.reservationReminders || []).filter(item => item._id !== id),
        selectedReservationReminderId: ''
      })
      wx.showToast({
        title: status === 'arrived' ? UI.reservationArrivedSuccess : UI.reservationCancelSuccess,
        icon: 'success'
      })
    } catch (err) {
      console.error('update reservation reminder failed', err)
      wx.showToast({
        title: err.message || UI.reservationUpdateFailed,
        icon: 'none'
      })
    } finally {
      this.updatingReservationStatus = false
    }
  },

  refreshTables() {
    const selectedMap = this.data.selectedMergeTableMap || {}
    const mergeSource = this.data.mergeSource || null
    this.setData({
      tableSections: (this.rawTables || []).map(section => ({
        ...section,
        tables: (section.tables || []).map(table => formatTable(table, selectedMap, mergeSource))
      }))
    })
  },

  syncTransferState() {
    const transferSource = wx.getStorageSync('adminTableTransfer') || null
    this.setData({
      transferMode: !!(transferSource && transferSource.tableNumber),
      transferSource,
      transferSourceText: transferSource && transferSource.label || ''
    })
  },

  cancelTransfer() {
    wx.removeStorageSync('adminTableTransfer')
    this.setData({
      transferMode: false,
      transferSource: null,
      transferSourceText: ''
    })
  },

  syncMergeState() {
    const mergeSource = wx.getStorageSync('adminTableMerge') || null
    const mergeMode = !!(mergeSource && mergeSource.tableNumber)
    const mergeSourceKey = mergeMode ? `${mergeSource.areaKey}-${mergeSource.tableNumber}-${mergeSource.createTime || ''}` : ''
    const shouldKeepSelected = mergeMode && mergeSourceKey === this.data.mergeSourceKey
    this.setData({
      mergeMode,
      mergeSource,
      mergeSourceText: mergeSource && mergeSource.label || '',
      mergeSourceKey,
      selectedMergeTableMap: shouldKeepSelected ? (this.data.selectedMergeTableMap || {}) : {},
      selectedMergeTableCount: shouldKeepSelected ? Object.keys(this.data.selectedMergeTableMap || {}).length : 0
    })
  },

  cancelMerge() {
    wx.removeStorageSync('adminTableMerge')
    this.setData({
      mergeMode: false,
      mergeSource: null,
      mergeSourceText: '',
      mergeSourceKey: '',
      selectedMergeTableMap: {},
      selectedMergeTableCount: 0
    })
    this.refreshTables()
  },

  buildTableQuery(data) {
    return [
      ['areaKey', data.areaKey],
      ['areaName', data.area],
      ['tableNumber', data.table],
      ['tableKey', data.tableKey],
      ['status', data.status],
      ['totalPrice', data.price],
      ['peopleCount', data.people],
      ['maxPeople', data.max],
      ['scannedAt', data.scanned],
      ['finishedAt', data.finished]
    ].map(([key, value]) => `${key}=${encodeURIComponent(value == null ? '' : value)}`).join('&')
  },

  navigateToTable(data) {
    wx.navigateTo({
      url: `${TABLE_DETAIL_PAGE}?${this.buildTableQuery(data)}`
    })
  },

  async transferToTable(data) {
    if (this.data.transferring) return
    const source = this.data.transferSource || {}

    if (!source.tableNumber) {
      this.cancelTransfer()
      return
    }
    if (source.areaKey === data.areaKey && source.tableNumber === data.table) {
      wx.showToast({
        title: UI.transferSameTable,
        icon: 'none'
      })
      return
    }
    if (data.status !== 'empty') {
      wx.showToast({
        title: UI.transferTargetOccupied,
        icon: 'none'
      })
      return
    }

    const targetText = `${data.area}${data.table}${UI.tableUnit}`
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: UI.transferConfirmTitle,
        content: `${UI.transferConfirmPrefix}${source.label || ''}${UI.transferConfirmMiddle}${targetText}${UI.transferConfirmSuffix}`,
        confirmText: '\u8f6c\u53f0',
        cancelText: '\u53d6\u6d88',
        success: res => resolve(res.confirm === true),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return

    try {
      this.setData({ transferring: true })
      await apiClient.call('admin.table.transfer', {
        sourceAreaKey: source.areaKey,
        sourceTableNumber: source.tableNumber,
        targetAreaKey: data.areaKey,
        targetTableNumber: data.table
      })
      wx.removeStorageSync('adminTableTransfer')
      this.setData({
        transferMode: false,
        transferSource: null,
        transferSourceText: ''
      })
      wx.showToast({
        title: UI.transferSuccess,
        icon: 'success'
      })
      await this.loadTables(true)
      this.navigateToTable(data)
    } catch (err) {
      console.error('transfer table failed', err)
      wx.showToast({
        title: err.message || UI.transferFailed,
        icon: 'none'
      })
    } finally {
      this.setData({ transferring: false })
    }
  },

  toggleMergeTable(data) {
    const source = this.data.mergeSource || {}
    if (isSameTable({
      areaKey: data.areaKey,
      tableNumber: data.table
    }, source)) {
      wx.showToast({
        title: UI.mergeSameTable,
        icon: 'none'
      })
      return
    }

    const tableKey = data.tableKey || `${data.areaKey}-${data.table}`
    const selectedMergeTableMap = {
      ...(this.data.selectedMergeTableMap || {})
    }
    if (selectedMergeTableMap[tableKey]) {
      delete selectedMergeTableMap[tableKey]
    } else {
      selectedMergeTableMap[tableKey] = {
        areaKey: data.areaKey,
        tableNumber: data.table
      }
    }

    this.setData({
      selectedMergeTableMap,
      selectedMergeTableCount: Object.keys(selectedMergeTableMap).length
    })
    this.refreshTables()
  },

  getSelectedMergeTables() {
    const selectedMap = this.data.selectedMergeTableMap || {}
    return Object.keys(selectedMap).map(key => selectedMap[key]).filter(Boolean)
  },

  async confirmMergeTables() {
    if (this.data.merging) return
    const source = this.data.mergeSource || {}
    const selectedTables = this.getSelectedMergeTables()

    if (!source.tableNumber) {
      this.cancelMerge()
      return
    }
    if (selectedTables.length === 0) {
      wx.showToast({
        title: UI.mergeSelectFirst,
        icon: 'none'
      })
      return
    }

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: UI.mergeConfirmTitle,
        content: `${UI.mergeConfirmPrefix}${source.label || ''}${UI.mergeConfirmMiddle}${selectedTables.length}${UI.mergeConfirmSuffix}`,
        confirmText: UI.confirmMerge,
        cancelText: '\u53d6\u6d88',
        success: res => resolve(res.confirm === true),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return

    try {
      this.setData({ merging: true })
      await apiClient.call('admin.table.merge', {
        areaKey: source.areaKey,
        tableNumber: source.tableNumber,
        tables: selectedTables
      })
      wx.removeStorageSync('adminTableMerge')
      this.setData({
        mergeMode: false,
        mergeSource: null,
        mergeSourceText: '',
        mergeSourceKey: '',
        selectedMergeTableMap: {},
        selectedMergeTableCount: 0
      })
      wx.showToast({
        title: UI.mergeSuccess,
        icon: 'success'
      })
      await this.loadTables(true)
      this.navigateToTable({
        areaKey: source.areaKey,
        area: source.areaName,
        table: source.tableNumber,
        tableKey: source.tableKey,
        status: 'submitted',
        price: 0,
        people: 0,
        max: 0,
        scanned: 0
      })
    } catch (err) {
      console.error('merge tables failed', err)
      wx.showToast({
        title: err.message || UI.mergeFailed,
        icon: 'none'
      })
    } finally {
      this.setData({ merging: false })
    }
  },

  openTable(e) {
    const data = e.currentTarget.dataset || {}
    if (this.data.transferMode) {
      this.transferToTable(data)
      return
    }
    if (this.data.mergeMode) {
      this.toggleMergeTable(data)
      return
    }

    this.navigateToTable(data)
  }
})
