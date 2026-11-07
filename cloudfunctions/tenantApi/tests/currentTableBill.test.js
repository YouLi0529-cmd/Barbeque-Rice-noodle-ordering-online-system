'use strict'

const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const test = require('node:test')
const assert = require('node:assert/strict')

const source = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8')
const start = source.indexOf('async function queryAdminBillDocuments(')
const end = source.indexOf('\nasync function expandActiveTableOrderTree(', start)
if (start < 0 || end < 0) throw new Error('current table bill functions not found')

function makeHarness(data) {
  const queries = []
  const context = {
    db: { collection(name) { return { where(condition) {
      queries.push({ name, condition })
      let skip = 0
      return {
        orderBy() { return this },
        skip(value) { skip = value; return this },
        async get() { return { data: (data[name] || []).filter(doc => Object.keys(condition).every(key => {
          const expected = condition[key]
          return Array.isArray(expected) ? expected.includes(doc[key]) : doc[key] === expected
        })).slice(skip) } },
        limit(limit) { return { get: async () => ({ data: (data[name] || []).filter(doc => Object.keys(condition).every(key => {
          const expected = condition[key]
          return Array.isArray(expected) ? expected.includes(doc[key]) : doc[key] === expected
        })).slice(skip, skip + limit) }) } }
      }
    } } } },
    _: { in: values => values },
    ACTIVE_ADMIN_TABLE_ORDER_STATUSES: ['submitted', 'pending_prepare', 'preparing'],
    formatAdminTableNumber: ref => ref.tableNumber,
    getSharedCartSessionId: number => 'table_' + number,
    getAdminTableNumberCandidates: (_, number) => [number],
    getOrderTableRef: order => ({ areaKey: 'normal', tableNumber: order.tableNumber }),
    isSameAdminTableRef: (left, right) => !!left && !!right && left.tableNumber === right.tableNumber,
    isMergedTableSession: session => !!session && session.status === 'merged' && !!session.mergedIntoSessionId,
    isActiveTableSession: session => !!session && session.status === 'ordering',
    isAdminTableOrder: order => order.type === 'order' && !order.deleted && !order.tableCleared && order.status !== 'cancelled',
    isAdminPaidOrder: order => order.payStatus === true,
    isClosedOrderContext: order => order.status === 'cancelled' || order.payStatus === true || order.tableCleared === true,
    getTableGroupRefs: group => group.tables,
    getTableGroupSnapshot: group => group && ({ tableGroupPrimary: group.primaryTable, tableGroupTables: group.tables }),
    getTimeValue: value => value || 0
  }
  const bill = vm.runInNewContext(source.slice(start, end) + '\n;getAdminTableBill', context)
  return { bill, queries, reader: context.db }
}

const table = number => ({ areaKey: 'normal', tableNumber: number })
const order = (id, root, visit, number, extra = {}) => ({
  _id: id, type: 'order', rootOrderId: root, tableVisitId: visit, tableNumber: number,
  status: 'submitted', createTime: Number(id.replace(/\D/g, '')) || 0, ...extra
})

test('current visit reads every add-on even with over 300 unrelated orders', async () => {
  const data = {
    tableOrderSession: [{ _id: 'table_01', status: 'ordering', visitId: 'v1', activeOrderRootId: 'root' }],
    order: Array.from({ length: 350 }, (_, i) => order('other' + i, 'other', 'other-visit', '02'))
      .concat(Array.from({ length: 121 }, (_, i) => order(i === 0 ? 'root' : 'add' + i, 'root', 'v1', '01')))
      .concat([order('old', 'root', 'old-visit', '01'), order('cancelled', 'root', 'v1', '01', { status: 'cancelled' })])
  }
  const { bill, queries } = makeHarness(data)
  const result = await bill(table('01'))
  assert.equal(result.orders.length, 121)
  assert.equal(result.orders.some(item => item._id === 'old'), false)
  assert.equal(result.orders.some(item => item._id === 'cancelled'), false)
  assert.ok(queries.filter(query => query.name === 'order').every(query => query.condition.rootOrderId || query.condition._id))
})

test('merged tables read each root from the active group and child resolves to primary', async () => {
  const group = { _id: 'g1', status: 'active', primarySessionId: 'table_01', primaryTable: table('01'), tables: [table('01'), table('02')] }
  const data = {
    tableOrderSession: [
      { _id: 'table_01', status: 'ordering', visitId: 'v1', activeOrderRootId: 'r1', tableGroupId: 'g1' },
      { _id: 'table_02', status: 'merged', mergedIntoSessionId: 'table_01', tableGroupId: 'g1' }
    ], tableGroup: [group],
    order: [order('r1', 'r1', 'v1', '01', { tableGroupId: 'g1' }), order('r2', 'r2', 'v2', '02', { tableGroupId: 'g1' }),
      order('unrelated', 'r3', 'v3', '03', { tableGroupId: 'old' })]
  }
  const { bill } = makeHarness(data)
  const result = await bill(table('02'))
  assert.deepEqual(Array.from(result.orders, item => item._id).sort(), ['r1', 'r2'])
  assert.equal(result.session._id, 'table_01')
})

test('without an active session an unpaid order is reported instead of silently reused', async () => {
  const { bill } = makeHarness({ order: [order('old', 'old', 'v1', '01')] })
  await assert.rejects(() => bill(table('01')), /用餐状态不一致/)
})

test('a paid, uncleared bill remains visible after its session ends', async () => {
  const { bill } = makeHarness({ order: [order('paid', 'paid', 'v1', '01', { payStatus: true })] })
  assert.equal((await bill(table('01'), { includePaid: true })).orders.length, 1)
  assert.equal((await bill(table('01'))).orders.length, 0)
})

test('a refunded first order remains the visit anchor while its live add-on stays in the bill', async () => {
  const { bill } = makeHarness({
    tableOrderSession: [{ _id: 'table_01', status: 'ordering', visitId: 'v1', activeOrderRootId: 'root' }],
    order: [order('root', 'root', 'v1', '01', { status: 'cancelled', goods: [], finalPrice: 0 }),
      order('add1', 'root', 'v1', '01', { goods: [{ count: 1 }], finalPrice: 25 }),
      order('other-visit', 'root', 'v2', '01', { finalPrice: 99 })]
  })
  const result = await bill(table('01'))
  assert.deepEqual(Array.from(result.orders, item => item._id), ['add1'])
  assert.equal(result.session.activeOrderRootId, 'root')
  assert.equal(result.session.visitId, 'v1')
})

test('transaction bill reads use the supplied reader for sessions, roots and add-ons', async () => {
  const outside = makeHarness({})
  const inside = makeHarness({
    tableOrderSession: [{ _id: 'table_01', status: 'ordering', visitId: 'v1', activeOrderRootId: 'root' }],
    order: [order('root', 'root', 'v1', '01'), order('new-addon', 'root', 'v1', '01')]
  })
  const result = await outside.bill(table('01'), {}, inside.reader)
  assert.deepEqual(Array.from(result.orders, row => row._id).sort(), ['new-addon', 'root'])
  assert.equal(outside.queries.length, 0)
  assert.ok(inside.queries.some(query => query.name === 'tableOrderSession'))
})
