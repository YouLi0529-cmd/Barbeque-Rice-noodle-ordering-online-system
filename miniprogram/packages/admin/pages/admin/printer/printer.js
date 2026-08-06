const apiClient = require('../../../../../utils/apiClient')

const TAB_ITEMS = [
  { key: 'dashboard', label: '打印中心' },
  { key: 'printers', label: '打印机' },
  { key: 'jobs', label: '打印任务' },
  { key: 'settings', label: '设置' }
]

const SETTINGS_TAB_ITEMS = [
  { key: 'cashier', label: '收银打印' },
  { key: 'stations', label: '出品档口' },
  { key: 'templates', label: '票据样式' },
  { key: 'logs', label: '操作日志' }
]

const BRAND_OPTIONS = ['美团', '芯烨', '佳博', '新北洋', '爱普生', '思普瑞特', '通用']
const PAPER_OPTIONS = ['58', '76', '80']
const RESOLUTION_OPTIONS = ['180', '203']
const TICKET_TYPE_OPTIONS = [
  { key: '', label: '全部票据' },
  { key: 'customer_order', label: '客单' },
  { key: 'prebill', label: '预结单' },
  { key: 'checkout', label: '结账单' },
  { key: 'refund', label: '退单' },
  { key: 'kitchen_order', label: '制作单' },
  { key: 'kitchen_add', label: '加菜单' },
  { key: 'kitchen_urge', label: '催菜单' },
  { key: 'kitchen_refund', label: '退菜通知' },
  { key: 'kitchen_split', label: '制作分单' }
]

const JOB_STATUS_OPTIONS = [
  { key: '', label: '全部状态' },
  { key: 'queued', label: '等待打印' },
  { key: 'claimed', label: '已领取' },
  { key: 'sending', label: '发送中' },
  { key: 'printed', label: '已打印' },
  { key: 'failed', label: '打印失败' },
  { key: 'cancelled', label: '已取消' }
]
const FIELD_LIBRARY = [
  { key: 'title', label: '票据名称', sample: '结账单' },
  { key: 'shopName', label: '店铺名称', sample: '张南火盆烧烤' },
  { key: 'banquetName', label: '宴会名称', sample: '生日宴' },
  { key: 'tableNumber', label: '桌号', sample: '桌号：A01' },
  { key: 'tableInfo', label: '桌台信息', sample: '一楼大厅' },
  { key: 'orderNumber', label: '订单号', sample: 'ORD-20260713-001' },
  { key: 'customData', label: '自定义数据', sample: '会员到店' },
  { key: 'peopleCount', label: '人数', sample: '人数：4人' },
  { key: 'seatCount', label: '席数', sample: '1席' },
  { key: 'orderType', label: '订单类型', sample: '类型：堂食' },
  { key: 'openingRemark', label: '开台备注', sample: '靠窗' },
  { key: 'dishes', label: '菜品明细', sample: '五花肉 x2\n金针菇 x1' },
  { key: 'totalCount', label: '数量合计', sample: '共3份' },
  { key: 'orderAmount', label: '订单金额', sample: '订单金额：88\n打折（8.8折）：-10\n直减：-5' },
  { key: 'receivableAmount', label: '应付金额', sample: '应付金额：73' },
  { key: 'orderTime', label: '下单时间', sample: '下单时间：2026-07-13 12:30' },
  { key: 'printTime', label: '打印时间', sample: '打印时间：2026-08-02 10:30' },
  { key: 'customText', label: '自定义文字', sample: '欢迎光临' }
]

const CASHIER_DISH_PREVIEW_ROWS = [
  { dish: '菜品', count: '数量', subtotal: '小计', header: true },
  { dish: '鲜虾', count: '2', subtotal: '60' },
  { dish: '薄切五花肉', count: '1', subtotal: '25' }
]

const CASHIER_SUMMARY_PREVIEW_ROWS = {
  orderAmount: [
    { label: '订单金额', amount: '88' },
    { label: '打折（8.8折）', amount: '-10' },
    { label: '直减', amount: '-5' }
  ],
  receivableAmount: [{ label: '应付金额', amount: '73' }]
}

