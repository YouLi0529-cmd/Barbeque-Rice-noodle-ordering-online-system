const apiClient = require('../../../../utils/apiClient')

const DISMISSED_STORAGE_KEY = 'adminInfoCenterDismissed'
const POLL_INTERVAL = 30000

function getLastFour(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits ? digits.slice(-4) : ''
}

function getDateTimeValue(value) {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (value && typeof value === 'object') {
    return getDateTimeValue(value.$date || value.value || value.date || 0)
  }
  const text = String(value || '').trim()
  if (!text) return 0
  const parsed = Date.parse(text.replace(/-/g, '/'))
  return Number.isNaN(parsed) ? 0 : parsed
}

function getReservationTimeValue(item = {}) {
  const dateMatch = String(item.reservationDate || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  const timeMatch = String(item.reservationTime || '').match(/(\d{1,2})(?:[:\uFF1A\u70B9](\d{1,2}))?/)
  if (!dateMatch || !timeMatch) return 0
  return new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2] || 0)
  ).getTime()
}

function formatMessageTime(value) {
  const time = getDateTimeValue(value)
  if (!time) return ''
  const date = new Date(time)
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return hour + ':' + minute
}

function getDismissedMap() {
  try {
    const value = wx.getStorageSync(DISMISSED_STORAGE_KEY)
    return value && typeof value === 'object' ? value : {}
  } catch (err) {
    return {}
  }
}

function saveDismissedMap(value) {
  try {
    wx.setStorageSync(DISMISSED_STORAGE_KEY, value)
  } catch (err) {
    console.warn('save admin info dismissed state failed', err)
  }
}

