const crypto = require('crypto')

const PRINT_COLLECTIONS = [
  'printers',
  'printerAgents',
  'printStations',
  'dishPrintRoutes',
  'cashierPrintConfigs',
  'receiptTemplates',
  'receiptTemplateVersions',
  'printJobs',
  'printerEventLogs',
  'printConfigAuditLogs',
  'unassignedDishAlerts'
]

const JOB_STATUS = {
  queued: 'queued',
  claimed: 'claimed',
  sending: 'sending',
  printed: 'printed',
  failed: 'failed',
  cancelled: 'cancelled'
}

const ACTIVE_JOB_STATUS = [JOB_STATUS.queued, JOB_STATUS.claimed, JOB_STATUS.sending]
const ONLINE_WINDOW_MS = 90 * 1000

function isEmptyValue(value) {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

function valueOf(item, keys) {
  for (const key of keys) {
    const value = item && item[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim()
  }
  return ''
}

function mergeKitchenDishes(entries = []) {
  const groups = new Map()
  entries.forEach(entry => {
    const item = entry.item || entry || {}
    const dishId = valueOf(item, ['dishId', '_id', 'id'])
    const specification = valueOf(item, ['specification', 'spec', 'skuName'])
    const method = valueOf(item, ['cookingMethod', 'method', 'practice'])
    const taste = valueOf(item, ['taste', 'flavor'])
    const remark = valueOf(item, ['remark', 'note'])
    const combo = valueOf(item, ['comboRelationId', 'comboId', 'setMealId', 'packageId'])
    const signature = [dishId, specification, method, taste, remark, combo].join('\u001f')
    const current = groups.get(signature)
    const count = Number(item.count || 0)
    if (current) {
      current.count += count
      current.sourceIndexes.push(entry.index)
      return
    }
    groups.set(signature, {
      dishId,
      dishName: valueOf(item, ['dishName', 'name']),
      specification,
      method,
      taste,
      remark,
      comboRelationId: combo,
      count,
      sourceIndexes: [entry.index]
    })
  })
  return Array.from(groups.values())
}

const DEFAULT_PRINTERS = [
  {
    code: 'front-counter',
    name: '\u524d\u53f0',
    brand: '\u82af\u70e8',
    model: 'XP-58IINT',
    connectionType: 'usb',
    printerType: 'thermal',
    paperWidth: 58,
    printMode: 'text',
    resolution: 203,
    status: true,
    usage: 'cashier',
    capabilities: { escpos: true, beep: true, cashDrawer: true, twoColor: false, cutPaper: false },
    usbBinding: { vendorId: '', productId: '', deviceName: '' },
    feedLines: 4,
    retryLimit: 2,
    beepCount: 1,
    beepLevel: 1,
    openCashDrawer: false
  },
  {
    code: 'kitchen',
    name: '\u540e\u53a8',
    brand: '\u82af\u70e8',
    model: '',
    connectionType: 'network',
    printerType: 'thermal',
    ip: '192.168.10.42',
    port: 9100,
    paperWidth: 80,
    printMode: 'text',
    resolution: 203,
    status: true,
    usage: 'kitchen',
    capabilities: { escpos: true, beep: true, cashDrawer: false, twoColor: false, cutPaper: true },
    feedLines: 4,
    retryLimit: 2,
    beepCount: 1,
    beepLevel: 1,
    openCashDrawer: false
  },
  {
    code: 'hot-dishes',
    name: '\u70ed\u83dc',
    brand: '\u82af\u70e8',
    model: '',
    connectionType: 'network',
    printerType: 'thermal',
    ip: '192.168.10.37',
    port: 9100,
    paperWidth: 80,
    printMode: 'text',
    resolution: 203,
    status: true,
    usage: 'kitchen',
    capabilities: { escpos: true, beep: true, cashDrawer: false, twoColor: false, cutPaper: true },
    feedLines: 4,
    retryLimit: 2,
    beepCount: 1,
    beepLevel: 1,
    openCashDrawer: false
  },
  {
    code: 'dessert',
    name: '\u751c\u54c1',
    brand: '\u82af\u70e8',
    model: '',
    connectionType: 'network',
    printerType: 'thermal',
    ip: '192.168.10.207',
    port: 9100,
    paperWidth: 80,
    printMode: 'text',
    resolution: 203,
    status: true,
    usage: 'kitchen',
    capabilities: { escpos: true, beep: true, cashDrawer: false, twoColor: false, cutPaper: true },
    feedLines: 4,
    retryLimit: 2,
    beepCount: 1,
    beepLevel: 1,
    openCashDrawer: false
  }
]

const DEFAULT_STATIONS = [
  { code: 'kitchen', name: '\u540e\u53a8', printerCode: 'kitchen', isDefault: false },
  { code: 'hot-dishes', name: '\u70ed\u83dc', printerCode: 'hot-dishes', isDefault: false },
  { code: 'dessert', name: '\u751c\u54c1', printerCode: 'dessert', isDefault: false },
  { code: 'cold-dishes', name: '\u51c9\u83dc', printerCode: 'kitchen', isDefault: true }
]

const CASHIER_TICKETS = [
  { ticketType: 'customer_order', name: '\u5ba2\u5355' },
  { ticketType: 'prebill', name: '\u9884\u7ed3\u5355' },
  { ticketType: 'checkout', name: '\u7ed3\u8d26\u5355' },
  { ticketType: 'refund', name: '\u9000\u5355' }
]

const TEMPLATE_DEFINITIONS = [
  ...CASHIER_TICKETS.map(item => ({ ...item, scope: 'cashier', paperWidth: 58 })),
  { ticketType: 'kitchen_order', name: '\u5236\u4f5c\u5355', scope: 'kitchen', paperWidth: 80 },
  { ticketType: 'kitchen_split', name: '\u5236\u4f5c\u5206\u5355', scope: 'kitchen', paperWidth: 80 }
]

function createPrintService({ db, _, defaultTenantId }) {
  function now() {
    return new Date()
  }

  function storeId(payload = {}) {
    return String(payload.storeId || payload.tenantId || defaultTenantId || '').trim()
  }

  function stableId(prefix, value) {
    return `${prefix}_${crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 30)}`
  }

  function randomToken() {
    return crypto.randomBytes(24).toString('hex')
  }

  function hash(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex')
  }

  function bool(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback
    return value === true || value === 1 || value === '1' || value === 'true'
  }

  function number(value, fallback = 0, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(max, Math.max(min, parsed))
  }

  function text(value, fallback = '') {
    const result = String(value === undefined || value === null ? fallback : value).trim()
    return result
  }

  function documentData(data = {}) {
    const { _id, ...fields } = data
    return fields
  }

  async function getDoc(collection, id) {
    const result = await db.collection(collection).doc(id).get()
    return result && result.data ? result.data : null
  }

  async function listDocs(collection, where = {}, limit = 500) {
    const result = await db.collection(collection).where(where).limit(limit).get()
    return result && result.data ? result.data : []
  }

  async function setDefault(collection, id, data) {
    const existing = await getDoc(collection, id)
    if (existing) return existing
    await db.collection(collection).doc(id).set({ data: documentData(data) })
    return { ...data, _id: id }
  }

  function defaultTemplate(definition) {
    const kitchen = definition.scope === 'kitchen'
    return {
      ticketType: definition.ticketType,
      name: definition.name,
      scope: definition.scope,
      paperWidth: definition.paperWidth,
      fields: kitchen
        ? [
            { id: 'title', key: 'title', label: '\u7968\u636e\u540d\u79f0', size: 'xlarge', align: 'center', bold: true, inverse: false, color: 'black', dividerAfter: true, blankBefore: false },
            { id: 'table', key: 'tableNumber', label: '\u684c\u53f7', size: 'large', align: 'left', bold: true, inverse: false, color: 'black', dividerAfter: false, blankBefore: false },
            { id: 'order', key: 'orderNumber', label: '\u8ba2\u5355\u53f7', size: 'normal', align: 'left', bold: false, inverse: false, color: 'black', dividerAfter: true, blankBefore: false },
            { id: 'dishes', key: 'dishes', label: '\u83dc\u54c1\u660e\u7ec6', size: 'large', align: 'left', bold: true, inverse: false, color: 'black', dividerAfter: true, blankBefore: false },
            { id: 'remark', key: 'orderRemark', label: '\u6574\u5355\u5907\u6ce8', size: 'normal', align: 'left', bold: false, inverse: false, color: 'black', dividerAfter: false, blankBefore: false },
            { id: 'time', key: 'orderTime', label: '\u4e0b\u5355\u65f6\u95f4', size: 'normal', align: 'left', bold: false, inverse: false, color: 'black', dividerAfter: false, blankBefore: true }
          ]
        : [
            { id: 'title', key: 'title', label: '\u7968\u636e\u540d\u79f0', size: 'large', align: 'center', bold: true, inverse: false, color: 'black', dividerAfter: true, blankBefore: false },
            { id: 'shop', key: 'shopName', label: '\u5e97\u94fa\u540d\u79f0', size: 'normal', align: 'center', bold: true, inverse: false, color: 'black', dividerAfter: false, blankBefore: false },
            { id: 'table', key: 'tableNumber', label: '\u684c\u53f7', size: 'normal', align: 'left', bold: false, inverse: false, color: 'black', dividerAfter: false, blankBefore: false },
            { id: 'order', key: 'orderNumber', label: '\u8ba2\u5355\u53f7', size: 'normal', align: 'left', bold: false, inverse: false, color: 'black', dividerAfter: true, blankBefore: false },
            { id: 'dishes', key: 'dishes', label: '\u83dc\u54c1\u660e\u7ec6', size: 'normal', align: 'left', bold: false, inverse: false, color: 'black', dividerAfter: true, blankBefore: false },
            { id: 'total', key: 'totalPrice', label: '\u8ba2\u5355\u4ef7\u683c', size: 'large', align: 'right', bold: true, inverse: false, color: 'black', dividerAfter: false, blankBefore: false },
            { id: 'time', key: 'orderTime', label: '\u4e0b\u5355\u65f6\u95f4', size: 'normal', align: 'left', bold: false, inverse: false, color: 'black', dividerAfter: false, blankBefore: true }
          ],
      version: 1,
      updateTime: now(),
      createTime: now()
    }
  }

  async function ensureDefaults(id) {
    const timestamp = now()
    for (const printer of DEFAULT_PRINTERS) {
      const printerId = stableId('printer', `${id}:${printer.code}`)
      await setDefault('printers', printerId, {
        ...printer,
        _id: printerId,
        storeId: id,
        createTime: timestamp,
        updateTime: timestamp
      })
    }

    for (const station of DEFAULT_STATIONS) {
      const printerId = stableId('printer', `${id}:${station.printerCode}`)
      const stationId = stableId('station', `${id}:${station.code}`)
      await setDefault('printStations', stationId, {
        ...station,
        _id: stationId,
        storeId: id,
        printerId,
        status: true,
        createTime: timestamp,
        updateTime: timestamp
      })
    }

    const frontPrinterId = stableId('printer', `${id}:front-counter`)
    for (const config of CASHIER_TICKETS) {
      const configId = stableId('cashier', `${id}:${config.ticketType}`)
      await setDefault('cashierPrintConfigs', configId, {
        _id: configId,
        storeId: id,
        ...config,
        enabled: true,
        copies: 1,
        printerId: frontPrinterId,
        createTime: timestamp,
        updateTime: timestamp
      })
    }

    for (const definition of TEMPLATE_DEFINITIONS) {
      const templateId = stableId('template', `${id}:${definition.ticketType}`)
      await setDefault('receiptTemplates', templateId, {
        _id: templateId,
        storeId: id,
        ...defaultTemplate(definition)
      })
    }
  }

  async function getActor() {
    const result = await db.collection('admin').limit(1).get()
    const admin = result && result.data && result.data[0]
    return {
      id: admin && admin._id || 'admin',
      name: admin && (admin.name || admin.nickName || admin.username) || '\u7ba1\u7406\u5458'
    }
  }

  async function audit(id, action, targetType, targetId, before, after) {
    const actor = await getActor()
    await db.collection('printConfigAuditLogs').add({
      data: {
        storeId: id,
        action,
        targetType,
        targetId,
        before: before || null,
        after: after || null,
        actorId: actor.id,
        actorName: actor.name,
        createTime: now()
      }
    })
  }

  function normalizeCapabilities(source = {}) {
    return {
      escpos: source.escpos !== false,
      beep: bool(source.beep),
      cashDrawer: bool(source.cashDrawer),
      twoColor: bool(source.twoColor),
      cutPaper: bool(source.cutPaper)
    }
  }

  function normalizePrinter(input = {}, existing = {}) {
    const connectionType = input.connectionType === 'usb' ? 'usb' : 'network'
    const paperWidth = [58, 76, 80].includes(Number(input.paperWidth)) ? Number(input.paperWidth) : 80
    const printerType = input.printerType === 'dotMatrix' ? 'dotMatrix' : 'thermal'
    const printMode = input.printMode === 'image' ? 'image' : 'text'
    const capabilities = normalizeCapabilities({ ...(existing.capabilities || {}), ...(input.capabilities || {}) })
    return {
      name: text(input.name || existing.name),
      code: text(input.code || existing.code),
      brand: text(input.brand || existing.brand || '\u901a\u7528'),
      model: text(input.model || existing.model),
      connectionType,
      printerType,
      ip: connectionType === 'network' ? text(input.ip || existing.ip) : '',
      port: connectionType === 'network' ? number(input.port, 9100, 1, 65535) : 0,
      usbBinding: connectionType === 'usb'
        ? {
            vendorId: text(input.usbBinding && input.usbBinding.vendorId || existing.usbBinding && existing.usbBinding.vendorId),
            productId: text(input.usbBinding && input.usbBinding.productId || existing.usbBinding && existing.usbBinding.productId),
            deviceName: text(input.usbBinding && input.usbBinding.deviceName || existing.usbBinding && existing.usbBinding.deviceName)
          }
        : null,
      paperWidth,
      printMode,
      resolution: Number(input.resolution) === 180 ? 180 : 203,
      status: bool(input.status, existing.status !== false),
      usage: text(input.usage || existing.usage || 'kitchen'),
      capabilities,
      beepCount: capabilities.beep ? number(input.beepCount, existing.beepCount || 1, 0, 9) : 0,
      beepLevel: capabilities.beep ? number(input.beepLevel, existing.beepLevel || 1, 0, 9) : 0,
      feedLines: number(input.feedLines, existing.feedLines === undefined ? 4 : existing.feedLines, 0, 20),
      retryLimit: number(input.retryLimit, existing.retryLimit === undefined ? 2 : existing.retryLimit, 0, 6),
      openCashDrawer: capabilities.cashDrawer && bool(input.openCashDrawer, existing.openCashDrawer),
      updateTime: now()
    }
  }

  async function listPrinters(id) {
    const [printers, events, agents] = await Promise.all([
      listDocs('printers', { storeId: id }),
      listDocs('printerEventLogs', { storeId: id }, 200),
      listDocs('printerAgents', { storeId: id })
    ])
    const online = agents.some(agent => agent.status === 'online' && Date.now() - new Date(agent.lastSeenAt || 0).getTime() < ONLINE_WINDOW_MS)
    const eventMap = events.reduce((map, event) => {
      if (!event.printerId) return map
      const old = map[event.printerId]
      if (!old || new Date(event.createTime || 0).getTime() > new Date(old.createTime || 0).getTime()) map[event.printerId] = event
      return map
    }, {})
    return printers.map(printer => {
      const event = eventMap[printer._id]
      const isOnline = printer.status !== false && online && (!event || event.status !== 'disconnected')
      return {
        ...printer,
        connectionStatus: isOnline ? 'online' : 'offline',
        lastError: event && event.level === 'error' ? event.message || '' : '',
        lastEventAt: event && event.createTime || null
      }
    }).sort((a, b) => String(a.code || a.name).localeCompare(String(b.code || b.name)))
  }

  function getTicketValue(key, data = {}) {
    const value = data[key]
    if (key === 'dishes') {
      const dishes = Array.isArray(value) ? value : []
      return dishes.map(item => `${item.dishName || item.name || ''} x${Number(item.count || 0)}${item.remark ? ` (${item.remark})` : ''}`).join('\n')
    }
    if (key === 'totalPrice' && value !== undefined && value !== null && value !== '') return `\uffe5${Number(value || 0).toFixed(2)}`
    if (value === false || value === 0) return value
    return value
  }

  function renderTicket(template = {}, data = {}) {
    const lines = []
    const fields = Array.isArray(template.fields) ? template.fields : []
    fields.forEach(field => {
      const value = getTicketValue(field.key, data)
      if (isEmptyValue(value)) return
      if (field.blankBefore) lines.push({ kind: 'blank' })
      lines.push({
        kind: field.key === 'dishes' ? 'dishes' : 'text',
        key: field.key,
        text: String(value),
        size: field.size || 'normal',
        align: field.align || 'left',
        bold: bool(field.bold),
        inverse: bool(field.inverse),
        color: field.color === 'red' ? 'red' : 'black'
      })
      if (field.dividerAfter) lines.push({ kind: 'divider' })
    })
    return {
      paperWidth: Number(template.paperWidth || data.paperWidth || 80),
      lines,
      feedLines: number(data.feedLines, 4, 0, 20),
      cutPaper: bool(data.cutPaper),
      openCashDrawer: bool(data.openCashDrawer),
      capabilities: data.capabilities || {}
    }
  }

  async function findTemplate(id, ticketType) {
    const templateId = stableId('template', `${id}:${ticketType}`)
    const template = await getDoc('receiptTemplates', templateId)
    if (template) return template
    const definition = TEMPLATE_DEFINITIONS.find(item => item.ticketType === ticketType)
    return definition ? defaultTemplate(definition) : defaultTemplate(TEMPLATE_DEFINITIONS[0])
  }

  async function createJob(id, input = {}) {
    const idempotencyKey = text(input.idempotencyKey)
    if (!idempotencyKey) throw new Error('print job idempotency key required')
    const jobId = stableId('printjob', `${id}:${idempotencyKey}`)
    const existing = await getDoc('printJobs', jobId)
    if (existing) return { job: existing, created: false }

    const printer = input.printer || await getDoc('printers', input.printerId)
    if (!printer || printer.storeId !== id) throw new Error('printer not found')
    const template = input.template || await findTemplate(id, input.ticketType)
    const ticket = input.ticket || renderTicket(template, {
      ...(input.ticketData || {}),
      paperWidth: printer.paperWidth,
      feedLines: printer.feedLines,
      cutPaper: printer.capabilities && printer.capabilities.cutPaper,
      openCashDrawer: printer.openCashDrawer,
      capabilities: printer.capabilities || {}
    })
    const timestamp = now()
    const job = {
      _id: jobId,
      storeId: id,
      idempotencyKey,
      status: JOB_STATUS.queued,
      ticketType: input.ticketType,
      ticketName: input.ticketName || template.name || input.ticketType,
      printerId: printer._id,
      printerName: printer.name,
      stationId: input.stationId || '',
      stationName: input.stationName || '',
      orderId: input.orderId || '',
      orderNumber: input.orderNumber || input.orderId || '',
      tableNumber: input.tableNumber || '',
      deviceName: '',
      payload: input.payload || {},
      ticket,
      copies: number(input.copies, 1, 1, 9),
      attempts: 0,
      retryLimit: number(printer.retryLimit, 2, 0, 6),
      reprintOf: input.reprintOf || '',
      reprintCount: number(input.reprintCount, 0, 0),
      reprintBy: input.reprintBy || '',
      reprintAt: input.reprintAt || null,
      availableAt: timestamp,
      createTime: timestamp,
      updateTime: timestamp,
      error: ''
    }
    await db.collection('printJobs').doc(jobId).set({ data: documentData(job) })
    return { job, created: true }
  }

  function getDishId(entry = {}) {
    const item = entry.item || entry
    return text(item.dishId || item._id || item.id)
  }

  async function queueKitchenJobs({ id, order, dishEntries = [], kind = 'kitchen_order', eventKey = '', reason = '' }) {
    await ensureDefaults(id)
    const [stations, printers, routes] = await Promise.all([
      listDocs('printStations', { storeId: id }),
      listDocs('printers', { storeId: id }),
      listDocs('dishPrintRoutes', { storeId: id })
    ])
    const routeMap = routes.reduce((map, route) => ({ ...map, [route.dishId]: route }), {})
    const stationMap = stations.reduce((map, station) => ({ ...map, [station._id]: station }), {})
    const printerMap = printers.reduce((map, printer) => ({ ...map, [printer._id]: printer }), {})
    const fallback = stations.find(station => station.isDefault && station.status !== false)
    if (!fallback) throw new Error('default print station not configured')

    const groups = {}
    const skipped = []
    const alertWrites = []
    dishEntries.forEach(entry => {
      const item = entry.item || entry
      const dishId = getDishId(entry)
      const route = routeMap[dishId]
      if (route && route.printEnabled === false) {
        skipped.push(entry.index)
        return
      }
      const station = route && stationMap[route.stationId] && stationMap[route.stationId].status !== false
        ? stationMap[route.stationId]
        : fallback
      if (!groups[station._id]) groups[station._id] = []
      groups[station._id].push(entry)
      if (!route || !route.stationId) {
        alertWrites.push({ entry, station })
      }
    })

    for (const alert of alertWrites) {
      const item = alert.entry.item || alert.entry
      const alertId = stableId('unassigned', `${id}:${order._id}:${getDishId(alert.entry)}:${alert.entry.index}:${eventKey}`)
      const existing = await getDoc('unassignedDishAlerts', alertId)
      if (!existing) {
        await db.collection('unassignedDishAlerts').doc(alertId).set({
          data: documentData({
            _id: alertId,
            storeId: id,
            orderId: order._id,
            orderNumber: order.orderNumber || order._id,
            dishId: getDishId(alert.entry),
            dishName: item.dishName || item.name || '',
            stationId: alert.station._id,
            stationName: alert.station.name,
            status: 'open',
            createTime: now()
          })
        })
      }
    }

    const results = []
    const byDishIndex = {}
    for (const stationId of Object.keys(groups)) {
      const station = stationMap[stationId]
      const printer = station && printerMap[station.printerId]
      const entries = groups[stationId]
      if (!printer || printer.status === false || station.status === false) {
        entries.forEach(entry => {
          byDishIndex[entry.index] = { status: 'failed', message: 'station printer unavailable', printerId: station && station.printerId || '' }
        })
        results.push({ stationId, stationName: station && station.name || '', status: 'failed', message: 'station printer unavailable', dishIndexes: entries.map(entry => entry.index) })
        continue
      }
      const type = kind === 'refund' ? 'kitchen_order' : 'kitchen_order'
      const template = await findTemplate(id, type)
      const title = kind === 'refund'
        ? '\u9000\u83dc\u901a\u77e5'
        : kind === 'urge'
          ? '\u50ac\u83dc\u5355'
          : (order.isAddOnOrder ? '\u52a0\u83dc\u5355' : '\u5236\u4f5c\u5355')
      const dishes = mergeKitchenDishes(entries)
      const ticketData = {
        title,
        tableNumber: order.tableNumber || '',
        orderNumber: order.orderNumber || order._id,
        orderTime: new Date(order.createTime || now()).toLocaleString('zh-CN', { hour12: false }),
        orderRemark: reason || order.frontDeskRemark || '',
        dishes
      }
      const jobResult = await createJob(id, {
        printer,
        stationId: station._id,
        stationName: station.name,
        ticketType: type,
        ticketName: title,
        orderId: order._id,
        orderNumber: ticketData.orderNumber,
        tableNumber: ticketData.tableNumber,
        template,
        ticketData,
        payload: { kind, orderId: order._id, dishes, reason },
        idempotencyKey: `kitchen:${kind}:${order._id}:${eventKey || entries.map(entry => entry.index).join(',')}:${station._id}`
      })
      const result = {
        jobId: jobResult.job._id,
        printerId: printer._id,
        printerName: printer.name,
        stationId: station._id,
        stationName: station.name,
        status: jobResult.job.status,
        dishIndexes: entries.map(entry => entry.index)
      }
      results.push(result)
      entries.forEach(entry => {
        byDishIndex[entry.index] = result
      })
    }
    skipped.forEach(index => {
      byDishIndex[index] = { status: 'skipped', message: 'dish print disabled' }
    })
    return { results, byDishIndex, skipped }
  }

  async function queueCashierReceipt({ id, ticketType, orders, checkoutSummary = {}, eventKey = '' }) {
    await ensureDefaults(id)
    const configs = await listDocs('cashierPrintConfigs', { storeId: id })
    const config = configs.find(item => item.ticketType === ticketType)
    if (!config || config.enabled === false) return { jobs: [], skipped: true }
    const printer = await getDoc('printers', config.printerId)
    if (!printer || printer.status === false) return { jobs: [], skipped: true, reason: 'cashier printer unavailable' }
    const sortedOrders = (orders || []).slice().sort((a, b) => new Date(a.createTime || 0).getTime() - new Date(b.createTime || 0).getTime())
    const first = sortedOrders[0] || {}
    const allDishes = mergeKitchenDishes(sortedOrders.reduce((list, order) => {
      return list.concat((Array.isArray(order.goods) ? order.goods : []).map((item, index) => ({ index: `${order._id || ''}-${index}`, item })))
    }, []))
    const template = await findTemplate(id, ticketType)
    const jobResult = await createJob(id, {
      printer,
      ticketType,
      ticketName: template.name,
      orderId: first._id || '',
      orderNumber: first.rootOrderId || first._id || '',
      tableNumber: first.tableNumber || '',
      template,
      ticketData: {
        title: template.name,
        shopName: first.shopName || '',
        tableNumber: first.tableNumber || '',
        orderNumber: first.rootOrderId || first._id || '',
        orderTime: new Date(first.createTime || now()).toLocaleString('zh-CN', { hour12: false }),
        dishes: allDishes,
        totalPrice: checkoutSummary.receivable !== undefined ? checkoutSummary.receivable : first.finalPrice || first.totalPrice || 0
      },
      payload: { ticketType, orderIds: sortedOrders.map(order => order._id), checkoutSummary },
      copies: config.copies,
      idempotencyKey: `cashier:${ticketType}:${eventKey || (first.rootOrderId || first._id || crypto.randomBytes(4).toString('hex'))}`
    })
    return { jobs: [jobResult.job], skipped: false }
  }

  async function dashboard(payload) {
    const id = storeId(payload)
    await ensureDefaults(id)
    const [printers, jobs, agents, alerts] = await Promise.all([
      listPrinters(id),
      listDocs('printJobs', { storeId: id }),
      listDocs('printerAgents', { storeId: id }),
      listDocs('unassignedDishAlerts', { storeId: id })
    ])
    const onlineAgents = agents.filter(agent => agent.status === 'online' && Date.now() - new Date(agent.lastSeenAt || 0).getTime() < ONLINE_WINDOW_MS)
    return {
      success: true,
      data: {
        agentOnline: onlineAgents.length > 0,
        agents: onlineAgents.map(agent => ({ _id: agent._id, name: agent.name, lastSeenAt: agent.lastSeenAt, usbDevices: agent.usbDevices || [] })),
        printers,
        metrics: {
          queued: jobs.filter(job => ACTIVE_JOB_STATUS.includes(job.status)).length,
          failed: jobs.filter(job => job.status === JOB_STATUS.failed).length,
          unassigned: alerts.filter(alert => alert.status === 'open').length
        },
        alerts: alerts.filter(alert => alert.status === 'open').slice(0, 20)
      }
    }
  }

  async function savePrinter(payload) {
    const id = storeId(payload)
    await ensureDefaults(id)
    const input = payload.printer || payload.data || {}
    const printerId = text(input._id)
    const existing = printerId ? await getDoc('printers', printerId) : null
    if (existing && existing.storeId !== id) return { success: false, code: 'PRINTER_NOT_FOUND', message: 'printer not found' }
    const data = normalizePrinter(input, existing || {})
    if (!data.name) return { success: false, code: 'PRINTER_NAME_REQUIRED', message: 'printer name required' }
    if (data.connectionType === 'network' && !data.ip) return { success: false, code: 'PRINTER_IP_REQUIRED', message: 'network printer ip required' }
    const finalId = printerId || stableId('printer', `${id}:custom:${crypto.randomBytes(8).toString('hex')}`)
    await db.collection('printers').doc(finalId).set({
      data: documentData({
        ...existing,
        ...data,
        _id: finalId,
        storeId: id,
        createTime: existing && existing.createTime || now()
      })
    })
    await audit(id, existing ? 'printer.update' : 'printer.create', 'printer', finalId, existing, data)
    return { success: true, data: await getDoc('printers', finalId) }
  }

  async function updatePrinterStatus(payload) {
    const id = storeId(payload)
    const printerId = text(payload.printerId || payload.id)
    const printer = await getDoc('printers', printerId)
    if (!printer || printer.storeId !== id) return { success: false, code: 'PRINTER_NOT_FOUND', message: 'printer not found' }
    const status = bool(payload.status)
    await db.collection('printers').doc(printerId).update({ data: { status, updateTime: now() } })
    await audit(id, status ? 'printer.enable' : 'printer.disable', 'printer', printerId, { status: printer.status }, { status })
    return { success: true }
  }

  async function deletePrinter(payload) {
    const id = storeId(payload)
    const printerId = text(payload.printerId || payload.id)
    const printer = await getDoc('printers', printerId)
    if (!printer || printer.storeId !== id) return { success: false, code: 'PRINTER_NOT_FOUND', message: 'printer not found' }
    const jobs = await listDocs('printJobs', { storeId: id }, 500)
    if (jobs.some(job => job.printerId === printerId && ACTIVE_JOB_STATUS.includes(job.status))) {
      return { success: false, code: 'PRINTER_HAS_ACTIVE_JOBS', message: 'cancel or finish active jobs before deleting printer' }
    }
    const stations = await listDocs('printStations', { storeId: id })
    if (stations.some(station => station.printerId === printerId)) {
      return { success: false, code: 'PRINTER_USED_BY_STATION', message: 'change the station binding before deleting this printer' }
    }
    await db.collection('printers').doc(printerId).remove()
    await audit(id, 'printer.delete', 'printer', printerId, printer, null)
    return { success: true }
  }

  async function clearPendingJobs(payload) {
    const id = storeId(payload)
    const printerId = text(payload.printerId || payload.id)
    const jobs = await listDocs('printJobs', { storeId: id }, 500)
    const targets = jobs.filter(job => job.printerId === printerId && ACTIVE_JOB_STATUS.includes(job.status))
    await Promise.all(targets.map(job => db.collection('printJobs').doc(job._id).update({
      data: { status: JOB_STATUS.cancelled, cancelledAt: now(), cancelReason: 'cleared by administrator', updateTime: now() }
    })))
    return { success: true, data: { cancelled: targets.length } }
  }

  async function createTestJob(payload) {
    const id = storeId(payload)
    await ensureDefaults(id)
    const printerId = text(payload.printerId || payload.id)
    const printer = await getDoc('printers', printerId)
    if (!printer || printer.storeId !== id) return { success: false, code: 'PRINTER_NOT_FOUND', message: 'printer not found' }
    if (printer.status === false) return { success: false, code: 'PRINTER_DISABLED', message: 'printer is disabled' }
    const ticket = {
      paperWidth: printer.paperWidth,
      feedLines: printer.feedLines,
      cutPaper: bool(printer.capabilities && printer.capabilities.cutPaper),
      openCashDrawer: false,
      capabilities: printer.capabilities || {},
      lines: [
        { kind: 'text', text: '\u6253\u5370\u6d4b\u8bd5\u5355', size: 'large', align: 'center', bold: true, inverse: false, color: 'black' },
        { kind: 'divider' },
        { kind: 'text', text: `\u6253\u5370\u673a: ${printer.name}`, size: 'normal', align: 'left', bold: false, inverse: false, color: 'black' },
        { kind: 'text', text: `\u65f6\u95f4: ${now().toLocaleString('zh-CN', { hour12: false })}`, size: 'normal', align: 'left', bold: false, inverse: false, color: 'black' },
        { kind: 'text', text: '\u4e2d\u6587\u6d4b\u8bd5', size: 'normal', align: 'left', bold: true, inverse: false, color: 'black' },
        { kind: 'text', text: 'English 123 ABC', size: 'normal', align: 'left', bold: false, inverse: false, color: 'black' },
        { kind: 'text', text: 'Normal / Medium / Large', size: 'large', align: 'center', bold: true, inverse: false, color: 'black' },
        { kind: 'divider' },
        { kind: 'text', text: printer.capabilities && printer.capabilities.cutPaper ? '\u5207\u7eb8\u6d4b\u8bd5' : '\u8d70\u7eb8\u6d4b\u8bd5', size: 'normal', align: 'center', bold: false, inverse: false, color: 'black' }
      ]
    }
    const jobResult = await createJob(id, {
      printer,
      ticketType: 'test',
      ticketName: '\u6253\u5370\u6d4b\u8bd5\u5355',
      ticket,
      payload: { type: 'printer_test' },
      idempotencyKey: `test:${printerId}:${Math.floor(Date.now() / 1000)}`
    })
    return { success: true, data: jobResult.job }
  }

  async function listStations(payload) {
    const id = storeId(payload)
    await ensureDefaults(id)
    const [stations, printers] = await Promise.all([listDocs('printStations', { storeId: id }), listDocs('printers', { storeId: id })])
    const printerMap = printers.reduce((map, printer) => ({ ...map, [printer._id]: printer }), {})
    return {
      success: true,
      data: stations.map(station => ({ ...station, printer: printerMap[station.printerId] || null }))
    }
  }

  async function saveStation(payload) {
    const id = storeId(payload)
    await ensureDefaults(id)
    const input = payload.station || payload.data || {}
    const stationId = text(input._id)
    const existing = stationId ? await getDoc('printStations', stationId) : null
    if (existing && existing.storeId !== id) return { success: false, code: 'STATION_NOT_FOUND', message: 'station not found' }
    const printer = await getDoc('printers', text(input.printerId || existing && existing.printerId))
    if (!printer || printer.storeId !== id) return { success: false, code: 'STATION_PRINTER_REQUIRED', message: 'station printer required' }
    const data = {
      name: text(input.name || existing && existing.name),
      code: text(input.code || existing && existing.code),
      printerId: printer._id,
      status: bool(input.status, existing ? existing.status !== false : true),
      isDefault: bool(input.isDefault, existing && existing.isDefault),
      updateTime: now()
    }
    if (!data.name) return { success: false, code: 'STATION_NAME_REQUIRED', message: 'station name required' }
    const finalId = stationId || stableId('station', `${id}:custom:${crypto.randomBytes(8).toString('hex')}`)
    if (data.isDefault) {
      const stations = await listDocs('printStations', { storeId: id })
      await Promise.all(stations.filter(station => station._id !== finalId && station.isDefault).map(station => db.collection('printStations').doc(station._id).update({ data: { isDefault: false, updateTime: now() } })))
    }
    await db.collection('printStations').doc(finalId).set({ data: documentData({ ...existing, ...data, _id: finalId, storeId: id, createTime: existing && existing.createTime || now() }) })
    await audit(id, existing ? 'station.update' : 'station.create', 'station', finalId, existing, data)
    return { success: true, data: await getDoc('printStations', finalId) }
  }

  async function listDishRoutes(payload) {
    const id = storeId(payload)
    await ensureDefaults(id)
    const [dishes, categories, routes, stations] = await Promise.all([
      listDocs('dish', {}, 1000),
      listDocs('dishCategory', {}, 300),
      listDocs('dishPrintRoutes', { storeId: id }, 1200),
      listDocs('printStations', { storeId: id })
    ])
    const routeMap = routes.reduce((map, route) => ({ ...map, [route.dishId]: route }), {})
    const categoryMap = categories.reduce((map, category) => ({ ...map, [category._id]: category.name }), {})
    const stationMap = stations.reduce((map, station) => ({ ...map, [station._id]: station }), {})
    const keyword = text(payload.keyword).toLowerCase()
    const categoryId = text(payload.categoryId)
    const printFilter = text(payload.printEnabled)
    const unassignedOnly = bool(payload.unassignedOnly)
    const list = dishes.filter(dish => dish.status !== 0 && dish.status !== false).map(dish => {
      const route = routeMap[dish._id]
      const printEnabled = !route || route.printEnabled !== false
      const station = route && stationMap[route.stationId]
      return {
        dishId: dish._id,
        dishName: dish.name || '',
        mnemonic: dish.mnemonic || dish.code || '',
        categoryId: dish.categoryId || '',
        categoryName: dish.categoryName || categoryMap[dish.categoryId] || '',
        printEnabled,
        stationId: route && route.stationId || '',
        stationName: station && station.name || '',
        configStatus: station ? 'configured' : 'unassigned',
        routeId: route && route._id || ''
      }
    }).filter(item => {
      if (keyword && `${item.dishName} ${item.mnemonic}`.toLowerCase().indexOf(keyword) === -1) return false
      if (categoryId && item.categoryId !== categoryId) return false
      if (printFilter === 'true' && !item.printEnabled) return false
      if (printFilter === 'false' && item.printEnabled) return false
      if (unassignedOnly && (!item.printEnabled || item.configStatus !== 'unassigned')) return false
      return true
    })
    return { success: true, data: { list, stations, categories } }
  }

  async function saveDishRoutes(payload) {
    const id = storeId(payload)
    await ensureDefaults(id)
    const dishIds = Array.from(new Set((payload.dishIds || [payload.dishId]).map(value => text(value)).filter(Boolean)))
    if (!dishIds.length) return { success: false, code: 'DISH_REQUIRED', message: 'dish required' }
    const stationId = text(payload.stationId)
    const printEnabled = bool(payload.printEnabled, true)
    const station = stationId ? await getDoc('printStations', stationId) : null
    if (printEnabled && stationId && (!station || station.storeId !== id)) return { success: false, code: 'STATION_NOT_FOUND', message: 'station not found' }
    const routes = await listDocs('dishPrintRoutes', { storeId: id }, 1200)
    const routeMap = routes.reduce((map, route) => ({ ...map, [route.dishId]: route }), {})
    const actor = await getActor()
    for (const dishId of dishIds) {
      const routeId = stableId('dishroute', `${id}:${dishId}`)
      const before = routeMap[dishId] || null
      const after = {
        _id: routeId,
        storeId: id,
        dishId,
        printEnabled,
        stationId: printEnabled ? stationId : '',
        updateTime: now(),
        createTime: before && before.createTime || now(),
        operatorId: actor.id,
        operatorName: actor.name
      }
      await db.collection('dishPrintRoutes').doc(routeId).set({ data: documentData(after) })
      await audit(id, dishIds.length > 1 ? 'dish-route.batch-update' : 'dish-route.update', 'dishPrintRoute', routeId, before, after)
    }
    return { success: true, data: { updated: dishIds.length } }
  }

  async function listCashierConfigs(payload) {
    const id = storeId(payload)
    await ensureDefaults(id)
    const [configs, printers] = await Promise.all([listDocs('cashierPrintConfigs', { storeId: id }), listPrinters(id)])
    const map = printers.reduce((result, printer) => ({ ...result, [printer._id]: printer }), {})
    return { success: true, data: configs.map(config => ({ ...config, printer: map[config.printerId] || null })) }
  }

  async function saveCashierConfig(payload) {
    const id = storeId(payload)
    await ensureDefaults(id)
    const input = payload.config || payload.data || {}
    const ticketType = text(input.ticketType)
    const configId = stableId('cashier', `${id}:${ticketType}`)
    const existing = await getDoc('cashierPrintConfigs', configId)
    if (!existing) return { success: false, code: 'CASHIER_CONFIG_NOT_FOUND', message: 'cashier config not found' }
    const printer = await getDoc('printers', text(input.printerId || existing.printerId))
    if (!printer || printer.storeId !== id || printer.connectionType !== 'usb' || printer.status === false) return { success: false, code: 'CASHIER_USB_PRINTER_REQUIRED', message: 'cashier receipt requires an enabled USB printer' }
    const data = { enabled: bool(input.enabled, existing.enabled), copies: number(input.copies, existing.copies || 1, 1, 9), printerId: printer._id, updateTime: now() }
    await db.collection('cashierPrintConfigs').doc(configId).update({ data })
    await audit(id, 'cashier-config.update', 'cashierPrintConfig', configId, existing, data)
    return { success: true, data: await getDoc('cashierPrintConfigs', configId) }
  }

  async function listTemplates(payload) {
    const id = storeId(payload)
    await ensureDefaults(id)
    const templates = await listDocs('receiptTemplates', { storeId: id })
    return { success: true, data: templates.sort((a, b) => String(a.ticketType).localeCompare(String(b.ticketType))) }
  }

  function normalizeTemplateFields(fields) {
    return (Array.isArray(fields) ? fields : []).map((field, index) => ({
      id: text(field.id || `${field.key}-${index}`),
      key: text(field.key),
      label: text(field.label),
      size: ['normal', 'medium', 'large', 'xlarge'].includes(field.size) ? field.size : 'normal',
      align: ['left', 'center', 'right'].includes(field.align) ? field.align : 'left',
      bold: bool(field.bold),
      inverse: bool(field.inverse),
      color: field.color === 'red' ? 'red' : 'black',
      dividerAfter: bool(field.dividerAfter),
      blankBefore: bool(field.blankBefore)
    })).filter(field => field.key)
  }

  async function saveTemplate(payload) {
    const id = storeId(payload)
    await ensureDefaults(id)
    const input = payload.template || payload.data || {}
    const ticketType = text(input.ticketType)
    const templateId = stableId('template', `${id}:${ticketType}`)
    const existing = await getDoc('receiptTemplates', templateId)
    if (!existing) return { success: false, code: 'TEMPLATE_NOT_FOUND', message: 'template not found' }
    const fields = normalizeTemplateFields(input.fields)
    if (!fields.length) return { success: false, code: 'TEMPLATE_FIELD_REQUIRED', message: 'template needs at least one field' }
    const version = number(existing.version, 1, 1) + 1
    await db.collection('receiptTemplateVersions').add({
      data: { storeId: id, templateId, ticketType, version: existing.version || 1, fields: existing.fields || [], createTime: now(), reason: 'save' }
    })
    const data = { fields, paperWidth: [58, 80].includes(Number(input.paperWidth)) ? Number(input.paperWidth) : existing.paperWidth, version, updateTime: now() }
    await db.collection('receiptTemplates').doc(templateId).update({ data })
    await audit(id, 'template.update', 'receiptTemplate', templateId, existing, data)
    return { success: true, data: await getDoc('receiptTemplates', templateId) }
  }

  async function resetTemplate(payload) {
    const id = storeId(payload)
    await ensureDefaults(id)
    const ticketType = text(payload.ticketType)
    const templateId = stableId('template', `${id}:${ticketType}`)
    const existing = await getDoc('receiptTemplates', templateId)
    const definition = TEMPLATE_DEFINITIONS.find(item => item.ticketType === ticketType)
    if (!existing || !definition) return { success: false, code: 'TEMPLATE_NOT_FOUND', message: 'template not found' }
    const reset = defaultTemplate(definition)
    await db.collection('receiptTemplateVersions').add({ data: { storeId: id, templateId, ticketType, version: existing.version || 1, fields: existing.fields || [], createTime: now(), reason: 'reset' } })
    await db.collection('receiptTemplates').doc(templateId).update({ data: { fields: reset.fields, paperWidth: reset.paperWidth, version: number(existing.version, 1) + 1, updateTime: now() } })
    return { success: true, data: await getDoc('receiptTemplates', templateId) }
  }

  async function templateHistory(payload) {
    const id = storeId(payload)
    const templateId = stableId('template', `${id}:${text(payload.ticketType)}`)
    const versions = await listDocs('receiptTemplateVersions', { storeId: id, templateId })
    return { success: true, data: versions.sort((a, b) => new Date(b.createTime || 0) - new Date(a.createTime || 0)) }
  }

  async function testTemplate(payload) {
    const id = storeId(payload)
    await ensureDefaults(id)
    const ticketType = text(payload.ticketType)
    const templates = await listDocs('receiptTemplates', { storeId: id })
    const template = templates.find(item => item.ticketType === ticketType)
    const printers = await listDocs('printers', { storeId: id })
    const printer = printers.find(item => item.status !== false && (ticketType.indexOf('kitchen') === 0 ? item.usage === 'kitchen' : item.usage === 'cashier'))
    if (!template || !printer) return { success: false, code: 'TEMPLATE_PRINTER_NOT_FOUND', message: 'template or printer not found' }
    const ticketData = { title: template.name, shopName: '\u5f20\u5357\u706b\u76c6\u70e7\u70e4', tableNumber: 'T01', orderNumber: 'TEST-0001', orderTime: now().toLocaleString('zh-CN', { hour12: false }), dishes: [{ dishName: '\u4e2d\u6587\u6d4b\u8bd5\u83dc\u54c1', count: 1, remark: '' }, { dishName: 'English 123', count: 2, remark: 'No ice' }], totalPrice: 88 }
    const jobResult = await createJob(id, { printer, ticketType, ticketName: template.name, template, ticketData, payload: { type: 'template_test' }, idempotencyKey: `template-test:${ticketType}:${Math.floor(Date.now() / 1000)}` })
    return { success: true, data: jobResult.job }
  }

  async function listJobs(payload) {
    const id = storeId(payload)
    const jobs = await listDocs('printJobs', { storeId: id }, 500)
    const printerId = text(payload.printerId)
    const ticketType = text(payload.ticketType)
    const deviceName = text(payload.deviceName)
    const orderTail = text(payload.orderTail)
    return {
      success: true,
      data: jobs.filter(job => {
        if (printerId && job.printerId !== printerId) return false
        if (ticketType && job.ticketType !== ticketType) return false
        if (deviceName && job.deviceName !== deviceName) return false
        if (orderTail && String(job.orderNumber || job.orderId || '').slice(-orderTail.length) !== orderTail) return false
        return true
      }).sort((a, b) => new Date(b.createTime || 0) - new Date(a.createTime || 0))
    }
  }

  async function getJob(payload) {
    const id = storeId(payload)
    const job = await getDoc('printJobs', text(payload.jobId || payload.id))
    if (!job || job.storeId !== id) return { success: false, code: 'PRINT_JOB_NOT_FOUND', message: 'print job not found' }
    return { success: true, data: job }
  }

  async function reprintJob(payload) {
    const id = storeId(payload)
    const source = await getDoc('printJobs', text(payload.jobId || payload.id))
    if (!source || source.storeId !== id) return { success: false, code: 'PRINT_JOB_NOT_FOUND', message: 'print job not found' }
    const actor = await getActor()
    const jobResult = await createJob(id, {
      printerId: source.printerId,
      ticketType: source.ticketType,
      ticketName: source.ticketName,
      orderId: source.orderId,
      orderNumber: source.orderNumber,
      tableNumber: source.tableNumber,
      ticket: source.ticket,
      payload: source.payload,
      reprintOf: source._id,
      reprintCount: number(source.reprintCount, 0) + 1,
      reprintBy: actor.id,
      reprintAt: now(),
      idempotencyKey: `reprint:${source._id}:${Math.floor(Date.now() / 1000)}`
    })
    return { success: true, data: jobResult.job }
  }

  async function cancelJob(payload) {
    const id = storeId(payload)
    const jobId = text(payload.jobId || payload.id)
    const job = await getDoc('printJobs', jobId)
    if (!job || job.storeId !== id) return { success: false, code: 'PRINT_JOB_NOT_FOUND', message: 'print job not found' }
    if (job.status !== JOB_STATUS.queued) return { success: false, code: 'PRINT_JOB_ALREADY_CLAIMED', message: 'only queued jobs can be cancelled' }
    await db.collection('printJobs').doc(jobId).update({ data: { status: JOB_STATUS.cancelled, cancelReason: 'cancelled by administrator', cancelledAt: now(), updateTime: now() } })
    return { success: true }
  }

  async function listLogs(payload) {
    const id = storeId(payload)
    const printerId = text(payload.printerId)
    const range = text(payload.range || 'all')
    const start = range === 'today' ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
      : range === 'yesterday' ? new Date(new Date().setHours(0, 0, 0, 0)).getTime() - 24 * 60 * 60 * 1000
        : range === 'sevenDays' ? Date.now() - 7 * 24 * 60 * 60 * 1000 : 0
    const end = range === 'yesterday' ? new Date(new Date().setHours(0, 0, 0, 0)).getTime() : Number.MAX_SAFE_INTEGER
    const logs = await listDocs('printerEventLogs', { storeId: id }, 500)
    return { success: true, data: logs.filter(log => {
      const time = new Date(log.createTime || 0).getTime()
      return (!printerId || log.printerId === printerId) && time >= start && time < end
    }).sort((a, b) => new Date(b.createTime || 0) - new Date(a.createTime || 0)) }
  }

  async function clearLogs(payload) {
    const id = storeId(payload)
    const printerId = text(payload.printerId)
    const logs = await listDocs('printerEventLogs', { storeId: id }, 500)
    const targets = logs.filter(log => !printerId || log.printerId === printerId)
    await Promise.all(targets.map(log => db.collection('printerEventLogs').doc(log._id).remove()))
    return { success: true, data: { removed: targets.length } }
  }

  async function listAlerts(payload) {
    const id = storeId(payload)
    const alerts = await listDocs('unassignedDishAlerts', { storeId: id }, 300)
    return { success: true, data: alerts.filter(alert => !payload.openOnly || alert.status === 'open').sort((a, b) => new Date(b.createTime || 0) - new Date(a.createTime || 0)) }
  }

  async function createAgentRegistration(payload) {
    const id = storeId(payload)
    const registrationCode = randomToken()
    const agentId = stableId('agent', `${id}:${crypto.randomBytes(12).toString('hex')}`)
    await db.collection('printerAgents').doc(agentId).set({
      data: documentData({
        _id: agentId,
        storeId: id,
        name: text(payload.name || '\u5b89\u5353\u6253\u5370\u5e73\u677f'),
        status: 'pending',
        registrationCodeHash: hash(registrationCode),
        registrationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createTime: now(),
        updateTime: now(),
        lastSeenAt: null,
        deviceTokenHash: ''
      })
    })
    return { success: true, data: { agentId, registrationCode, expiresInSeconds: 900 } }
  }

  async function authenticateAgent(payload) {
    const agentId = text(payload.agentId)
    const token = text(payload.agentToken)
    const agent = await getDoc('printerAgents', agentId)
    if (!agent || !token || agent.deviceTokenHash !== hash(token)) return null
    return agent
  }

  async function agentRegister(payload) {
    const id = storeId(payload)
    const registrationCode = text(payload.registrationCode)
    const agents = await listDocs('printerAgents', { storeId: id })
    const agent = agents.find(item => item.registrationCodeHash === hash(registrationCode) && new Date(item.registrationExpiresAt || 0).getTime() > Date.now())
    if (!agent) return { success: false, code: 'AGENT_REGISTRATION_INVALID', message: 'agent registration code invalid or expired' }
    const token = randomToken()
    await db.collection('printerAgents').doc(agent._id).update({
      data: {
        name: text(payload.name || agent.name),
        status: 'online',
        deviceTokenHash: hash(token),
        registrationCodeHash: '',
        registrationExpiresAt: null,
        lastSeenAt: now(),
        capabilities: payload.capabilities || {},
        updateTime: now()
      }
    })
    await writeAgentLog(agent, { status: 'agent_online', message: '\u6253\u5370\u4ee3\u7406\u4e0a\u7ebf', level: 'info' })
    return { success: true, data: { agentId: agent._id, agentToken: token, storeId: id } }
  }

  async function writeAgentLog(agent, input = {}) {
    const printerId = text(input.printerId)
    const printer = printerId ? await getDoc('printers', printerId) : null
    await db.collection('printerEventLogs').add({
      data: {
        storeId: agent.storeId,
        agentId: agent._id,
        printerId,
        printerName: printer && printer.name || text(input.printerName),
        status: text(input.status),
        level: text(input.level || 'info'),
        message: text(input.message),
        detail: input.detail || null,
        createTime: now()
      }
    })
  }

  async function agentHeartbeat(payload) {
    const agent = await authenticateAgent(payload)
    if (!agent) return { success: false, code: 'AGENT_AUTH_REQUIRED', message: 'invalid agent token' }
    await db.collection('printerAgents').doc(agent._id).update({ data: { status: 'online', lastSeenAt: now(), capabilities: payload.capabilities || agent.capabilities || {}, updateTime: now() } })
    return { success: true }
  }

  async function agentBootstrap(payload) {
    const agent = await authenticateAgent(payload)
    if (!agent) return { success: false, code: 'AGENT_AUTH_REQUIRED', message: 'invalid agent token' }
    const printers = await listDocs('printers', { storeId: agent.storeId })
    return {
      success: true,
      data: {
        storeId: agent.storeId,
        agentId: agent._id,
        printers: printers.map(printer => ({
          _id: printer._id,
          name: printer.name,
          status: printer.status !== false,
          connectionType: printer.connectionType,
          ip: printer.ip || '',
          port: printer.port || 9100,
          paperWidth: printer.paperWidth,
          printMode: printer.printMode,
          usbBinding: printer.usbBinding || null,
          capabilities: printer.capabilities || {},
          retryLimit: printer.retryLimit || 0
        }))
      }
    }
  }

  async function agentClaim(payload) {
    const agent = await authenticateAgent(payload)
    if (!agent) return { success: false, code: 'AGENT_AUTH_REQUIRED', message: 'invalid agent token' }
    const jobs = await listDocs('printJobs', { storeId: agent.storeId }, 200)
    const expired = jobs.filter(job => (job.status === JOB_STATUS.claimed || job.status === JOB_STATUS.sending) && new Date(job.leaseUntil || 0).getTime() <= Date.now())
    await Promise.all(expired.map(job => db.collection('printJobs').doc(job._id).update({
      data: { status: JOB_STATUS.queued, claimToken: '', agentId: '', deviceName: '', availableAt: now(), updateTime: now(), error: 'print agent lease expired; returned to queue' }
    })))
    const candidate = jobs.filter(job => job.status === JOB_STATUS.queued && new Date(job.availableAt || 0).getTime() <= Date.now()).sort((a, b) => new Date(a.createTime || 0) - new Date(b.createTime || 0))[0]
    if (!candidate) return { success: true, data: null }
    const claimToken = randomToken()
    const result = await db.runTransaction(async transaction => {
      const currentRes = await transaction.collection('printJobs').doc(candidate._id).get()
      const current = currentRes.data
      if (!current || current.status !== JOB_STATUS.queued) return null
      const claimedAt = now()
      await transaction.collection('printJobs').doc(candidate._id).update({
        data: { status: JOB_STATUS.claimed, agentId: agent._id, deviceName: agent.name, claimToken, claimedAt, leaseUntil: new Date(Date.now() + 2 * 60 * 1000), attempts: number(current.attempts, 0) + 1, updateTime: claimedAt }
      })
      return { ...current, status: JOB_STATUS.claimed, agentId: agent._id, deviceName: agent.name, claimToken, attempts: number(current.attempts, 0) + 1 }
    })
    if (!result) return { success: true, data: null }
    return { success: true, data: result }
  }

  async function agentStart(payload) {
    const agent = await authenticateAgent(payload)
    if (!agent) return { success: false, code: 'AGENT_AUTH_REQUIRED', message: 'invalid agent token' }
    const job = await getDoc('printJobs', text(payload.jobId))
    if (!job || job.storeId !== agent.storeId || job.agentId !== agent._id || job.claimToken !== text(payload.claimToken)) {
      return { success: false, code: 'PRINT_JOB_CLAIM_INVALID', message: 'print job claim invalid' }
    }
    await db.collection('printJobs').doc(job._id).update({ data: { status: JOB_STATUS.sending, sendingAt: now(), leaseUntil: new Date(Date.now() + 2 * 60 * 1000), updateTime: now() } })
    return { success: true }
  }

  async function agentResult(payload) {
    const agent = await authenticateAgent(payload)
    if (!agent) return { success: false, code: 'AGENT_AUTH_REQUIRED', message: 'invalid agent token' }
    const job = await getDoc('printJobs', text(payload.jobId))
    if (!job || job.storeId !== agent.storeId || job.agentId !== agent._id || job.claimToken !== text(payload.claimToken)) {
      return { success: false, code: 'PRINT_JOB_CLAIM_INVALID', message: 'print job claim invalid' }
    }
    const success = bool(payload.success)
    if (success) {
      await db.collection('printJobs').doc(job._id).update({ data: { status: JOB_STATUS.printed, printedAt: now(), updateTime: now(), error: '' } })
      await writeAgentLog(agent, { printerId: job.printerId, status: 'printed', message: `print job ${job._id} completed`, level: 'info' })
      return { success: true }
    }
    const error = text(payload.error || 'print failed')
    const attempts = number(job.attempts, 1)
    const retry = attempts <= number(job.retryLimit, 2)
    await db.collection('printJobs').doc(job._id).update({
      data: retry
        ? { status: JOB_STATUS.queued, availableAt: new Date(Date.now() + Math.pow(2, attempts) * 1000), error, claimToken: '', updateTime: now() }
        : { status: JOB_STATUS.failed, failedAt: now(), error, updateTime: now() }
    })
    await writeAgentLog(agent, { printerId: job.printerId, status: retry ? 'send_failed_retrying' : 'send_failed', message: error, level: 'error' })
    return { success: true, data: { retrying: retry } }
  }

  async function agentLog(payload) {
    const agent = await authenticateAgent(payload)
    if (!agent) return { success: false, code: 'AGENT_AUTH_REQUIRED', message: 'invalid agent token' }
    await writeAgentLog(agent, payload)
    return { success: true }
  }

  async function agentUsbDevices(payload) {
    const agent = await authenticateAgent(payload)
    if (!agent) return { success: false, code: 'AGENT_AUTH_REQUIRED', message: 'invalid agent token' }
    await db.collection('printerAgents').doc(agent._id).update({ data: { usbDevices: Array.isArray(payload.usbDevices) ? payload.usbDevices : [], lastSeenAt: now(), status: 'online', updateTime: now() } })
    return { success: true }
  }

  async function handleAdminAction(action, payload) {
    if (action === 'admin.print.dashboard') return dashboard(payload)
    if (action === 'admin.print.printers.list') return { success: true, data: await listPrinters(storeId(payload)) }
    if (action === 'admin.print.printers.save') return savePrinter(payload)
    if (action === 'admin.print.printers.status') return updatePrinterStatus(payload)
    if (action === 'admin.print.printers.delete') return deletePrinter(payload)
    if (action === 'admin.print.printers.clearPending') return clearPendingJobs(payload)
    if (action === 'admin.print.printers.test') return createTestJob(payload)
    if (action === 'admin.print.stations.list') return listStations(payload)
    if (action === 'admin.print.stations.save') return saveStation(payload)
    if (action === 'admin.print.dishes.list') return listDishRoutes(payload)
    if (action === 'admin.print.dishes.save') return saveDishRoutes(payload)
    if (action === 'admin.print.cashier.list') return listCashierConfigs(payload)
    if (action === 'admin.print.cashier.save') return saveCashierConfig(payload)
    if (action === 'admin.print.templates.list') return listTemplates(payload)
    if (action === 'admin.print.templates.save') return saveTemplate(payload)
    if (action === 'admin.print.templates.reset') return resetTemplate(payload)
    if (action === 'admin.print.templates.history') return templateHistory(payload)
    if (action === 'admin.print.templates.test') return testTemplate(payload)
    if (action === 'admin.print.jobs.list') return listJobs(payload)
    if (action === 'admin.print.jobs.detail') return getJob(payload)
    if (action === 'admin.print.jobs.reprint') return reprintJob(payload)
    if (action === 'admin.print.jobs.cancel') return cancelJob(payload)
    if (action === 'admin.print.logs.list') return listLogs(payload)
    if (action === 'admin.print.logs.clear') return clearLogs(payload)
    if (action === 'admin.print.alerts.list') return listAlerts(payload)
    if (action === 'admin.print.agents.createRegistration') return createAgentRegistration(payload)
    return null
  }

  async function handleAgentAction(action, payload) {
    if (action === 'print.agent.register') return agentRegister(payload)
    if (action === 'print.agent.heartbeat') return agentHeartbeat(payload)
    if (action === 'print.agent.bootstrap') return agentBootstrap(payload)
    if (action === 'print.agent.claim') return agentClaim(payload)
    if (action === 'print.agent.start') return agentStart(payload)
    if (action === 'print.agent.result') return agentResult(payload)
    if (action === 'print.agent.log') return agentLog(payload)
    if (action === 'print.agent.usbDevices') return agentUsbDevices(payload)
    return null
  }

  return {
    collectionNames: PRINT_COLLECTIONS,
    ensureDefaults,
    handleAdminAction,
    handleAgentAction,
    queueKitchenJobs,
    queueCashierReceipt,
    JOB_STATUS
  }
}

module.exports = {
  createPrintService,
  JOB_STATUS,
  isEmptyValue,
  mergeKitchenDishes
}
