const crypto = require('crypto')
const packages = require('./salesQueryPackages.json')

const PAGE_SIZE = 100
const MAX_PAGES_PER_REQUEST = 20
const REQUEST_WORK_MS = 3000
const HEADER_PAGE_SIZE = 1000
const ORDER_FIELDS = Object.fromEntries([
  '_id', 'type', 'storeId', 'status', 'pay_status', 'payStatus', 'deleted', 'orderScene', 'orderType',
  'checkoutAt', 'paidAt', 'payTime', 'finishTime', 'completedAt', 'goods', 'categoryName',
  'checkoutBatchId', 'jointCheckoutId'
].map(key => [key, true]))
const HEADER_FIELDS = { ...ORDER_FIELDS }
delete HEADER_FIELDS.goods
const HASH_START = crypto.createHash('sha256').update('sales-query-v1').digest('hex')
const GROUP_BUY_KEY = 'group-buy'

function fail(code, message) {
  const error = new Error(message)
  error.code = code
  throw error
}

function incomplete(order, detail) {
  fail('SALES_HISTORY_INCOMPLETE', `历史订单 ${order._id || ''} ${detail}，无法完整统计，请核对原始记录`)
}

function dateStart(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) fail('SALES_DATE_REQUIRED', '请选择查询时间段')
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (year < 1900 || year > 2100 || utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    fail('SALES_DATE_INVALID', '查询日期无效')
  }
  return utc.getTime() - 8 * 60 * 60 * 1000
}

function validateDateRange(payload) {
  const startAt = dateStart(payload.startDate)
  const endStart = dateStart(payload.endDate)
  if (endStart < startAt) fail('SALES_DATE_ORDER', '结束日期不能早于开始日期')
  return { startAt, endAt: endStart + 24 * 60 * 60 * 1000 }
}

function validateFilters(payload) {
  const { startAt, endAt } = validateDateRange(payload)
  const categoryKey = String(payload.categoryKey || '').trim()
  if (!categoryKey || !(categoryKey === GROUP_BUY_KEY || /^(category|legacy):.+/.test(categoryKey)) || categoryKey.length > 300) {
    fail('SALES_CATEGORY_REQUIRED', '请选择查询品类')
  }
  return { startAt, endAt, categoryKey }
}

function timeValue(value) {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (value && typeof value === 'object') return timeValue(value.$date || value.value || value.date)
  return value ? Date.parse(value) : NaN
}

function isPaid(order) {
  return order.pay_status === true || order.payStatus === true || ['paid', 'completed'].includes(String(order.status || ''))
}

function isEffectiveOrder(order) {
  return order && order.type === 'order' && isPaid(order) && order.deleted !== true &&
    order.orderScene !== 'camping' && order.orderType !== 'camping' &&
    !['cancelled', 'closed', '3'].includes(String(order.status || ''))
}

function checkoutTime(order) {
  // Never substitute updateTime: editing a settled order must not change its sales date.
  const value = order.checkoutAt || order.paidAt || order.payTime || order.finishTime || order.completedAt
  const result = timeValue(value)
  if (!Number.isFinite(result)) incomplete(order, '缺少有效结账时间')
  return result
}

function historicalCategory(item, order) {
  const id = String(item.categoryId || '').trim()
  const name = String(item.categoryName || order.categoryName || '').trim()
  if (!id && !name) incomplete(order, '缺少菜品历史分类')
  return { key: id ? `category:${id}` : `legacy:${name}`, id, name: name || `分类 ${id}`, historical: true }
}

function safeAdd(left, right) {
  const value = left + right
  if (!Number.isSafeInteger(value)) fail('SALES_NUMBER_OVERFLOW', '统计数值超出安全范围')
  return value
}

function quantity(item, order) {
  const value = item.count
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) incomplete(order, '菜品份数无效')
  return value
}

function menuPriceCents(item, order) {
  let price = item.originalPrice
  if (price === undefined && !item.packageId && !item.packageName && !item.isGift && !item.giftDish && !item.freeByThreshold) price = item.price
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 ||
      !Number.isSafeInteger(Math.round(price * 100)) || Math.abs(price * 100 - Math.round(price * 100)) > 0.000001) {
    incomplete(order, '缺少有效的下单时菜单单价')
  }
  return Math.round(price * 100)
}

function addRow(rows, row) {
  if (!rows.has(row.id)) rows.set(row.id, { ...row, quantity: 0, amountCents: 0 })
  const stored = rows.get(row.id)
  stored.quantity = safeAdd(stored.quantity, row.quantity)
  stored.amountCents = safeAdd(stored.amountCents, row.amountCents)
}

