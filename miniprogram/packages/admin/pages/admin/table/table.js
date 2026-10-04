const apiClient = require('../../../../../utils/apiClient')
const tableBoardSignal = require('../../../../../utils/tableBoardSignal')
const adminSound = require('../../../utils/adminSound')

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
  reservationSelectFirst: '\u8bf7\u5148\u9009\u62e9\u9884\u7ea6',
  clearTable: '\u6e05\u53f0',
  clearSelectFirst: '\u8bf7\u5148\u70b9\u9009\u9700\u8981\u6e05\u53f0\u7684\u684c\u53f0',
  clearConfirmTitle: '\u786e\u8ba4\u6e05\u53f0',
  clearConfirmPrefix: '\u786e\u5b9a\u5c06',
  clearConfirmSuffix: '\u6062\u590d\u4e3a\u7a7a\u684c\u5e76\u6e05\u9664\u62fc\u684c\u5173\u7cfb\u5417',
  clearSuccess: '\u5df2\u6e05\u53f0',
  clearFailed: '\u6e05\u53f0\u5931\u8d25',
  todayArrival: '\u4eca\u65e5\u5230\u5e97',
  todayTableCount: '\u4eca\u65e5\u603b\u684c\u6570',
  peopleUnit: '\u4eba',
  unsettledTotal: '\u672a\u7ed3\u7b97\u91d1\u989d',
  searchDish: '\u67e5\u83dc',
  searchDishTitle: '\u67e5\u627e\u672a\u7ed3\u8d26\u684c\u53f0\u83dc\u54c1',
  searchDishPlaceholder: '\u8f93\u5165\u83dc\u54c1\u540d\u79f0',
  searchDishEmpty: '\u8bf7\u8f93\u5165\u83dc\u540d\u540e\u67e5\u627e',
  searchDishNoResults: '\u6ca1\u6709\u5728\u8425\u684c\u53f0\u7684\u5df2\u63d0\u4ea4\u83dc\u54c1',
  searchDishFailed: '\u67e5\u83dc\u5931\u8d25'
}

const TABLE_DETAIL_PAGE = '/packages/admin/pages/admin/tableDetail/tableDetail'
const TABLE_BOARD_PREFETCH_KEY = 'adminTableBoardPrefetch'
const TABLE_BOARD_PREFETCH_MAX_AGE_MS = 90 * 1000
const TABLE_BOARD_SIGNAL_DEBOUNCE_MS = 300
const TABLE_BOARD_SIGNAL_FALLBACK_INTERVAL_MS = 60 * 1000
const TABLE_BOARD_POLLING_INTERVAL_MS = 10 * 1000

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
    text: '\u5df2\u53d1\u9001',
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

