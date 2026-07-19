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
  await service.queueKitchenJobs({ id: 'store-test', order, eventKey: 'first-submit', dishEntries: [{ index: 0, item: { dishId: 'hot-beef', dishName: 'hot beef', count: 1 } }, { index: 1, item: { dishId: 'unassigned-tofu', dishName: 'tofu', count: 1 } }] })
  assert.strictEqual(Object.values(db.data.printJobs).length, 2)
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

  const invalidStation = await service.handleAdminAction('admin.print.stations.save', {
    tenantId: 'store-test',
    station: { name: 'invalid kitchen station', code: 'invalid', printerId: cashier._id, status: true }
  })
  assert.strictEqual(invalidStation.success, false)
  assert.strictEqual(invalidStation.code, 'STATION_KITCHEN_PRINTER_REQUIRED')

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