Component({
  properties: {
    enabled: {
      type: Boolean,
      value: true,
      observer(enabled) {
        if (!this.componentAttached) return
        if (enabled) {
          this.activate()
          this.startPolling()
          return
        }
        this.stopPolling()
        this.setData({
          visible: false,
          panelOpen: false
        })
      }
    }
  },

  data: {
    visible: false,
    panelOpen: false,
    loading: false,
    unreadCount: 0,
    unreadBadge: '',
    messages: [],
    selectedMessageId: '',
    ui: {
      title: '\u4FE1\u606F',
      refresh: '\u5237\u65B0',
      empty: '\u6682\u65E0\u672A\u8BFB\u4FE1\u606F',
      dineInType: '\u5802\u98DF\u8BA2\u5355',
      outdoorType: '\u6237\u5916\u8BA2\u5355',
      reservationType: '\u4E34\u8FD1\u9884\u7EA6'
    }
  },

  lifetimes: {
    attached() {
      this.componentAttached = true
      if (!this.data.enabled) return
      this.activate()
      this.startPolling()
    },
    detached() {
      this.componentAttached = false
      this.stopPolling()
    }
  },

  pageLifetimes: {
    show() {
      if (!this.data.enabled) return
      this.activate()
      this.startPolling()
    },
    hide() {
      this.stopPolling()
    }
  },

  methods: {
    startPolling() {
      this.stopPolling()
      this.pollTimer = setInterval(() => {
        this.activate(true)
      }, POLL_INTERVAL)
    },

    stopPolling() {
      if (!this.pollTimer) return
      clearInterval(this.pollTimer)
      this.pollTimer = null
    },

    togglePanel() {
      if (!this.data.enabled || !apiClient.getAdminAuthToken()) return
      this.setData({ visible: true })
      const panelOpen = !this.data.panelOpen
      this.setData({ panelOpen })
      if (panelOpen) this.loadNotifications()
    },

    activate(silent = false) {
      if (!this.data.enabled || !apiClient.getAdminAuthToken()) {
        this.setData({
          visible: false,
          panelOpen: false
        })
        return
      }
      this.setData({ visible: true })
      this.loadNotifications(silent)
    },

    closePanel() {
      this.setData({ panelOpen: false })
    },

    async refreshNotifications() {
      await this.loadNotifications()
    },

    async loadNotifications(silent = false) {
      if (this.data.loading || !this.data.enabled || !apiClient.getAdminAuthToken()) return

      this.setData({ loading: true })
      try {
        const res = await apiClient.call('admin.notification.list')
        this.applyNotifications(res.data || {})
      } catch (err) {
        if (!silent) console.error('load admin notifications failed', err)
      } finally {
        this.setData({ loading: false })
      }
    },

    applyNotifications(data = {}) {
      const dismissedMap = getDismissedMap()
      const now = Date.now()
      const reservationDeadline = now + 30 * 60 * 1000
      const messages = []

      ;(data.orders || []).forEach(order => {
        const isOutdoor = order.orderScene === 'camping'
        const id = (isOutdoor ? 'outdoor:' : 'table:') + order._id
        const version = String(order.updateTime || order.createTime || order.status || '')
        if (dismissedMap[id] === version) return

        const lastFour = getLastFour(order.userPhone)
        messages.push({
          id,
          version,
          type: isOutdoor ? 'outdoor' : 'dineIn',
          typeText: isOutdoor ? this.data.ui.outdoorType : this.data.ui.dineInType,
          title: isOutdoor
            ? (lastFour ? '\u5C3E\u53F7' + lastFour : '\u65B0\u6237\u5916\u8BA2\u5355') + '\u5DF2\u63D0\u4EA4'
            : (order.tableNumber || '\u672A\u77E5') + '\u684C\u5DF2\u63D0\u4EA4\u8BA2\u5355',
          detail: '',
          time: formatMessageTime(order.updateTime || order.createTime),
          timeValue: getDateTimeValue(order.updateTime || order.createTime)
        })
      })

      ;(data.reservations || []).forEach(reservation => {
        const reservationTime = getReservationTimeValue(reservation)
        if (!reservationTime || reservationTime < now || reservationTime > reservationDeadline) return

        const id = 'reservation:' + reservation._id
        const version = String(reservation.updateTime || reservation.status || '')
        if (dismissedMap[id] === version) return

        const lastFour = getLastFour(reservation.phone)
        messages.push({
          id,
          version,
          type: 'reservation',
          typeText: this.data.ui.reservationType,
          title: String(reservation.reservationTime || '') + '\u6709\u4E00\u4E2A\u4E34\u8FD1\u9884\u7EA6',
          detail: String(reservation.roomType || '\u672A\u9009\u533A\u57DF') + ' \u00B7 ' + Number(reservation.peopleCount || 0) + '\u4EBA' + (lastFour ? ' \u00B7 \u5C3E\u53F7' + lastFour : ''),
          time: '',
          timeValue: reservationTime
        })
      })

      messages.sort((left, right) => Number(right.timeValue || 0) - Number(left.timeValue || 0))
      const unreadCount = messages.length
      this.setData({
        messages,
        unreadCount,
        unreadBadge: unreadCount > 99 ? '99+' : String(unreadCount),
        selectedMessageId: messages.some(item => item.id === this.data.selectedMessageId)
          ? this.data.selectedMessageId
          : ''
      })
    },

    selectMessage(event) {
      const id = event.currentTarget.dataset.id
      this.setData({
        selectedMessageId: this.data.selectedMessageId === id ? '' : id
      })
    },

    dismissMessage(event) {
      const id = event.currentTarget.dataset.id
      const message = (this.data.messages || []).find(item => item.id === id)
      if (!message) return

      const dismissedMap = getDismissedMap()
      dismissedMap[id] = message.version
      saveDismissedMap(dismissedMap)

      const messages = this.data.messages.filter(item => item.id !== id)
      const unreadCount = messages.length
      this.setData({
        messages,
        unreadCount,
        unreadBadge: unreadCount > 99 ? '99+' : String(unreadCount),
        selectedMessageId: ''
      })
    }
  }
})
