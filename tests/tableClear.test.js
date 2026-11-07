const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const crypto = require('node:crypto')
const { runTransactionWithBusyRetry } = require('../cloudfunctions/tenantApi/tableCheckoutTransaction')
const source = fs.readFileSync(require.resolve('../cloudfunctions/tenantApi/index.js'), 'utf8')
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))
const table = number => ({ areaKey: 'normal', tableNumber: number, tableKey: `normal-${number}`, label: `${number}号桌` })
function harness() {
  let state = {
    order: [{ _id: 'o1', type: 'order', tableNumber: '01', rootOrderId: 'o1', tableVisitId: 'v1',
      status: 'pending_prepare', goods: [{ dishId: 'd1', count: 1 }], finalPrice: 25, totalPrice: 25 }],
    tableOrderSession: [{ _id: 'table_01', tableNumber: '01', visitId: 'v1', status: 'ordering',
      activeOrderRootId: 'o1', cartVersion: 1, peopleConfirmed: true, peopleCount: 2, memberOpenids: ['customer'] }],
    tableCartItem: [{ _id: 'c1', sessionId: 'table_01', cartKey: 'd1', count: 1 }], tableGroup: []
  }
  const reads = []
  let failWrite = false, beforeCommit = null
  const matches = (row, condition) => Object.entries(condition).every(([key, expected]) => {
    if (expected && expected.in) return expected.in.includes(row[key])
    if (expected && expected.nin) return !expected.nin.includes(row[key])
    if (expected && Object.hasOwn(expected, 'neq')) return row[key] !== expected.neq
    return row[key] === expected
  })
  function collection(rows, name) {
    const data = rows[name] || (rows[name] = [])
    return {
      where(condition) {
        let skip = 0, limit = 100
        return { orderBy() { return this }, skip(value) { skip = value; return this },
          limit(value) { limit = value; return this },
          async get() { reads.push({ name, condition }); return { data: structuredClone(data.filter(row => matches(row, condition)).slice(skip, skip + limit)) } } }
      },
      doc(id) { return {
        async get() { return { data: structuredClone(data.find(row => row._id === id) || null) } },
        async update({ data: update }) {
          if (failWrite && name === 'tableOrderSession') throw new Error('injected write failure')
          const row = data.find(row => row._id === id)
          assert.ok(row, `missing ${name}/${id}`)
          Object.assign(row, update)
        },
        async set({ data: value }) { data.push({ ...value, _id: id }) },
        async remove() { const at = data.findIndex(row => row._id === id); if (at >= 0) data.splice(at, 1) }
      } }
    }
  }
  const db = {
    serverDate: () => new Date(), collection: name => collection(state, name),
    async runTransaction(callback) {
      const original = JSON.stringify(state)
      const draft = structuredClone(state)
      const result = await callback({ collection: name => collection(draft, name) })
      if (beforeCommit) { const hook = beforeCommit; beforeCommit = null; hook(state) }
      if (JSON.stringify(state) !== original) throw new Error('ResourceUnavailable.TransactionBusy')
      state = draft
      return result
    }
  }
  const paid = row => row.payStatus === true || row.pay_status === true || row.status === 'completed'
  const context = vm.createContext({ db, crypto, console, Map, Set,
    _: { in: values => ({ in: values }), nin: values => ({ nin: values }), neq: value => ({ neq: value }) },
    hashToken: value => crypto.createHash('sha256').update(value).digest('hex'),
    runTransactionWithBusyRetry: (run, callback) => runTransactionWithBusyRetry(run, callback, { delays: [0], sleep: async () => {} }),
    getAdminTableRef: (_, number) => table(number), padTableNumber: String,
    getAdminTableNumberCandidates: (_, number) => [number], getOrderTableRef: order => table(order.tableNumber),
    isSameAdminTableRef: (a, b) => a.tableKey === b.tableKey,
    findTableGroupForRef: (groups, ref) => groups.find(group => group.tables.some(item => item.tableKey === ref.tableKey)),
    getTableGroupRefs: group => group ? group.tables : [], getTableGroupId: group => group._id,
    mergeAdminTableRefs: (...lists) => [...new Map(lists.flat().map(ref => [ref.tableKey, ref])).values()],
    getSharedCartTableNumbersForAdminRef: ref => [ref.tableNumber], getRawSharedCartSessionId: number => `table_${number}`,
    formatAdminTableNumber: ref => ref.tableNumber,
    isAdminTableOrder: row => !row.tableCleared && !row.deleted && row.status !== 'cancelled',
    isClosedOrderContext: row => paid(row) || row.status === 'cancelled' || row.tableCleared === true,
    isAdminPaidOrder: paid, isAdminPreparingOrder: row => row.status === 'pending_prepare',
    isActiveTableSession: session => !!session && session.status === 'ordering',
    isMergedTableSession: session => !!session && session.status === 'merged',
    getTimeValue: value => Number(value) || 0,
    getOrdersSettlementState: rows => ({ outstandingAmount: rows.reduce((sum, row) => sum + Number(row.finalPrice || 0), 0) }),
    getNewTableVisitSessionFields: () => ({ activeOrderRootId: '', tableGroupId: '', mergedIntoSessionId: '', cartVersion: 0 }),
    assertNoUntrackedAdminBill: async () => {},
    normalizeTableNumber: String, parseAdminTableNumber: number => table(number),
    SHARED_CART_ACTIVE_WINDOW_MS: 120000,
    getAuthSession: async () => ({ success: true, data: { openid: 'customer' } }),
    resolveSharedCartSession: async () => ({ redirected: false })
  })
  vm.runInContext([
    extract('async function queryAdminBillDocuments(', 'async function canContinueRefundedVisit('),
    extract('function buildClosedTableSessionData(', 'function isMergedTableSession('),
    extract('async function listVisibleTableOrders(', 'async function adminListTables('),
    extract('async function getTableClearContext(', 'async function adminSendTableToKitchen('),
    extract('async function autoClearPaidTableOrdersForNewSession(', 'function getSharedCartDocId('),
    extract('function getTableJoinIdentity(', 'async function joinSharedCart('),
    extract('async function patchSharedCart(', 'async function saveOrderDraft(')
  ].join('\n'), context)
  const request = { areaKey: 'normal', tableNumber: '01', clearActorId: 'admin-1' }
  return { context, request, reads, get state() { return state },
    failWrites() { failWrite = true }, onCommit(hook) { beforeCommit = hook },
    preview: () => context.adminClearTable({ ...request, preview: true }),
    clear: token => context.adminClearTable({ ...request, confirm: true, confirmationToken: token }) }
}

