const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const https = require('https')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database({
  throwOnNotFound: false
})
const _ = db.command

const DEFAULT_TENANT_ID = 'zhangnan'
const ACTIVE_STATUS = 'active'
const SESSION_EXPIRE_DAYS = 7
const DRAFT_EXPIRE_MS = 24 * 60 * 60 * 1000
let ensureSessionCollectionPromise = null
let ensureCoreCollectionsPromise = null

function parseJson(text) {
  if (!text || typeof text !== 'string') return {}
  try {
    return JSON.parse(text)
  } catch (err) {
    return {}
  }
}

function parsePayload(event = {}) {
  const body = parseJson(event.body)
  const query = event.queryStringParameters || {}
  return {
    ...query,
    ...body,
    ...event
  }
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let raw = ''
      res.on('data', chunk => {
        raw += chunk
      })
      res.on('end', () => {
        const data = parseJson(raw)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data)
          return
        }
        reject(new Error(data.errmsg || `http ${res.statusCode}`))
      })
    }).on('error', reject)
  })
}

function buildResponse(payload, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
    },
    body: JSON.stringify(payload)
  }
}

function getTenantId(payload) {
  return String(payload.tenantId || process.env.TENANT_ID || DEFAULT_TENANT_ID).trim()
}

function toTime(value) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

async function getTenantLicense(tenantId) {
  let res
  try {
    res = await db.collection('tenantLicense')
      .where({ tenantId })
      .limit(1)
      .get()
  } catch (err) {
    const message = `${err && err.errCode ? err.errCode : ''} ${err && err.message ? err.message : ''} ${err && err.errMsg ? err.errMsg : ''}`
    if (message.includes('collection not exists') || message.includes('DATABASE_COLLECTION_NOT_EXIST')) {
      return null
    }
    throw err
  }

  return res.data && res.data[0]
}

