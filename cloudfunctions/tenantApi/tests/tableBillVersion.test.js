'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizeBillVersion, nextBillVersion, getBillSnapshot, matchesBillSnapshot, getOrderBillFingerprint, getCheckoutBillDigest } = require('../tableBillVersion')

test('legacy sessions start at version zero and changes increase it', () => {
  assert.equal(normalizeBillVersion(undefined), 0)
  assert.equal(nextBillVersion({ visitId: 'visit-a' }), 1)
  assert.equal(nextBillVersion({ billVersion: 1 }), 2)
})

test('a snapshot needs the same visit and version', () => {
  const session = { visitId: 'visit-a', billVersion: 1 }
  assert.deepEqual(getBillSnapshot(session), { visitId: 'visit-a', billVersion: 1 })
  assert.equal(matchesBillSnapshot(session, { visitId: 'visit-a', billVersion: 1 }), true)
  assert.equal(matchesBillSnapshot(session, { visitId: 'visit-b', billVersion: 1 }), false)
  assert.equal(matchesBillSnapshot(session, { visitId: 'visit-a', billVersion: 2 }), false)
  assert.equal(matchesBillSnapshot(session, { visitId: 'visit-a', billVersion: '1' }), false)
  assert.equal(matchesBillSnapshot(session, null), false)
  assert.equal(matchesBillSnapshot({ billVersion: 1 }, { billVersion: 1 }), false)
})

test('invalid versions cannot overflow into a different visit', () => {
  assert.throws(() => normalizeBillVersion(-1))
  assert.throws(() => normalizeBillVersion(1.5))
  assert.equal(getBillSnapshot({ visitId: 'visit-a', billVersion: -1 }), null)
  assert.throws(() => nextBillVersion({ billVersion: Number.MAX_SAFE_INTEGER }))
})

test('bill changes invalidate an order fingerprint but print metadata does not', () => {
  const order = { _id: 'order-1', status: 'submitted', goods: [{ count: 2 }], totalPrice: 20 }
  const fingerprint = getOrderBillFingerprint(order)
  assert.equal(getOrderBillFingerprint({ ...order, kitchenPrinted: true }), fingerprint)
  assert.notEqual(getOrderBillFingerprint({ ...order, goods: [{ count: 1 }] }), fingerprint)
  assert.notEqual(getOrderBillFingerprint({ ...order, status: 'cancelled' }), fingerprint)
  assert.notEqual(getOrderBillFingerprint({ ...order, payStatus: true }), fingerprint)
})

test('checkout digest changes for bill edits but not kitchen print progress or order ordering', () => {
  const first = { _id: '1', goods: [{ dishId: 'd', count: 2, kitchenStatus: 'queued' }], totalPrice: 20 }
  const second = { _id: '2', goods: [], totalPrice: 10 }
  const digest = getCheckoutBillDigest([first, second])
  assert.equal(getCheckoutBillDigest([second, { ...first, goods: [{ dishId: 'd', count: 2, kitchenStatus: 'printed' }] }]), digest)
  assert.notEqual(getCheckoutBillDigest([{ ...first, goods: [{ dishId: 'd', count: 1 }] }, second]), digest)
  assert.notEqual(getCheckoutBillDigest([first]), digest)
})
