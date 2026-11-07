const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const policy = require('../cloudfunctions/tenantApi/tableVisitOrders')
const { hasOrderableGoods } = require('../cloudfunctions/tenantApi/waiterOrderState')
const source = fs.readFileSync(path.join(__dirname, '../cloudfunctions/tenantApi/index.js'), 'utf8')
function slice(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))) }

function harness() {
  const root = { _id: 'root', type: 'order', rootOrderId: 'root', tableVisitId: 'visit', tableNumber: 'T03',
    storeId: 'store', orderScene: 'dineIn', status: 'cancelled', goods: [], totalPrice: 0, finalPrice: 0 }
  const addon = { ...root, _id: 'addon', status: 'pending_prepare', isAddOnOrder: true, addOnIndex: 1,
    goods: [{ dishId: 'dish', count: 1 }], totalPrice: 25, finalPrice: 25 }
  const session = { _id: 'table_T03', tableNumber: 'T03', status: 'ordering', visitId: 'visit', activeOrderRootId: 'root',
    memberOpenids: ['customer'], peopleCount: 2, peopleConfirmed: true, cartVersion: 0, addOnCount: 1, billVersion: 2 }
  const data = { order: [root, addon], tableOrderSession: [session], tableGroup: [], orderSubmission: [],
    tableCartItem: [{ _id: 'cart', sessionId: 'table_T03', dishId: 'new-dish', count: 1 }] }
  const writes = []
  let id = 0, clears = 0
  const matches = (doc, condition) => Object.entries(condition).every(([key, value]) =>
    value && value.in ? value.in.includes(doc[key]) : value && value.neq !== undefined ? doc[key] !== value.neq : doc[key] === value)
  const db = { serverDate: () => new Date(), runTransaction: fn => fn(db), collection(name) {
    const rows = data[name] || (data[name] = [])
    return {
      where(condition) {
        let skip = 0, limit = 100
        return { orderBy() { return this }, skip(value) { skip = value; return this }, limit(value) { limit = value; return this },
          get: async () => ({ data: rows.filter(row => matches(row, condition)).slice(skip, skip + limit) }) }
      },
      add: async ({ data: row }) => { const _id = `new-${++id}`; rows.push({ ...row, _id }); writes.push({ name, id: _id, row }); return { _id } },
      doc(key) { return {
        get: async () => ({ data: rows.find(row => row._id === key) || null }),
        update: async ({ data: update }) => {
          const row = rows.find(row => row._id === key)
          for (const [field, value] of Object.entries(update)) row[field] = value && value.addToSet
            ? [...new Set([...(row[field] || []), value.addToSet])] : value
          writes.push({ name, id: key, update })
        },
        set: async ({ data: value }) => { rows.push({ ...value, _id: key }); writes.push({ name, id: key, value }) },
        remove: async () => { const index = rows.findIndex(row => row._id === key); if (index >= 0) rows.splice(index, 1) }
      } }
    }
  } }
  const paid = order => order && (order.payStatus || order.pay_status || ['paid', 'completed'].includes(order.status))
  const visible = order => order && !order.deleted && !order.tableCleared && !['cancelled', 'closed', '3'].includes(order.status)
  const ref = { areaKey: 'sky', tableNumber: '03', tableKey: 'sky-03' }
  const context = vm.createContext({ db, crypto, console, ...policy,
    runTransactionWithBusyRetry: require('../cloudfunctions/tenantApi/tableCheckoutTransaction').runTransactionWithBusyRetry,
    hashToken: value => crypto.createHash('sha256').update(value).digest('hex'),
    findTableGroupForRef: () => null, mergeAdminTableRefs: (...lists) => lists.flat(),
    getRawSharedCartSessionId: number => 'table_' + number,
    getOrdersSettlementState: orders => ({ outstandingAmount: orders.reduce((sum, order) => sum + Number(order.finalPrice || 0), 0) }),
    isAdminPreparingOrder: order => order.status === 'pending_prepare',
    _: { in: values => ({ in: values }), neq: value => ({ neq: value }), addToSet: value => ({ addToSet: value }) },
    ACTIVE_ADMIN_TABLE_ORDER_STATUSES: ['submitted', 'pending_prepare', 'preparing', 'served'],
    SHARED_CART_ACTIVE_WINDOW_MS: 120000, hasOrderableGoods,
    getAuthSession: async () => ({ success: true, data: { openid: 'customer' } }), refreshAuthSessionProfile: async (_, auth) => auth,
    getTenantId: () => 'store', normalizeTableNumber: value => value,
    resolveSharedCartSession: async () => ({ redirected: false }),
    getActiveTableGroupSnapshotForTableNumber: async () => ({}),
    getSharedCartSessionId: () => 'table_T03', getAdminTableRef: () => ref,
    getAdminTableNumberCandidates: () => ['T03'], getOrderTableRef: () => ref,
    formatAdminTableNumber: () => 'T03', padTableNumber: () => '03',
    isSameAdminTableRef: (a, b) => a && b && a.tableKey === b.tableKey,
    isActiveTableSession: value => !!value && value.status === 'ordering', isMergedTableSession: () => false,
    isAdminPaidOrder: paid, isAdminTableOrder: visible, isVisibleSharedCartOrder: order => visible(order) && !paid(order),
    isClosedOrderContext: order => !visible(order) || paid(order),
    getTimeValue: value => Number(value) || 0,
    buildSharedCartPeopleState: value => ({ peopleConfirmed: value.peopleConfirmed, peopleCount: value.peopleCount }),
    buildSharedCartSessionState: value => ({ sessionActive: value.status === 'ordering', visitId: value.visitId }),
    getNewTableVisitSessionFields: () => ({ activeOrderRootId: '', addOnCount: 0, cartVersion: 0 }),
    buildClosedTableSessionData: () => ({ status: 'finished' }),
    buildSharedCartOrderCards: orders => orders, listActiveSharedCartOrdersForSession: async () => data.order.filter(order => visible(order) && !paid(order)),
    normalizeOrderParticipantOpenids: (members = [], openid) => [...new Set([...members, openid].filter(Boolean))],
    createSharedCartAccessToken: () => 'test', addSharedCartParticipantToActiveOrders: async () => 0,
    clearSharedCartItemsBySessionId: async () => { clears++ }, autoClearPaidTableOrdersForNewSession: async () => ({ clearedOrders: 0 }),
    buildServerOrderGoods: async () => ({ goods: [{ dishId: 'new-dish', count: 1 }], totalPrice: 10, finalPrice: 10 }),
    getSharedCartPeopleCount: value => value.peopleCount, isOrderTransferredFromTable: () => false,
    customerReceiptState: { getCustomerReceiptOrderId: () => 'root', buildCustomerReceiptSessionFields: () => ({}) },
    nextBillVersion: value => Number(value && value.billVersion || 0) + 1,
    ensureSessionCustomerReceipt: async () => ({}), sendOrderDishesToKitchen: async () => ({ success: true, data: {} }),
    touchAdminTableBoard: async () => {}, getActiveTableGroupForRef: async () => null,
    getActiveTableSessionForRef: async () => session, getTableGroupId: () => '', getTableGroupRefs: () => [],
    normalizeAdminTableRefs: () => [], getSharedCartTableNumbersForAdminRef: () => ['T03'],
    clearSharedCartSessionByTableNumber: async () => { session.status = 'finished'; return { removed: 0 } }
  })
  Object.assign(context, {
    listOrderRowsForRootAudit: async () => data.order,
    listAllTableSessionsForMaintenance: async () => data.tableOrderSession,
    getTableSessionRef: () => ref, getOrderClosedAt: () => 0, createAdminTableSections: () => []
  })
  vm.runInContext([
    slice('async function queryAdminBillDocuments(', 'async function expandActiveTableOrderTree('),
    slice('async function getActiveTableOrderContext(', 'async function addSharedCartParticipantToActiveOrders('),
    slice('async function createOrder(', 'async function adminCreateOfflineOrder('),
    slice('async function adminCreateOfflineOrder(', 'async function updateSessionCustomerReceiptState('),
    slice('function getTableJoinIdentity(', 'async function getSharedCart('),
    slice('async function getTableClearContext(', 'async function adminSendTableToKitchen('),
    slice('async function adminAuditOrphanedOrderRoots(', 'async function buildOrphanedRootRecoveryPlan(')
  ].join('\n'), context)
  return { context, root, addon, session, data, writes, get clears() { return clears } }
}