function aggregateOrders(orders, filters, queryAt, tenantId) {
  const rows = new Map()
  const included = []
  for (const order of orders) {
    if (order.storeId !== tenantId || !isEffectiveOrder(order)) continue
    const paidAt = checkoutTime(order)
    if (paidAt < filters.startAt || paidAt >= filters.endAt || paidAt > queryAt) continue
    if (!Array.isArray(order.goods)) incomplete(order, '缺少菜品明细')
    included.push(order)
    const orderPackages = new Map()
    for (const item of order.goods) {
      if (!item || typeof item !== 'object') incomplete(order, '菜品明细无效')
      const count = quantity(item, order)
      if (!count) continue
      if (filters.categoryKey === GROUP_BUY_KEY) {
        const packageId = String(item.packageId || '').trim()
        if (!packageId && (item.packageName || item.packageCount)) incomplete(order, '缺少套餐标识')
        if (!packages.some(pack => pack.id === packageId)) continue
        const sets = item.packageCount
        if (typeof sets !== 'number' || !Number.isSafeInteger(sets) || sets < 1) incomplete(order, '缺少有效套餐套数')
        if (orderPackages.has(packageId) && orderPackages.get(packageId) !== sets) incomplete(order, '同一套餐的套数记录不一致')
        orderPackages.set(packageId, sets)
      } else {
        if (historicalCategory(item, order).key !== filters.categoryKey) continue
        const dishId = String(item.dishId || item._id || '').trim()
        const name = String(item.dishName || item.name || '').trim()
        if (!dishId || !name) incomplete(order, '缺少菜品标识或名称')
        const amountCents = menuPriceCents(item, order) * count
        if (!Number.isSafeInteger(amountCents)) fail('SALES_NUMBER_OVERFLOW', '统计金额超出安全范围')
        addRow(rows, { id: dishId, name, quantity: count, amountCents })
      }
    }
    // packageCount is repeated on each ingredient. Count once per order/package;
    // any surviving ingredient retains the submitted sets, per the agreed rule.
    for (const [id, sets] of orderPackages) addRow(rows, { id, quantity: sets, amountCents: 0 })
  }
  return { rows: [...rows.values()], included }
}

function fingerprint(previous, orders) {
  let digest = previous
  for (const order of orders) {
    digest = crypto.createHash('sha256').update(digest).update(JSON.stringify({
      id: order._id, paidAt: checkoutTime(order), goods: order.goods, categoryName: order.categoryName,
      // Include these even if unused by this query so settlement changes are detected.
      checkoutBatchId: order.checkoutBatchId, jointCheckoutId: order.jointCheckoutId
    })).digest('hex')
  }
  return digest
}

