const assert = require('assert')
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

verifyKitchenRouting()
  .then(() => console.log('kitchen routing tests passed'))
  .catch(error => { console.error(error); process.exitCode = 1 })

console.log('print-core tests passed')