test('rescanning keeps the visit, root and live add-on after all first-order dishes are refunded', async () => {
  const h = harness()
  const result = await h.context.joinSharedCart({ tableNumber: 'T03' })
  assert.equal(result.success, true)
  assert.equal(h.session.visitId, 'visit')
  assert.equal(h.session.activeOrderRootId, 'root')
  assert.equal(h.clears, 0)
  assert.equal(result.existingOrderCards[0]._id, 'addon')
  assert.equal(h.root.status, 'cancelled')
})

test('customer submission after root refund creates the next add-on in the same visit', async () => {
  const h = harness()
  const result = await h.context.createOrder({ tableNumber: 'T03', cartVersion: 0 })
  assert.equal(result.success, true)
  assert.equal(result.order.rootOrderId, 'root')
  assert.equal(result.order.tableVisitId, 'visit')
  assert.equal(result.order.addOnIndex, 2)
  assert.equal(h.session.status, 'ordering')
  assert.equal(h.root.status, 'cancelled')
})

test('waiter submission also retains a refunded-root visit when add-ons remain', async () => {
  const h = harness()
  const result = await h.context.adminCreateOfflineOrder({ tableNumber: '03', areaKey: 'sky', requestId: 'test' })
  assert.equal(result.success, true)
  assert.equal(result.order.rootOrderId, 'root')
  assert.equal(result.order.tableVisitId, 'visit')
  assert.equal(result.order.addOnIndex, 2)
})

