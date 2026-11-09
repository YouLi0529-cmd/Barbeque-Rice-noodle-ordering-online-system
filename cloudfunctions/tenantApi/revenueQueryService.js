const crypto = require('crypto')
const zlib = require('zlib')
const { validateDateRange } = require('./salesQueryService')

// Only financial headers are needed. Dish photos, goods and kitchen logs are omitted.
const ORDER_FIELDS = Object.fromEntries([
  '_id', 'type', 'storeId', 'status', 'pay_status', 'payStatus', 'deleted', 'orderScene', 'orderType',
  'checkoutAt', 'paidAt', 'payTime', 'finishTime', 'completedAt', 'updateTime',
  'checkoutBatchId', 'tableGroupId', 'rootOrderId', 'checkoutReceivable', 'receivedAmount',
  'finalPrice', 'totalPrice', 'discountType', 'discountValue', 'directReduceValue',
  'checkoutCashAmount', 'checkoutOnlineAmount', 'paymentMethod', 'payMethod',
  'jointCheckoutId', 'jointCheckoutAllocationVersion', 'combinedSettlementEvents'
].map(key => [key, true]))
const PAYMENT_FIELDS = Object.fromEntries([
  '_id', 'type', 'storeId', 'deleted', 'jointCheckoutId', 'allocationMode',
  'checkoutAt', 'createTime', 'updateTime', 'receivable', 'cashAmount', 'onlineAmount', 'paymentMethod'
].map(key => [key, true]))

function queryError(code, message) {
  throw Object.assign(new Error(message), { code })
}

function createRevenueQueryService({ db, _, getTenantId, now = Date.now }) {
  function signature(body, payload) {
    return crypto.createHmac('sha256', String(payload.adminAuthToken || '')).update(body).digest('hex')
  }

  function encode(state, payload) {
    const body = zlib.gzipSync(Buffer.from(JSON.stringify(state))).toString('base64')
    return `${body}.${signature(body, payload)}`
  }

  function decode(payload, binding) {
    if (!payload.cursor) return null
    const cursor = String(payload.cursor)
    if (cursor.length > 4096) queryError('REVENUE_CURSOR_INVALID', '查询状态过大，请缩小日期范围重试')
    const [body, digest, extra] = cursor.split('.')
    const expected = signature(body || '', payload)
    if (extra !== undefined || !digest || !/^[a-f0-9]{64}$/.test(digest) ||
        !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(expected))) {
      queryError('REVENUE_CURSOR_INVALID', '查询状态无效，请重新查询')
    }
    let state
    try {
      state = JSON.parse(zlib.gunzipSync(Buffer.from(body, 'base64'), { maxOutputLength: 4096 }).toString('utf8'))
    } catch (err) {
      queryError('REVENUE_CURSOR_INVALID', '查询状态无效，请重新查询')
    }
    if (state.version !== 2 || state.binding !== binding || now() - state.queryAt > 30 * 60 * 1000) {
      queryError('REVENUE_CURSOR_EXPIRED', '查询条件或登录状态已变化，请重新查询')
    }
    return state
  }

  async function query(payload) {
    const interval = validateDateRange(payload)
    if (payload.protocol !== 2) queryError('REVENUE_CLIENT_UPDATE_REQUIRED', '请更新小程序版本后再查询营业额')
    const tenantId = getTenantId(payload)
    const binding = JSON.stringify([tenantId, payload.startDate, payload.endDate])
    const state = decode(payload, binding) || {
      version: 2, binding, queryAt: now(), phase: 0, lastId: '', upperIds: [null, null],
      digests: ['', ''], verified: ['', ''], scanned: 0
    }
    const orders = []
    const payments = []
    let responseBytes = 0
    const deadline = now() + 2000
    // Bound each invocation; the client resumes with the signed state.
    for (let page = 0; page < 2; page++) {
      const stream = state.phase % 2
      const verifying = state.phase >= 2
      const collection = stream === 0 ? 'order' : 'checkoutPayment'
      const fields = stream === 0 ? ORDER_FIELDS : PAYMENT_FIELDS
      const conditions = [
        { type: stream === 0 ? 'order' : 'joint_checkout', storeId: tenantId, deleted: _.neq(true) },
        { checkoutAt: _.gte(new Date(interval.startAt)) },
        { checkoutAt: _.lt(new Date(Math.min(interval.endAt, state.queryAt + 1))) }
      ]
      if (state.upperIds[stream] === null) {
        const result = await db.collection(collection).where(_.and(conditions))
          .field({ _id: true }).orderBy('_id', 'desc').limit(1).get()
        state.upperIds[stream] = result.data && result.data[0] && result.data[0]._id || ''
      }
      let rows = []
      if (state.upperIds[stream]) {
        const bounds = [{ _id: _.lte(state.upperIds[stream]) }]
        if (state.lastId) bounds.push({ _id: _.gt(state.lastId) })
        const result = await db.collection(collection).where(_.and([...conditions, ...bounds]))
          .field(fields).orderBy('_id', 'asc').limit(verifying ? 1000 : 250).get()
        rows = result.data || []
      }
      // Exclude split-payment dish lists from both transfer and verification.
      rows = rows.map(row => {
        if (!Array.isArray(row.combinedSettlementEvents)) return row
        return { ...row, combinedSettlementEvents: row.combinedSettlementEvents.map(event => {
          if (!event) return event
          const { dishes, ...financialEvent } = event
          return financialEvent
        }) }
      })
      let responseFull = false
      if (!verifying && rows.length) {
        const bounded = []
        for (const row of rows) {
          const bytes = Buffer.byteLength(JSON.stringify(row), 'utf8') + 1
          if (bytes > 48000) queryError('REVENUE_RECORD_TOO_LARGE', '结算记录过大，请联系管理员核查')
          if (responseBytes + bytes > 48000) {
            responseFull = true
            break
          }
          responseBytes += bytes
          bounded.push(row)
        }
        if (!bounded.length) break
        rows = bounded
      }
      if (rows.length) {
        const nextId = rows[rows.length - 1]._id
        if (!nextId || nextId === state.lastId) queryError('REVENUE_PAGE_INVALID', '查询分页未推进，请重新查询')
        state.lastId = nextId
        const digestField = verifying ? state.verified : state.digests
        for (const row of rows) {
          const values = Object.keys(fields).map(key => [Object.prototype.hasOwnProperty.call(row, key), row[key]])
          digestField[stream] = crypto.createHash('sha256').update(digestField[stream]).update(JSON.stringify(values)).digest('hex')
        }
        if (!verifying) {
          ;(stream === 0 ? orders : payments).push(...rows)
          state.scanned += rows.length
        }
      } else {
        if (verifying && state.verified[stream] !== state.digests[stream]) {
          queryError('REVENUE_DATA_CHANGED', '查询期间结算记录有变化，请重新查询')
        }
        state.phase++
        state.lastId = ''
        if (state.phase === 4) {
          return { protocol: 2, orders, payments, startDate: payload.startDate, endDate: payload.endDate,
            done: true, cursor: '', scannedOrders: state.scanned }
        }
      }
      if (responseFull || now() >= deadline) break
    }
    return { protocol: 2, orders, payments, done: false, cursor: encode(state, payload), scannedOrders: state.scanned,
      phase: state.phase >= 2 ? 'verify' : 'read' }
  }

  return { query }
}

module.exports = { createRevenueQueryService }
