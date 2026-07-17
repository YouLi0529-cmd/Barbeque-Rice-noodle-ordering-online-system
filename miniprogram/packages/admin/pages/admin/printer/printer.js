const apiClient = require('../../../../../utils/apiClient')

const TAB_ITEMS = [
  { key: 'dashboard', label: '打印中心' },
  { key: 'printers', label: '打印机' },
  { key: 'cashier', label: '收银配置' },
  { key: 'stations', label: '出品档口' },
  { key: 'dishes', label: '菜品路由' },
  { key: 'templates', label: '票据样式' },
  { key: 'jobs', label: '打印任务' },
  { key: 'logs', label: '操作日志' }
]

const FEATURE_ITEMS = [
  { key: 'printers', title: '打印机管理', desc: '网口、USB、测试单和连接状态' },
  { key: 'cashier', title: '收银打印配置', desc: '客单、预结、结账、退单' },
  { key: 'stations', title: '后厨出品档口', desc: '逻辑档口与物理打印机绑定' },
  { key: 'dishes', title: '菜品打印配置', desc: '按菜品配置出品档口' },
  { key: 'templates', title: '票据样式设置', desc: '模板、预览、版本记录和测试' },
  { key: 'jobs', title: '打印任务', desc: '查看、补打、取消与票据预览' },
  { key: 'logs', title: '打印机操作日志', desc: '连接、断开、USB和错误事件' }
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
  { key: 'kitchen_order', label: '制作单' }
]
const FIELD_LIBRARY = [
  { key: 'title', label: '票据名称', sample: '结账单' },
  { key: 'shopName', label: '店铺名称', sample: '张南火盆烧烤' },
  { key: 'banquetName', label: '宴会名称', sample: '生日宴' },
  { key: 'tableNumber', label: '桌号', sample: 'A01' },
  { key: 'tableInfo', label: '桌台信息', sample: '一楼大厅' },
  { key: 'orderNumber', label: '订单号', sample: 'ORD-20260713-001' },
  { key: 'customData', label: '自定义数据', sample: '会员到店' },
  { key: 'peopleCount', label: '人数', sample: '4人' },
  { key: 'seatCount', label: '席数', sample: '1席' },
  { key: 'orderType', label: '订单类型', sample: '堂食' },
  { key: 'openingRemark', label: '开台备注', sample: '靠窗' },
  { key: 'dishes', label: '菜品明细', sample: '五花肉 x2\n金针菇 x1' },
  { key: 'orderRemark', label: '整单备注', sample: '少辣' },
  { key: 'totalCount', label: '数量合计', sample: '共3份' },
  { key: 'totalPrice', label: '订单价格', sample: '¥88.00' },
  { key: 'orderTime', label: '下单时间', sample: '2026-07-13 12:30' },
  { key: 'customImage', label: '自定义图片', sample: '[图片]' },
  { key: 'customText', label: '自定义文字', sample: '欢迎光临' }
]

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

function makePreviewFields(fields) {
  return (fields || []).map((field, index) => {
    const source = FIELD_LIBRARY.find(item => item.key === field.key) || {}
    return { ...field, index, label: field.label || source.label || field.key, text: source.sample || field.key }
  })
}