test('waiter transaction sees an add-on committed after its initial session read', async () => {
  const h = harness()
  h.data.order.splice(1, 1)
  const db = h.context.db
  const runTransaction = db.runTransaction
  db.runTransaction = async callback => {
    // Another submission committed while this request was waiting to save.
    h.data.order.push(h.addon)
    h.session.addOnCount = 1
    h.session.billVersion++
    db.runTransaction = runTransaction
    return runTransaction(callback)
  }
  const payload = { tableNumber: '03', areaKey: 'sky', requestId: 'interleaved' }
  const result = await h.context.adminCreateOfflineOrder(payload)
  assert.equal(result.success, true)
  assert.equal(result.order.rootOrderId, 'root')
  assert.equal(result.order.tableVisitId, 'visit')
  assert.equal(result.order.addOnIndex, 2)
  assert.equal(h.session.activeOrderRootId, 'root')
  assert.equal(h.session.visitId, 'visit')
  assert.equal(h.root.status, 'cancelled')
  const repeated = await h.context.adminCreateOfflineOrder(payload)
  assert.equal(repeated.duplicateSubmission, true)
  assert.equal(repeated.orderId, result.orderId)
  assert.equal(h.data.order.length, 3)
})

test('customer submission after waiter addition continues the same visit and numbering', async () => {
  const h = harness()
  const waiter = await h.context.adminCreateOfflineOrder({ tableNumber: '03', areaKey: 'sky', requestId: 'waiter-first' })
  const customer = await h.context.createOrder({ tableNumber: 'T03', cartVersion: 0 })
  assert.equal(waiter.success, true)
  assert.equal(customer.success, true)
  assert.equal(customer.order.rootOrderId, waiter.order.rootOrderId)
  assert.equal(customer.order.tableVisitId, waiter.order.tableVisitId)
  assert.equal(customer.order.addOnIndex, 3)
})

test('waiter stops without writing if another request changes or ends the dining visit', async () => {
  for (const change of [
    { status: 'finished' },
    { visitId: 'next-guest', activeOrderRootId: 'next-root' },
    { activeOrderRootId: 'replacement-root' },
    { status: 'merged', tableGroupId: 'new-group' }
  ]) {
    const h = harness()
    const db = h.context.db
    db.runTransaction = async callback => { Object.assign(h.session, change); return callback(db) }
    const result = await h.context.adminCreateOfflineOrder({ tableNumber: '03', areaKey: 'sky', requestId: 'stale' })
    assert.equal(result.code, 'TABLE_SESSION_MISMATCH')
    assert.equal(h.writes.length, 0)
    assert.equal(h.data.order.length, 2)
  }
})

test('unpaid live add-ons require explicit confirmation before force clear', async () => {
  const h = harness()
  const rejected = await h.context.adminClearTable({ tableNumber: '03', areaKey: 'sky' })
  assert.equal(rejected.code, 'TABLE_CLEAR_CONFIRM_REQUIRED')
  assert.equal(h.writes.length, 0)
  const preview = await h.context.adminClearTable({ tableNumber: '03', areaKey: 'sky', preview: true })
  assert.equal(h.writes.length, 0)
  assert.equal(preview.data.unpaidOrderCount, 1)
  const cleared = await h.context.adminClearTable({ tableNumber: '03', areaKey: 'sky',
    confirm: true, confirmationToken: preview.data.confirmationToken })
  assert.equal(cleared.success, true)
  assert.equal(h.addon.status, 'cancelled')
  assert.equal(h.addon.tableCleared, true)
  assert.equal(h.session.status, 'finished')
})

