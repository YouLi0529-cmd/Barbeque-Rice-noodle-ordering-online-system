'use strict'

const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const test = require('node:test')
const assert = require('node:assert/strict')
const { matchesBillSnapshot, getCheckoutBillDigest } = require('../tableBillVersion')

const source = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8')
const start = source.indexOf('async function adminFinishTableCheckout(')
const end = source.indexOf('\nfunction isSameCheckoutAmount(', start)
if (start < 0 || end < 0) throw new Error('checkout function not found')

function harness({ version = 3, visit = 'v1', extra = [], enforce = false } = {}) {
  const order = { _id: 'o1', rootOrderId: 'o1', tableNumber: '01', status: 'pending', goods: [{ count: 1 }], totalPrice: 20 }
  const session = { _id: 'table_01', status: 'ordering', visitId: visit, activeOrderRootId: 'o1', billVersion: version, addOnCount: 2 }
  const writes = []
  let billReads = 0
  const db = {
    serverDate: () => new Date(),
    collection: name => ({ doc: id => ({
      get: async () => ({ data: name === 'order' ? order : name === 'tableOrderSession' ? session : null }),
      update: async ({ data }) => { writes.push({ name, id, data }) },
      remove: async () => {}
    }) }),
    runTransaction: fn => fn(db)
  }
  const context = {
    process: { env: { BILL_VERSION_ENFORCE: enforce ? '1' : '' } }, db, Date,
    getAdminTableRef: () => ({ tableNumber: '01' }),
    getAdminTableBill: async () => ({ orders: [order].concat(billReads++ ? extra : []), session }),
    isAdminPaidOrder: item => item.payStatus === true,
    isClosedOrderContext: item => !item || item.status === 'cancelled' || item.payStatus === true,
    getCheckoutSharedCartTableNumbers: () => ['01'], getRawSharedCartSessionId: number => 'table_' + number,
    getSharedCartSessionId: number => 'table_' + number, normalizeTableNumber: number => number,
    getCheckoutCurrentSessionIds: () => ['table_01'], findUnseenOpenOrdersForRoots: async () => extra,
    runTransactionWithBusyRetry: (run, fn) => run(fn),
    runTransactionSequentially: async (items, fn) => { const results = []; for (let i = 0; i < items.length; i++) results.push(await fn(items[i], i)); return results },
    getCheckoutSessionRevision: item => JSON.stringify(item), matchesBillSnapshot, getCheckoutBillDigest,
    isActiveTableSession: item => !!item && item.status === 'ordering', isAdminTableOrder: item => !!item,
    getOrdersSettlementState: () => ({ grossAmount: 20, settledAmount: 0, outstandingAmount: 20 }),
    buildAdminCheckoutSummary: () => ({ paymentSplitValid: true, totalPrice: 20, receivable: 20, paymentMethod: 'cash' }),
    buildClosedTableSessionData: () => ({ status: 'finished' }),
    printService: { queueCashierReceipt: async () => ({ jobs: [{ _id: 'p' }] }) },
    getTenantId: () => 'tenant', console
  }
  const checkout = vm.runInNewContext('(' + source.slice(start, end).trim() + ')', context)
  const snapshot = { sessionId: 'table_01', visitId: 'v1', billVersion: 3, digest: getCheckoutBillDigest([order]) }
  return { checkout, snapshot, writes }
}

test('fully cancelled historical add-on does not prevent checkout', async () => {
  const { checkout, snapshot, writes } = harness()
  const result = await checkout({ expectedBillSnapshot: snapshot })
  assert.equal(result.success, true)
  assert.equal(writes.length, 2)
})

test('changed visit, changed version, or an unseen order blocks checkout before writing', async () => {
  for (const options of [{ visit: 'v2' }, { version: 4 }, { extra: [{ _id: 'new', rootOrderId: 'o1' }] }]) {
    const { checkout, snapshot, writes } = harness(options)
    const result = await checkout({ expectedBillSnapshot: snapshot })
    assert.equal(result.code, 'CHECKOUT_STATE_CHANGED')
    assert.equal(writes.length, 0)
  }
})

test('old clients are allowed in compatibility mode and rejected in strict mode', async () => {
  assert.equal((await harness().checkout({})).success, true)
  assert.equal((await harness({ enforce: true }).checkout({})).code, 'CLIENT_UPDATE_REQUIRED')
})
