const assert = require('assert')
const crypto = require('crypto')
const { createPrintService, isEmptyValue, mergeKitchenDishes } = require('../cloudfunctions/tenantApi/printService')

assert.strictEqual(isEmptyValue(null), true)
assert.strictEqual(isEmptyValue(undefined), true)
assert.strictEqual(isEmptyValue('   '), true)
assert.strictEqual(isEmptyValue([]), true)
assert.strictEqual(isEmptyValue(0), false)
assert.strictEqual(isEmptyValue(false), false)

const merged = mergeKitchenDishes([
  { index: 0, item: { dishId: 'meat', dishName: 'beef', count: 1, spec: 'regular', method: 'grill', taste: 'mild', remark: 'less salt' } },
  { index: 1, item: { dishId: 'meat', dishName: 'beef', count: 2, spec: 'regular', method: 'grill', taste: 'mild', remark: 'less salt' } },
  { index: 2, item: { dishId: 'meat', dishName: 'beef', count: 1, spec: 'large', method: 'grill', taste: 'mild', remark: 'less salt' } },
  { index: 3, item: { dishId: 'meat', dishName: 'beef', count: 1, spec: 'regular', method: 'grill', taste: 'mild', remark: 'no cilantro' } }
])

assert.strictEqual(merged.length, 3)
assert.strictEqual(merged[0].count, 3)
assert.deepStrictEqual(merged[0].sourceIndexes, [0, 1])
assert.strictEqual(merged[1].count, 1)
assert.strictEqual(merged[2].count, 1)

function createMemoryDb() {
  const collections = {}
  let increment = 0
  const getCollection = name => {
    if (!collections[name]) collections[name] = {}
    return collections[name]
  }
  const matches = (doc, where) => Object.keys(where || {}).every(key => doc[key] === where[key])
  const makeDoc = (name, id) => ({
    async get() { return { data: getCollection(name)[id] } },
    async set({ data }) { getCollection(name)[id] = { ...JSON.parse(JSON.stringify(data)), _id: id }; return { _id: id } },
    async update({ data }) { getCollection(name)[id] = { ...(getCollection(name)[id] || {}), ...JSON.parse(JSON.stringify(data)) } },
    async remove() { delete getCollection(name)[id] }
  })
  return {
    collection(name) {
      return {
        doc: id => makeDoc(name, id),
        where(where) {
          return {
            limit() {
              return {
                async get() { return { data: Object.values(getCollection(name)).filter(doc => matches(doc, where)) } }
              }
            }
          }
        },
        limit() {
          return { async get() { return { data: Object.values(getCollection(name)) } } }
        },
        async add({ data }) {
          increment += 1
          const id = `${name}-${increment}`
          getCollection(name)[id] = { ...JSON.parse(JSON.stringify(data)), _id: id }
          return { _id: id }
        }
      }
    },
    data: collections
  }
}