test('preview is read-only; confirmation voids unpaid orders, closes carts, and preserves paid settlement', async () => {
  const h = harness()
  h.state.order.push({ _id: 'paid', type: 'order', tableNumber: '01', status: 'completed', payStatus: true,
    checkoutTotalPrice: 121, checkoutReceivable: 120, receivedAmount: 120, goods: [{ count: 1 }] })
  const before = JSON.stringify(h.state)
  const preview = await h.preview()
  assert.equal(JSON.stringify(h.state), before)
  assert.equal(preview.data.unpaidOrderCount, 1)
  assert.equal(preview.data.unpaidAmount, 25)
  assert.equal(preview.data.kitchenWarning, true)
  assert.equal((await h.clear(preview.data.confirmationToken)).success, true)
  const order = h.state.order[0]
  assert.equal(order.status, 'cancelled')
  assert.equal(order.cancelledBy, 'admin-1')
  assert.equal(order.goods[0].count, 1)
  assert.equal(h.state.order[1].status, 'completed')
  assert.equal(h.state.order[1].receivedAmount, 120)
  assert.equal(h.state.tableCartItem.length, 0)
  assert.equal(h.state.tableOrderSession[0].status, 'finished')
})

test('a changed visit, cart, order amount, or transferred table rejects the old confirmation without writes', async () => {
  const changes = [
    state => { state.tableOrderSession[0].visitId = 'new-visit' },
    state => { state.tableOrderSession[0].cartVersion++ },
    state => { state.order[0].finalPrice = 28 },
    state => { state.order[0].tableNumber = '02' }
  ]
  for (const change of changes) {
    const h = harness(), preview = await h.preview()
    change(h.state)
    const before = JSON.stringify(h.state)
    assert.equal((await h.clear(preview.data.confirmationToken)).code, 'TABLE_CLEAR_STATE_CHANGED')
    assert.equal(JSON.stringify(h.state), before)
  }
})

test('merged tables are previewed and cleared together; historical links cannot clear an unrelated table', async () => {
  const h = harness()
  h.state.tableGroup.push({ _id: 'g1', status: 'active', tables: [table('01'), table('02')] })
  h.state.tableOrderSession.push({ _id: 'table_02', tableNumber: '02', status: 'merged', mergedIntoSessionId: 'table_01' })
  h.state.order.push({ ...h.state.order[0], _id: 'o2', tableNumber: '02', tableVisitId: 'v2' },
    { ...h.state.order[0], _id: 'other', tableNumber: '03', tableGroupTables: [table('01'), table('03')] })
  const preview = await h.preview()
  assert.equal(preview.data.tables.length, 2)
  assert.equal(preview.data.unpaidOrderCount, 2)
  await h.clear(preview.data.confirmationToken)
  assert.equal(h.state.order[1].status, 'cancelled')
  assert.equal(h.state.order[2].status, 'pending_prepare')
  assert.equal(h.state.tableGroup[0].status, 'inactive')
  assert.equal(h.state.tableOrderSession[1].status, 'finished')
})

test('clear works for an abandoned cart and for a session with no submitted orders', async () => {
  for (const cart of [true, false]) {
    const h = harness()
    h.state.order = []
    if (!cart) h.state.tableCartItem = []
    const preview = await h.preview()
    assert.equal(preview.data.unpaidOrderCount, 0)
    assert.equal((await h.clear(preview.data.confirmationToken)).success, true)
    assert.equal(h.state.tableOrderSession[0].status, 'finished')
  }
})

