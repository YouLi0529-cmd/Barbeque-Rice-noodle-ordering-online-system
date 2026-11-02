'use strict'

const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const test = require('node:test')
const assert = require('node:assert/strict')
const { nextBillVersion, getOrderBillFingerprint } = require('../tableBillVersion')

const source = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8')
const start = source.indexOf('async function commitAdminOrderBillUpdate(')
const end = source.indexOf('\nasync function refundOrderDishes(', start)
if (start < 0 || end < 0) throw new Error('bill mutation function not found')

function makeHarness(order, session) {
  const writes = []
  const transaction = {
    collection(name) {
      return { doc(id) { return {
        async get() { return { data: name === 'order' ? order : session } },
        async update({ data }) { writes.push({ name, id, data }) }
      } } }
    }
  }
  const context = {
    db: { runTransaction: callback => callback(transaction), serverDate: () => 'server-date' },
    runTransactionWithBusyRetry: (run, callback) => run(callback),
    getSharedCartSessionId: table => 'table_' + table,
    isAdminTableOrder: value => !!value && value.status !== 'cancelled',
    isAdminPaidOrder: value => value.payStatus === true,
    isMergedTableSession: value => value && value.status === 'merged',
    isActiveTableSession: value => !!value && value.status === 'ordering',
    nextBillVersion,
    getOrderBillFingerprint
  }
  const commit = vm.runInNewContext('(' + source.slice(start, end).trim() + ')', context)
  return { commit, writes }
}

test('a refund updates the order and current bill version in one transaction', async () => {
  const order = { _id: 'o1', tableNumber: 'T01', rootOrderId: 'o1', status: 'submitted', goods: [{ count: 1 }] }
  const session = { status: 'ordering', activeOrderRootId: 'o1', visitId: 'v1', billVersion: 3 }
  const { commit, writes } = makeHarness(order, session)
  const result = await commit(order, { status: 'cancelled', goods: [] })
  assert.equal(result.success, true)
  assert.equal(result.versionTracked, true)
  assert.equal(writes.length, 2)
  assert.equal(writes[0].data.status, 'cancelled')
  assert.equal(writes[1].data.billVersion, 4)
})

test('a changed order is not overwritten by a stale refund', async () => {
  const expected = { _id: 'o1', tableNumber: 'T01', rootOrderId: 'o1', status: 'submitted', goods: [{ count: 1 }] }
  const current = { ...expected, goods: [{ count: 2 }] }
  const { commit, writes } = makeHarness(current, { status: 'ordering', activeOrderRootId: 'o1' })
  const result = await commit(expected, { status: 'cancelled', goods: [] })
  assert.equal(result.success, false)
  assert.equal(result.code, 'ORDER_STATE_CHANGED')
  assert.equal(writes.length, 0)
})

test('a mismatched session refuses the bill change instead of skipping the version update', async () => {
  const order = { _id: 'o1', tableNumber: 'T01', rootOrderId: 'o1', status: 'submitted', goods: [{ count: 1 }] }
  const { commit, writes } = makeHarness(order, { status: 'ordering', activeOrderRootId: 'another-order', billVersion: 9 })
  const result = await commit(order, { status: 'cancelled', goods: [] })
  assert.equal(result.success, false)
  assert.equal(result.code, 'TABLE_SESSION_MISMATCH')
  assert.equal(writes.length, 0)
})