function formatSearchTime(value) {
  const time = Number(value || 0)
  if (!time) return '\u672a\u8bb0\u5f55\u65f6\u95f4'
  const date = new Date(time)
  return `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}

function isSameTable(left, right) {
  return left && right &&
    left.areaKey === right.areaKey &&
    left.tableNumber === right.tableNumber
}

function formatTable(item, mergeSelectedMap = {}, mergeSource = null, selectedTableMap = {}) {
  const status = STATUS[item.status] || STATUS.empty
  const tableKey = item.tableKey || `${item.areaKey}-${item.tableNumber}`
  const mergedTables = Array.isArray(item.mergedTables) ? item.mergedTables : []
  const hasMergedTable = !!item.tableGroupId || mergedTables.length > 1
  return {
    ...item,
    tableKey,
    statusText: status.text,
    statusClass: status.className,
    priceText: formatPrice(item.totalPrice),
    peopleText: `${Number(item.peopleCount || 0)}/${Number(item.maxPeople || 0)}`,
    diningTimeText: getDiningTime(item.scannedAt, item.finishedAt),
    hasMergedTable,
    mergeSelected: !!mergeSelectedMap[tableKey],
    mergeSource: isSameTable(item, mergeSource),
    selected: !!selectedTableMap[tableKey]
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
  onAdminTap(event) {
    adminSound.playClick(event)
  },

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
    selectedReservationReminderIds: [],
    selectedTableMap: {},
    selectedTableCount: 0,
    clearingTable: false,
    todayArrivalCount: 0,
    todayTableCount: 0,
    unsettledTotalText: '0',
    showDishSearch: false,
    dishSearchQuery: '',
    dishSearchResults: [],
    searchingDish: false
  },

  onLoad() {
    this.rawTables = getBaseTableSections()
    this.tableBoardVersion = 0
    this.tableBoardActivityStamp = ''
    this.tableBoardStatusSupported = true
    this.tableBoardRefreshInFlight = false
    this.tableBoardSignalSupported = true
    this.tableBoardSignalVersion = 0
    this.tableBoardSignalRunId = 0
    this.syncTransferState()
    this.syncMergeState()
    const usedPrefetchedTables = this.restorePrefetchedTables()
    if (usedPrefetchedTables) {
      this.refreshTableBoard(true)
    } else {
      this.refreshTables()
      this.loadTables()
    }
    this.startAutoRefresh()
  },

  onShow() {
    this.syncTransferState()
    this.syncMergeState()
    this.refreshTableBoard(true)
    this.startAutoRefresh()
  },

  onHide() {
    this.stopAutoRefresh()
  },

  onUnload() {
    this.stopAutoRefresh()
  },

  startAutoRefresh() {
    if (this.timer) return
    this.startTableBoardSignal()
    this.startTableBoardPolling(this.tableBoardSignalWatcher
      ? TABLE_BOARD_SIGNAL_FALLBACK_INTERVAL_MS
      : TABLE_BOARD_POLLING_INTERVAL_MS)
    this.clockTimer = setInterval(() => {
      this.refreshTables()
    }, 60000)
  },

  startTableBoardPolling(interval) {
    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => {
      this.refreshTableBoard(true)
    }, interval)
  },

  startTableBoardSignal() {
    if (this.tableBoardSignalWatcher || this.tableBoardSignalSupported === false) return

    const signalRunId = this.tableBoardSignalRunId + 1
    this.tableBoardSignalRunId = signalRunId
    let initialSnapshot = true
    this.tableBoardSignalWatcher = tableBoardSignal.watch((signal) => {
      if (signalRunId !== this.tableBoardSignalRunId) return
      const version = Number(signal && signal.version || 0)
      if (initialSnapshot) {
        initialSnapshot = false
        if (Number.isFinite(version)) this.tableBoardSignalVersion = version
        return
      }

      if (!Number.isFinite(version) || version <= this.tableBoardSignalVersion) return
      this.tableBoardSignalVersion = version
      this.queueTableBoardSignalRefresh()
    }, err => {
      if (signalRunId !== this.tableBoardSignalRunId) return
      console.error('watch table board signal failed', err)
      this.tableBoardSignalSupported = false
      this.stopTableBoardSignal()
      if (this.timer) this.startTableBoardPolling(TABLE_BOARD_POLLING_INTERVAL_MS)
    })

    if (!this.tableBoardSignalWatcher) {
      this.tableBoardSignalSupported = false
    }
  },

  stopTableBoardSignal() {
    this.tableBoardSignalRunId += 1
    if (this.tableBoardSignalRefreshTimer) {
      clearTimeout(this.tableBoardSignalRefreshTimer)
      this.tableBoardSignalRefreshTimer = null
    }
    if (this.tableBoardSignalWatcher && typeof this.tableBoardSignalWatcher.close === 'function') {
      this.tableBoardSignalWatcher.close()
    }
    this.tableBoardSignalWatcher = null
  },

  queueTableBoardSignalRefresh() {
    if (this.tableBoardSignalRefreshTimer) return
    this.tableBoardSignalRefreshTimer = setTimeout(() => {
      this.tableBoardSignalRefreshTimer = null
      this.loadTables(true)
    }, TABLE_BOARD_SIGNAL_DEBOUNCE_MS)
  },

  stopAutoRefresh() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.clockTimer) {
      clearInterval(this.clockTimer)
      this.clockTimer = null
    }
    this.stopTableBoardSignal()
  },

  async loadTables(silent = false) {
    try {
      if (!silent) {
        this.setData({ loading: true })
      }

      const res = await apiClient.call('admin.table.list')
      const boardData = res && res.data ? res.data : {}
      this.applyTableBoardData(boardData)
      this.cacheTableBoardData(boardData)
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

  applyTableBoardData(data = {}) {
    const sections = Array.isArray(data.sections) ? data.sections : []
    const hasReservations = Array.isArray(data.reservations)
    const reservations = hasReservations ? data.reservations : []
    const boardVersion = Number(data.boardVersion)
    const activityStamp = String(data.activityStamp || '')
    const todayArrivalCount = Math.max(0, Math.floor(Number(
      data.todayArrival && data.todayArrival.peopleCount || 0
    )))
    const todayTableCount = Math.max(0, Math.floor(Number(
      data.todayArrival && data.todayArrival.tableCount || 0
    )))
    const unsettledTotalText = formatPrice(data.unsettledTotal || 0)

    if (sections.length > 0) {
      this.rawTables = sections
      this.refreshTables()
    }
    this.setData({ todayArrivalCount, todayTableCount, unsettledTotalText })
    if (Number.isFinite(boardVersion)) this.tableBoardVersion = boardVersion
    if (activityStamp) this.tableBoardActivityStamp = activityStamp
    if (hasReservations) {
      this.applyReservationReminders(reservations)
    } else {
      this.loadReservationReminders(true)
    }
  },

  cacheTableBoardData(data = {}) {
    const sections = Array.isArray(data.sections) ? data.sections : []
    if (sections.length === 0) return
    try {
      wx.setStorageSync(TABLE_BOARD_PREFETCH_KEY, {
        cachedAt: Date.now(),
        data: {
          sections,
          reservations: Array.isArray(data.reservations) ? data.reservations : [],
          boardVersion: Number(data.boardVersion || 0),
          activityStamp: String(data.activityStamp || ''),
          todayArrival: data.todayArrival || {},
          unsettledTotal: Number(data.unsettledTotal || 0)
        }
      })
    } catch (err) {
      console.error('cache table board failed', err)
    }
  },

  restorePrefetchedTables() {
    try {
      const cached = wx.getStorageSync(TABLE_BOARD_PREFETCH_KEY)
      if (!cached || !cached.data || Date.now() - Number(cached.cachedAt || 0) > TABLE_BOARD_PREFETCH_MAX_AGE_MS) {
        return false
      }
      if (!Array.isArray(cached.data.sections) || cached.data.sections.length === 0) return false
      this.applyTableBoardData(cached.data)
      return true
    } catch (err) {
      return false
    }
  },

  async refreshTableBoard(silent = false) {
    if (this.tableBoardRefreshInFlight) return
    this.tableBoardRefreshInFlight = true
    try {
      if (this.tableBoardStatusSupported === false) {
        await this.loadTables(silent)
        return
      }

      const res = await apiClient.call('admin.table.status', {
        boardVersion: this.tableBoardVersion,
        activityStamp: this.tableBoardActivityStamp
      })
      const status = res && res.data ? res.data : {}
      const boardVersion = Number(status.boardVersion)
      const activityStamp = String(status.activityStamp || '')
      if (Number.isFinite(boardVersion)) this.tableBoardVersion = boardVersion
      if (activityStamp) this.tableBoardActivityStamp = activityStamp
      if (status.changed || !Number.isFinite(boardVersion)) {
        await this.loadTables(silent)
      }
    } catch (err) {
      if (String(err && err.message || '').indexOf('unknown action') >= 0) {
        this.tableBoardStatusSupported = false
      }
      await this.loadTables(silent)
    } finally {
      this.tableBoardRefreshInFlight = false
    }
  },

  applyReservationReminders(reservations = []) {
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
    const activeReminderIdMap = (this.data.selectedReservationReminderIds || []).reduce((map, id) => {
      map[id] = true
      return map
    }, {})
    const selectedReservationReminderIds = reservationReminders
      .filter(item => activeReminderIdMap[item._id])
      .map(item => item._id)
    const nextReservationReminders = reservationReminders.map(item => ({
      ...item,
      isSelected: !!activeReminderIdMap[item._id]
    }))

    this.setData({
      reservationReminders: nextReservationReminders,
      selectedReservationReminderIds
    })
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
      this.applyReservationReminders(reservations)
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
    const selectedReservationReminderIds = (this.data.selectedReservationReminderIds || []).slice()
    const index = selectedReservationReminderIds.indexOf(id)
    if (index >= 0) {
      selectedReservationReminderIds.splice(index, 1)
    } else {
      selectedReservationReminderIds.push(id)
    }
    this.setData({
      selectedReservationReminderIds,
      reservationReminders: (this.data.reservationReminders || []).map(item => ({
        ...item,
        isSelected: selectedReservationReminderIds.indexOf(item._id) >= 0
      }))
    })
  },

  async handleReservationAction(e) {
    const data = e.currentTarget.dataset || {}
    const status = data.status
    const ids = (this.data.selectedReservationReminderIds || []).filter(Boolean)
    if (status !== 'arrived' && status !== 'cancelled') return
    if (ids.length === 0) {
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
      await Promise.all(ids.map(id => apiClient.call('admin.collection.update', {
        collection: 'reservation',
        id,
        data: updateData
      })))

      this.setData({
        reservationReminders: (this.data.reservationReminders || []).filter(item => ids.indexOf(item._id) < 0),
        selectedReservationReminderIds: []
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
    const selectedTableMap = this.data.selectedTableMap || {}
    this.setData({
      tableSections: (this.rawTables || []).map(section => ({
        ...section,
        tables: (section.tables || []).map(table => formatTable(table, selectedMap, mergeSource, selectedTableMap))
      }))
    })
  },

  syncTransferState() {
    const transferSource = this.getStoredTransferSource()
    this.setData({
      transferMode: !!(transferSource && transferSource.tableNumber),
      transferSource,
      transferSourceText: transferSource && transferSource.label || ''
    })
  },

  getStoredTransferSource() {
    try {
      return wx.getStorageSync('adminTableTransfer') || null
    } catch (err) {
      console.error('读取转台状态失败', err)
      return null
    }
  },

  getActiveTransferSource() {
    const currentSource = this.data.transferSource || null
    if (currentSource && currentSource.tableNumber) {
      return currentSource
    }
    return this.getStoredTransferSource()
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
    const mergeSource = this.getStoredMergeSource()
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

  getStoredMergeSource() {
    try {
      return wx.getStorageSync('adminTableMerge') || null
    } catch (err) {
      console.error('读取拼桌状态失败', err)
      return null
    }
  },

  getActiveMergeSource() {
    const currentSource = this.data.mergeSource || null
    if (currentSource && currentSource.tableNumber) {
      return currentSource
    }
    return this.getStoredMergeSource()
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
    this.setData({
      selectedTableMap: {},
      selectedTableCount: 0
    }, () => {
      wx.navigateTo({
        url: `${TABLE_DETAIL_PAGE}?${this.buildTableQuery(data)}`
      })
    })
  },

  selectTable(data) {
    const table = {
      areaKey: data.areaKey,
      areaName: data.area,
      tableNumber: data.table,
      tableKey: data.tableKey,
      label: `${data.area}${data.table}${UI.tableUnit}`
    }
    if (!table.tableKey) return

    const selectedTableMap = {
      ...(this.data.selectedTableMap || {}),
      [table.tableKey]: table
    }
    this.setData({
      selectedTableMap,
      selectedTableCount: Object.keys(selectedTableMap).length
    })
    this.refreshTables()
  },

  clearTableSelection() {
    if (this.data.selectedTableCount <= 0) return
    this.setData({
      selectedTableMap: {},
      selectedTableCount: 0
    }, () => {
      this.refreshTables()
    })
  },

  async confirmClearTable() {
    if (this.data.clearingTable) return
    const tables = Object.keys(this.data.selectedTableMap || {})
      .map(key => this.data.selectedTableMap[key])
      .filter(table => table && table.tableNumber)
    if (tables.length === 0) {
      wx.showToast({
        title: UI.clearSelectFirst,
        icon: 'none'
      })
      return
    }

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: UI.clearConfirmTitle,
        content: `${UI.clearConfirmPrefix}${tables.map(table => table.label).join(', ')}${UI.clearConfirmSuffix}`,
        confirmText: UI.clearTable,
        cancelText: '\u53d6\u6d88',
        success: res => resolve(res.confirm === true),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return

    try {
      this.setData({ clearingTable: true })
      const results = []
      for (const table of tables) {
        try {
          await apiClient.call('admin.table.clear', {
            areaKey: table.areaKey,
            tableNumber: table.tableNumber
          })
          results.push({ table, cleared: true })
        } catch (err) {
          results.push({ table, error: err })
        }
      }
      const failed = results.filter(item => item.error && item.error.code !== 'NO_TABLE_STATE')
      if (failed.length > 0) {
        throw failed[0].error
      }
      this.setData({
        selectedTableMap: {},
        selectedTableCount: 0
      })
      wx.showToast({
        title: UI.clearSuccess,
        icon: 'success'
      })
      await this.loadTables(true)
    } catch (err) {
      console.error('clear table failed', err)
      wx.showToast({
        title: err.message || UI.clearFailed,
        icon: 'none'
      })
    } finally {
      this.setData({ clearingTable: false })
    }
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

  stopPropagation() {},

  openDishSearch() {
    this.setData({ showDishSearch: true, dishSearchQuery: '', dishSearchResults: [] })
  },

  closeDishSearch() {
    if (this.data.searchingDish) return
    this.setData({ showDishSearch: false, dishSearchQuery: '', dishSearchResults: [] })
  },

  onDishSearchInput(event) {
    this.setData({ dishSearchQuery: String(event.detail && event.detail.value || '') })
  },

  async searchOpenTableDishes() {
    const query = String(this.data.dishSearchQuery || '').trim()
    if (!query || this.data.searchingDish) {
      if (!query) this.setData({ dishSearchResults: [] })
      return
    }
    this.setData({ searchingDish: true })
    try {
      const res = await apiClient.call('admin.table.searchDishes', { query })
      const items = (res && res.data && Array.isArray(res.data.items) ? res.data.items : []).map(item => ({
        ...item,
        orderTimeText: formatSearchTime(item.orderTime)
      }))
      this.setData({ dishSearchResults: items })
    } catch (err) {
      console.error('search open table dishes failed', err)
      wx.showToast({ title: err.message || UI.searchDishFailed, icon: 'none' })
    } finally {
      this.setData({ searchingDish: false })
    }
  },

  openDishSearchTable(event) {
    const data = event.currentTarget.dataset || {}
    if (!data.table) return
    this.setData({ showDishSearch: false }, () => this.navigateToTable({
      areaKey: data.areaKey,
      area: data.area,
      table: data.table,
      tableKey: `${data.areaKey}-${data.table}`
    }))
  },

  toggleMergeTable(data, activeSource = null) {
    const source = activeSource || this.getActiveMergeSource() || {}
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
    const transferSource = this.getActiveTransferSource()
    if (this.data.transferMode && transferSource && transferSource.tableNumber) {
      this.transferToTable(data)
      return
    }
    const mergeSource = this.getActiveMergeSource()
    if (this.data.mergeMode || (mergeSource && mergeSource.tableNumber)) {
      if (!this.data.mergeMode && mergeSource && mergeSource.tableNumber) {
        const mergeSourceKey = `${mergeSource.areaKey}-${mergeSource.tableNumber}-${mergeSource.createTime || ''}`
        this.setData({
          mergeMode: true,
          mergeSource,
          mergeSourceText: mergeSource.label || '',
          mergeSourceKey
        })
      }
      this.toggleMergeTable(data, mergeSource)
      return
    }
    const selectedTableMap = this.data.selectedTableMap || {}
    if (selectedTableMap[data.tableKey]) {
      this.navigateToTable(data)
      return
    }
    this.selectTable(data)
  }
})