Page({
  data: {
    tabs: TAB_ITEMS,
    features: FEATURE_ITEMS,
    activeTab: 'dashboard',
    loading: false,
    backendError: '',
    dashboard: { agentOnline: false, agents: [], printers: [], metrics: { queued: 0, failed: 0, unassigned: 0 }, alerts: [] },
    printers: [],
    usbPrinterNames: [],
    usbDevices: [],
    cashierConfigs: [],
    stations: [],
    dishes: [],
    categories: [],
    categoryOptions: [{ _id: '', name: '所有分类' }],
    templates: [],
    jobs: [],
    logs: [],
    brandOptions: BRAND_OPTIONS,
    paperOptions: PAPER_OPTIONS,
    resolutionOptions: RESOLUTION_OPTIONS,
    ticketTypeOptions: TICKET_TYPE_OPTIONS,
    sizeOptions: ['normal', 'medium', 'large', 'xlarge'],
    sizeLabels: ['正常', '中号', '大号', '加大号'],
    alignOptions: ['left', 'center', 'right'],
    alignLabels: ['左对齐', '居中', '右对齐'],
    colorOptions: ['black', 'red'],
    colorLabels: ['黑色', '红色'],
    fieldLibrary: FIELD_LIBRARY,
    dishKeyword: '',
    dishCategoryId: '',
    dishUnassignedOnly: false,
    selectedDishIds: [],
    selectedTemplateId: '',
    editTemplate: null,
    previewFields: [],
    selectedTemplateFieldIndex: -1,
    jobFilter: { printerId: '', ticketType: '', deviceName: '', orderTail: '' },
    logFilter: { printerId: '', range: 'today' },
    showPrinterForm: false,
    printerForm: emptyPrinter(),
    showStationForm: false,
    stationForm: { name: '', code: '', printerId: '', status: true, isDefault: false },
    showRouteForm: false,
    routeForm: { printEnabled: true, stationId: '' },
    showJobDetail: false,
    jobDetail: null,
    registration: null,
    showRegistration: false
  },

  onLoad() {
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
    this.setData({
      printers,
      usbPrinterNames: printers.filter(item => item.connectionType === 'usb').map(item => item.name)
    })
  },

  async loadCashier() {
    const res = await this.call('admin.print.cashier.list')
    this.setData({ cashierConfigs: res.data || [] })
  },

  async loadStations() {
    const res = await this.call('admin.print.stations.list')
    this.setData({ stations: res.data || [] })
  },

  async loadDishes() {
    const res = await this.call('admin.print.dishes.list', {
      keyword: this.data.dishKeyword,
      categoryId: this.data.dishCategoryId,
      unassignedOnly: this.data.dishUnassignedOnly
    })
    const data = res.data || {}
    const selected = this.data.selectedDishIds
    const categories = data.categories || []
    this.setData({
      dishes: (data.list || []).map(item => ({ ...item, selected: selected.indexOf(item.dishId) >= 0 })),
      categories,
      categoryOptions: [{ _id: '', name: '所有分类' }].concat(categories),
      stations: data.stations || this.data.stations
    })
  },

  selectTemplate(templateId, templates) {
    const list = templates || this.data.templates
    const selected = list.find(item => item._id === templateId) || list[0]
    if (!selected) {
      this.setData({ selectedTemplateId: '', editTemplate: null, previewFields: [] })
      return
    }
    const editTemplate = clone(selected)
    this.setData({
      selectedTemplateId: selected._id,
      editTemplate,
      previewFields: makePreviewFields(editTemplate.fields),
      selectedTemplateFieldIndex: editTemplate.fields && editTemplate.fields.length ? 0 : -1
    })
  },

  async loadTemplates() {
    const res = await this.call('admin.print.templates.list')
    const templates = res.data || []
    this.setData({ templates })
    const current = templates.some(item => item._id === this.data.selectedTemplateId) ? this.data.selectedTemplateId : (templates[0] && templates[0]._id)
    this.selectTemplate(current, templates)
  },

  async loadJobs() {
    const res = await this.call('admin.print.jobs.list', this.data.jobFilter)
    this.setData({ jobs: (res.data || []).map(item => ({ ...item, displayTime: formatTime(item.createTime) })) })
  },

  async loadLogs() {
    const res = await this.call('admin.print.logs.list', this.data.logFilter)
    this.setData({ logs: (res.data || []).map(item => ({ ...item, displayTime: formatTime(item.createTime) })) })
  },

  async refreshCurrent() {
    this.setData({ loading: true })
    try {
      const tab = this.data.activeTab
      if (tab === 'dashboard') await this.loadDashboard()
      if (tab === 'printers') await this.loadPrinters()
      if (tab === 'cashier') await this.loadCashier()
      if (tab === 'stations') await this.loadStations()
      if (tab === 'dishes') await this.loadDishes()
      if (tab === 'templates') await this.loadTemplates()
      if (tab === 'jobs') await this.loadJobs()
      if (tab === 'logs') await this.loadLogs()
      toast('已刷新', 'success')
    } catch (err) {
      toast(err.message || '刷新失败')
    } finally {
      this.setData({ loading: false })
    }
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ activeTab: key })
  },

  goFeature(e) {
    this.setData({ activeTab: e.currentTarget.dataset.key })
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

  async confirmPrinterAction(e) {
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
    this.setData({ showStationForm: true, stationForm: station ? clone(station) : { name: '', code: '', printerId: '', status: true, isDefault: false } })
  },

  closeStationForm() { this.setData({ showStationForm: false }) },

  onStationInput(e) { this.setData({ stationForm: setNested(this.data.stationForm, e.currentTarget.dataset.key, e.detail.value) }) },
  onStationSwitch(e) { this.setData({ stationForm: setNested(this.data.stationForm, e.currentTarget.dataset.key, e.detail.value) }) },
  onStationPrinter(e) {
    const printer = this.data.printers[Number(e.detail.value)]
    const stationForm = setNested(this.data.stationForm, 'printerId', printer ? printer._id : '')
    stationForm.printer = printer || null
    this.setData({ stationForm })
  },

  async saveStation() {
    try {
      await this.call('admin.print.stations.save', { station: this.data.stationForm })
      this.closeStationForm()
      await Promise.all([this.loadStations(), this.loadDishes(), this.loadDashboard()])
      toast('档口已保存', 'success')
    } catch (err) { toast(err.message || '保存失败') }
  },

  onDishKeyword(e) { this.setData({ dishKeyword: e.detail.value }) },
  async searchDishes() { try { await this.loadDishes() } catch (err) { toast(err.message || '查询失败') } },
  async toggleUnassigned() { this.setData({ dishUnassignedOnly: !this.data.dishUnassignedOnly }); await this.searchDishes() },
  onDishCategory(e) {
    const index = Number(e.detail.value)
    const category = this.data.categoryOptions[index]
    this.setData({ dishCategoryId: category ? category._id : '' })
    this.searchDishes()
  },

  toggleDishSelect(e) {
    const dishId = e.currentTarget.dataset.id
    const selected = this.data.selectedDishIds.slice()
    const index = selected.indexOf(dishId)
    if (index >= 0) selected.splice(index, 1)
    else selected.push(dishId)
    this.setData({ selectedDishIds: selected, dishes: this.data.dishes.map(item => ({ ...item, selected: selected.indexOf(item.dishId) >= 0 })) })
  },

  openRouteForm(e) {
    const dishId = e && e.currentTarget.dataset.id
    const dish = this.data.dishes.find(item => item.dishId === dishId)
    const selectedDishIds = dish ? [dish.dishId] : this.data.selectedDishIds
    if (!selectedDishIds.length) { toast('请先选择要配置的菜品'); return }
    this.setData({
      showRouteForm: true,
      selectedDishIds,
      routeForm: { printEnabled: dish ? dish.printEnabled : true, stationId: dish ? dish.stationId : '' }
    })
  },

  closeRouteForm() { this.setData({ showRouteForm: false }) },
  onRouteSwitch(e) { this.setData({ routeForm: setNested(this.data.routeForm, 'printEnabled', e.detail.value) }) },
  onRouteStation(e) {
    const station = this.data.stations[Number(e.detail.value)]
    this.setData({ routeForm: setNested(this.data.routeForm, 'stationId', station ? station._id : '') })
  },

  async saveRoutes() {
    try {
      await this.call('admin.print.dishes.save', { dishIds: this.data.selectedDishIds, ...this.data.routeForm })
      this.closeRouteForm()
      this.setData({ selectedDishIds: [] })
      await Promise.all([this.loadDishes(), this.loadDashboard()])
      toast('菜品出品档口已保存', 'success')
    } catch (err) { toast(err.message || '保存失败') }
  },

  chooseTemplate(e) { this.selectTemplate(e.currentTarget.dataset.id) },

  addTemplateField(e) {
    if (!this.data.editTemplate) return
    const source = e.currentTarget.dataset.item
    const template = clone(this.data.editTemplate)
    template.fields = template.fields || []
    template.fields.push({ id: `${source.key}-${Date.now()}`, key: source.key, label: source.label, size: 'normal', align: 'left', bold: false, inverse: false, color: 'black', dividerAfter: false, blankBefore: false })
    this.setData({ editTemplate: template, previewFields: makePreviewFields(template.fields), selectedTemplateFieldIndex: template.fields.length - 1 })
  },

  selectTemplateField(e) { this.setData({ selectedTemplateFieldIndex: Number(e.currentTarget.dataset.index) }) },

  updateTemplateField(path, value) {
    const index = this.data.selectedTemplateFieldIndex
    if (!this.data.editTemplate || index < 0) return
    const template = clone(this.data.editTemplate)
    const prefix = `fields.${index}.${path}`
    const next = setNested(template, prefix, value)
    this.setData({ editTemplate: next, previewFields: makePreviewFields(next.fields) })
  },

  onTemplateFieldInput(e) { this.updateTemplateField(e.currentTarget.dataset.key, e.detail.value) },
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
    this.setData({ editTemplate: template, previewFields: makePreviewFields(template.fields), selectedTemplateFieldIndex: target })
  },

  deleteTemplateField() {
    const current = this.data.selectedTemplateFieldIndex
    if (!this.data.editTemplate || current < 0) return
    const template = clone(this.data.editTemplate)
    template.fields.splice(current, 1)
    this.setData({ editTemplate: template, previewFields: makePreviewFields(template.fields), selectedTemplateFieldIndex: Math.max(0, current - 1) })
  },

  onTemplatePaper(e) {
    const width = Number(this.data.paperOptions[Number(e.detail.value)])
    const template = setNested(this.data.editTemplate, 'paperWidth', width)
    this.setData({ editTemplate: template })
  },

  async saveTemplate() {
    if (!this.data.editTemplate) return
    try {
      await this.call('admin.print.templates.save', { template: this.data.editTemplate })
      await this.loadTemplates()
      toast('票据模板已保存', 'success')
    } catch (err) { toast(err.message || '模板保存失败') }
  },

  async templateAction(e) {
    const action = e.currentTarget.dataset.action
    const template = this.data.editTemplate
    if (!template) return
    try {
      if (action === 'test') await this.call('admin.print.templates.test', { ticketType: template.ticketType })
      if (action === 'reset') await this.call('admin.print.templates.reset', { ticketType: template.ticketType })
      if (action === 'history') {
        const res = await this.call('admin.print.templates.history', { ticketType: template.ticketType })
        const latest = (res.data || []).slice(0, 5).map(item => `v${item.version} ${formatTime(item.createTime)}`).join('\n') || '暂无历史版本'
        wx.showModal({ title: '模板版本', content: latest, showCancel: false })
        return
      }
      await this.loadTemplates()
      toast(action === 'test' ? '模板测试任务已创建' : '已恢复默认模板', 'success')
    } catch (err) { toast(err.message || '操作失败') }
  },

  onJobFilterInput(e) {
    this.setData({ jobFilter: setNested(this.data.jobFilter, e.currentTarget.dataset.key, e.detail.value) })
  },
  onJobPrinterFilter(e) {
    const printer = this.data.printers[Number(e.detail.value)]
    this.setData({ jobFilter: setNested(this.data.jobFilter, 'printerId', printer ? printer._id : '') })
    this.loadJobs()
  },
  onJobTicketFilter(e) {
    const item = TICKET_TYPE_OPTIONS[Number(e.detail.value)] || TICKET_TYPE_OPTIONS[0]
    this.setData({ jobFilter: setNested(this.data.jobFilter, 'ticketType', item.key) })
    this.loadJobs()
  },
  clearJobFilter() { this.setData({ jobFilter: { printerId: '', ticketType: '', deviceName: '', orderTail: '' } }); this.loadJobs() },

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
  setLogRange(e) { this.setData({ logFilter: setNested(this.data.logFilter, 'range', e.currentTarget.dataset.range) }); this.loadLogs() },
  clearLogs() {
    wx.showModal({ title: '清空日志', content: '将删除当前打印机筛选下的操作日志。', success: async modal => {
      if (!modal.confirm) return
      try { await this.call('admin.print.logs.clear', { printerId: this.data.logFilter.printerId }); await this.loadLogs(); toast('日志已清空', 'success') } catch (err) { toast(err.message || '清空失败') }
    } })
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
