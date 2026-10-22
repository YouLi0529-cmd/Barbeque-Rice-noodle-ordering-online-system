const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const source = fs.readFileSync(path.join(__dirname, '../cloudfunctions/tenantApi/index.js'), 'utf8')
const queryFunctions = source.slice(source.indexOf('async function getSingleAdminTableOrders('), source.indexOf('async function getAdminTableOrders('))
const transferFunction = source.slice(source.indexOf('async function adminTransferTable('), source.indexOf('function getOrderGrossAmount('))

function createTransfer(orders) {
  const writes = []
  const paid = order => order.pay_status === true || order.payStatus === true || ['paid', 'completed'].includes(order.status)
  const visible = order => order && order.type === 'order' && !order.deleted && !order.tableCleared && !['cancelled', 'closed', '3'].includes(String(order.status))
  const ref = (areaKey, tableNumber) => ({ areaKey: areaKey || 'normal', tableNumber: String(tableNumber).padStart(2, '0'), tableKey: `${areaKey || 'normal'}-${String(tableNumber).padStart(2, '0')}` })
  const context = vm.createContext({
    Date,
    console,
    db: {
      serverDate: () => new Date(),
      collection(name) {
        assert.equal(name, 'order')
        return {
          where(criteria) {
            let rows = orders.filter(order => Object.entries(criteria).every(([key, value]) => (
              value && value.values ? value.values.includes(order[key]) : order[key] === value
            )))
            const query = {
              orderBy(key, direction) {
                rows = rows.slice().sort((a, b) => (a[key] - b[key]) * (direction === 'desc' ? -1 : 1))
                return query
              },
              limit(count) { rows = rows.slice(0, count); return query },
              async get() { return { data: rows } }
            }
            return query
          },
          doc(id) {
            return { async update({ data }) { writes.push({ id, data }); Object.assign(orders.find(order => order._id === id), data) } }
          }
        }
      }
    },
    _: { in: values => ({ values }) },
    padTableNumber: value => String(value).padStart(2, '0'),
    getAdminTableNumberCandidates: (area, number) => [number],
    parseAdminTableNumber: number => ref('normal', number),
    getAdminTableRef: ref,
    isAdminTableOrder: visible,
    isAdminPaidOrder: paid,
    isClosedOrderContext: order => !visible(order) || paid(order),
    getActiveTableGroupForRef: async () => null,
    expandActiveTableOrderTree: async rows => rows.filter(order => visible(order) && !paid(order)),
    getActiveTableSessionForRef: async () => null,
    formatAdminTableNumber: table => table.tableNumber,
    getMergedTablesFromOrders: (rows, fallback) => [fallback],
    replaceAdminTableRef: (rows, from, to) => rows.map(row => row.tableKey === from.tableKey ? to : row),
    isSameAdminTableRef: (a, b) => a && b && a.tableKey === b.tableKey,
    migrateSharedCartSessionForTableTransfer: async () => ({ migrated: true })
  })
  vm.runInContext(`${queryFunctions}\n${transferFunction}`, context)
  return { transfer: context.adminTransferTable, writes }
}

const payload = { sourceAreaKey: 'normal', sourceTableNumber: '14', targetAreaKey: 'normal', targetTableNumber: '13' }
const history = table => Array.from({ length: 120 }, (_, index) => ({
  _id: `paid-${table}-${index}`, type: 'order', tableNumber: table, status: 'completed', createTime: index, finalPrice: 20
}))
const active = (id, table, extra = {}) => ({
  _id: id, type: 'order', tableNumber: table, status: 'submitted', createTime: 1000, finalPrice: 193, rootOrderId: id, ...extra
})

test('transfers the current 14 visit to 13 after more than 100 historical orders', async () => {
  const oldOrders = [...history('14'), ...history('13')]
  const root = active('current-14', '14')
  const addOn = active('addon-14', '14', { rootOrderId: root._id, addOnIndex: 1 })
  const { transfer, writes } = createTransfer([...oldOrders, root, addOn])
  const result = await transfer(payload)
  assert.equal(result.success, true)
  assert.equal(result.data.updatedOrders, 2)
  assert.equal(root.tableNumber, '13')
  assert.equal(addOn.tableNumber, '13')
  assert.deepEqual(writes.map(write => write.id).sort(), ['addon-14', 'current-14'])
  assert.ok(oldOrders.every(order => order.tableNumber === (order._id.includes('-14-') ? '14' : '13')))
})

test('blocks transfer when target has a current order hidden behind historical orders', async () => {
  const { transfer, writes } = createTransfer([...history('13'), active('current-14', '14'), active('current-13', '13')])
  const result = await transfer(payload)
  assert.equal(result.code, 'TARGET_TABLE_OCCUPIED')
  assert.equal(writes.length, 0)
})

test('does not transfer completed or cancelled source orders', async () => {
  const { transfer, writes } = createTransfer([...history('14'), active('cancelled-14', '14', { status: 'cancelled' })])
  const result = await transfer(payload)
  assert.equal(result.code, 'NO_ACTIVE_ORDER')
  assert.equal(writes.length, 0)
})