function toast(title, icon) {
  wx.showToast({ title, icon: icon || 'none', duration: 1800 })
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

function formatTime(value) {
  if (!value) return '暂无'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function emptyPrinter() {
  return {
    name: '', code: '', brand: '通用', model: '', connectionType: 'network', printerType: 'thermal',
    ip: '', port: 9100, paperWidth: 80, printMode: 'text', resolution: 203, status: true, usage: 'kitchen',
    usbBinding: { vendorId: '', productId: '', deviceName: '' },
    capabilities: { escpos: true, beep: false, cashDrawer: false, twoColor: false, cutPaper: false },
    beepCount: 1, beepLevel: 1, feedLines: 4, retryLimit: 2, openCashDrawer: false
  }
}

function setNested(target, path, value) {
  const result = clone(target)
  const keys = path.split('.')
  let current = result
  keys.slice(0, -1).forEach(key => {
    if (!current[key] || typeof current[key] !== 'object') current[key] = {}
    current = current[key]
  })
  current[keys[keys.length - 1]] = value
  return result
}

function makePreviewFields(fields, template = {}) {
  return (fields || []).map((field, index) => {
    const source = FIELD_LIBRARY.find(item => item.key === field.key) || {}
    const isCashierDishTable = field.key === 'dishes' && ['checkout', 'prebill'].includes(template.ticketType)
    const isCashierSummary = ['orderAmount', 'receivableAmount'].includes(field.key) && ['checkout', 'prebill'].includes(template.ticketType)
    const text = field.key === 'title'
      ? (template.name || source.sample || field.key)
      : (isCashierDishTable
        ? '菜品                  数量  小计\n鲜虾                    2    60\n薄切五花肉              1    25'
        : (source.sample || field.key))
    return {
      ...field,
      index,
      label: field.label || source.label || field.key,
      text,
      isCashierDishTable,
      isCashierSummary,
      previewRows: isCashierDishTable ? CASHIER_DISH_PREVIEW_ROWS : [],
      summaryRows: isCashierSummary ? (CASHIER_SUMMARY_PREVIEW_ROWS[field.key] || []) : []
    }
  })
}

function getTemplateFieldName(fields, index) {
  const field = (fields || [])[Number(index)]
  if (!field) return ''
  const source = FIELD_LIBRARY.find(item => item.key === field.key)
  return (source && source.label) || field.key || ''
}

Page({
  data: {
    tabs: TAB_ITEMS,
    settingsTabs: SETTINGS_TAB_ITEMS,
    activeTab: 'dashboard',
    activeSettingsTab: '',
    settingsDetailMode: false,
    loading: false,
    backendError: '',
    dashboard: { agentOnline: false, agents: [], printers: [], metrics: { queued: 0, failed: 0, unassigned: 0 }, alerts: [] },
    printers: [],
    kitchenPrinters: [],
    usbPrinterNames: [],
    usbDevices: [],
    cashierConfigs: [],
    stations: [],
    templates: [],
    templateBindingScopes: ['global', 'station', 'printer'],
    templateBindingScopeLabels: ['全店默认', '按后厨档口', '按具体打印机'],
    templateTestPrinters: [],
    templateTestPrinterId: '',
    templateTestPrinterName: '请选择要测试的打印机',
    jobs: [],
    jobsHasMore: false,
    jobsNextCursor: '',
    logs: [],
    logsHasMore: false,
    logsNextCursor: '',
    brandOptions: BRAND_OPTIONS,
    paperOptions: PAPER_OPTIONS,
    resolutionOptions: RESOLUTION_OPTIONS,
    ticketTypeOptions: TICKET_TYPE_OPTIONS,
    jobStatusOptions: JOB_STATUS_OPTIONS,
    jobPrinterOptions: [{ _id: '', name: '全部打印机' }],
    jobPrinterLabel: '全部打印机',
    jobStatusLabel: '全部状态',
    jobTicketLabel: '全部票据',
    sizeOptions: ['small', 'normal', 'medium', 'large', 'xlarge'],
    sizeLabels: ['小号', '正常', '中号', '大号', '加大号'],
    alignOptions: ['left', 'center', 'right'],
    alignLabels: ['左对齐', '居中', '右对齐'],
    colorOptions: ['black', 'red'],
    colorLabels: ['黑色', '红色'],
    fieldLibrary: FIELD_LIBRARY,
    selectedTemplateId: '',
    editTemplate: null,
    previewFields: [],
    selectedTemplateFieldIndex: -1,
    selectedTemplateFieldName: '',
    showTemplateDropdown: false,
    showTemplateHistory: false,
    templateHistory: [],
    selectedTemplateHistoryIds: [],
    jobFilter: { printerId: '', ticketType: '', status: '', orderTail: '' },
    showJobPrinterDropdown: false,
    showJobStatusDropdown: false,
    showJobTicketDropdown: false,
    logFilter: { printerId: '', agentId: '', range: 'today' },
    logDeviceOptions: [{ _id: '', name: '全部设备' }],
    logDeviceLabel: '全部设备',
    showLogDeviceDropdown: false,
    showPrinterForm: false,
    printerForm: emptyPrinter(),
    showPrinterMore: false,
    printerMore: null,
    showStationForm: false,
    stationForm: { name: '', code: '', printerId: '', status: true, isDefault: false },
    showJobDetail: false,
    jobDetail: null,
    registration: null,
    showRegistration: false
  },

  onLoad(options = {}) {
    const settingsTab = SETTINGS_TAB_ITEMS.find(item => item.key === String(options.settings || ''))
    if (settingsTab) {
      this.setData({
        activeTab: 'settings',
        activeSettingsTab: settingsTab.key,
        settingsDetailMode: true
      })
      this.loadActiveTab()
      return
    }
    this.loadAll()
  },

  onShow() {
    if (this.data.activeTab === 'dashboard') this.loadDashboard()
  },

  async call(action, data) {
    return apiClient.call(action, data || {})
  },

  async loadAll() {
    this.setData({ loading: true, backendError: '' })
    try {
      await this.loadDashboard()
    } catch (error) {
      console.error('load print management failed', error)
      const message = error.message || ''
      const backendError = message.indexOf('unknown action') >= 0
        ? '云端 tenantApi 还是旧版本，尚未包含打印管理接口。请在微信开发者工具上传并部署 tenantApi 后重新编译。'
        : `打印管理数据暂时无法加载：${message || '请检查云函数和网络连接。'}`
      this.setData({ backendError })
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadDashboard() {
    const res = await this.call('admin.print.dashboard')
    const dashboard = res.data || this.data.dashboard
    const usbDevices = (dashboard.agents || []).reduce((list, agent) => list.concat((agent.usbDevices || []).map(device => ({ ...device, agentName: agent.name }))), [])
    this.setData({ dashboard, usbDevices })
  },

  async loadPrinters() {
    const res = await this.call('admin.print.printers.list')
    const printers = res.data || []
    const jobPrinterOptions = [{ _id: '', name: '全部打印机' }].concat(printers)
    const selectedPrinter = jobPrinterOptions.find(item => item._id === this.data.jobFilter.printerId)
    this.setData({
      printers,
      kitchenPrinters: printers.filter(item => item.usage === 'kitchen' || item.usage === 'both'),
      usbPrinterNames: printers.filter(item => item.connectionType === 'usb').map(item => item.name),
      jobPrinterOptions,
      jobPrinterLabel: selectedPrinter ? selectedPrinter.name : '全部打印机'
    })
  },

  async loadCashier() {
    const res = await this.call('admin.print.cashier.list')
    this.setData({ cashierConfigs: res.data || [] })
  },

  normalizeStations(stations, printers) {
    const printerMap = (printers || this.data.printers || []).reduce((map, printer) => {
      map[printer._id] = printer
      return map
    }, {})
    return (stations || []).map(station => {
      const printer = station.printer || printerMap[station.printerId] || null
      return {
        ...station,
        printer,
        printerName: station.printerName || (printer && printer.name) || '',
        bindingLabel: station.printerName || (printer && printer.name) || (station.printerId ? '已绑定的打印机已不存在' : '未绑定打印机')
      }
    })
  },

  async loadStations() {
    const res = await this.call('admin.print.stations.list')
    this.setData({ stations: this.normalizeStations(res.data) })
  },

  selectTemplate(templateId, templates) {
    const list = templates || this.data.templates
    const selected = list.find(item => item._id === templateId) || list[0]
    if (!selected) {
      this.setData({ selectedTemplateId: '', editTemplate: null, previewFields: [], selectedTemplateFieldName: '' })
      return
    }
    const editTemplate = clone(selected)
    const kitchenTicket = String(editTemplate.ticketType || '').indexOf('kitchen_') === 0
    const templateTestPrinters = this.data.printers.filter(printer => !kitchenTicket || printer.usage === 'kitchen' || printer.usage === 'both')
    const selectedTestPrinter = templateTestPrinters.find(printer => printer._id === editTemplate.printerId)
    this.setData({
      selectedTemplateId: selected._id,
      editTemplate,
      previewFields: makePreviewFields(editTemplate.fields, editTemplate),
      selectedTemplateFieldIndex: editTemplate.fields && editTemplate.fields.length ? 0 : -1,
      selectedTemplateFieldName: getTemplateFieldName(editTemplate.fields, 0),
      templateTestPrinters,
      templateTestPrinterId: selectedTestPrinter ? selectedTestPrinter._id : '',
      templateTestPrinterName: selectedTestPrinter ? selectedTestPrinter.name : '请选择要测试的打印机',
      showTemplateDropdown: false
    })
  },

  async loadTemplates() {
    const res = await this.call('admin.print.templates.list')
    const templates = res.data || []
    this.setData({ templates })
    const current = templates.some(item => item._id === this.data.selectedTemplateId) ? this.data.selectedTemplateId : (templates[0] && templates[0]._id)
    this.selectTemplate(current, templates)
  },

  async loadJobs(append) {
    const res = await this.call('admin.print.jobs.list', {
      ...this.data.jobFilter,
      pageSize: 30,
      cursor: append ? this.data.jobsNextCursor : ''
    })
    const page = Array.isArray(res.data) ? { list: res.data, hasMore: false, nextCursor: '' } : (res.data || {})
    const rows = (page.list || []).map(item => ({ ...item, displayTime: formatTime(item.createTime) }))
    this.setData({
      jobs: append ? this.data.jobs.concat(rows) : rows,
      jobsHasMore: !!page.hasMore,
      jobsNextCursor: page.nextCursor || ''
    })
  },

  async loadLogs(append) {
    const res = await this.call('admin.print.logs.list', {
      ...this.data.logFilter,
      pageSize: 30,
      cursor: append ? this.data.logsNextCursor : ''
    })
    const page = Array.isArray(res.data) ? { list: res.data, hasMore: false, nextCursor: '' } : (res.data || {})
    const deviceOptions = [{ _id: '', name: '全部设备' }].concat(
      (page.devices || []).filter(item => item && item._id && item.name)
    )
    const selectedDevice = deviceOptions.find(item => item._id === this.data.logFilter.agentId)
    const rows = (page.list || []).map(item => ({ ...item, displayTime: formatTime(item.createTime) }))
    this.setData({
      logs: append ? this.data.logs.concat(rows) : rows,
      logsHasMore: !!page.hasMore,
      logsNextCursor: page.nextCursor || '',
      logDeviceOptions: deviceOptions,
      logDeviceLabel: selectedDevice ? selectedDevice.name : '全部设备'
    })
  },

  async loadSettingsTab() {
    const tab = this.data.activeSettingsTab
    if (!tab) return
    if (tab === 'cashier') await Promise.all([this.loadPrinters(), this.loadCashier()])
    if (tab === 'stations') await this.loadStations()
    if (tab === 'templates') await Promise.all([this.loadPrinters(), this.loadStations(), this.loadTemplates()])
    if (tab === 'logs') await Promise.all([this.loadPrinters(), this.loadLogs()])
  },

  async loadActiveTab() {
    const tab = this.data.activeTab
    if (tab === 'dashboard') await this.loadDashboard()
    if (tab === 'printers') await this.loadPrinters()
    if (tab === 'jobs') await Promise.all([this.loadPrinters(), this.loadJobs()])
    if (tab === 'settings') await this.loadSettingsTab()
  },

  async switchTab(e) {
    const key = e.currentTarget.dataset.key
    this.setData(key === 'settings'
      ? { activeTab: key, activeSettingsTab: '' }
      : { activeTab: key })
    try {
      await this.loadActiveTab()
    } catch (err) {
      toast(err.message || '加载失败')
    }
  },

  async switchSettingsTab(e) {
    const key = e.currentTarget.dataset.key
    const settingsTab = SETTINGS_TAB_ITEMS.find(item => item.key === key)
    if (!settingsTab) return
    wx.navigateTo({
      url: '/packages/admin/pages/admin/printer/printer?settings=' + settingsTab.key
    })
  },

  goDishManager() {
    wx.navigateTo({ url: '/packages/admin/pages/admin/dish/dish' })
  },

  async openDashboardMetric(e) {
    const target = e.currentTarget.dataset.target
    try {
      if (target === 'printers') {
        this.setData({ activeTab: 'printers' })
        await this.loadPrinters()
        return
      }

      const status = target === 'queued' || target === 'failed' ? target : ''
      this.setData({
        activeTab: 'jobs',
        jobFilter: { printerId: '', ticketType: '', status, orderTail: '' },
        jobPrinterLabel: '全部打印机',
        jobStatusLabel: (JOB_STATUS_OPTIONS.find(item => item.key === status) || JOB_STATUS_OPTIONS[0]).label,
        jobTicketLabel: '全部票据',
        showJobPrinterDropdown: false,
        showJobStatusDropdown: false,
        showJobTicketDropdown: false
      })
      await Promise.all([this.loadPrinters(), this.loadJobs()])
    } catch (err) {
      toast(err.message || '加载打印任务失败')
    }
  },

  openPrinterForm(e) {
    const item = e && e.currentTarget.dataset.item
    this.setData({ showPrinterForm: true, printerForm: item ? clone(item) : emptyPrinter() })
  },

  closePrinterForm() {
    this.setData({ showPrinterForm: false })
  },

  onPrinterInput(e) {
    this.setData({ printerForm: setNested(this.data.printerForm, e.currentTarget.dataset.key, e.detail.value) })
  },

  onPrinterNumberInput(e) {
    this.setData({ printerForm: setNested(this.data.printerForm, e.currentTarget.dataset.key, Number(e.detail.value || 0)) })
  },

  onPrinterSwitch(e) {
    this.setData({ printerForm: setNested(this.data.printerForm, e.currentTarget.dataset.key, e.detail.value) })
  },

  onPrinterPick(e) {
    const key = e.currentTarget.dataset.key
    const options = this.data[e.currentTarget.dataset.options] || []
    this.setData({ printerForm: setNested(this.data.printerForm, key, options[Number(e.detail.value)]) })
  },

  setPrinterConnection(e) {
    this.setData({ printerForm: setNested(this.data.printerForm, 'connectionType', e.currentTarget.dataset.value) })
  },

  setPrinterUsage(e) {
    this.setData({ printerForm: setNested(this.data.printerForm, 'usage', e.currentTarget.dataset.value) })
  },

  bindUsbDevice(e) {
    const device = e.currentTarget.dataset.item || {}
    let printerForm = setNested(this.data.printerForm, 'usbBinding.vendorId', String(device.vendorId || ''))
    printerForm = setNested(printerForm, 'usbBinding.productId', String(device.productId || ''))
    printerForm = setNested(printerForm, 'usbBinding.deviceName', device.name || '')
    this.setData({ printerForm })
  },

  async savePrinter() {
    try {
      const res = await this.call('admin.print.printers.save', { printer: this.data.printerForm })
      if (res.success === false) throw new Error(res.message)
      this.closePrinterForm()
      await Promise.all([this.loadPrinters(), this.loadDashboard(), this.loadCashier(), this.loadStations()])
      toast('打印机已保存', 'success')
    } catch (err) {
      toast(err.message || '保存失败')
    }
  },

  async changePrinterStatus(e) {
    const item = e.currentTarget.dataset.item
    try {
      await this.call('admin.print.printers.status', { printerId: item._id, status: !item.status })
      await Promise.all([this.loadPrinters(), this.loadDashboard()])
      toast(item.status ? '打印机已停用' : '打印机已启用', 'success')
    } catch (err) { toast(err.message || '操作失败') }
  },

  openPrinterMore(e) {
    const printer = e.currentTarget.dataset.item || null
    const isCurrent = this.data.showPrinterMore && this.data.printerMore && printer && this.data.printerMore._id === printer._id
    this.setData({ showPrinterMore: !isCurrent, printerMore: isCurrent ? null : printer })
  },

  closePrinterMore() {
    this.setData({ showPrinterMore: false, printerMore: null })
  },

  setPrinterHardware(e) {
    this.closePrinterMore()
    const printer = e.currentTarget.dataset.item
    const choices = ['硬件正常', '疑似缺纸', '疑似开盖', '人工标记卡纸', '无法确认']
    const statuses = ['ok', 'paper_out', 'cover_open', 'jammed', 'unknown']
    wx.showActionSheet({
      itemList: choices,
      success: async result => {
        try {
          await this.call('admin.print.printers.hardwareStatus', {
            printerId: printer._id,
            hardwareStatus: statuses[result.tapIndex]
          })
          await Promise.all([this.loadPrinters(), this.loadLogs()])
          toast('硬件状态已更新', 'success')
        } catch (err) {
          const message = String(err.message || '')
          const backendOutdated = err.code === 'UNKNOWN_ACTION' || message.indexOf('unknown action') >= 0
          toast(backendOutdated ? '云端 tenantApi 尚未更新，请上传完整 tenantApi 后重试' : (message || '更新失败'))
        }
      }
    })
  },

  async confirmPrinterAction(e) {
    if (this.data.showPrinterMore) this.closePrinterMore()
    const { action, id, name } = e.currentTarget.dataset
    const actionMap = {
      test: { title: '打印测试单', content: '将创建真实打印任务，由平板代理发送。', api: 'admin.print.printers.test' },
      clear: { title: '清空未完成任务', content: '仅取消此打印机等待或正在发送的任务。', api: 'admin.print.printers.clearPending' },
      delete: { title: '删除打印机', content: '有活动任务时后端会拒绝删除。', api: 'admin.print.printers.delete' }
    }
    const config = actionMap[action]
    if (!config) return
    wx.showModal({
      title: config.title,
      content: `${name || ''}${config.content}`,
      success: async modal => {
        if (!modal.confirm) return
        try {
          await this.call(config.api, { printerId: id })
          await Promise.all([this.loadPrinters(), this.loadJobs(), this.loadDashboard()])
          toast(action === 'test' ? '测试任务已创建' : '操作完成', 'success')
        } catch (err) { toast(err.message || '操作失败') }
      }
    })
  },

  async saveCashier(e) {
    const config = e.currentTarget.dataset.item
    try {
      await this.call('admin.print.cashier.save', { config })
      await this.loadCashier()
      toast('收银配置已保存', 'success')
    } catch (err) { toast(err.message || '保存失败') }
  },

  onCashierSwitch(e) {
    const index = Number(e.currentTarget.dataset.index)
    const configs = clone(this.data.cashierConfigs)
    configs[index].enabled = e.detail.value
    this.setData({ cashierConfigs: configs })
  },

  onCashierCopies(e) {
    const index = Number(e.currentTarget.dataset.index)
    const configs = clone(this.data.cashierConfigs)
    configs[index].copies = Math.max(1, Math.min(9, Number(e.detail.value || 1)))
    this.setData({ cashierConfigs: configs })
  },

  onCashierPrinter(e) {
    const index = Number(e.currentTarget.dataset.index)
    const usbPrinters = this.data.printers.filter(item => item.connectionType === 'usb')
    const configs = clone(this.data.cashierConfigs)
    const printer = usbPrinters[Number(e.detail.value)] || null
    configs[index].printerId = printer ? printer._id : ''
    configs[index].printer = printer
    this.setData({ cashierConfigs: configs })
  },

  getUsbPrinterNames() {
    return this.data.printers.filter(item => item.connectionType === 'usb').map(item => item.name)
  },

  openStationForm(e) {
    const station = e && e.currentTarget.dataset.item
    const printerMap = (this.data.kitchenPrinters || []).reduce((map, printer) => {
      map[printer._id] = printer
      return map
    }, {})
    const selectedPrinter = station && (station.printer || printerMap[station.printerId])
    const printerIndex = selectedPrinter
      ? this.data.kitchenPrinters.findIndex(printer => printer._id === selectedPrinter._id)
      : -1
    const stationForm = station
      ? {
          ...clone(station),
          printerId: selectedPrinter ? selectedPrinter._id : '',
          printerName: selectedPrinter ? selectedPrinter.name : '',
          printer: selectedPrinter || null,
          printerIndex
        }
      : { name: '', code: '', printerId: '', printerName: '', printer: null, printerIndex: -1, status: true, isDefault: false }
    this.setData({ showStationForm: true, stationForm })
  },

  closeStationForm() { this.setData({ showStationForm: false }) },

  onStationInput(e) { this.setData({ stationForm: setNested(this.data.stationForm, e.currentTarget.dataset.key, e.detail.value) }) },
  onStationSwitch(e) { this.setData({ stationForm: setNested(this.data.stationForm, e.currentTarget.dataset.key, e.detail.value) }) },
  onStationPrinter(e) {
    const printerIndex = Number(e.detail.value)
    const printer = this.data.kitchenPrinters[printerIndex]
    const stationForm = setNested(this.data.stationForm, 'printerId', printer ? printer._id : '')
    stationForm.printerName = printer ? printer.name : ''
    stationForm.printer = printer || null
    stationForm.printerIndex = printer ? printerIndex : -1
    this.setData({ stationForm })
  },

  async saveStation() {
    const station = this.data.stationForm || {}
    if (!station.printerId) {
      toast('请先选择要绑定的后厨打印机')
      return
    }
    try {
      const res = await this.call('admin.print.stations.save', { station })
      if (res.success === false) throw new Error(res.message || '保存失败')
      if (!res.data || !res.data.printerId) {
        throw new Error('云端未保存打印机绑定，请更新完整 tenantApi 后重试')
      }
      this.closeStationForm()
      await Promise.all([this.loadStations(), this.loadDashboard()])
      toast('档口已保存', 'success')
    } catch (err) { toast(err.message || '保存失败') }
  },

  toggleTemplateDropdown() {
    this.setData({
      showTemplateDropdown: !this.data.showTemplateDropdown,
      showJobPrinterDropdown: false,
      showJobStatusDropdown: false,
      showJobTicketDropdown: false,
      showLogDeviceDropdown: false,
      showPrinterMore: false
    })
  },

  selectTemplateOption(e) {
    const template = this.data.templates[Number(e.currentTarget.dataset.index)]
    if (!template) return
    this.selectTemplate(template._id)
  },

  addTemplateField(e) {
    if (!this.data.editTemplate) return
    const source = e.currentTarget.dataset.item
    const template = clone(this.data.editTemplate)
    template.fields = template.fields || []
    template.fields.push({ id: `${source.key}-${Date.now()}`, key: source.key, label: source.label, size: 'normal', align: 'left', bold: false, inverse: false, color: 'black', dividerAfter: false, blankBefore: false })
    this.setData({
      editTemplate: template,
      previewFields: makePreviewFields(template.fields, template),
      selectedTemplateFieldIndex: template.fields.length - 1,
      selectedTemplateFieldName: getTemplateFieldName(template.fields, template.fields.length - 1)
    })
  },

  selectTemplateField(e) {
    const index = Number(e.currentTarget.dataset.index)
    this.setData({
      selectedTemplateFieldIndex: index,
      selectedTemplateFieldName: getTemplateFieldName(this.data.editTemplate && this.data.editTemplate.fields, index)
    })
  },

  updateTemplateField(path, value) {
    const index = this.data.selectedTemplateFieldIndex
    if (!this.data.editTemplate || index < 0) return
    const template = clone(this.data.editTemplate)
    const prefix = `fields.${index}.${path}`
    const next = setNested(template, prefix, value)
    this.setData({
      editTemplate: next,
      previewFields: makePreviewFields(next.fields, next),
      selectedTemplateFieldName: getTemplateFieldName(next.fields, index)
    })
  },

  onTemplateFieldSwitch(e) { this.updateTemplateField(e.currentTarget.dataset.key, e.detail.value) },
  onTemplateFieldPicker(e) {
    const options = this.data[e.currentTarget.dataset.options] || []
    this.updateTemplateField(e.currentTarget.dataset.key, options[Number(e.detail.value)])
  },

  moveTemplateField(e) {
    const direction = Number(e.currentTarget.dataset.direction)
    const current = this.data.selectedTemplateFieldIndex
    const target = current + direction
    if (!this.data.editTemplate || target < 0 || target >= this.data.editTemplate.fields.length) return
    const template = clone(this.data.editTemplate)
    const field = template.fields.splice(current, 1)[0]
    template.fields.splice(target, 0, field)
    this.setData({
      editTemplate: template,
      previewFields: makePreviewFields(template.fields, template),
      selectedTemplateFieldIndex: target,
      selectedTemplateFieldName: getTemplateFieldName(template.fields, target)
    })
  },

  deleteTemplateField() {
    const current = this.data.selectedTemplateFieldIndex
    if (!this.data.editTemplate || current < 0) return
    const template = clone(this.data.editTemplate)
    template.fields.splice(current, 1)
    const nextIndex = template.fields.length ? Math.max(0, current - 1) : -1
    this.setData({
      editTemplate: template,
      previewFields: makePreviewFields(template.fields, template),
      selectedTemplateFieldIndex: nextIndex,
      selectedTemplateFieldName: getTemplateFieldName(template.fields, nextIndex)
    })
  },

  onTemplatePaper(e) {
    const width = Number(this.data.paperOptions[Number(e.detail.value)])
    const template = setNested(this.data.editTemplate, 'paperWidth', width)
    this.setData({ editTemplate: template })
  },

  onTemplateBindingScope(e) {
    const bindScope = this.data.templateBindingScopes[Number(e.detail.value)] || 'global'
    if (bindScope === 'station' && String(this.data.editTemplate.ticketType || '').indexOf('kitchen_') !== 0) {
      toast('只有后厨票据可以按档口配置')
      return
    }
    const template = clone(this.data.editTemplate)
    template.bindScope = bindScope
    if (bindScope !== 'station') template.stationId = ''
    if (bindScope !== 'printer') template.printerId = ''
    this.setData({ editTemplate: template })
  },

  onTemplateStation(e) {
    const station = this.data.stations[Number(e.detail.value)]
    let template = setNested(this.data.editTemplate, 'stationId', station ? station._id : '')
    template = setNested(template, 'stationName', station ? station.name : '')
    this.setData({ editTemplate: template })
  },

  onTemplatePrinter(e) {
    const printer = this.data.templateTestPrinters[Number(e.detail.value)]
    let template = setNested(this.data.editTemplate, 'printerId', printer ? printer._id : '')
    template = setNested(template, 'printerName', printer ? printer.name : '')
    this.setData({ editTemplate: template })
  },

  onTemplateTestPrinter(e) {
    const printer = this.data.templateTestPrinters[Number(e.detail.value)]
    this.setData({
      templateTestPrinterId: printer ? printer._id : '',
      templateTestPrinterName: printer ? printer.name : '请选择要测试的打印机'
    })
  },

  async saveTemplate() {
    if (!this.data.editTemplate) return
    try {
      const res = await this.call('admin.print.templates.save', { template: this.data.editTemplate })
      await this.loadTemplates()
      if (res.data && res.data._id) this.selectTemplate(res.data._id)
      toast('票据模板已保存', 'success')
    } catch (err) { toast(err.message || '模板保存失败') }
  },

  async templateAction(e) {
    const action = e.currentTarget.dataset.action
    const template = this.data.editTemplate
    if (!template) return
    try {
      if (action === 'test') {
        if (!this.data.templateTestPrinterId) {
          toast('请先选择要测试的具体打印机')
          return
        }
        await this.call('admin.print.templates.test', {
          templateId: template._id,
          ticketType: template.ticketType,
          stationId: template.stationId || '',
          printerId: this.data.templateTestPrinterId
        })
      }
      if (action === 'reset') await this.call('admin.print.templates.reset', { templateId: template._id, ticketType: template.ticketType })
      if (action === 'history') {
        const res = await this.call('admin.print.templates.history', { templateId: template._id, ticketType: template.ticketType })
        const templateHistory = (res.data || []).slice(0, 20).map(item => ({
          _id: item._id,
          version: item.version || 1,
          time: formatTime(item.createTime),
          reason: item.reason === 'reset' ? '恢复默认前' : '保存前',
          fields: clone(item.fields || []),
          selected: false
        }))
        this._lastTemplateHistoryTap = null
        this.setData({ showTemplateHistory: true, templateHistory, selectedTemplateHistoryIds: [] })
        return
      }
      await this.loadTemplates()
      toast(action === 'test' ? '模板测试任务已创建' : '已恢复默认模板', 'success')
    } catch (err) { toast(err.message || '操作失败') }
  },

  onJobFilterInput(e) {
    this.setData({ jobFilter: setNested(this.data.jobFilter, e.currentTarget.dataset.key, e.detail.value) })
  },

  closeTemplateHistory() {
    this._lastTemplateHistoryTap = null
    this.setData({ showTemplateHistory: false, selectedTemplateHistoryIds: [] })
  },

  onTemplateHistoryTap(e) {
    const versionId = e.currentTarget.dataset.id
    const item = this.data.templateHistory.find(history => history._id === versionId)
    if (!item) return
    const timestamp = Date.now()
    const previous = this._lastTemplateHistoryTap
    this._lastTemplateHistoryTap = { versionId, timestamp }
    if (previous && previous.versionId === versionId && timestamp - previous.timestamp < 360) {
      const template = clone(this.data.editTemplate)
      template.fields = clone(item.fields || [])
      this._lastTemplateHistoryTap = null
      this.setData({
        editTemplate: template,
        previewFields: makePreviewFields(template.fields, template),
        selectedTemplateFieldIndex: -1,
        selectedTemplateFieldName: '',
        showTemplateHistory: false,
        selectedTemplateHistoryIds: []
      })
      toast(`已载入 v${item.version}，请保存模板`, 'success')
      return
    }

    const selected = this.data.selectedTemplateHistoryIds.slice()
    const index = selected.indexOf(versionId)
    if (index >= 0) selected.splice(index, 1)
    else selected.push(versionId)
    this.setData({
      selectedTemplateHistoryIds: selected,
      templateHistory: this.data.templateHistory.map(history => ({
        ...history,
        selected: selected.includes(history._id)
      }))
    })
  },

  deleteSelectedTemplateHistory() {
    const versionIds = this.data.selectedTemplateHistoryIds
    const template = this.data.editTemplate
    if (!template || !versionIds.length) {
      toast('请先选择要删除的历史版本')
      return
    }
    wx.showModal({
      title: '删除历史版本',
      content: `确定删除已选择的 ${versionIds.length} 个历史版本吗？`,
      success: async result => {
        if (!result.confirm) return
        try {
          const res = await this.call('admin.print.templates.history.delete', {
            templateId: template._id,
            versionIds
          })
          const deleted = Number(res.data && res.data.deleted || 0)
          const selected = new Set(versionIds)
          this.setData({
            templateHistory: this.data.templateHistory
              .filter(item => !selected.has(item._id))
              .map(item => ({ ...item, selected: false })),
            selectedTemplateHistoryIds: []
          })
          toast(`已删除 ${deleted} 个历史版本`, 'success')
        } catch (err) {
          toast(err.message || '删除历史版本失败')
        }
      }
    })
  },
  closeJobDropdowns() {
    if (this.data.showJobPrinterDropdown || this.data.showJobStatusDropdown || this.data.showJobTicketDropdown || this.data.showLogDeviceDropdown || this.data.showTemplateDropdown || this.data.showPrinterMore) {
      this.setData({
        showJobPrinterDropdown: false,
        showJobStatusDropdown: false,
        showJobTicketDropdown: false,
        showLogDeviceDropdown: false,
        showTemplateDropdown: false,
        showPrinterMore: false,
        printerMore: null
      })
    }
  },
  toggleJobPrinterDropdown() {
    this.setData({
      showJobPrinterDropdown: !this.data.showJobPrinterDropdown,
      showJobStatusDropdown: false,
      showJobTicketDropdown: false,
      showTemplateDropdown: false
    })
  },
  toggleJobTicketDropdown() {
    this.setData({
      showJobPrinterDropdown: false,
      showJobStatusDropdown: false,
      showJobTicketDropdown: !this.data.showJobTicketDropdown,
      showTemplateDropdown: false
    })
  },
  toggleJobStatusDropdown() {
    this.setData({
      showJobPrinterDropdown: false,
      showJobStatusDropdown: !this.data.showJobStatusDropdown,
      showJobTicketDropdown: false,
      showTemplateDropdown: false
    })
  },
  selectJobPrinterOption(e) {
    const item = this.data.jobPrinterOptions[Number(e.currentTarget.dataset.index)] || this.data.jobPrinterOptions[0]
    this.setData({
      jobFilter: setNested(this.data.jobFilter, 'printerId', item._id || ''),
      jobPrinterLabel: item.name || '全部打印机',
      showJobPrinterDropdown: false
    })
    this.loadJobs()
  },
  selectJobTicketOption(e) {
    const item = TICKET_TYPE_OPTIONS[Number(e.currentTarget.dataset.index)] || TICKET_TYPE_OPTIONS[0]
    this.setData({
      jobFilter: setNested(this.data.jobFilter, 'ticketType', item.key),
      jobTicketLabel: item.label || '全部票据',
      showJobTicketDropdown: false
    })
    this.loadJobs()
  },
  selectJobStatusOption(e) {
    const item = JOB_STATUS_OPTIONS[Number(e.currentTarget.dataset.index)] || JOB_STATUS_OPTIONS[0]
    this.setData({
      jobFilter: setNested(this.data.jobFilter, 'status', item.key),
      jobStatusLabel: item.label || '全部状态',
      showJobStatusDropdown: false
    })
    this.loadJobs()
  },
  resetJobFilters() {
    this.setData({
      jobFilter: {
        printerId: '',
        ticketType: '',
        status: '',
        orderTail: this.data.jobFilter.orderTail || ''
      },
      jobPrinterLabel: '全部打印机',
      jobStatusLabel: '全部状态',
      jobTicketLabel: '全部票据',
      showJobPrinterDropdown: false,
      showJobStatusDropdown: false,
      showJobTicketDropdown: false
    })
    this.loadJobs()
  },
  loadMoreJobs() { if (this.data.jobsHasMore) this.loadJobs(true) },

  async openJob(e) {
    try {
      const res = await this.call('admin.print.jobs.detail', { jobId: e.currentTarget.dataset.id })
      this.setData({ showJobDetail: true, jobDetail: res.data || null })
    } catch (err) { toast(err.message || '任务读取失败') }
  },
  closeJob() { this.setData({ showJobDetail: false, jobDetail: null }) },
  async jobAction(e) {
    const { action, id } = e.currentTarget.dataset
    try {
      await this.call(action === 'reprint' ? 'admin.print.jobs.reprint' : 'admin.print.jobs.cancel', { jobId: id })
      this.closeJob()
      await Promise.all([this.loadJobs(), this.loadDashboard()])
      toast(action === 'reprint' ? '已创建新的补打任务' : '任务已取消', 'success')
    } catch (err) { toast(err.message || '操作失败') }
  },

  onLogPrinterFilter(e) {
    const printer = this.data.printers[Number(e.detail.value)]
    this.setData({ logFilter: setNested(this.data.logFilter, 'printerId', printer ? printer._id : '') })
    this.loadLogs()
  },
  toggleLogDeviceDropdown() {
    this.setData({
      showLogDeviceDropdown: !this.data.showLogDeviceDropdown,
      showJobPrinterDropdown: false,
      showJobTicketDropdown: false,
      showTemplateDropdown: false
    })
  },
  selectLogDeviceOption(e) {
    const item = this.data.logDeviceOptions[Number(e.currentTarget.dataset.index)] || this.data.logDeviceOptions[0]
    this.setData({
      logFilter: setNested(this.data.logFilter, 'agentId', item._id || ''),
      logDeviceLabel: item.name || '全部设备',
      showLogDeviceDropdown: false
    })
    this.loadLogs()
  },
  setLogRange(e) { this.setData({ logFilter: setNested(this.data.logFilter, 'range', e.currentTarget.dataset.range) }); this.loadLogs() },
  loadMoreLogs() { if (this.data.logsHasMore) this.loadLogs(true) },
  clearLogs() {
    wx.showModal({ title: '清空当前日志页', content: '一次最多删除当前筛选下的 100 条日志；较早日志建议使用“归档90天前”。', success: async modal => {
      if (!modal.confirm) return
      try {
        const res = await this.call('admin.print.logs.clear', {
          printerId: this.data.logFilter.printerId,
          agentId: this.data.logFilter.agentId
        })
        await this.loadLogs()
        const data = res.data || {}
        toast(data.hasMore ? `已清空 ${data.removed || 0} 条，本筛选下仍有更多日志` : `已清空 ${data.removed || 0} 条`, 'success')
      } catch (err) { toast(err.message || '清空失败') }
    } })
  },

  archiveHistory() {
    wx.showModal({
      title: '归档历史数据',
      content: '将归档 90 天前的已发送、失败或已取消任务与日志，不影响当前未完成任务。',
      success: async modal => {
        if (!modal.confirm) return
        try {
          const res = await this.call('admin.print.history.archive', { retentionDays: 90, limit: 500 })
          await Promise.all([this.loadJobs(), this.loadLogs()])
          const data = res.data || {}
          toast('已归档 ' + (data.archivedJobs || 0) + ' 任务 / ' + (data.archivedLogs || 0) + ' 日志' + (data.hasMore ? '，可再次归档剩余历史' : ''), 'success')
        } catch (err) { toast(err.message || '归档失败') }
      }
    })
  },

  async createRegistration() {
    try {
      const res = await this.call('admin.print.agents.createRegistration', { name: '店内安卓打印平板' })
      this.setData({ registration: res.data || null, showRegistration: true })
    } catch (err) { toast(err.message || '无法创建注册码') }
  },
  closeRegistration() { this.setData({ showRegistration: false }) },

  stopPropagation() {}
})