test('failed writes roll back order cancellation and cart removal', async () => {
  const h = harness(), preview = await h.preview(), before = JSON.stringify(h.state)
  h.failWrites()
  await assert.rejects(h.clear(preview.data.confirmationToken), /injected write failure/)
  assert.equal(JSON.stringify(h.state), before)
})

test('a submission committed during clear forces recheck instead of clearing the changed bill', async () => {
  const h = harness(), preview = await h.preview()
  h.onCommit(state => {
    state.tableOrderSession[0].billVersion = 2
    state.order.push({ ...state.order[0], _id: 'late-order' })
  })
  const result = await h.clear(preview.data.confirmationToken)
  assert.equal(result.code, 'TABLE_CLEAR_STATE_CHANGED')
  assert.equal(h.state.order[0].status, 'pending_prepare')
  assert.equal(h.state.tableCartItem.length, 1)
})

test('a delayed join cannot reopen a session cleared after its initial read', async () => {
  const h = harness(), previous = structuredClone(h.state.tableOrderSession[0])
  const preview = await h.preview()
  await h.clear(preview.data.confirmationToken)
  await assert.rejects(h.context.commitTableJoin('table_01', previous, { status: 'ordering' }, '01', false), /重新扫码/)
  assert.equal(h.state.tableOrderSession[0].status, 'finished')
})

test('paid auto-cleanup reads beyond 100 records; later visits reject an old diner identity', async () => {
  const h = harness()
  h.state.order = Array.from({ length: 121 }, (_, index) => ({ _id: `paid-${index}`, type: 'order',
    tableNumber: '01', status: 'completed', payStatus: true }))
  assert.equal((await h.context.autoClearPaidTableOrdersForNewSession('01', new Date())).clearedOrders, 121)
  assert.ok(h.state.order.every(order => order.tableCleared))
  assert.equal(h.context.isStaleTableVisit({ tableVisitId: 'old' }, { visitId: 'new' }), true)
})


test('old diner patch and cart-clear requests cannot touch a later visit even for the same user', async () => {
  const h = harness()
  h.state.tableOrderSession[0].visitId = 'new-visit'
  const before = JSON.stringify(h.state)
  const payload = { tableNumber: '01', sessionId: 'table_01', tableVisitId: 'v1',
    operations: [{ cartKey: 'd1', delta: 1 }] }
  assert.equal((await h.context.patchSharedCart(payload)).code, 'SESSION_CLOSED')
  assert.equal((await h.context.clearSharedCart(payload)).code, 'SESSION_CLOSED')
  assert.equal(JSON.stringify(h.state), before)
})


test('legacy session aliases are read in batches without dropping carts or missing-session guards', async () => {
  const h = harness()
  h.context.getSharedCartTableNumbersForAdminRef = () => Array.from({ length: 25 }, (_, i) => i ? `alias-${i}` : '01')
  h.state.tableOrderSession.push({ _id: 'table_alias-24', status: 'ordering', visitId: 'legacy', cartVersion: 3 })
  h.state.tableCartItem.push({ _id: 'legacy-cart', sessionId: 'table_alias-24', count: 2 })
  const preview = await h.preview()
  assert.equal(preview.data.cartItemCount, 3)
  assert.equal(h.reads.filter(read => read.name === 'tableOrderSession').length, 2)
  assert.equal(h.reads.filter(read => read.name === 'tableCartItem').length, 2)
  assert.equal((await h.clear(preview.data.confirmationToken)).success, true)
  assert.equal(h.state.tableCartItem.length, 0)
  assert.equal(h.state.tableOrderSession.length, 25)
  assert.ok(h.state.tableOrderSession.every(row => row.status === 'finished'))
})


test('board queries exclude cancelled history at the database and retain every uncleared valid order across pages', async () => {
  const h = harness()
  h.state.order = Array.from({ length: 1200 }, (_, i) => ({ _id: `cancel-${i}`, type: 'order', status: 'cancelled' }))
  h.state.order.push(...Array.from({ length: 305 }, (_, i) => ({ _id: `live-${i}`, type: 'order', status: 'pending_prepare' })),
    { _id: 'paid', type: 'order', status: 'completed', payStatus: true },
    { _id: 'legacy', type: 'order', status: 0 },
    { _id: 'deleted', type: 'order', status: 'pending_prepare', deleted: true },
    { _id: 'cleared', type: 'order', status: 'completed', tableCleared: true },
    { _id: 'camp', type: 'order', status: 'pending_prepare', orderScene: 'camping' })
  const result = await h.context.listVisibleTableOrders()
  assert.equal(result.data.length, 307)
  assert.ok(result.data.some(row => row._id === 'paid'))
  assert.ok(result.data.some(row => row._id === 'legacy'))
  assert.equal(h.reads.length, 4)
})