function createSalesQueryService({ db, _, getTenantId }) {
  function baseOrders(tenantId) {
    return _.and([
      { type: 'order', storeId: tenantId, deleted: _.neq(true), orderScene: _.neq('camping'), orderType: _.neq('camping') },
      _.or([{ status: _.in(['paid', 'completed']) }, { pay_status: true }, { payStatus: true }])
    ])
  }

  async function readPage(collection, condition, state, fields, size = PAGE_SIZE) {
    if (state.upperId === null) {
      const last = await db.collection(collection).where(condition).field({ _id: true }).orderBy('_id', 'desc').limit(1).get()
      state.upperId = last.data && last.data[0] && last.data[0]._id || ''
    }
    if (!state.upperId) return []
    const bounds = [{ _id: _.lte(state.upperId) }]
    if (state.lastId) bounds.push({ _id: _.gt(state.lastId) })
    let query = db.collection(collection).where(_.and([condition, ...bounds])).orderBy('_id', 'asc').limit(size)
    if (fields) query = query.field(fields)
    const result = await query.get()
    const rows = result.data || []
    if (rows.length) state.lastId = rows[rows.length - 1]._id
    return rows
  }

  function binding(payload, mode) {
    return JSON.stringify([getTenantId(payload), mode, payload.startDate || '', payload.endDate || '', payload.categoryKey || ''])
  }

  function sign(value, payload) {
    return crypto.createHmac('sha256', String(payload.adminAuthToken || '')).update(value).digest('hex')
  }

  function encode(state, payload) {
    const body = Buffer.from(JSON.stringify(state)).toString('base64')
    return `${body}.${sign(body, payload)}`
  }

  function decode(payload, mode) {
    if (!payload.cursor) return null
    const parts = String(payload.cursor).split('.')
    if (parts.length !== 2 || parts[1] !== sign(parts[0], payload)) fail('SALES_CURSOR_INVALID', '查询状态无效，请重新查询')
    let state
    try { state = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8')) } catch (_) { fail('SALES_CURSOR_INVALID', '查询状态无效，请重新查询') }
    if (state.binding !== binding(payload, mode) || Date.now() - state.queryAt > 60 * 60 * 1000) {
      fail('SALES_CURSOR_EXPIRED', '查询条件或登录状态已变化，请重新查询')
    }
    return state
  }

  function nextPhase(state, phase) {
    state.phase = phase
    state.lastId = ''
    state.upperId = null
  }

  function datedOrders(filters, queryAt) {
    return _.and([
      { checkoutAt: _.gte(new Date(filters.startAt)) },
      { checkoutAt: _.lt(new Date(Math.min(filters.endAt, queryAt + 1))) }
    ])
  }

  async function readOrderBatch(payload, filters, state) {
    const dateCondition = datedOrders(filters, state.queryAt)
    const legacy = state.stream === 'legacy'
    // Complement the exact database predicate rather than assuming every historical
    // timestamp is a Date. Every candidate belongs to precisely one stream.
    const condition = _.and([baseOrders(getTenantId(payload)), legacy ? _.nor([dateCondition]) : dateCondition])
    const docs = await readPage('order', condition, state, legacy ? HEADER_FIELDS : ORDER_FIELDS,
      legacy ? HEADER_PAGE_SIZE : PAGE_SIZE)
    if (!legacy) return { docs, scanned: docs.length, headers: 0, details: docs.length, empty: !docs.length }

    const candidates = docs.filter(order => {
      if (!isEffectiveOrder(order)) return false
      const time = checkoutTime(order)
      return time >= filters.startAt && time < filters.endAt && time <= state.queryAt
    })
    const hydrated = []
    for (let offset = 0; offset < candidates.length; offset += PAGE_SIZE) {
      const ids = candidates.slice(offset, offset + PAGE_SIZE).map(order => order._id)
      // Hydrate only matching legacy records, preserving header order for hashing.
      const result = await db.collection('order').where(_.and([
        baseOrders(getTenantId(payload)), { _id: _.in(ids) }
      ])).field(ORDER_FIELDS).limit(PAGE_SIZE).get()
      const byId = new Map((result.data || []).map(order => [order._id, order]))
      for (const id of ids) {
        if (!byId.has(id)) fail('SALES_DATA_CHANGED', '查询期间结算记录有变化，请重新查询')
        hydrated.push(byId.get(id))
      }
    }
    return { docs: hydrated, scanned: docs.length, headers: docs.length, details: hydrated.length, empty: !docs.length }
  }

  async function packageRows(payload) {
    return Promise.all(packages.map(async pack => {
      const result = await db.collection('mealPackage').doc(pack.id).get()
      const doc = result.data
      if (doc && ((doc.storeId && doc.storeId !== getTenantId(payload)) || doc.menuType === 'camping')) {
        fail('SALES_PACKAGE_MISMATCH', '已配置团购套餐与当前门店不匹配，请核对套餐配置')
      }
      return { id: pack.id, name: doc && doc.name || `${pack.name}（已删除）`, quantity: 0, amountCents: 0 }
    }))
  }

  async function options(payload) {
    const state = decode(payload, 'options') || {
      binding: binding(payload, 'options'), queryAt: Date.now(), phase: 'categories', upperId: null, lastId: '', scanned: 0
    }
    const categories = new Map()
    let done = false
    if (state.phase === 'categories') {
      const docs = await readPage('dishCategory', { menuType: _.neq('camping') }, state)
      for (const doc of docs) {
        if (doc.storeId && doc.storeId !== getTenantId(payload)) continue
        categories.set(`category:${doc._id}`, { key: `category:${doc._id}`, id: doc._id, name: doc.name, sort: Number(doc.sort || 0), historical: false })
      }
      if (docs.length < PAGE_SIZE) nextPhase(state, 'history')
    } else {
      // Amortize HTTP round trips while retaining keyset pagination and a bounded request.
      const deadline = Date.now() + REQUEST_WORK_MS
      for (let page = 0; page < MAX_PAGES_PER_REQUEST; page++) {
        const docs = await readPage('order', baseOrders(getTenantId(payload)), state, ORDER_FIELDS)
        state.scanned = (state.scanned || 0) + docs.length
        for (const order of docs.filter(isEffectiveOrder)) {
          if (!Array.isArray(order.goods)) incomplete(order, '缺少菜品明细')
          for (const item of order.goods) {
            if (!item || !quantity(item, order)) continue
            const category = historicalCategory(item, order)
            categories.set(category.key, category)
          }
        }
        done = docs.length < PAGE_SIZE
        if (done || Date.now() >= deadline) break
      }
    }
    return { categories: [...categories.values()], done, scannedOrders: state.scanned || 0, cursor: done ? '' : encode(state, payload) }
  }

  async function query(payload) {
    const filters = validateFilters(payload)
    const state = decode(payload, 'query') || {
      binding: binding(payload, 'query'), queryAt: Date.now(), phase: filters.categoryKey === GROUP_BUY_KEY ? 'packages' : 'catalog',
      upperId: null, lastId: '', digest: HASH_START, scanned: 0, matched: 0,
      plan: 2, stream: 'dated', streamBounds: {}, headerReads: 0, detailReads: 0
    }
    if (state.plan !== 2) fail('SALES_CURSOR_EXPIRED', '查询方式已更新，请重新查询')
    let rows = []
    let done = false
    let changed = false
    if (state.phase === 'packages') {
      rows = await packageRows(payload)
      nextPhase(state, 'orders')
    } else if (state.phase === 'catalog') {
      const categoryId = filters.categoryKey.startsWith('category:') ? filters.categoryKey.slice(9) : ''
      const docs = categoryId ? await readPage('dish', { categoryId, menuType: _.neq('camping') }, state) : []
      rows = docs.filter(doc => !doc.storeId || doc.storeId === getTenantId(payload))
        .map(doc => ({ id: doc._id, name: doc.name || doc._id, quantity: 0, amountCents: 0 }))
      if (docs.length < PAGE_SIZE) nextPhase(state, 'orders')
    } else {
      const phase = state.phase
      const batchRows = new Map()
      const deadline = Date.now() + REQUEST_WORK_MS
      for (let pageIndex = 0; pageIndex < MAX_PAGES_PER_REQUEST; pageIndex++) {
        const batch = await readOrderBatch(payload, filters, state)
        state.headerReads += batch.headers
        state.detailReads += batch.details
        const page = aggregateOrders(batch.docs, filters, state.queryAt, getTenantId(payload))
        state.digest = fingerprint(state.digest, page.included)
        if (phase === 'orders') {
          for (const row of page.rows) addRow(batchRows, row)
          state.scanned += batch.scanned
          state.matched += page.included.length
        }
        // End only on an empty page, so a server-side page cap cannot truncate results.
        if (batch.empty) {
          if (state.stream === 'dated') {
            if (phase === 'orders') state.streamBounds.dated = state.upperId
            state.stream = 'legacy'
            state.lastId = ''
            state.upperId = phase === 'verify' ? state.streamBounds.legacy : null
            continue
          }
          if (phase === 'orders') {
            state.expectedDigest = state.digest
            state.streamBounds.legacy = state.upperId
            nextPhase(state, 'verify')
            state.stream = 'dated'
            state.upperId = state.streamBounds.dated
            state.digest = HASH_START
          } else {
            done = true
            changed = state.digest !== state.expectedDigest
          }
          // Keep verification a separate request, preserving the phase boundary.
          break
        }
        if (Date.now() >= deadline) break
      }
      rows = [...batchRows.values()]
    }
    if (changed) fail('SALES_DATA_CHANGED', '查询期间结算记录有变化，请重新查询')
    return { rows, done, cursor: done ? '' : encode(state, payload), phase: state.phase,
      scannedOrders: state.scanned, matchedOrders: state.matched, queryAt: state.queryAt,
      queryPlan: 'date-range-v2', headerReads: state.headerReads, detailReads: state.detailReads,
      elapsedMs: Date.now() - state.queryAt }
  }

  async function run(action, payload) {
    try {
      const data = action === 'options' ? await options(payload) : await query(payload)
      return { success: true, data }
    } catch (err) {
      if (err.code && String(err.code).startsWith('SALES_')) return { success: false, code: err.code, message: err.message }
      // Never replace an index/network failure with partial/zero statistics.
      console.error('sales query failed', err)
      return { success: false, code: 'SALES_QUERY_FAILED', message: '销量查询失败，请检查网络及云端查询索引后重试' }
    }
  }

  return { options: payload => run('options', payload), query: payload => run('query', payload) }
}

module.exports = { createSalesQueryService, validateDateRange, validateFilters, aggregateOrders, historicalCategory, menuPriceCents, GROUP_BUY_KEY }