async function verifyKitchenRouting() {
  const db = createMemoryDb()
  const service = createPrintService({ db, _: {}, defaultTenantId: 'store-test' })
  assert.strictEqual(service.formatTicketTableNumber('05'), '5')
  assert.strictEqual(service.formatTicketTableNumber('VIP01'), 'VIP1')
  assert.strictEqual(service.formatTicketTableNumber('天楼02'), '天2')
  assert.strictEqual(service.formatTicketTableNumber('普通02号桌'), '普通2号桌')
  assert.strictEqual(service.formatTicketTableNumber('天楼10'), '天10')
  assert.strictEqual(service.formatTicketTableNumber('A10'), 'A10')
  const kitchenLines = service.renderDishLines({ size: 'large' }, {
    paperWidth: 80,
    dishes: [{ dishName: '长菜名测试超过一行宽度的菜品', count: 2 }]
  })
  assert.ok(kitchenLines[0].text.endsWith('2份'))
  assert.strictEqual(kitchenLines[0].size, 'large')
  assert.ok(kitchenLines.slice(1).every(line => line.size === 'large'))
  const oversizedKitchenLine = service.renderDishLines({ size: 'xxxlarge' }, {
    paperWidth: 58,
    dishes: [{ dishName: '牛肉', count: 99 }]
  })[0]
  assert.ok(oversizedKitchenLine.text.endsWith('99份'))
  assert.strictEqual(oversizedKitchenLine.size, 'xxlarge')
  db.data.dish = {
    'hot-beef': { _id: 'hot-beef', name: '招牌秘制牛肉', kitchenPrintName: '牛肉' }
  }
  const stationsResult = await service.handleAdminAction('admin.print.stations.list', { tenantId: 'store-test' })
  const hotStation = stationsResult.data.find(station => station.code === 'hot-dishes')
  assert.ok(hotStation)
  await service.handleAdminAction('admin.print.dishes.save', {
    tenantId: 'store-test', dishIds: ['hot-beef'], stationId: hotStation._id, printEnabled: true
  })
  const order = { _id: 'order-1', orderNumber: 'ORD-1', tableNumber: 'A01', createTime: new Date(), isAddOnOrder: false }
  const dispatch = await service.queueKitchenJobs({
    id: 'store-test',
    order,
    eventKey: 'first-submit',
    dishEntries: [
      { index: 0, item: { dishId: 'hot-beef', dishName: 'hot beef', count: 1 } },
      { index: 1, item: { dishId: 'unassigned-tofu', dishName: 'tofu', count: 1 } }
    ]
  })
  assert.strictEqual(dispatch.results.length, 2)
  assert.strictEqual(Object.values(db.data.printJobs).length, 2)
  assert.strictEqual(Object.values(db.data.unassignedDishAlerts).length, 1)
  const kitchenJob = Object.values(db.data.printJobs).find(job => job.payload.dishIndexes.includes(0))
  const alignedKitchenText = kitchenJob.ticket.lines.map(line => String(line.text || '')).join('\n')
  assert.match(alignedKitchenText, /\u725b\u8089\s+1\u4efd/)
  assert.ok(!kitchenJob.ticket.lines.some(line => String(line.text || '').includes('招牌秘制牛肉')))
  const kitchenTemplate = (await service.handleAdminAction('admin.print.templates.list', { tenantId: 'store-test' })).data.find(template => template.ticketType === 'kitchen_order' && template.bindScope === 'global')
  const renamedKitchen = await service.handleAdminAction('admin.print.templates.save', {
    tenantId: 'store-test', template: { ...kitchenTemplate, name: '烤肉制作单' }
  })
  assert.strictEqual(renamedKitchen.success, true)
  const newKitchenOrder = { ...order, _id: 'renamed-kitchen-order' }
  await service.queueKitchenJobs({ id: 'store-test', order: newKitchenOrder, eventKey: 'renamed', dishEntries: [{ index: 0, item: { dishId: 'hot-beef', dishName: '招牌秘制牛肉', count: 1 } }] })
  const renamedKitchenJob = Object.values(db.data.printJobs).find(job => job.orderId === newKitchenOrder._id)
  assert.ok(renamedKitchenJob.ticket.lines.some(line => line.key === 'title' && line.text === '烤肉制作单'))
  await service.queueKitchenJobs({ id: 'store-test', order, eventKey: 'first-submit', dishEntries: [{ index: 0, item: { dishId: 'hot-beef', dishName: 'hot beef', count: 1 } }, { index: 1, item: { dishId: 'unassigned-tofu', dishName: 'tofu', count: 1 } }] })
  assert.strictEqual(Object.values(db.data.printJobs).length, 3)

  const templates = (await service.handleAdminAction('admin.print.templates.list', { tenantId: 'store-test' })).data
  const prebillTemplate = templates.find(template => template.ticketType === 'prebill')
  const savedTemplate = await service.handleAdminAction('admin.print.templates.save', {
    tenantId: 'store-test',
    template: {
      ...prebillTemplate,
      fields: prebillTemplate.fields.map(field => field.key === 'shopName'
        ? { ...field, content: '张南烤肉', size: 'xxlarge' }
        : field).concat({ id: 'large-note', key: 'customText', label: '自定义文字', content: '欢迎光临', size: 'xxxlarge' })
    }
  })
  assert.strictEqual(savedTemplate.success, true)
  assert.strictEqual(savedTemplate.data.fields.find(field => field.key === 'shopName').content, '张南烤肉')
  assert.strictEqual(savedTemplate.data.fields.find(field => field.key === 'shopName').size, 'xxlarge')
  assert.strictEqual(savedTemplate.data.fields.find(field => field.key === 'customText').size, 'xxxlarge')
  const templatesAfterPrebillSave = (await service.handleAdminAction('admin.print.templates.list', { tenantId: 'store-test' })).data
  const checkoutAfterPrebillSave = templatesAfterPrebillSave.find(template => template.ticketType === 'checkout' && template.bindScope === 'global')
  assert.ok(!checkoutAfterPrebillSave.fields.find(field => field.key === 'shopName').content)
  await service.queueCashierReceipt({
    id: 'store-test', ticketType: 'prebill', eventKey: 'original-name',
    orders: [{ ...order, goods: [{ dishId: 'hot-beef', dishName: '招牌秘制牛肉', count: 1, price: 28, specification: 'large', remark: 'mild' }] }]
  })
  const prebill = Object.values(db.data.printJobs).find(job => job.ticketType === 'prebill')
  assert.ok(prebill.ticket.lines.some(line => line.key === 'shopName' && line.text === '张南烤肉' && line.size === 'xxlarge'))
  assert.ok(prebill.ticket.lines.some(line => line.key === 'customText' && line.text === '欢迎光临' && line.size === 'xxxlarge'))
  assert.ok(prebill.ticket.lines.some(line => String(line.text || '').includes('招牌秘制牛肉')))
  assert.ok(prebill.ticket.lines.some(line => line.key === 'dishSpecification' && line.size === 'normal'))
  assert.ok(prebill.ticket.lines.some(line => line.key === 'dishRemark' && line.size === 'normal'))
  await service.handleAdminAction('admin.print.templates.save', {
    tenantId: 'store-test',
    template: { ...checkoutAfterPrebillSave, fields: checkoutAfterPrebillSave.fields.map(field => field.key === 'shopName' ? { ...field, content: '结账专用店名' } : field) }
  })
  const prebillAfterCheckoutSave = (await service.handleAdminAction('admin.print.templates.list', { tenantId: 'store-test' })).data.find(template => template.ticketType === 'prebill' && template.bindScope === 'global')
  assert.strictEqual(prebillAfterCheckoutSave.fields.find(field => field.key === 'shopName').content, '张南烤肉')

  const customerTemplate = templates.find(template => template.ticketType === 'customer_order' && template.bindScope === 'global')
  const customizedCustomer = await service.handleAdminAction('admin.print.templates.save', {
    tenantId: 'store-test',
    template: {
      ...customerTemplate,
      fields: customerTemplate.fields.map(field => field.key === 'shopName'
        ? { ...field, content: '张南烤肉' }
        : field.key === 'dishes' ? { ...field, content: 'ignored', specificationSize: 'small', remarkSize: 'large' } : field)
    }
  })
  assert.strictEqual(customizedCustomer.success, true)
  assert.strictEqual(customizedCustomer.data.fields.find(field => field.key === 'dishes').content, undefined)
  const firstOrder = { ...order, _id: 'order-guest-1', rootOrderId: 'order-guest-1', totalPrice: 28, finalPrice: 28, goods: [{ dishId: 'hot-beef', dishName: '招牌秘制牛肉', count: 1, price: 28, specification: 'large', remark: 'mild' }] }
  const addOrder = { ...order, _id: 'order-guest-2', rootOrderId: 'order-guest-1', isAddOnOrder: true, totalPrice: 12, finalPrice: 12, goods: [{ dishId: 'drink', dishName: '啤酒', count: 2, price: 6 }] }
  const frontStation = stationsResult.data.find(station => station.code === 'front-counter')
  await service.handleAdminAction('admin.print.dishes.save', {
    tenantId: 'store-test', dishIds: ['drink'], stationId: frontStation._id, printEnabled: true
  })
  const frontKitchenPrint = await service.queueKitchenJobs({
    id: 'store-test', order: addOrder, eventKey: 'auto-submit:order-guest-2',
    dishEntries: [{ index: 0, item: addOrder.goods[0] }]
  })
  assert.strictEqual(frontKitchenPrint.results.length, 1)
  assert.strictEqual(frontKitchenPrint.results[0].stationId, frontStation._id)
  assert.strictEqual(Object.values(db.data.printJobs).find(job => job.orderId === addOrder._id).ticketType, 'kitchen_add')
  const customerPrint = await service.queueCashierReceipt({ id: 'store-test', ticketType: 'customer_order', orders: [firstOrder, addOrder], eventKey: 'auto-submit:order-guest-2' })
  assert.strictEqual(customerPrint.jobs.length, 1)
  const customerJob = customerPrint.jobs[0]
  assert.strictEqual(customerJob.printerId, Object.values(db.data.printers).find(printer => printer.code === 'front-counter')._id)
  assert.strictEqual(frontKitchenPrint.results[0].printerId, customerJob.printerId)
  assert.ok(customerJob.ticket.lines.some(line => line.key === 'shopName' && line.text === '张南烤肉'))
  assert.ok(customerJob.ticket.lines.some(line => line.key === 'dishName' && line.text.includes('招牌秘制牛肉')))
  assert.ok(customerJob.ticket.lines.some(line => line.key === 'dishName' && line.text.includes('啤酒')))
  assert.ok(customerJob.ticket.lines.some(line => line.key === 'dishSpecification' && line.size === 'small'))
  assert.ok(customerJob.ticket.lines.some(line => line.key === 'dishRemark' && line.size === 'large'))
  assert.ok(customerJob.ticket.lines.some(line => line.key === 'totalPrice' && line.text.includes('40')))
  const skyPrint = await service.queueCashierReceipt({
    id: 'store-test', ticketType: 'customer_order',
    orders: [{ ...firstOrder, _id: 'sky-order', tableNumber: 'T1' }],
    eventKey: 'sky-table-display'
  })
  assert.strictEqual(skyPrint.jobs[0].tableNumber, '\u59291')
  assert.ok(skyPrint.jobs[0].ticket.lines.some(line => line.key === 'tableNumber' && line.text.includes('\u59291')))
  const repeatPrint = await service.queueCashierReceipt({ id: 'store-test', ticketType: 'customer_order', orders: [firstOrder, addOrder], eventKey: 'auto-submit:order-guest-2' })
  assert.strictEqual(repeatPrint.jobs[0]._id, customerJob._id)

  const scopedCustomer = await service.handleAdminAction('admin.print.templates.save', {
    tenantId: 'store-test',
    template: { ...customerTemplate, name: '前台客单', bindScope: 'printer', printerId: customerJob.printerId }
  })
  assert.strictEqual(scopedCustomer.success, true)
  const scopedPrint = await service.queueCashierReceipt({ id: 'store-test', ticketType: 'customer_order', orders: [firstOrder], eventKey: 'scoped-customer' })
  assert.strictEqual(scopedPrint.jobs[0].ticketName, '前台客单')
  const deleted = await service.handleAdminAction('admin.print.templates.delete', { tenantId: 'store-test', templateId: scopedCustomer.data._id })
  assert.strictEqual(deleted.success, true)
  const remaining = (await service.handleAdminAction('admin.print.templates.list', { tenantId: 'store-test' })).data
  assert.ok(remaining.some(template => template._id === customerTemplate._id))
  assert.ok(remaining.find(template => template._id === customerTemplate._id).isSystemDefault)
  assert.ok(!remaining.some(template => template._id === scopedCustomer.data._id))
  const protectedDefault = await service.handleAdminAction('admin.print.templates.delete', { tenantId: 'store-test', templateId: customerTemplate._id })
  assert.strictEqual(protectedDefault.code, 'DEFAULT_TEMPLATE_REQUIRED')

  db.data.printers['other-usb'] = { _id: 'other-usb', storeId: 'store-test', name: '别的 USB 打印机', connectionType: 'usb', status: true, paperWidth: 58 }
  const checkoutConfig = Object.values(db.data.cashierPrintConfigs).find(config => config.ticketType === 'checkout')
  checkoutConfig.printerId = 'other-usb'
  const checkoutTemplate = templates.find(template => template.ticketType === 'checkout' && template.bindScope === 'global')
  const frontCheckoutTemplate = await service.handleAdminAction('admin.print.templates.save', {
    tenantId: 'store-test',
    template: { ...checkoutTemplate, name: '前台结账单', bindScope: 'printer', printerId: customerJob.printerId }
  })
  assert.strictEqual(frontCheckoutTemplate.success, true)
  const checkoutPrint = await service.queueCashierReceipt({
    id: 'store-test', ticketType: 'checkout', orders: [firstOrder, addOrder],
    checkoutSummary: { totalPrice: 40, receivable: 40 }, eventKey: 'checkout:guest-order'
  })
  assert.strictEqual(checkoutPrint.jobs.length, 1)
  assert.strictEqual(checkoutPrint.jobs[0].printerId, customerJob.printerId)
  assert.strictEqual(checkoutPrint.jobs[0].ticketName, '前台结账单')
  await service.handleAdminAction('admin.print.templates.delete', { tenantId: 'store-test', templateId: frontCheckoutTemplate.data._id })
  const fallbackCheckout = await service.queueCashierReceipt({
    id: 'store-test', ticketType: 'checkout', orders: [firstOrder, addOrder],
    checkoutSummary: { totalPrice: 40, receivable: 40 }, eventKey: 'checkout:fallback'
  })
  assert.strictEqual(fallbackCheckout.jobs[0].ticketName, checkoutTemplate.name)
  assert.strictEqual(fallbackCheckout.jobs[0].printerId, customerJob.printerId)

  const editableKeys = ['title', 'shopName', 'banquetName', 'tableNumber', 'tableInfo', 'orderNumber', 'customData', 'peopleCount', 'seatCount', 'orderType', 'openingRemark', 'totalCount', 'orderAmount', 'receivableAmount', 'totalPrice', 'orderTime', 'printTime', 'customText']
  const fieldMatrix = editableKeys.map((key, index) => ({
    id: `matrix-${index}`, key, label: key, content: `自定义-${key}`,
    size: 'normal', align: 'left', bold: false, inverse: false, color: 'black', dividerAfter: false, blankBefore: false
  })).concat({ id: 'matrix-dishes', key: 'dishes', label: '菜品明细', content: '不能覆盖菜品', size: 'normal' })
  const matrixSave = await service.handleAdminAction('admin.print.templates.save', {
    tenantId: 'store-test', template: { ...customerTemplate, name: '全字段测试', paperWidth: 76, fields: fieldMatrix }
  })
  assert.strictEqual(matrixSave.success, true)
  const matrixReload = (await service.handleAdminAction('admin.print.templates.list', { tenantId: 'store-test' })).data.find(template => template._id === customerTemplate._id)
  assert.strictEqual(matrixReload.paperWidth, 76)
  editableKeys.forEach(key => assert.strictEqual(matrixReload.fields.find(field => field.key === key).content, `自定义-${key}`))
  assert.strictEqual(matrixReload.fields.find(field => field.key === 'dishes').content, undefined)
  const matrixPrint = await service.queueCashierReceipt({ id: 'store-test', ticketType: 'customer_order', orders: [firstOrder], eventKey: 'field-matrix' })
  editableKeys.forEach(key => assert.ok(matrixPrint.jobs[0].ticket.lines.some(line => line.key === key && line.text === `自定义-${key}`)))
  assert.ok(matrixPrint.jobs[0].ticket.lines.some(line => line.key === 'dishName' && line.text.includes('招牌秘制牛肉')))
  const resetMatrix = await service.handleAdminAction('admin.print.templates.reset', { tenantId: 'store-test', templateId: customerTemplate._id, ticketType: 'customer_order' })
  assert.strictEqual(resetMatrix.data.name, '客单')
  assert.strictEqual(resetMatrix.data.paperWidth, 58)
  assert.ok(!resetMatrix.data.fields.find(field => field.key === 'shopName').content)
}