async function checkTenantLicense(tenantId) {
  const license = await getTenantLicense(tenantId)
  if (!license) {
    return {
      ok: false,
      code: 'LICENSE_NOT_FOUND',
      message: 'service license not found'
    }
  }

  if (license.status !== ACTIVE_STATUS) {
    return {
      ok: false,
      code: 'LICENSE_DISABLED',
      message: 'service is disabled'
    }
  }

  const now = Date.now()
  const expireAt = toTime(license.expireAt)
  const graceUntil = toTime(license.graceUntil) || expireAt

  if (graceUntil && now > graceUntil) {
    return {
      ok: false,
      code: 'LICENSE_EXPIRED',
      message: 'service license expired'
    }
  }

  return {
    ok: true,
    license
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

function createToken() {
  return crypto.randomBytes(32).toString('hex')
}

function isCollectionExistsError(err) {
  const message = `${err && err.errCode ? err.errCode : ''} ${err && err.message ? err.message : ''} ${err && err.errMsg ? err.errMsg : ''}`
  return message.includes('already exists') ||
    message.includes('already exist') ||
    message.includes('DATABASE_COLLECTION_ALREADY_EXIST')
}

async function ensureCollection(name) {
  if (typeof db.createCollection !== 'function') return

  try {
    await db.createCollection(name)
  } catch (err) {
    if (!isCollectionExistsError(err)) {
      throw err
    }
  }
}

async function ensureSessionCollection() {
  if (!ensureSessionCollectionPromise) {
    ensureSessionCollectionPromise = ensureCollection('tenantSession')
  }
  return ensureSessionCollectionPromise
}

async function ensureCoreCollections() {
  if (!ensureCoreCollectionsPromise) {
    ensureCoreCollectionsPromise = Promise.all([
      ensureCollection('tenantLicense'),
      ensureCollection('tenantSession'),
      ensureCollection('user'),
      ensureCollection('counter'),
      ensureCollection('order'),
      ensureCollection('dishCategory'),
      ensureCollection('dish'),
      ensureCollection('shopInfo'),
      ensureCollection('notice'),
      ensureCollection('orderDraft'),
      ensureCollection('tableOrderSession'),
      ensureCollection('tableCartItem')
    ])
  }
  return ensureCoreCollectionsPromise
}

async function getWechatSession(code) {
  const appid = process.env.WECHAT_APPID
  const secret = process.env.WECHAT_SECRET

  if (!appid || !secret) {
    return {
      success: false,
      code: 'AUTH_CONFIG_MISSING',
      message: 'missing WECHAT_APPID or WECHAT_SECRET'
    }
  }

  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
  const data = await requestJson(url)
  if (!data.openid) {
    return {
      success: false,
      code: 'WECHAT_LOGIN_FAILED',
      message: data.errmsg || 'wechat login failed'
    }
  }

  return {
    success: true,
    data
  }
}

async function createUserSession(tenantId, openid) {
  await ensureSessionCollection()

  const token = createToken()
  const expiresAt = new Date(Date.now() + SESSION_EXPIRE_DAYS * 24 * 60 * 60 * 1000)

  await db.collection('tenantSession').add({
    data: {
      tenantId,
      openid,
      tokenHash: hashToken(token),
      expiresAt,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })

  return {
    token,
    expiresAt
  }
}

async function loginByWechatCode(payload) {
  const code = String(payload.code || '').trim()
  if (!code) {
    return {
      success: false,
      code: 'MISSING_WECHAT_CODE',
      message: 'missing wx.login code'
    }
  }

  const tenantId = getTenantId(payload)
  const wxSession = await getWechatSession(code)
  if (!wxSession.success) return wxSession

  const openid = wxSession.data.openid
  const session = await createUserSession(tenantId, openid)
  const userRes = await db.collection('user')
    .where({
      _openid: openid,
      status: _.neq(0)
    })
    .limit(1)
    .get()

  return {
    success: true,
    data: {
      token: session.token,
      expiresAt: session.expiresAt,
      openid,
      user: userRes.data && userRes.data[0] ? userRes.data[0] : null
    }
  }
}

function getAuthToken(payload) {
  return String(payload.authToken || payload.token || '').trim()
}

async function getAuthSession(payload) {
  const tenantId = getTenantId(payload)
  const token = getAuthToken(payload)
  if (!token) {
    return {
      success: false,
      code: 'AUTH_REQUIRED',
      message: 'login required'
    }
  }

  const res = await db.collection('tenantSession')
    .where({
      tenantId,
      tokenHash: hashToken(token)
    })
    .limit(1)
    .get()

  const session = res.data && res.data[0]
  if (!session) {
    return {
      success: false,
      code: 'AUTH_INVALID',
      message: 'invalid login session'
    }
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    return {
      success: false,
      code: 'AUTH_EXPIRED',
      message: 'login session expired'
    }
  }

  return {
    success: true,
    data: session
  }
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function normalizeCount(count) {
  const value = Math.floor(Number(count) || 0)
  if (value <= 0) {
    throw new Error('invalid dish count')
  }
  if (value > 99) {
    throw new Error('dish count too large')
  }
  return value
}

function normalizeTags(tags) {
  if (!tags) return []
  if (Array.isArray(tags)) {
    return tags.filter(Boolean).map(item => String(item))
  }
  if (typeof tags === 'object') {
    return Object.values(tags).flat().filter(Boolean).map(item => String(item))
  }
  return [String(tags)]
}

async function getActiveUser(transaction, openid) {
  const userRes = await transaction.collection('user')
    .where({
      _openid: openid,
      status: _.neq(0)
    })
    .limit(1)
    .get()

  const user = userRes.data && userRes.data[0]
  if (!user) {
    throw new Error('profile required')
  }
  if (!user.phoneNumber) {
    throw new Error('phone authorization required')
  }
  return user
}

async function buildServerOrderGoods(transaction, orderGoods) {
  if (!Array.isArray(orderGoods) || orderGoods.length === 0) {
    throw new Error('empty cart')
  }

  const goods = []
  let totalPrice = 0

  for (const item of orderGoods) {
    const dishId = item && item.dishId
    if (!dishId) {
      throw new Error('missing dish id')
    }

    const count = normalizeCount(item.count)
    const dishRes = await transaction.collection('dish').doc(dishId).get()
    const dish = dishRes.data

    if (!dish) {
      throw new Error('dish not found')
    }
    if (dish.status !== undefined && dish.status !== 1) {
      throw new Error(`dish unavailable: ${dish.name || item.dishName || ''}`)
    }

    const price = roundMoney(dish.price)
    const subtotal = roundMoney(price * count)
    totalPrice = roundMoney(totalPrice + subtotal)

    goods.push({
      dishId,
      dishName: dish.name || item.dishName || '',
      dishImage: dish.image || item.dishImage || '',
      price,
      count,
      subtotal,
      tags: normalizeTags(item.tags)
    })
  }

  return {
    goods,
    totalPrice,
    finalPrice: totalPrice
  }
}

async function createOrder(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const openid = auth.data.openid
  const orderScene = payload.orderScene === 'camping' || payload.orderType === 'camping'
    ? 'camping'
    : 'dineIn'
  const tableNumber = String(payload.tableNumber || '').trim()
  const parentOrderId = String(payload.parentOrderId || '').trim()
  const isAddOnOrder = !!parentOrderId
  const addOnIndex = Math.max(0, Math.floor(Number(payload.addOnIndex) || 0))

  if (orderScene !== 'camping' && !tableNumber) {
    return {
      success: false,
      code: 'TABLE_REQUIRED',
      message: 'table number required'
    }
  }

  const result = await db.runTransaction(async transaction => {
    const user = await getActiveUser(transaction, openid)
    const priceResult = await buildServerOrderGoods(transaction, payload.orderGoods)
    let rootOrderId = ''

    if (isAddOnOrder) {
      const parentRes = await transaction.collection('order').doc(parentOrderId).get()
      const parentOrder = parentRes.data

      if (!parentOrder) {
        throw new Error('parent order not found')
      }
      if (parentOrder._openid !== openid) {
        throw new Error('cannot append to another user order')
      }
      if (parentOrder.orderScene !== orderScene) {
        throw new Error('order scene mismatch')
      }
      if (orderScene !== 'camping' && String(parentOrder.tableNumber || '') !== tableNumber) {
        throw new Error('table number mismatch')
      }

      rootOrderId = parentOrder.rootOrderId || parentOrder._id || parentOrderId
    }

    const orderData = {
      type: 'order',
      orderScene,
      orderType: orderScene,
      isAddOnOrder,
      parentOrderId: isAddOnOrder ? parentOrderId : '',
      rootOrderId,
      addOnIndex: isAddOnOrder ? addOnIndex : 0,
      orderCardTitle: payload.orderCardTitle || (isAddOnOrder ? `Add-on ${addOnIndex}` : 'First order'),
      goods: priceResult.goods,
      totalPrice: priceResult.totalPrice,
      finalPrice: priceResult.finalPrice,
      pay_status: false,
      payStatus: false,
      payMethod: 'offline',
      status: 'waiting_pay',
      frontDeskConfirmed: false,
      frontDeskRemark: '',
      kitchenPrinted: false,
      kitchenPrintStatus: 'pending',
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
      _openid: openid,
      userId: user._id,
      userCode: user.userCode || '',
      userSnapshot: {
        userCode: user.userCode || '',
        nickName: user.nickName || '',
        avatarUrl: user.avatarUrl || '',
        phoneNumber: user.phoneNumber || ''
      },
      userNickName: user.nickName || '',
      userAvatar: user.avatarUrl || '',
      userPhone: user.phoneNumber || '',
      tableNumber: orderScene === 'camping' ? '' : tableNumber
    }

    const orderRes = await transaction.collection('order').add({
      data: orderData
    })
    const savedRootOrderId = rootOrderId || orderRes._id

    if (!rootOrderId) {
      await transaction.collection('order').doc(orderRes._id).update({
        data: {
          rootOrderId: savedRootOrderId
        }
      })
    }

    return {
      success: true,
      orderId: orderRes._id,
      order: {
        ...orderData,
        _id: orderRes._id,
        rootOrderId: savedRootOrderId
      }
    }
  })

  return result
}

async function getCurrentUser(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const res = await db.collection('user')
    .where({
      _openid: auth.data.openid,
      status: _.neq(0)
    })
    .limit(1)
    .get()

  return {
    success: true,
    data: res.data && res.data[0] ? res.data[0] : null
  }
}

async function getNextUserCode(transaction) {
  const counterRef = transaction.collection('counter').doc('userCode')
  const counterRes = await counterRef.get()
  const counter = counterRes.data

  if (!counter) {
    await counterRef.set({
      data: {
        next: 23002,
        updateTime: db.serverDate()
      }
    })
    return '23001'
  }

  const next = Number(counter.next || 23001)
  await counterRef.update({
    data: {
      next: _.inc(1),
      updateTime: db.serverDate()
    }
  })

  return String(next).padStart(5, '0')
}

async function completeUserProfile(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const openid = auth.data.openid
  const avatarUrl = payload.avatarUrl || ''
  const phoneNumber = String(payload.phoneNumber || '').trim()
  if (!phoneNumber) {
    return {
      success: false,
      code: 'PHONE_REQUIRED',
      message: 'phone number required'
    }
  }

  const user = await db.runTransaction(async transaction => {
    const userRes = await transaction.collection('user')
      .where({ _openid: openid })
      .limit(1)
      .get()
    const oldUser = userRes.data && userRes.data[0]

    if (oldUser) {
      const userCode = oldUser.userCode || await getNextUserCode(transaction)
      const nickName = String(payload.nickName || '').trim() || `Member${userCode}`
      const data = {
        avatarUrl,
        nickName,
        phoneNumber,
        userCode,
        profileCompleted: true,
        status: oldUser.status === 0 ? 1 : (oldUser.status || 1),
        updateTime: db.serverDate()
      }

      if (oldUser.orderCount === undefined) data.orderCount = 0
      if (oldUser.dineInOrderCount === undefined) data.dineInOrderCount = 0
      if (oldUser.campingOrderCount === undefined) data.campingOrderCount = 0

      await transaction.collection('user').doc(oldUser._id).update({ data })
      return {
        ...oldUser,
        ...data,
        updateTime: new Date()
      }
    }

    const userCode = await getNextUserCode(transaction)
    const nickName = String(payload.nickName || '').trim() || `Member${userCode}`
    const newUser = {
      _openid: openid,
      userCode,
      avatarUrl,
      nickName,
      phoneNumber,
      profileCompleted: true,
      orderCount: 0,
      dineInOrderCount: 0,
      campingOrderCount: 0,
      status: 1,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }

    const addRes = await transaction.collection('user').add({
      data: newUser
    })

    return {
      ...newUser,
      _id: addRes._id,
      createTime: new Date(),
      updateTime: new Date()
    }
  })

  return {
    success: true,
    data: {
      user
    }
  }
}

async function getPhoneNumber(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const code = String(payload.code || '').trim()
  if (!code) {
    return {
      success: false,
      code: 'MISSING_PHONE_CODE',
      message: 'missing phone authorization code'
    }
  }

  try {
    const result = await cloud.openapi.phonenumber.getPhoneNumber({ code })
    const phoneNumber = result && result.phoneInfo && result.phoneInfo.phoneNumber
    if (!phoneNumber) {
      return {
        success: false,
        code: 'PHONE_NUMBER_EMPTY',
        message: 'phone number not found'
      }
    }

    return {
      success: true,
      phoneNumber
    }
  } catch (err) {
    return {
      success: false,
      code: 'PHONE_NUMBER_FAILED',
      message: err.message || 'get phone number failed'
    }
  }
}

function isSavedOrder(order) {
  return order && (order.savedOnly === true || order.isDraft === true || !!order.expiresAt)
}

function getTimeValue(value) {
  if (!value) return 0
  const source = value && value.$date ? value.$date : value
  const date = source instanceof Date ? source : new Date(source)
  const time = date.getTime()
  return Number.isNaN(time) ? 0 : time
}

function isExpiredSavedOrder(order) {
  if (!isSavedOrder(order)) return false
  const expiresAt = getTimeValue(order.expiresAt)
  return expiresAt > 0 && expiresAt <= Date.now()
}

function getOrderScene(value) {
  return value === 'camping' ? 'camping' : 'dineIn'
}

async function listUserOrders(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const orderScene = getOrderScene(payload.orderScene)
  const page = getPage(payload)
  const limit = getLimit(payload, 20, 100)
  const query = {
    _openid: auth.data.openid,
    type: 'order',
    deleted: _.neq(true)
  }

  if (orderScene === 'camping') {
    query.orderScene = 'camping'
  } else {
    query.orderScene = _.neq('camping')
  }

  const res = await db.collection('order')
    .where(query)
    .orderBy('createTime', 'desc')
    .skip(page * limit)
    .limit(limit)
    .get()

  return {
    success: true,
    data: (res.data || []).filter(order => !isExpiredSavedOrder(order)),
    page,
    limit,
    hasMore: (res.data || []).length === limit
  }
}

async function getUserOrderDetail(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const orderId = String(payload.orderId || '').trim()
  const rootOrderId = String(payload.rootOrderId || payload.orderId || '').trim()
  if (!rootOrderId && !orderId) {
    return {
      success: false,
      code: 'MISSING_ORDER_ID',
      message: 'missing order id'
    }
  }

  const res = await db.collection('order')
    .where(_.or([
      { _openid: auth.data.openid, _id: orderId, deleted: _.neq(true) },
      { _openid: auth.data.openid, rootOrderId, deleted: _.neq(true) },
      { _openid: auth.data.openid, parentOrderId: rootOrderId, deleted: _.neq(true) }
    ]))
    .orderBy('createTime', 'asc')
    .limit(100)
    .get()

  return {
    success: true,
    data: (res.data || []).filter(order => !isExpiredSavedOrder(order))
  }
}

async function markUserOrdersDeleted(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const orderIds = Array.isArray(payload.orderIds)
    ? payload.orderIds.map(id => String(id || '').trim()).filter(Boolean)
    : [String(payload.orderId || '').trim()].filter(Boolean)

  if (orderIds.length === 0) {
    return {
      success: false,
      code: 'MISSING_ORDER_ID',
      message: 'missing order id'
    }
  }

  await Promise.all(orderIds.map(async orderId => {
    const oldRes = await db.collection('order').doc(orderId).get()
    const order = oldRes.data
    if (!order || order._openid !== auth.data.openid) {
      throw new Error('order not found')
    }

    await db.collection('order').doc(orderId).update({
      data: {
        deleted: true,
        updateTime: db.serverDate()
      }
    })
  }))

  return {
    success: true
  }
}

async function cancelUserOrder(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const orderId = String(payload.orderId || '').trim()
  if (!orderId) {
    return {
      success: false,
      code: 'MISSING_ORDER_ID',
      message: 'missing order id'
    }
  }

  const oldRes = await db.collection('order').doc(orderId).get()
  const order = oldRes.data
  if (!order || order._openid !== auth.data.openid) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: 'order not found'
    }
  }

  const canCancel = (order.status === 'waiting_pay' || Number(order.status) === 0) &&
    !order.frontDeskConfirmed &&
    !order.kitchenPrinted

  if (!canCancel) {
    return {
      success: false,
      code: 'ORDER_CANNOT_CANCEL',
      message: 'order cannot be cancelled'
    }
  }

  await db.collection('order').doc(orderId).update({
    data: {
      status: 3,
      updateTime: db.serverDate()
    }
  })

  return {
    success: true
  }
}

function normalizeTableNumber(tableNumber) {
  return String(tableNumber || '').trim()
}

function getSharedCartSessionId(tableNumber) {
  const safeTable = encodeURIComponent(tableNumber).replace(/%/g, '_')
  return `table_${safeTable}`
}

function getSharedCartDocId(sessionId, cartKey) {
  const hash = crypto.createHash('md5').update(String(cartKey || '')).digest('hex')
  return `${sessionId}_${hash}`
}

function normalizeSharedCartCount(count) {
  const value = Math.floor(Number(count) || 0)
  return value > 0 ? value : 0
}

function normalizeSharedCartItem(item) {
  const info = item && item.info && typeof item.info === 'object'
    ? { ...item.info }
    : {}
  delete info.cartCount

  return {
    info,
    tags: item && item.tags && typeof item.tags === 'object' ? item.tags : {},
    tagLabels: Array.isArray(item && item.tagLabels) ? item.tagLabels : [],
    dishId: item && item.dishId ? item.dishId : (info._id || '')
  }
}

async function joinSharedCart(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const tableNumber = normalizeTableNumber(payload.tableNumber)
  if (!tableNumber) {
    return {
      success: false,
      code: 'TABLE_REQUIRED',
      message: 'table number required'
    }
  }

  const sessionId = getSharedCartSessionId(tableNumber)
  const sessionRef = db.collection('tableOrderSession').doc(sessionId)
  const oldSessionRes = await sessionRef.get()
  const oldSession = oldSessionRes.data

  if (oldSession) {
    await sessionRef.update({
      data: {
        tableNumber,
        status: 'ordering',
        memberOpenids: _.addToSet(auth.data.openid),
        updateTime: db.serverDate()
      }
    })
  } else {
    await sessionRef.set({
      data: {
        tableNumber,
        status: 'ordering',
        memberOpenids: [auth.data.openid],
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
  }

  return {
    success: true,
    sessionId,
    tableNumber
  }
}

async function getSharedCart(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const tableNumber = normalizeTableNumber(payload.tableNumber)
  const sessionId = String(payload.sessionId || (tableNumber ? getSharedCartSessionId(tableNumber) : '')).trim()
  if (!sessionId) {
    return {
      success: false,
      code: 'SESSION_REQUIRED',
      message: 'shared cart session required'
    }
  }

  const res = await db.collection('tableCartItem')
    .where({
      sessionId,
      deleted: _.neq(true)
    })
    .limit(200)
    .get()

  return {
    success: true,
    items: res.data || []
  }
}

async function patchSharedCart(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const tableNumber = normalizeTableNumber(payload.tableNumber)
  const sessionId = String(payload.sessionId || (tableNumber ? getSharedCartSessionId(tableNumber) : '')).trim()
  const operations = Array.isArray(payload.operations) ? payload.operations : []

  if (!sessionId || !tableNumber) {
    return {
      success: false,
      code: 'SESSION_REQUIRED',
      message: 'shared cart session required'
    }
  }

  if (operations.length === 0) {
    return {
      success: true
    }
  }

  await db.runTransaction(async transaction => {
    for (const operation of operations) {
      const cartKey = String(operation.cartKey || '').trim()
      const delta = Math.floor(Number(operation.delta) || 0)
      if (!cartKey || delta === 0) continue

      const docId = getSharedCartDocId(sessionId, cartKey)
      const itemRef = transaction.collection('tableCartItem').doc(docId)
      const oldRes = await itemRef.get()
      const oldItem = oldRes.data
      const normalizedItem = normalizeSharedCartItem(operation.item || {})
      const nextCount = normalizeSharedCartCount((oldItem ? Number(oldItem.count || 0) : 0) + delta)

      if (nextCount <= 0) {
        if (oldItem) {
          await itemRef.remove()
        }
        continue
      }

      const itemData = {
        sessionId,
        tableNumber,
        cartKey,
        count: nextCount,
        info: normalizedItem.info,
        tags: normalizedItem.tags,
        tagLabels: normalizedItem.tagLabels,
        dishId: normalizedItem.dishId,
        updatedByOpenid: auth.data.openid,
        updateTime: db.serverDate(),
        deleted: false
      }

      if (oldItem) {
        await itemRef.update({
          data: itemData
        })
      } else {
        await itemRef.set({
          data: {
            ...itemData,
            createTime: db.serverDate(),
            createdByOpenid: auth.data.openid
          }
        })
      }
    }
  })

  await db.collection('tableOrderSession').doc(sessionId).update({
    data: {
      tableNumber,
      memberOpenids: _.addToSet(auth.data.openid),
      updateTime: db.serverDate()
    }
  })

  return {
    success: true
  }
}

async function clearSharedCart(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const tableNumber = normalizeTableNumber(payload.tableNumber)
  const sessionId = String(payload.sessionId || (tableNumber ? getSharedCartSessionId(tableNumber) : '')).trim()
  if (!sessionId) {
    return {
      success: false,
      code: 'SESSION_REQUIRED',
      message: 'shared cart session required'
    }
  }

  const res = await db.collection('tableCartItem')
    .where({
      sessionId,
      deleted: _.neq(true)
    })
    .limit(200)
    .get()

  await Promise.all((res.data || []).map(item => {
    return db.collection('tableCartItem').doc(item._id).remove()
  }))

  await db.collection('tableOrderSession').doc(sessionId).update({
    data: {
      updateTime: db.serverDate()
    }
  })

  return {
    success: true,
    removed: (res.data || []).length
  }
}

async function saveOrderDraft(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const cart = payload.cart || {}
  if (!cart || Object.keys(cart).length === 0) {
    return {
      success: false,
      code: 'EMPTY_CART',
      message: 'empty cart'
    }
  }

  const data = {
    _openid: auth.data.openid,
    cart,
    totalPrice: Number(payload.totalPrice || 0),
    expiresAt: new Date(Date.now() + DRAFT_EXPIRE_MS),
    updateTime: db.serverDate()
  }

  const oldRes = await db.collection('orderDraft')
    .where({
      _openid: auth.data.openid
    })
    .limit(1)
    .get()

  const oldDraft = oldRes.data && oldRes.data[0]
  if (oldDraft) {
    await db.collection('orderDraft').doc(oldDraft._id).update({ data })
  } else {
    await db.collection('orderDraft').add({
      data: {
        ...data,
        createTime: db.serverDate()
      }
    })
  }

  return {
    success: true
  }
}

async function getOrderDraft(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const draftRes = await db.collection('orderDraft')
    .where({
      _openid: auth.data.openid
    })
    .orderBy('updateTime', 'desc')
    .limit(1)
    .get()

  const draft = draftRes.data && draftRes.data[0]
  if (!draft) {
    return {
      success: true,
      data: null
    }
  }

  if (isExpiredSavedOrder({
    ...draft,
    savedOnly: true
  })) {
    await db.collection('orderDraft').doc(draft._id).remove()
    return {
      success: true,
      data: null
    }
  }

  return {
    success: true,
    data: draft
  }
}

async function deleteOrderDraft(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const oldRes = await db.collection('orderDraft')
    .where({
      _openid: auth.data.openid
    })
    .get()

  await Promise.all((oldRes.data || []).map(item => {
    return db.collection('orderDraft').doc(item._id).remove()
  }))

  return {
    success: true
  }
}

function getMenuType(value) {
  return value === 'camping' ? 'camping' : 'dineIn'
}

function getMenuTypeWhere(menuType) {
  return menuType === 'camping' ? 'camping' : _.neq('camping')
}

function getPage(payload) {
  return Math.max(0, Math.floor(Number(payload.page) || 0))
}

function getLimit(payload, fallback = 20, max = 100) {
  const value = Math.floor(Number(payload.limit || payload.pageSize || fallback) || fallback)
  return Math.min(Math.max(value, 1), max)
}

async function listCategories(payload) {
  const menuType = getMenuType(payload.menuType)
  const res = await db.collection('dishCategory')
    .where({
      menuType: getMenuTypeWhere(menuType)
    })
    .orderBy('sort', 'asc')
    .limit(100)
    .get()

  const data = (res.data || [])
    .filter(item => item && item.status !== 0)
    .map(item => ({
      ...item,
      menuType: item.menuType || menuType
    }))
    .sort((a, b) => Number(a.sort || 9999) - Number(b.sort || 9999))

  return {
    success: true,
    data
  }
}

async function listCategoryGoods(payload) {
  const menuType = getMenuType(payload.menuType)
  const categoryId = String(payload.categoryId || '').trim()
  if (!categoryId) {
    return {
      success: false,
      data: [],
      message: 'missing categoryId'
    }
  }

  const page = getPage(payload)
  const limit = getLimit(payload, 20, 100)
  const res = await db.collection('dish')
    .where({
      categoryId,
      menuType: getMenuTypeWhere(menuType),
      status: 1
    })
    .orderBy('sort', 'asc')
    .skip(page * limit)
    .limit(limit)
    .get()

  return {
    success: true,
    data: res.data || [],
    page,
    limit,
    hasMore: (res.data || []).length === limit
  }
}

async function searchGoods(payload) {
  const keyword = String(payload.keyword || '').trim()
  if (!keyword) {
    return {
      success: true,
      data: []
    }
  }

  const menuType = getMenuType(payload.menuType)
  const limit = getLimit(payload, 50, 100)
  const matcher = db.RegExp({
    regexp: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    options: 'i'
  })

  const commonWhere = {
    status: 1,
    menuType: getMenuTypeWhere(menuType)
  }
  const res = await db.collection('dish')
    .where(_.or([
      { ...commonWhere, name: matcher },
      { ...commonWhere, categoryName: matcher },
      { ...commonWhere, description: matcher }
    ]))
    .limit(limit)
    .get()

  return {
    success: true,
    data: res.data || []
  }
}

async function syncMenu(payload) {
  const menuType = getMenuType(payload.menuType)
  const categoryNames = Array.isArray(payload.categoryNames)
    ? payload.categoryNames
    : (payload.categoryName ? [payload.categoryName] : [])

  try {
    const res = await cloud.callFunction({
      name: 'getCategory',
      data: {
        sync: true,
        menuType,
        categoryNames
      }
    })

    const result = res.result || {}
    if (!result.success) {
      return {
        success: false,
        code: 'MENU_SYNC_FAILED',
        message: result.message || 'menu sync failed',
        data: result
      }
    }

    return {
      success: true,
      data: result.data || [],
      syncedCategoryNames: result.syncedCategoryNames || []
    }
  } catch (err) {
    console.error('menu sync failed', err)
    return {
      success: false,
      code: 'MENU_SYNC_CALL_FAILED',
      message: err.message || 'failed to call getCategory'
    }
  }
}

async function getShopInfo() {
  const res = await db.collection('shopInfo').limit(1).get()
  return {
    success: true,
    data: res.data && res.data[0] ? res.data[0] : null
  }
}

async function listNotices() {
  const res = await db.collection('notice')
    .where({ status: 1 })
    .orderBy('sort', 'asc')
    .limit(10)
    .get()

  return {
    success: true,
    data: res.data || []
  }
}

async function handleAction(action, payload) {
  if (action === 'license.check') {
    const tenantId = getTenantId(payload)
    const license = await checkTenantLicense(tenantId)
    return {
      success: license.ok,
      code: license.code || '',
      data: license.license || null,
      message: license.message || ''
    }
  }

  const tenantId = getTenantId(payload)
  const license = await checkTenantLicense(tenantId)
  if (!license.ok) {
    return {
      success: false,
      code: license.code,
      message: license.message
    }
  }

  if (action === 'menu.categories') return listCategories(payload)
  if (action === 'menu.categoryGoods') return listCategoryGoods(payload)
  if (action === 'menu.search') return searchGoods(payload)
  if (action === 'menu.sync') return syncMenu(payload)
  if (action === 'shop.info') return getShopInfo(payload)
  if (action === 'notice.list') return listNotices(payload)
  if (action === 'auth.login') return loginByWechatCode(payload)
  if (action === 'user.me') return getCurrentUser(payload)
  if (action === 'user.completeProfile') return completeUserProfile(payload)
  if (action === 'phone.getNumber') return getPhoneNumber(payload)
  if (action === 'order.create') return createOrder(payload)
  if (action === 'order.list') return listUserOrders(payload)
  if (action === 'order.detail') return getUserOrderDetail(payload)
  if (action === 'order.delete') return markUserOrdersDeleted(payload)
  if (action === 'order.cancel') return cancelUserOrder(payload)
  if (action === 'sharedCart.join') return joinSharedCart(payload)
  if (action === 'sharedCart.get') return getSharedCart(payload)
  if (action === 'sharedCart.patch') return patchSharedCart(payload)
  if (action === 'sharedCart.clear') return clearSharedCart(payload)
  if (action === 'orderDraft.save') return saveOrderDraft(payload)
  if (action === 'orderDraft.get') return getOrderDraft(payload)
  if (action === 'orderDraft.delete') return deleteOrderDraft(payload)

  return {
    success: false,
    code: 'ACTION_NOT_FOUND',
    message: 'unknown action'
  }
}

exports.main = async (event = {}) => {
  const method = event.httpMethod || event.requestContext && event.requestContext.httpMethod
  if (method === 'OPTIONS') {
    return buildResponse({ success: true })
  }

  try {
    await ensureCoreCollections()

    const payload = parsePayload(event)
    const action = String(payload.action || '').trim()
    if (!action) {
      return buildResponse({
        success: false,
        code: 'MISSING_ACTION',
        message: 'missing action'
      }, 400)
    }

    const result = await handleAction(action, payload)
    return buildResponse(result, result.success ? 200 : 400)
  } catch (err) {
    console.error('tenantApi failed', err)
    return buildResponse({
      success: false,
      code: 'SERVER_ERROR',
      message: err.message || 'server error'
    }, 500)
  }
}
