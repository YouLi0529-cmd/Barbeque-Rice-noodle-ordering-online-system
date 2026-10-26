'use strict'

const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const test = require('node:test')
const assert = require('node:assert/strict')
const { getBillSnapshot, matchesBillSnapshot, getCheckoutBillDigest } = require('../tableBillVersion')

const source = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8')
const start = source.indexOf('function getCombinedCheckoutSessionEntries(')
const end = source.indexOf('\nasync function adminPrintTableReceipt(', start)
if (start < 0 || end < 0) throw new Error('combined checkout function not found')

function makeHarness({ changedTarget = false } = {}) {
  const refs = ['01', '02', '03'].map(number => ({ tableKey: 'normal-' + number, tableNumber: number }))
  const orders = ['r1', 'r2', 'r3'].map((id, index) => ({
    _id: id, rootOrderId: id, tableNumber: refs[index].tableNumber, status: 'submitted',
    goods: [{ count: 1 }], totalPrice: (index + 1) * 10,
    ...(index < 2 ? { tableGroupId: 'g1' } : {})
  }))
  const group = { _id: 'g1', status: 'active', tableGroupId: 'g1', primaryTable: refs[0], tables: refs.slice(0, 2) }
  const sessions = {
    table_01: { _id: 'table_01', status: 'ordering', visitId: 'v1', billVersion: 2, activeOrderRootId: 'r1', tableGroupId: 'g1' },
    table_02: { _id: 'table_02', status: 'merged', tableGroupId: 'g1', mergedIntoSessionId: 'table_01' },
    table_03: { _id: 'table_03', status: 'ordering', visitId: 'v3', billVersion: 1, activeOrderRootId: 'r3' }
  }
  const state = values => {
    const total = values.reduce((sum, item) => sum + item.totalPrice, 0)
    return { grossAmount: total, settledAmount: 0, outstandingAmount: total, roots: values.map(item => ({ rootOrder: item })) }
  }
  const groupSnapshot = { tableGroupId: 'g1', tableGroupPrimary: refs[0], tableGroupTables: refs.slice(0, 2) }
  const contexts = [
    { ref: refs[0], refs: refs.slice(0, 2), groupSnapshot, orders: orders.slice(0, 2), orderIds: ['r1', 'r2'], rootOrderIds: ['r1', 'r2'], settlementState: state(orders.slice(0, 2)), session: sessions.table_01, sessionIds: ['table_01', 'table_02'], primarySessionId: 'table_01' },
    { ref: refs[2], refs: [refs[2]], groupSnapshot: null, orders: [orders[2]], orderIds: ['r3'], rootOrderIds: ['r3'], settlementState: state([orders[2]]), session: sessions.table_03, sessionIds: ['table_03'], primarySessionId: 'table_03' }
  ]
  const writes = []
  const db = { serverDate: () => new Date(), collection: name => ({ doc: id => ({
    async get() { return { data: name === 'order' ? orders.find(item => item._id === id) : name === 'tableOrderSession' ? sessions[id] : name === 'tableGroup' ? group : null } },
    async update({ data }) { writes.push({ name, id, data }) },
    async set({ data }) { writes.push({ name, id, data }) }
  }) }), runTransaction: fn => fn(db) }
  const context = {
    process: { env: {} }, crypto, db, console,
    getCombinedCheckoutContexts: async () => ({ success: true, contexts, source: contexts[0], targets: [contexts[1]] }),
    getAdminTableBill: async ref => ref.tableNumber === '01'
      ? { session: sessions.table_01, orders: orders.slice(0, 2) }
      : { session: sessions.table_03, orders: changedTarget ? [orders[2], { _id: 'new', totalPrice: 1 }] : [orders[2]] },
    getCheckoutSessionRevision: value => JSON.stringify(value), getCheckoutBillDigest, matchesBillSnapshot,
    ensureCollection: async () => {}, runTransactionWithBusyRetry: (run, fn) => run(fn),
    runTransactionSequentially: async (items, fn) => { const out = []; for (let i = 0; i < items.length; i++) out.push(await fn(items[i], i)); return out },
    getOrdersSettlementState: state, isClosedOrderContext: item => item.status === 'cancelled' || item.payStatus === true,
    isSameCheckoutAmount: (a, b) => Math.abs(a - b) < 0.005,
    getTableGroupSnapshot: value => value && groupSnapshot,
    isSameAdminTableRef: (a, b) => a.tableKey === b.tableKey,
    isSameAdminTableRefSet: (a, b) => a.map(x => x.tableKey).join() === b.map(x => x.tableKey).join(),
    isMergedTableSession: value => value.status === 'merged', isActiveTableSession: value => value.status === 'ordering',
    isAdminTableOrder: value => !!value, roundMoney: value => Math.round(value * 100) / 100,
    buildAdminCheckoutSummary: (_, __, options) => ({ totalPrice: options.baseTotalPrice, receivable: options.baseTotalPrice }),
    buildSettlementPaymentBreakdown: (_, amount) => ({ cash: 0, online: amount, paymentSplitValid: true }),
    allocateJointCheckoutPayments: summaries => ({ valid: true, allocations: summaries.map(item => ({ paymentMethod: 'wechat_alipay', cashAmount: 0, onlineAmount: item.receivable })) }),
    mergeAdminTableRefs: (...values) => values.flat(), getCombinedCheckoutContextTableRefs: value => value.refs,
    serializeCombinedCheckoutTable: value => ({ tableNumber: value.ref.tableNumber }),
    buildClosedTableSessionData: () => ({ status: 'finished' }), getTenantId: () => 'tenant',
    formatAdminTableNumber: value => value.tableNumber,
    printService: { queueCashierReceipt: async () => ({ jobs: [{ _id: 'p' }] }) }
  }
  const checkout = vm.runInNewContext(source.slice(start, end) + '\n;adminFinishCombinedTableCheckout', context)
  const snapshots = contexts.map(item => ({ ...getBillSnapshot(item.session), sessionId: item.session._id, digest: getCheckoutBillDigest(item.orders) }))
  return { checkout, snapshots, writes }
}

test('a merged group and another table settle together and close all three sessions', async () => {
  const { checkout, snapshots, writes } = makeHarness()
  const result = await checkout({ expectedCombinedBillSnapshots: snapshots })
  assert.equal(result.success, true)
  assert.equal(writes.filter(item => item.name === 'order').length, 3)
  assert.equal(writes.filter(item => item.name === 'tableOrderSession').length, 3)
  assert.equal(writes.filter(item => item.name === 'tableGroup').length, 1)
})

test('a new order at another table stops combined checkout before any writes', async () => {
  const { checkout, snapshots, writes } = makeHarness({ changedTarget: true })
  const result = await checkout({ expectedCombinedBillSnapshots: snapshots })
  assert.equal(result.code, 'CHECKOUT_STATE_CHANGED')
  assert.equal(writes.length, 0)
})

test('a stale snapshot for either table stops combined checkout before any writes', async () => {
  const { checkout, snapshots, writes } = makeHarness()
  snapshots[1].billVersion -= 1
  const result = await checkout({ expectedCombinedBillSnapshots: snapshots })
  assert.equal(result.code, 'CHECKOUT_STATE_CHANGED')
  assert.equal(writes.length, 0)
})