async function verifyKitchenPrintFailureSync() {
  const db = createMemoryDb()
  const service = createPrintService({ db, _: {}, defaultTenantId: 'store-test' })
  const agentToken = 'agent-token'
  const agentId = 'agent-1'
  const jobId = 'job-1'
  db.data.order = {
    'order-1': {
      _id: 'order-1',
      goods: [
        { dishName: 'chicken cartilage', kitchenSent: true, kitchenStatus: 'queued' },
        { dishName: 'lotus root', kitchenSent: true, kitchenStatus: 'queued' }
      ],
      kitchenPrintStatus: 'queued'
    }
  }
  db.data.printerAgents = {
    [agentId]: {
      _id: agentId,
      storeId: 'store-test',
      name: 'test-agent',
      deviceTokenHash: crypto.createHash('sha256').update(agentToken).digest('hex')
    }
  }
  db.data.printJobs = {
    [jobId]: {
      _id: jobId,
      storeId: 'store-test',
      agentId,
      claimToken: 'claim-1',
      printerId: '',
      attempts: 1,
      retryLimit: 0,
      payload: { kind: 'kitchen_order', orderId: 'order-1', dishIndexes: [1] }
    }
  }

  const result = await service.handleAgentAction('print.agent.result', {
    agentId,
    agentToken,
    jobId,
    claimToken: 'claim-1',
    success: false,
    error: 'printer unreachable'
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(db.data.printJobs[jobId].status, 'failed')
  assert.strictEqual(db.data.order['order-1'].goods[0].kitchenStatus, 'queued')
  assert.strictEqual(db.data.order['order-1'].goods[1].kitchenStatus, 'failed')
  assert.strictEqual(db.data.order['order-1'].kitchenPrintStatus, 'partial_failed')
  assert.strictEqual(db.data.order['order-1'].kitchenPrinted, false)
}

async function verifyPrinterScopeAndHealth() {
  const db = createMemoryDb()
  const service = createPrintService({ db, _: {}, defaultTenantId: 'store-test' })
  const templates = (await service.handleAdminAction('admin.print.templates.list', { tenantId: 'store-test' })).data
  const printers = (await service.handleAdminAction('admin.print.printers.list', { tenantId: 'store-test' })).data
  const cashier = printers.find(printer => printer.usage === 'cashier')
  const dessert = printers.find(printer => printer.code === 'dessert')
  assert.ok(cashier)
  assert.ok(dessert)

  const legacyDessertStation = Object.values(db.data.printStations).find(station => station.code === 'dessert')
  delete legacyDessertStation.printerId
  delete legacyDessertStation.status
  await service.ensureDefaults('store-test')
  const migratedDessertStation = Object.values(db.data.printStations).find(station => station.code === 'dessert')
  assert.strictEqual(migratedDessertStation.printerId, dessert._id)
  assert.strictEqual(migratedDessertStation.status, true)

  const frontCounterStation = await service.handleAdminAction('admin.print.stations.save', {
    tenantId: 'store-test',
    station: { name: 'front counter station', code: 'front-counter', printerId: cashier._id, status: true }
  })
  assert.strictEqual(frontCounterStation.success, true)
  assert.strictEqual(frontCounterStation.data.printerId, cashier._id)

  const savedStation = await service.handleAdminAction('admin.print.stations.save', {
    tenantId: 'store-test',
    station: { name: 'dessert station', code: 'dessert', printerId: dessert._id, status: true }
  })
  assert.strictEqual(savedStation.success, true)
  assert.strictEqual(savedStation.data.printerId, dessert._id)
  const stations = await service.handleAdminAction('admin.print.stations.list', { tenantId: 'store-test' })
  const dessertStation = stations.data.find(station => station.code === 'dessert')
  assert.strictEqual(dessertStation.printerId, dessert._id)
  assert.strictEqual(dessertStation.printer._id, dessert._id)

  const kitchenTemplate = templates.find(template => template.ticketType === 'kitchen_order' && template.bindScope === 'global')
  const scoped = await service.handleAdminAction('admin.print.templates.save', {
    tenantId: 'store-test',
    template: {
      ...kitchenTemplate,
      bindScope: 'printer',
      printerId: dessert._id,
      fields: kitchenTemplate.fields
    }
  })
  assert.strictEqual(scoped.success, true)
  assert.strictEqual(scoped.data.printerId, dessert._id)

  const testResult = await service.handleAdminAction('admin.print.templates.test', {
    tenantId: 'store-test',
    templateId: scoped.data._id,
    ticketType: 'kitchen_order',
    printerId: dessert._id
  })
  assert.strictEqual(testResult.success, true)
  assert.strictEqual(testResult.data.printerId, dessert._id)

  const token = 'health-agent-token'
  db.data.printerAgents = {
    'agent-health': {
      _id: 'agent-health',
      storeId: 'store-test',
      name: 'health agent',
      deviceTokenHash: crypto.createHash('sha256').update(token).digest('hex')
    }
  }
  const healthResult = await service.handleAgentAction('print.agent.printerHealth', {
    tenantId: 'store-test',
    agentId: 'agent-health',
    agentToken: token,
    printers: [{ printerId: dessert._id, networkStatus: 'reachable', networkLatencyMs: 12, hardwareStatus: 'paper_out', hardwareStatusSource: 'escpos_realtime' }]
  })
  assert.strictEqual(healthResult.success, true)
  assert.strictEqual(db.data.printers[dessert._id].networkStatus, 'reachable')
  assert.strictEqual(db.data.printers[dessert._id].hardwareStatus, 'paper_out')

  await service.handleAdminAction('admin.print.printers.hardwareStatus', {
    tenantId: 'store-test',
    printerId: dessert._id,
    hardwareStatus: 'jammed'
  })
  await service.handleAgentAction('print.agent.printerHealth', {
    tenantId: 'store-test',
    agentId: 'agent-health',
    agentToken: token,
    printers: [{ printerId: dessert._id, networkStatus: 'reachable', hardwareStatus: 'unknown', hardwareStatusSource: 'network_only' }]
  })
  assert.strictEqual(db.data.printers[dessert._id].hardwareStatus, 'jammed')
  assert.strictEqual(db.data.printers[dessert._id].hardwareStatusSource, 'manual')
}

Promise.all([verifyKitchenRouting(), verifyKitchenPrintFailureSync(), verifyPrinterScopeAndHealth()])
  .then(() => console.log('kitchen routing, printer scope, and health tests passed'))
  .catch(error => { console.error(error); process.exitCode = 1 })

console.log('print-core tests passed')