test('finished or missing session with a live orphan refuses to reset without writing', async () => {
  for (const missing of [false, true]) {
    const h = harness()
    if (missing) h.data.tableOrderSession.length = 0
    else h.session.status = 'finished'
    await assert.rejects(h.context.joinSharedCart({ tableNumber: 'T03' }), /用餐状态不一致/)
    assert.equal(h.writes.length, 0)
    assert.equal(h.clears, 0)
  }
})

test('once every order is refunded a rescan may start an empty new visit', async () => {
  const h = harness()
  Object.assign(h.addon, { status: 'cancelled', goods: [], finalPrice: 0, totalPrice: 0 })
  const result = await h.context.joinSharedCart({ tableNumber: 'T03' })
  assert.equal(result.success, true)
  assert.notEqual(h.session.visitId, 'visit')
  assert.equal(h.session.activeOrderRootId, '')
  assert.equal(h.data.tableCartItem.length, 0)
})

test('cancelled root exceptions never accept paid, cleared, foreign-store or foreign-visit children', () => {
  const h = harness()
  assert.equal(policy.hasLiveVisitAddOns(h.root, h.session, [h.addon]), true)
  for (const change of [{ payStatus: true }, { tableCleared: true }, { status: 'cancelled' },
    { storeId: 'other' }, { tableVisitId: 'other' }, { rootOrderId: 'other' }, { tableNumber: 'T04' }, { goods: [] }]) {
    assert.equal(policy.hasLiveVisitAddOns(h.root, h.session, [{ ...h.addon, ...change }]), false)
  }
  for (const change of [{ payStatus: true }, { deleted: true }, { tableCleared: true }, { goods: [{ count: 1 }] }]) {
    assert.equal(policy.hasLiveVisitAddOns({ ...h.root, ...change }, h.session, [h.addon]), false)
  }
})

test('a refunded primary root retains a verified merged bill with another root and visit', async () => {
  const h = harness()
  h.root.tableGroupId = h.session.tableGroupId = 'group'
  h.addon.status = 'cancelled'
  h.data.order.push({ ...h.addon, _id: 'other-root', rootOrderId: 'other-root', tableVisitId: 'other-visit',
    tableNumber: 'T04', tableGroupId: 'group', status: 'pending_prepare' })
  h.data.tableGroup.push({ _id: 'group', status: 'active', primarySessionId: h.session._id })
  h.context.getTableGroupSnapshot = group => group ? { tableGroupPrimary: {} } : null
  h.context.getTableGroupRefs = () => [{ tableKey: 'sky-03' }]
  assert.equal(await h.context.canContinueRefundedVisit(h.root, h.session), true)
  h.data.order[2].payStatus = true
  assert.equal(await h.context.canContinueRefundedVisit(h.root, h.session), false)
  h.data.tableGroup[0].status = 'closed'
  await assert.rejects(h.context.canContinueRefundedVisit(h.root, h.session), /拼桌状态异常/)
})

test('orphaned roots are never silently discarded while inferring table context', async () => {
  const h = harness()
  let result = await h.context.getActiveTableOrderContext('T03')
  assert.equal(result.ambiguous, true)
  h.data.order.push({ ...h.addon, _id: 'valid-root', rootOrderId: 'valid-root', isAddOnOrder: false })
  result = await h.context.getActiveTableOrderContext('T03')
  assert.equal(result.ambiguous, true)
  assert.equal(result.activeOrderRootId, '')
})

test('maintenance audit accepts a continuing refunded-root visit but flags a foreign visit', async () => {
  const h = harness()
  let result = await h.context.adminAuditOrphanedOrderRoots({})
  assert.equal(result.data.issueCount, 0)
  assert.equal(result.data.sessionIssueCount, 0)
  h.addon.tableVisitId = 'other-visit'
  result = await h.context.adminAuditOrphanedOrderRoots({})
  assert.equal(result.data.issueCount, 1)
  assert.equal(result.data.sessionIssueCount, 1)
  assert.equal(h.writes.length, 0)
})


test('a stale customer submission cannot join a later visit of the same table', async () => {
  const h = harness()
  h.session.visitId = 'later-visit'
  const result = await h.context.createOrder({ tableNumber: 'T03', sharedSessionId: 'table_T03',
    tableVisitId: 'visit', orderScene: 'dineIn', cartVersion: 0 })
  assert.equal(result.code, 'TABLE_SESSION_CLOSED')
  assert.equal(h.writes.length, 0)
})
