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
const PRINTER_IDS = {
  FRONT: 'qian1',
  RAW: 'sheng2',
  COOKED: 'shu3',
  DESSERT: 'tian4'
}
const PRINTER_NAMES = {
  qian1: '前台打印机',
  sheng2: '生菜打印机',
  shu3: '熟食打印机',
  tian4: '甜品打印机'
}
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

function padNumber(value) {
  return value < 10 ? `0${value}` : `${value}`
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
      ensureCollection('admin'),
      ensureCollection('shopInfo'),
      ensureCollection('notice'),
      ensureCollection('orderDraft'),
      ensureCollection('tableOrderSession'),
      ensureCollection('tableCartItem'),
      ensureCollection('tableGroup'),
      ensureCollection('queue'),
      ensureCollection('reservation'),
      ensureCollection('outdoorGrill'),
      ensureCollection('printer'),
      ensureCollection('tableCode'),
      ensureCollection('rechargeOptions')
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

  const records = []
  const exclusiveGroupCount = {}
  let thresholdBasePrice = 0

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

    const maxOrderCount = Math.floor(Number(dish.maxOrderCount || 0))
    if (maxOrderCount > 0 && count > maxOrderCount) {
      throw new Error(`dish count too large: ${dish.name || item.dishName || ''}`)
    }

    const exclusiveGroup = String(dish.exclusiveGroup || '').trim()
    if (exclusiveGroup) {
      exclusiveGroupCount[exclusiveGroup] = (exclusiveGroupCount[exclusiveGroup] || 0) + count
      if (exclusiveGroupCount[exclusiveGroup] > 1) {
        throw new Error(`exclusive dish conflict: ${dish.name || item.dishName || ''}`)
      }
    }

    const originalPrice = roundMoney(dish.price)
    const originalSubtotal = roundMoney(originalPrice * count)
    const freeThreshold = Number(dish.freeThreshold || 0)
    let categoryName = dish.categoryName || ''
    if (!categoryName && dish.categoryId) {
      const categoryRes = await transaction.collection('dishCategory').doc(dish.categoryId).get()
      categoryName = categoryRes.data && categoryRes.data.name || ''
    }

    if (!freeThreshold) {
      thresholdBasePrice = roundMoney(thresholdBasePrice + originalSubtotal)
    }

    records.push({
      dishId,
      dishName: dish.name || item.dishName || '',
      dishImage: dish.image || item.dishImage || '',
      categoryId: dish.categoryId || '',
      categoryName,
      originalPrice,
      count,
      originalSubtotal,
      freeThreshold,
      maxOrderCount,
      quantityMode: dish.quantityMode || '',
      exclusiveGroup,
      returnRequired: !!dish.returnRequired,
      tags: normalizeTags(item.tags)
    })
  }

  const goods = []
  let totalPrice = 0

  records.forEach(record => {
    const freeByThreshold = record.freeThreshold > 0 && thresholdBasePrice >= record.freeThreshold
    const price = freeByThreshold ? 0 : record.originalPrice
    const subtotal = roundMoney(price * record.count)
    totalPrice = roundMoney(totalPrice + subtotal)

    goods.push({
      ...record,
      price,
      subtotal,
      freeByThreshold
    })
  })

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
  let effectiveTableNumber = tableNumber

  if (orderScene !== 'camping' && !tableNumber) {
    return {
      success: false,
      code: 'TABLE_REQUIRED',
      message: 'table number required'
    }
  }

  const linkedTableGroup = !isAddOnOrder && orderScene !== 'camping'
    ? await getActiveTableGroupSnapshotForTableNumber(tableNumber)
    : {}

  const result = await db.runTransaction(async transaction => {
    const user = await getActiveUser(transaction, openid)
    const priceResult = await buildServerOrderGoods(transaction, payload.orderGoods)
    let rootOrderId = ''
    let inheritedTableGroup = linkedTableGroup

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
        if (isOrderTransferredFromTable(parentOrder, tableNumber)) {
          effectiveTableNumber = String(parentOrder.tableNumber || '').trim()
        } else {
          throw new Error('table number mismatch')
        }
      }

      rootOrderId = parentOrder.rootOrderId || parentOrder._id || parentOrderId
      if (parentOrder.tableGroupId) {
        inheritedTableGroup = {
          tableGroupId: parentOrder.tableGroupId,
          tableGroupPrimary: parentOrder.tableGroupPrimary || null,
          tableGroupTables: Array.isArray(parentOrder.tableGroupTables) ? parentOrder.tableGroupTables : [],
          peopleCount: Number(parentOrder.peopleCount || 0)
        }
      }
    }

    const orderData = {
      type: 'order',
      orderScene,
      orderType: orderScene,
      isAddOnOrder,
      parentOrderId: isAddOnOrder ? parentOrderId : '',
      rootOrderId,
      addOnIndex: isAddOnOrder ? addOnIndex : 0,
      orderCardTitle: payload.orderCardTitle || (isAddOnOrder ? `加菜单${addOnIndex}` : '首单'),
      goods: priceResult.goods,
      totalPrice: priceResult.totalPrice,
      finalPrice: priceResult.finalPrice,
      pay_status: false,
      payStatus: false,
      payMethod: 'offline',
      status: 'submitted',
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
      tableNumber: orderScene === 'camping' ? '' : effectiveTableNumber,
      ...inheritedTableGroup
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

async function createReservation(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const selectedDate = String(payload.selectedDate || payload.reservationDate || '').trim()
  const selectedDateText = String(payload.selectedDateText || payload.reservationDateText || '').trim()
  const selectedTime = String(payload.selectedTime || payload.reservationTime || '').trim()
  const peopleCount = Number(payload.peopleCount || payload.selectedPeople || 0)
  const roomType = String(payload.roomType || payload.selectedRoom || '').trim()

  if (!selectedDate || !selectedTime || !Number.isFinite(peopleCount) || peopleCount <= 0 || !roomType) {
    return {
      success: false,
      code: 'INVALID_RESERVATION',
      message: 'reservation info incomplete'
    }
  }

  const userRes = await db.collection('user')
    .where({
      _openid: auth.data.openid,
      status: _.neq(0)
    })
    .limit(1)
    .get()
  const user = userRes.data && userRes.data[0]
  const phone = user && (user.phoneNumber || user.phone || user.userPhone)

  if (!phone) {
    return {
      success: false,
      code: 'PHONE_REQUIRED',
      message: 'phone number required'
    }
  }

  const now = new Date()
  const reservationNo = `R${now.getFullYear()}${padNumber(now.getMonth() + 1)}${padNumber(now.getDate())}${padNumber(now.getHours())}${padNumber(now.getMinutes())}${padNumber(now.getSeconds())}`
  const reservation = {
    reservationNo,
    _openid: auth.data.openid,
    userId: user._id || '',
    userCode: user.userCode || '',
    nickName: user.nickName || user.nickname || '',
    phone,
    phoneNumber: phone,
    reservationDate: selectedDate,
    reservationDateText: selectedDateText,
    reservationTime: selectedTime,
    peopleCount,
    roomType,
    status: 'pending',
    createTime: db.serverDate(),
    updateTime: db.serverDate()
  }

  const addRes = await db.collection('reservation').add({
    data: reservation
  })

  return {
    success: true,
    data: {
      _id: addRes._id,
      ...reservation,
      createTime: now,
      updateTime: now
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

const ADMIN_TABLE_SECTIONS = [
  {
    areaKey: 'normal',
    areaName: '普通',
    maxPeople: 4,
    count: 15
  },
  {
    areaKey: 'vip',
    areaName: 'VIP',
    maxPeople: 8,
    count: 5
  },
  {
    areaKey: 'sky',
    areaName: '天楼',
    maxPeople: 4,
    count: 13
  }
]

function padTableNumber(value) {
  const text = String(value || '').trim()
  const match = text.match(/\d+/)
  if (!match) return ''
  return String(Number(match[0]) || 0).padStart(2, '0')
}

function createAdminTableSections() {
  return ADMIN_TABLE_SECTIONS.map(section => ({
    areaKey: section.areaKey,
    areaName: section.areaName,
    tables: Array.from({ length: section.count }, (_, index) => {
      const tableNumber = String(index + 1).padStart(2, '0')
      return {
        tableKey: `${section.areaKey}-${tableNumber}`,
        areaKey: section.areaKey,
        areaName: section.areaName,
        tableNumber,
        status: 'empty',
        totalPrice: 0,
        peopleCount: 0,
        maxPeople: section.maxPeople,
        scannedAt: 0,
        orderCount: 0,
        itemCount: 0,
        rootOrderIds: []
      }
    })
  }))
}

function getAdminTableMap(sections) {
  const map = {}
  sections.forEach(section => {
    ;(section.tables || []).forEach(table => {
      map[table.tableKey] = table
    })
  })
  return map
}

function parseAdminTableNumber(tableNumber) {
  const raw = String(tableNumber || '').trim()
  const upper = raw.toUpperCase()
  const number = padTableNumber(raw)
  if (!number) return null

  let areaKey = 'normal'
  if (/^(VIP|V)[-\s_]?\d+/i.test(raw)) {
    areaKey = 'vip'
  } else if (/^(T|SKY|TIAN|TL|天楼)[-\s_]?\d+/i.test(raw) || raw.indexOf('天楼') >= 0) {
    areaKey = 'sky'
  } else if (upper.indexOf('VIP') >= 0) {
    areaKey = 'vip'
  }

  const section = ADMIN_TABLE_SECTIONS.find(item => item.areaKey === areaKey)
  if (!section || Number(number) < 1 || Number(number) > section.count) {
    return null
  }

  return {
    areaKey,
    tableNumber: number,
    tableKey: `${areaKey}-${number}`
  }
}

function getAdminTableNumberCandidates(areaKey, tableNumber) {
  const number = padTableNumber(tableNumber)
  if (!number) return []

  const shortNumber = String(Number(number))
  const base = [number, shortNumber]
  if (areaKey === 'vip') {
    return base.concat([
      `VIP${number}`,
      `VIP${shortNumber}`,
      `VIP-${number}`,
      `VIP ${number}`,
      `V${number}`,
      `V${shortNumber}`
    ])
  }
  if (areaKey === 'sky') {
    return base.concat([
      `天楼${number}`,
      `天楼${shortNumber}`,
      `T${number}`,
      `T${shortNumber}`,
      `T-${number}`,
      `SKY${number}`,
      `SKY${shortNumber}`
    ])
  }
  return base.concat([
    `普通${number}`,
    `普通${shortNumber}`,
    `N${number}`,
    `N${shortNumber}`
  ])
}

function getAdminTableSection(areaKey) {
  return ADMIN_TABLE_SECTIONS.find(item => item.areaKey === areaKey) || ADMIN_TABLE_SECTIONS[0]
}

function getAdminTableRef(areaKey, tableNumber) {
  const section = getAdminTableSection(areaKey)
  const number = padTableNumber(tableNumber)
  if (!number || Number(number) < 1 || Number(number) > section.count) return null

  return {
    tableKey: `${section.areaKey}-${number}`,
    areaKey: section.areaKey,
    areaName: section.areaName,
    tableNumber: number,
    label: `${section.areaName}${number}号桌`
  }
}

function getOrderTableRef(order) {
  const parsed = parseAdminTableNumber(order && order.tableNumber)
  return parsed ? getAdminTableRef(parsed.areaKey, parsed.tableNumber) : null
}

function normalizeAdminTableRefs(tables) {
  const map = {}
  ;(tables || []).forEach(table => {
    const ref = getAdminTableRef(table && table.areaKey, table && table.tableNumber)
    if (ref) map[ref.tableKey] = ref
  })
  return Object.keys(map).map(key => map[key])
}

function mergeAdminTableRefs() {
  const map = {}
  Array.prototype.slice.call(arguments).forEach(list => {
    normalizeAdminTableRefs(list).forEach(ref => {
      map[ref.tableKey] = ref
    })
  })
  return Object.keys(map)
    .map(key => map[key])
    .sort((a, b) => a.tableKey.localeCompare(b.tableKey))
}

function getTableGroupId(group) {
  return group && (group.tableGroupId || group._id) || ''
}

function getTableGroupRefs(group) {
  return normalizeAdminTableRefs(group && (group.tables || group.tableGroupTables))
}

function getTableGroupPrimary(group, fallbackRef) {
  return getAdminTableRef(group && group.primaryTable && group.primaryTable.areaKey, group && group.primaryTable && group.primaryTable.tableNumber) ||
    getAdminTableRef(group && group.tableGroupPrimary && group.tableGroupPrimary.areaKey, group && group.tableGroupPrimary && group.tableGroupPrimary.tableNumber) ||
    fallbackRef ||
    getTableGroupRefs(group)[0] ||
    null
}

function getTableGroupSnapshot(group, fallbackRef) {
  if (!group) return null
  const groupId = getTableGroupId(group)
  const refs = mergeAdminTableRefs(getTableGroupRefs(group), fallbackRef ? [fallbackRef] : [])
  if (!groupId || refs.length < 2) return null
  return {
    tableGroupId: groupId,
    tableGroupPrimary: getTableGroupPrimary(group, fallbackRef),
    tableGroupTables: refs,
    peopleCount: Number(group.peopleCount || 0)
  }
}

function findTableGroupForRef(tableGroups, ref) {
  if (!ref) return null
  return (tableGroups || []).find(group => {
    return getTableGroupRefs(group).some(item => isSameAdminTableRef(item, ref))
  }) || null
}

async function listActiveTableGroups() {
  try {
    const res = await db.collection('tableGroup')
      .where({
        status: 'active'
      })
      .limit(200)
      .get()
    return res.data || []
  } catch (err) {
    return []
  }
}

async function listActiveTableSessions() {
  try {
    const res = await db.collection('tableOrderSession')
      .where({
        status: 'ordering'
      })
      .limit(200)
      .get()
    return (res.data || []).filter(isActiveTableSession)
  } catch (err) {
    return []
  }
}

async function getActiveTableSessionForRef(ref) {
  if (!ref) return null
  const sessions = await listActiveTableSessions()
  return sessions.find(session => {
    const sessionRef = getOrderTableRef({ tableNumber: session.tableNumber })
    return isSameAdminTableRef(sessionRef, ref)
  }) || null
}

async function getActiveTableGroupForRef(ref) {
  if (!ref) return null
  const groups = await listActiveTableGroups()
  return findTableGroupForRef(groups, ref)
}

async function getActiveTableGroupSnapshotForTableNumber(tableNumber) {
  const ref = getOrderTableRef({ tableNumber })
  if (!ref) return {}
  const group = await getActiveTableGroupForRef(ref)
  const snapshot = getTableGroupSnapshot(group, ref)
  if (!snapshot) return {}
  return snapshot
}

function getMergedTablesFromOrders(orders, fallbackTable) {
  const map = {}
  const fallbackRef = fallbackTable ? getAdminTableRef(fallbackTable.areaKey, fallbackTable.tableNumber) : null
  if (fallbackRef) map[fallbackRef.tableKey] = fallbackRef

  ;(orders || []).forEach(order => {
    normalizeAdminTableRefs(order.tableGroupTables).forEach(ref => {
      map[ref.tableKey] = ref
    })
    const orderRef = getOrderTableRef(order)
    if (orderRef) map[orderRef.tableKey] = orderRef
  })

  return Object.keys(map)
    .map(key => map[key])
    .sort((a, b) => a.tableKey.localeCompare(b.tableKey))
}

function getMergedTableText(tables) {
  return (tables || []).map(table => table.label).join(' + ')
}

function formatAdminTableNumber(ref) {
  if (!ref) return ''
  if (ref.areaKey === 'vip') return `VIP${ref.tableNumber}`
  if (ref.areaKey === 'sky') return `天楼${ref.tableNumber}`
  return ref.tableNumber
}

function isSameAdminTableRef(left, right) {
  return left && right &&
    left.areaKey === right.areaKey &&
    left.tableNumber === right.tableNumber
}

function replaceAdminTableRef(tables, sourceRef, targetRef) {
  const map = {}
  normalizeAdminTableRefs(tables).forEach(ref => {
    const nextRef = isSameAdminTableRef(ref, sourceRef) ? targetRef : ref
    if (nextRef) map[nextRef.tableKey] = nextRef
  })
  if (targetRef && !map[targetRef.tableKey]) {
    map[targetRef.tableKey] = targetRef
  }
  return Object.keys(map)
    .map(key => map[key])
    .sort((a, b) => a.tableKey.localeCompare(b.tableKey))
}

function isOrderTransferredFromTable(order, tableNumber) {
  const sourceRef = getOrderTableRef({ tableNumber })
  if (!sourceRef || !order) return false

  const directFrom = getAdminTableRef(
    order.transferFromTable && order.transferFromTable.areaKey,
    order.transferFromTable && order.transferFromTable.tableNumber
  )
  if (isSameAdminTableRef(sourceRef, directFrom)) return true

  return (Array.isArray(order.transferLogs) ? order.transferLogs : []).some(log => {
    const fromRef = getAdminTableRef(log.from && log.from.areaKey, log.from && log.from.tableNumber)
    return isSameAdminTableRef(sourceRef, fromRef)
  })
}

function isAdminTableOrder(order) {
  if (!order || order.type !== 'order') return false
  if (order.deleted === true) return false
  if (order.tableCleared === true) return false
  if (isExpiredSavedOrder(order)) return false
  if (order.orderScene === 'camping' || order.orderType === 'camping') return false
  if (!order.tableNumber) return false

  const status = String(order.status || '')
  if (status === 'cancelled' || status === '3') return false
  return true
}

function isKitchenPrintableOrder(order) {
  if (!order || order.type !== 'order') return false
  if (order.deleted === true) return false
  if (isSavedOrder(order)) return false

  const status = String(order.status || '')
  if (status === 'cancelled' || status === '3') return false
  return true
}

function isAdminPaidOrder(order) {
  const status = String(order && order.status || '')
  return order && (
    order.pay_status === true ||
    order.payStatus === true ||
    status === 'paid' ||
    status === 'completed'
  )
}

function isAdminPreparingOrder(order) {
  const status = String(order && order.status || '')
  return order && (
    order.frontDeskConfirmed === true ||
    order.kitchenPrinted === true ||
    status === 'pending_prepare' ||
    status === 'preparing' ||
    status === 'served' ||
    status === 'ready_pickup' ||
    status === 'picked_up'
  )
}

function getAdminTableStatus(orders) {
  if (!orders || orders.length === 0) return 'empty'
  if (orders.every(isAdminPaidOrder)) return 'paid'
  if (orders.some(isAdminPreparingOrder)) return 'preparing'
  if (orders.some(order => !isAdminPaidOrder(order))) return 'submitted'
  return 'paid'
}

function getOrderGoodsCount(order) {
  return (Array.isArray(order.goods) ? order.goods : []).reduce((sum, item) => {
    return sum + (Number(item.count) || 0)
  }, 0)
}

function summarizeAdminTable(table, orders, tableGroup, tableSession) {
  const activeOrders = (orders || []).filter(isAdminTableOrder)
  const rootOrderIds = []
  const userIds = []
  const tableRef = getAdminTableRef(table && table.areaKey, table && table.tableNumber)
  const groupSnapshot = getTableGroupSnapshot(tableGroup, tableRef)
  const mergedTables = groupSnapshot
    ? mergeAdminTableRefs(getMergedTablesFromOrders(activeOrders, table), groupSnapshot.tableGroupTables)
    : getMergedTablesFromOrders(activeOrders, table)
  const tableGroupId = (activeOrders.find(order => order.tableGroupId) || {}).tableGroupId ||
    (groupSnapshot && groupSnapshot.tableGroupId) ||
    ''
  let totalPrice = 0
  let itemCount = 0
  let scannedAt = 0
  let finishedAt = 0
  let peopleCount = Number(tableGroup && tableGroup.peopleCount || 0)
  const hasActiveSession = isActiveTableSession(tableSession)

  activeOrders.forEach(order => {
    const rootOrderId = order.rootOrderId || order._id
    if (rootOrderId && rootOrderIds.indexOf(rootOrderId) === -1) {
      rootOrderIds.push(rootOrderId)
    }
    const userId = order.userId || order._openid || ''
    if (userId && userIds.indexOf(userId) === -1) {
      userIds.push(userId)
    }
    totalPrice = roundMoney(totalPrice + Number(order.finalPrice || order.totalPrice || 0))
    itemCount += getOrderGoodsCount(order)

    const createTime = getTimeValue(order.createTime)
    if (createTime && (!scannedAt || createTime < scannedAt)) {
      scannedAt = createTime
    }
    const checkoutTime = getTimeValue(order.checkoutAt || order.payTime || order.finishTime || order.updateTime)
    if (checkoutTime && checkoutTime > finishedAt) {
      finishedAt = checkoutTime
    }

    peopleCount = Math.max(peopleCount, Number(order.peopleCount || 0))
  })

  if (!peopleCount && activeOrders.length > 0) {
    peopleCount = Math.max(1, userIds.length)
  }
  if (!peopleCount && hasActiveSession) {
    peopleCount = Math.max(1, Array.isArray(tableSession.memberOpenids) ? tableSession.memberOpenids.length : 0)
  }
  if (!scannedAt && hasActiveSession) {
    scannedAt = getTimeValue(tableSession.createTime || tableSession.updateTime)
  }

  const status = activeOrders.length > 0
    ? getAdminTableStatus(activeOrders)
    : (hasActiveSession ? 'submitted' : 'empty')

  return {
    ...table,
    status,
    totalPrice,
    peopleCount,
    scannedAt,
    finishedAt: status === 'paid' ? finishedAt : 0,
    orderCount: activeOrders.length,
    itemCount,
    rootOrderIds,
    tableGroupId,
    mergedTables,
    mergedTableText: mergedTables.length > 1 ? getMergedTableText(mergedTables) : ''
  }
}

function buildAdminTableSections(orders, tableGroups = [], tableSessions = []) {
  const sections = createAdminTableSections()
  const tableMap = getAdminTableMap(sections)
  const ordersByTable = {}
  const tableGroupsByTable = {}
  const tableSessionsByTable = {}

  ;(orders || []).filter(isAdminTableOrder).forEach(order => {
    const parsed = parseAdminTableNumber(order.tableNumber)
    const tableRefs = normalizeAdminTableRefs(order.tableGroupTables)
    const targetRefs = tableRefs.length > 1
      ? tableRefs
      : (parsed ? [getAdminTableRef(parsed.areaKey, parsed.tableNumber)] : [])

    targetRefs.forEach(ref => {
      if (!ref || !tableMap[ref.tableKey]) return
      if (!ordersByTable[ref.tableKey]) ordersByTable[ref.tableKey] = []
      ordersByTable[ref.tableKey].push(order)
    })
  })

  ;(tableGroups || []).forEach(group => {
    getTableGroupRefs(group).forEach(ref => {
      if (!ref || !tableMap[ref.tableKey]) return
      if (!tableGroupsByTable[ref.tableKey]) {
        tableGroupsByTable[ref.tableKey] = group
      }
    })
  })

  ;(tableSessions || []).forEach(session => {
    const ref = getOrderTableRef({ tableNumber: session.tableNumber })
    if (!ref || !tableMap[ref.tableKey]) return
    tableSessionsByTable[ref.tableKey] = session
  })

  sections.forEach(section => {
    section.tables = section.tables.map(table => {
      return summarizeAdminTable(
        table,
        ordersByTable[table.tableKey] || [],
        tableGroupsByTable[table.tableKey],
        tableSessionsByTable[table.tableKey]
      )
    })
  })

  return sections
}

function getAdminOrderStatusText(order) {
  if (isAdminPaidOrder(order)) return '已支付'
  if (isAdminPreparingOrder(order)) return '制作中'
  return '已提交'
}

function formatAdminGoods(goods) {
  return (Array.isArray(goods) ? goods : []).map(item => {
    const count = Number(item.count || 0)
    const subtotal = roundMoney(item.subtotal !== undefined
      ? item.subtotal
      : Number(item.price || 0) * count)
    const tags = normalizeTags(item.tags)
    if ((item.isGift === true || item.giftDish === true) && tags.indexOf('赠菜') === -1) {
      tags.push('赠菜')
    }
    return {
      dishId: item.dishId || '',
      dishName: item.dishName || item.name || '',
      dishImage: item.dishImage || item.image || '',
      categoryId: item.categoryId || '',
      categoryName: item.categoryName || '',
      price: roundMoney(item.price || 0),
      count,
      subtotal,
      subtotalText: String(subtotal),
      tags,
      tagText: tags.join('、'),
      isGift: item.isGift === true || item.giftDish === true,
      kitchenSent: item.kitchenSent === true,
      kitchenStatus: item.kitchenStatus || ''
    }
  })
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload || {})
    const target = new URL(url)
    const req = https.request({
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
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
        reject(new Error(data.errmsg || data.message || `http ${res.statusCode}`))
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function normalizeRouteText(value) {
  return String(value || '').replace(/\s+/g, '').trim()
}

function routeTextIncludes(value, patterns) {
  const text = normalizeRouteText(value)
  return patterns.some(pattern => text.indexOf(normalizeRouteText(pattern)) !== -1)
}

function routeTextEquals(value, names) {
  const text = normalizeRouteText(value)
  return names.some(name => text === normalizeRouteText(name))
}

function isCampingOrder(order = {}) {
  return order.orderScene === 'camping' || order.orderType === 'camping'
}

function getCampingDishPrinterId(item = {}) {
  const categoryName = normalizeRouteText(item.categoryName || item.category || '')
  const dishName = normalizeRouteText(item.dishName || item.name || '')

  if (routeTextEquals(dishName, ['小薄饼', '烤榴莲'])) {
    return PRINTER_IDS.COOKED
  }
  if (routeTextIncludes(categoryName, ['锡纸类', '锡纸'])) {
    return PRINTER_IDS.COOKED
  }
  if (routeTextIncludes(categoryName, [
    '张南招牌',
    '牛肉',
    '牛肉i',
    '猪肉',
    '明星烤肉',
    '素菜',
    '蔬菜',
    '小料区',
    '包肉搭子',
    '包肉好搭子',
    '包肉好打字'
  ])) {
    return PRINTER_IDS.RAW
  }

  return PRINTER_IDS.RAW
}

function getDishPrinterId(item = {}, order = {}) {
  if (isCampingOrder(order)) {
    return getCampingDishPrinterId(item)
  }

  const categoryName = normalizeRouteText(item.categoryName || item.category || '')
  const dishName = normalizeRouteText(item.dishName || item.name || '')

  if (routeTextIncludes(categoryName, ['贵州冰浆', '雪冰', '甜品饮料'])) {
    return PRINTER_IDS.DESSERT
  }
  if (routeTextIncludes(categoryName, ['主食'])) {
    return PRINTER_IDS.COOKED
  }
  if (routeTextIncludes(categoryName, ['张南原切'])) {
    return PRINTER_IDS.RAW
  }
  if (routeTextIncludes(categoryName, ['张南招牌'])) {
    if (routeTextEquals(dishName, ['泰式冬阴功', '烤榴莲'])) {
      return PRINTER_IDS.DESSERT
    }
    return PRINTER_IDS.RAW
  }
  if (routeTextIncludes(categoryName, ['包肉搭子', '包肉好搭子', '包肉好打字'])) {
    if (routeTextEquals(dishName, ['小薄饼'])) return PRINTER_IDS.COOKED
    if (routeTextEquals(dishName, ['糖心苹果片'])) return PRINTER_IDS.DESSERT
    if (routeTextEquals(dishName, ['生菜', '蔬菜', '菠萝片'])) return PRINTER_IDS.RAW
    return PRINTER_IDS.RAW
  }
  if (routeTextIncludes(categoryName, ['明星烤肉'])) {
    return PRINTER_IDS.RAW
  }
  if (routeTextIncludes(categoryName, ['素菜', '蔬菜'])) {
    return PRINTER_IDS.RAW
  }
  if (routeTextIncludes(categoryName, ['熟食'])) {
    if (routeTextEquals(dishName, ['绝味花生米', '油酥花生米', '葱心豆干', '芥末黄瓜条', '芥末黄瓜', '虾片'])) {
      return PRINTER_IDS.RAW
    }
  }

  return PRINTER_IDS.FRONT
}

function groupDishEntriesByPrinter(dishEntries, order = {}) {
  return (dishEntries || []).reduce((groups, entry) => {
    const printerId = getDishPrinterId(entry.item || {}, order)
    if (!groups[printerId]) groups[printerId] = []
    groups[printerId].push(entry)
    return groups
  }, {})
}

function getPrinterWebhookUrl(printerId) {
  const upperId = String(printerId || '').toUpperCase()
  const specificUrl = process.env[`PRINTER_${upperId}_WEBHOOK_URL`] || process.env[`${upperId}_PRINTER_WEBHOOK_URL`]
  return String(specificUrl || process.env.KITCHEN_PRINTER_WEBHOOK_URL || process.env.PRINTER_WEBHOOK_URL || '').trim()
}

async function enrichDishEntriesForPrinter(dishEntries) {
  const result = []

  for (const entry of dishEntries || []) {
    const item = {
      ...(entry.item || {})
    }
    if (!item.categoryName && item.dishId) {
      const dishRes = await db.collection('dish').doc(item.dishId).get()
      const dish = dishRes.data || {}
      item.categoryId = item.categoryId || dish.categoryId || ''
      item.categoryName = item.categoryName || dish.categoryName || ''
      if (!item.categoryName && item.categoryId) {
        const categoryRes = await db.collection('dishCategory').doc(item.categoryId).get()
        item.categoryName = categoryRes.data && categoryRes.data.name || ''
      }
    }
    result.push({
      ...entry,
      item
    })
  }

  return result
}

function getAdminOrderTitle(order, index) {
  const rawTitle = String(order.orderCardTitle || '').trim()
  const addOnIndex = Number(order.addOnIndex || index)

  if (rawTitle === 'First order' || rawTitle === '第一单') return '首单'
  if (/^Add-on\s+\d+/i.test(rawTitle)) {
    const match = rawTitle.match(/\d+/)
    return `加菜单${match ? match[0] : addOnIndex || index}`
  }
  if (rawTitle) return rawTitle
  return order.isAddOnOrder ? `加菜单${addOnIndex || index}` : '首单'
}

function buildAdminBillGroups(orders) {
  return (orders || []).filter(isAdminTableOrder).map((order, index) => {
    const goods = formatAdminGoods(order.goods)
    const finalPrice = roundMoney(order.finalPrice || order.totalPrice || 0)
    return {
      id: order._id,
      orderId: order._id,
      rootOrderId: order.rootOrderId || order._id,
      title: getAdminOrderTitle(order, index),
      status: order.status || '',
      statusText: getAdminOrderStatusText(order),
      createTime: order.createTime,
      createTimeValue: getTimeValue(order.createTime),
      userCode: order.userCode || '',
      userNickName: order.userNickName || order.userSnapshot && order.userSnapshot.nickName || '',
      userPhone: order.userPhone || order.userSnapshot && order.userSnapshot.phoneNumber || '',
      goods,
      goodsCount: goods.reduce((sum, item) => sum + (Number(item.count) || 0), 0),
      finalPrice,
      finalPriceText: String(finalPrice),
      kitchenPrinted: order.kitchenPrinted === true,
      frontDeskConfirmed: order.frontDeskConfirmed === true
    }
  })
}

async function adminListTables() {
  const res = await db.collection('order')
    .where({
      type: 'order'
    })
    .orderBy('createTime', 'desc')
    .limit(300)
    .get()
  const tableGroups = await listActiveTableGroups()
  const tableSessions = await listActiveTableSessions()

  return {
    success: true,
    data: {
      sections: buildAdminTableSections(res.data || [], tableGroups, tableSessions)
    }
  }
}

async function getSingleAdminTableOrders(areaKey, tableNumber) {
  const targetAreaKey = String(areaKey || 'normal').trim() || 'normal'
  const number = padTableNumber(tableNumber)
  const candidates = getAdminTableNumberCandidates(targetAreaKey, number)
  if (!number || candidates.length === 0) return []

  const res = await db.collection('order')
    .where({
      type: 'order',
      tableNumber: _.in(candidates)
    })
    .orderBy('createTime', 'asc')
    .limit(100)
    .get()

  return (res.data || []).filter(order => {
    if (!isAdminTableOrder(order)) return false
    const parsed = parseAdminTableNumber(order.tableNumber)
    return parsed && parsed.areaKey === targetAreaKey && parsed.tableNumber === number
  })
}

async function getAdminTableOrders(payload) {
  const areaKey = String(payload.areaKey || 'normal').trim() || 'normal'
  const tableNumber = padTableNumber(payload.tableNumber)
  const tableRef = getAdminTableRef(areaKey, tableNumber)
  const baseOrders = await getSingleAdminTableOrders(areaKey, tableNumber)
  let relatedOrders = baseOrders
  let groupMemberOrders = []

  if (tableRef) {
    const groupMemberRes = await db.collection('order')
      .where({
        type: 'order'
      })
      .orderBy('createTime', 'desc')
      .limit(300)
      .get()
    groupMemberOrders = (groupMemberRes.data || []).filter(order => {
      if (!isAdminTableOrder(order)) return false
      return normalizeAdminTableRefs(order.tableGroupTables).some(ref => isSameAdminTableRef(ref, tableRef))
    })
    const relatedMap = {}
    const baseOrdersForCurrentBill = groupMemberOrders.length > 0
      ? baseOrders.filter(order => !isAdminPaidOrder(order) || order.tableGroupId)
      : baseOrders
    baseOrdersForCurrentBill.concat(groupMemberOrders).forEach(order => {
      if (order._id) relatedMap[order._id] = order
    })
    relatedOrders = Object.keys(relatedMap).map(key => relatedMap[key])
  }

  const groupIds = Array.from(new Set(relatedOrders.map(order => String(order.tableGroupId || '').trim()).filter(Boolean)))

  if (groupIds.length === 0) return relatedOrders

  const groupRes = await db.collection('order')
    .where({
      type: 'order',
      tableGroupId: _.in(groupIds)
    })
    .orderBy('createTime', 'asc')
    .limit(200)
    .get()

  const orderMap = {}
  relatedOrders.concat(groupRes.data || []).forEach(order => {
    if (isAdminTableOrder(order) && order._id) {
      orderMap[order._id] = order
    }
  })

  return Object.keys(orderMap)
    .map(key => orderMap[key])
    .sort((a, b) => getTimeValue(a.createTime) - getTimeValue(b.createTime))
}

async function adminGetTableDetail(payload) {
  const areaKey = String(payload.areaKey || 'normal').trim() || 'normal'
  const tableNumber = padTableNumber(payload.tableNumber)
  const section = ADMIN_TABLE_SECTIONS.find(item => item.areaKey === areaKey) || ADMIN_TABLE_SECTIONS[0]
  const baseTable = createAdminTableSections()
    .find(item => item.areaKey === section.areaKey)
    .tables
    .find(item => item.tableNumber === tableNumber)

  if (!baseTable) {
    return {
      success: false,
      code: 'TABLE_NOT_FOUND',
      message: 'table not found'
    }
  }

  const orders = await getAdminTableOrders({ areaKey, tableNumber })
  const tableGroup = await getActiveTableGroupForRef(baseTable)
  const tableSession = await getActiveTableSessionForRef(baseTable)
  const table = summarizeAdminTable(baseTable, orders, tableGroup, tableSession)
  const billGroups = buildAdminBillGroups(orders)
  const totalPrice = roundMoney(billGroups.reduce((sum, group) => sum + Number(group.finalPrice || 0), 0))
  const itemCount = billGroups.reduce((sum, group) => sum + Number(group.goodsCount || 0), 0)

  return {
    success: true,
    data: {
      table,
      billGroups,
      totalPrice,
      totalPriceText: String(totalPrice),
      itemCount
    }
  }
}

async function adminUpdateTablePeople(payload) {
  const peopleCount = Math.floor(Number(payload.peopleCount))
  if (!Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > 99) {
    return {
      success: false,
      code: 'PEOPLE_COUNT_INVALID',
      message: 'people count invalid'
    }
  }

  const tableRef = getAdminTableRef(payload.areaKey, payload.tableNumber)
  if (!tableRef) {
    return {
      success: false,
      code: 'TABLE_NOT_FOUND',
      message: 'table not found'
    }
  }

  const orders = await getAdminTableOrders(payload)
  const targetOrders = orders.filter(order => !isAdminPaidOrder(order))
  const activeGroup = await getActiveTableGroupForRef(tableRef)
  const groupIds = Array.from(new Set(targetOrders
    .map(order => String(order.tableGroupId || '').trim())
    .filter(Boolean)))
  const activeGroupId = getTableGroupId(activeGroup)
  if (activeGroupId && groupIds.indexOf(activeGroupId) === -1) {
    groupIds.push(activeGroupId)
  }

  if (targetOrders.length === 0 && groupIds.length === 0) {
    return {
      success: false,
      code: 'NO_ACTIVE_ORDER',
      message: 'no active order'
    }
  }

  await Promise.all(targetOrders.map(order => db.collection('order').doc(order._id).update({
    data: {
      peopleCount,
      updateTime: db.serverDate()
    }
  })).concat(groupIds.map(groupId => db.collection('tableGroup').doc(groupId).update({
    data: {
      peopleCount,
      updateTime: db.serverDate()
    }
  }).catch(() => db.collection('tableGroup').doc(groupId).set({
    data: {
      tableGroupId: groupId,
      primaryTable: tableRef,
      tables: [tableRef],
      status: 'active',
      peopleCount,
      updateTime: db.serverDate()
    }
  })))))

  return {
    success: true,
    data: {
      updated: targetOrders.length,
      updatedGroups: groupIds.length,
      peopleCount
    }
  }
}

async function adminMergeTables(payload) {
  const primaryRef = getAdminTableRef(payload.areaKey, payload.tableNumber)
  const targetRefs = normalizeAdminTableRefs(payload.tables)
  if (!primaryRef) {
    return {
      success: false,
      code: 'TABLE_NOT_FOUND',
      message: 'table not found'
    }
  }

  const refMap = {
    [primaryRef.tableKey]: primaryRef
  }
  targetRefs.forEach(ref => {
    if (ref.tableKey !== primaryRef.tableKey) {
      refMap[ref.tableKey] = ref
    }
  })
  const mergeRefs = Object.keys(refMap).map(key => refMap[key])

  if (mergeRefs.length < 2) {
    return {
      success: false,
      code: 'MERGE_TARGET_REQUIRED',
      message: 'merge target required'
    }
  }

  const activeTableGroups = await listActiveTableGroups()
  const matchedTableGroups = activeTableGroups.filter(group => {
    const refs = getTableGroupRefs(group)
    return refs.some(groupRef => mergeRefs.some(ref => isSameAdminTableRef(groupRef, ref)))
  })
  matchedTableGroups.forEach(group => {
    getTableGroupRefs(group).forEach(ref => {
      refMap[ref.tableKey] = ref
    })
  })
  const allMergeRefs = Object.keys(refMap).map(key => refMap[key])
  const activeOrderMap = {}

  for (const ref of allMergeRefs) {
    const orders = await getSingleAdminTableOrders(ref.areaKey, ref.tableNumber)
    const activeOrders = orders.filter(order => !isAdminPaidOrder(order))
    activeOrders.forEach(order => {
      if (order._id) activeOrderMap[order._id] = order
    })
  }

  let activeOrders = Object.keys(activeOrderMap).map(key => activeOrderMap[key])
  const groupIds = Array.from(new Set(activeOrders.map(order => String(order.tableGroupId || '').trim()).filter(Boolean)))

  if (groupIds.length > 0) {
    const groupRes = await db.collection('order')
      .where({
        type: 'order',
        tableGroupId: _.in(groupIds)
      })
      .limit(200)
      .get()
    ;(groupRes.data || []).forEach(order => {
      if (isAdminTableOrder(order) && !isAdminPaidOrder(order) && order._id) {
        activeOrderMap[order._id] = order
      }
    })
    activeOrders = Object.keys(activeOrderMap).map(key => activeOrderMap[key])
  }

  const tableMap = {}
  allMergeRefs.forEach(ref => {
    tableMap[ref.tableKey] = ref
  })
  getMergedTablesFromOrders(activeOrders, primaryRef).forEach(ref => {
    tableMap[ref.tableKey] = ref
  })
  const mergedTables = Object.keys(tableMap)
    .map(key => tableMap[key])
    .sort((a, b) => a.tableKey.localeCompare(b.tableKey))
  const existingGroupId = groupIds[0] || getTableGroupId(matchedTableGroups[0]) || ''
  const tableGroupId = existingGroupId || `merge_${primaryRef.tableKey}_${Date.now()}`
  const updateData = {
    tableGroupId,
    tableGroupPrimary: primaryRef,
    tableGroupTables: mergedTables,
    tableGroupUpdatedAt: db.serverDate(),
    updateTime: db.serverDate()
  }

  await Promise.all(activeOrders.map(order => db.collection('order').doc(order._id).update({
    data: updateData
  })))

  await db.collection('tableGroup').doc(tableGroupId).set({
    data: {
      tableGroupId,
      primaryTable: primaryRef,
      tables: mergedTables,
      status: 'active',
      updateTime: db.serverDate()
    }
  })

  const inactiveGroupIds = matchedTableGroups
    .map(group => getTableGroupId(group))
    .filter(groupId => groupId && groupId !== tableGroupId)
  await Promise.all(inactiveGroupIds.map(groupId => db.collection('tableGroup').doc(groupId).set({
    data: {
      tableGroupId: groupId,
      status: 'inactive',
      mergedInto: tableGroupId,
      updateTime: db.serverDate()
    }
  })))

  return {
    success: true,
    data: {
      tableGroupId,
      primaryTable: primaryRef,
      tables: mergedTables,
      tableText: getMergedTableText(mergedTables),
      updatedOrders: activeOrders.length
    }
  }
}

async function adminTransferTable(payload) {
  const sourceRef = getAdminTableRef(
    payload.sourceAreaKey || payload.areaKey,
    payload.sourceTableNumber || payload.tableNumber
  )
  const targetRef = getAdminTableRef(payload.targetAreaKey, payload.targetTableNumber)

  if (!sourceRef || !targetRef) {
    return {
      success: false,
      code: 'TABLE_NOT_FOUND',
      message: 'table not found'
    }
  }
  if (sourceRef.tableKey === targetRef.tableKey) {
    return {
      success: false,
      code: 'SAME_TABLE',
      message: 'target table is same as source table'
    }
  }

  const sourceOrders = (await getSingleAdminTableOrders(sourceRef.areaKey, sourceRef.tableNumber))
    .filter(order => !isAdminPaidOrder(order))
  if (sourceOrders.length === 0) {
    return {
      success: false,
      code: 'NO_ACTIVE_ORDER',
      message: 'no active order'
    }
  }

  const targetOrders = (await getSingleAdminTableOrders(targetRef.areaKey, targetRef.tableNumber))
    .filter(order => !isAdminPaidOrder(order))
  if (targetOrders.length > 0) {
    return {
      success: false,
      code: 'TARGET_TABLE_OCCUPIED',
      message: '目标桌已有未结账订单，请使用拼桌'
    }
  }

  const sourceOrderMap = {}
  sourceOrders.forEach(order => {
    if (order._id) sourceOrderMap[order._id] = order
  })

  const groupIds = Array.from(new Set(sourceOrders.map(order => String(order.tableGroupId || '').trim()).filter(Boolean)))
  const groupOrderMap = {}
  if (groupIds.length > 0) {
    const groupRes = await db.collection('order')
      .where({
        type: 'order',
        tableGroupId: _.in(groupIds)
      })
      .limit(200)
      .get()
    ;(groupRes.data || []).forEach(order => {
      if (isAdminTableOrder(order) && !isAdminPaidOrder(order) && order._id) {
        groupOrderMap[order._id] = order
      }
    })
  }

  const transferTime = new Date()
  const targetTableNumber = formatAdminTableNumber(targetRef)
  const allGroupOrders = Object.keys(groupOrderMap).map(key => groupOrderMap[key])
  const groupTables = replaceAdminTableRef(
    getMergedTablesFromOrders(allGroupOrders.length > 0 ? allGroupOrders : sourceOrders, sourceRef),
    sourceRef,
    targetRef
  )

  const updates = []
  sourceOrders.forEach(order => {
    const nextGroupTables = order.tableGroupId
      ? groupTables
      : replaceAdminTableRef([sourceRef], sourceRef, targetRef)
    const nextPrimary = isSameAdminTableRef(
      getAdminTableRef(order.tableGroupPrimary && order.tableGroupPrimary.areaKey, order.tableGroupPrimary && order.tableGroupPrimary.tableNumber),
      sourceRef
    ) ? targetRef : (order.tableGroupPrimary || targetRef)
    const updateData = {
      tableNumber: targetTableNumber,
      transferFromTable: sourceRef,
      transferToTable: targetRef,
      transferAt: transferTime,
      transferLogs: [
        ...(Array.isArray(order.transferLogs) ? order.transferLogs : []),
        {
          from: sourceRef,
          to: targetRef,
          createTime: transferTime
        }
      ],
      updateTime: db.serverDate()
    }

    if (order.tableGroupId) {
      updateData.tableGroupPrimary = nextPrimary
      updateData.tableGroupTables = nextGroupTables
    }

    updates.push(db.collection('order').doc(order._id).update({
      data: updateData
    }))
  })

  Object.keys(groupOrderMap).forEach(orderId => {
    if (sourceOrderMap[orderId]) return
    const order = groupOrderMap[orderId]
    const updateData = {
      tableGroupTables: groupTables,
      updateTime: db.serverDate()
    }
    if (order.tableGroupPrimary) {
      updateData.tableGroupPrimary = isSameAdminTableRef(
        getAdminTableRef(order.tableGroupPrimary && order.tableGroupPrimary.areaKey, order.tableGroupPrimary && order.tableGroupPrimary.tableNumber),
        sourceRef
      ) ? targetRef : order.tableGroupPrimary
    }
    updates.push(db.collection('order').doc(orderId).update({
      data: updateData
    }))
  })

  await Promise.all(updates)

  const sourceSharedCartTableNumbers = getSharedCartTableNumbersForAdminRef(sourceRef)
  const sourceSharedCartResults = []
  for (const sourceTableNumber of sourceSharedCartTableNumbers) {
    sourceSharedCartResults.push(await clearSharedCartSessionByTableNumber(sourceTableNumber, transferTime))
  }

  if (groupIds.length > 0) {
    await Promise.all(groupIds.map(groupId => db.collection('tableGroup').doc(groupId).set({
      data: {
        tableGroupId: groupId,
        tables: groupTables,
        status: 'active',
        updateTime: db.serverDate()
      }
    })))
  }

  return {
    success: true,
    data: {
      from: sourceRef,
      to: targetRef,
      updatedOrders: sourceOrders.length,
      tableNumber: targetTableNumber,
      sourceSharedCartRemoved: sourceSharedCartResults.reduce((sum, item) => sum + Number(item.removed || 0), 0),
      sourceSharedCartTables: sourceSharedCartTableNumbers
    }
  }
}

function buildAdminCheckoutSummary(orders, payload) {
  const totalPrice = roundMoney((orders || []).reduce((sum, order) => {
    return sum + Number(order.finalPrice || order.totalPrice || 0)
  }, 0))
  const discountType = String(payload.discountType || '').trim()
  const discountValueRaw = payload.discountValue
  const discountValue = discountValueRaw === '' || discountValueRaw == null ? '' : Number(discountValueRaw)
  const hasDiscount = discountType === 'reduce' && Number.isFinite(discountValue) && discountValue >= 0 && discountValue <= 10
  const receivable = hasDiscount ? roundMoney(totalPrice * discountValue / 10) : totalPrice

  return {
    totalPrice,
    receivable,
    paymentMethod: String(payload.paymentMethod || 'wechat_alipay').trim() || 'wechat_alipay',
    discountType: hasDiscount ? discountType : '',
    discountValue: hasDiscount ? discountValue : ''
  }
}

async function adminFinishTableCheckout(payload) {
  const orders = await getAdminTableOrders(payload)
  const targetOrders = orders.filter(order => !isAdminPaidOrder(order))

  if (targetOrders.length === 0) {
    return {
      success: false,
      code: 'NO_UNPAID_ORDER',
      message: 'no unpaid order'
    }
  }

  const checkoutSummary = buildAdminCheckoutSummary(targetOrders, payload)
  const checkoutTime = new Date()

  await Promise.all(targetOrders.map(order => db.collection('order').doc(order._id).update({
    data: {
      pay_status: true,
      payStatus: true,
      status: 'completed',
      checkoutStatus: 'finished',
      payMethod: checkoutSummary.paymentMethod,
      paymentMethod: checkoutSummary.paymentMethod,
      checkoutTotalPrice: checkoutSummary.totalPrice,
      checkoutReceivable: checkoutSummary.receivable,
      checkoutDiscountType: checkoutSummary.discountType,
      checkoutDiscountValue: checkoutSummary.discountValue,
      checkoutAt: checkoutTime,
      updateTime: db.serverDate()
    }
  })))

  const groupIds = Array.from(new Set(targetOrders.map(order => String(order.tableGroupId || '').trim()).filter(Boolean)))
  await Promise.all(groupIds.map(groupId => db.collection('tableGroup').doc(groupId).update({
    data: {
      status: 'inactive',
      finishedAt: checkoutTime,
      updateTime: db.serverDate()
    }
  }).catch(() => db.collection('tableGroup').doc(groupId).set({
    data: {
      tableGroupId: groupId,
      status: 'inactive',
      finishedAt: checkoutTime,
      updateTime: db.serverDate()
    }
  }))))

  const sharedCartClearResult = await clearCheckoutSharedCarts(targetOrders, payload, checkoutTime)

  return {
    success: true,
    data: {
      updated: targetOrders.length,
      totalPrice: checkoutSummary.totalPrice,
      receivable: checkoutSummary.receivable,
      paymentMethod: checkoutSummary.paymentMethod,
      sharedCartRemoved: sharedCartClearResult.removed,
      sharedCartTables: sharedCartClearResult.tableNumbers
    }
  }
}

async function adminClearTable(payload) {
  const areaKey = String(payload.areaKey || 'normal').trim() || 'normal'
  const tableNumber = padTableNumber(payload.tableNumber)
  const tableRef = getAdminTableRef(areaKey, tableNumber)

  if (!tableRef) {
    return {
      success: false,
      code: 'TABLE_NOT_FOUND',
      message: 'table not found'
    }
  }

  const orders = await getAdminTableOrders({ areaKey, tableNumber })
  const unclearedOrders = orders.filter(order => order.tableCleared !== true)
  const activeGroup = await getActiveTableGroupForRef(tableRef)
  const activeSession = await getActiveTableSessionForRef(tableRef)
  const clearRefMap = {
    [tableRef.tableKey]: tableRef
  }
  getTableGroupRefs(activeGroup).forEach(ref => {
    clearRefMap[ref.tableKey] = ref
  })
  unclearedOrders.forEach(order => {
    const orderRef = getOrderTableRef(order)
    if (orderRef) clearRefMap[orderRef.tableKey] = orderRef
    normalizeAdminTableRefs(order.tableGroupTables).forEach(ref => {
      clearRefMap[ref.tableKey] = ref
    })
  })
  const clearRefs = Object.keys(clearRefMap).map(key => clearRefMap[key])

  if (unclearedOrders.length === 0 && !activeGroup && !activeSession) {
    return {
      success: false,
      code: 'NO_TABLE_STATE',
      message: '该桌暂无需要清除的状态'
    }
  }

  const clearedAt = new Date()
  await Promise.all(unclearedOrders.map(order => db.collection('order').doc(order._id).update({
    data: {
      tableCleared: true,
      tableClearedAt: clearedAt,
      checkoutStatus: order.checkoutStatus || 'cleared',
      updateTime: db.serverDate()
    }
  })))

  const groupIds = Array.from(new Set(unclearedOrders.map(order => String(order.tableGroupId || '').trim()).filter(Boolean)))
  const activeGroupId = getTableGroupId(activeGroup)
  if (activeGroupId && groupIds.indexOf(activeGroupId) === -1) {
    groupIds.push(activeGroupId)
  }

  await Promise.all(groupIds.map(groupId => db.collection('tableGroup').doc(groupId).update({
    data: {
      status: 'inactive',
      clearedAt,
      updateTime: db.serverDate()
    }
  }).catch(() => db.collection('tableGroup').doc(groupId).set({
    data: {
      tableGroupId: groupId,
      status: 'inactive',
      clearedAt,
      updateTime: db.serverDate()
    }
  }))))

  const sharedCartTableNumbers = Array.from(new Set(clearRefs.reduce((list, ref) => {
    return list.concat(getSharedCartTableNumbersForAdminRef(ref))
  }, [])))
  const sharedCartResults = []
  for (const cartTableNumber of sharedCartTableNumbers) {
    sharedCartResults.push(await clearSharedCartSessionByTableNumber(cartTableNumber, clearedAt))
  }

  return {
    success: true,
    data: {
      clearedOrders: unclearedOrders.length,
      clearedGroups: groupIds.length,
      sharedCartRemoved: sharedCartResults.reduce((sum, item) => sum + Number(item.removed || 0), 0),
      sharedCartTables: sharedCartTableNumbers
    }
  }
}

async function adminSendTableToKitchen(payload) {
  const orders = await getAdminTableOrders(payload)
  const targetOrders = orders.filter(order => !isAdminPaidOrder(order) && !isAdminPreparingOrder(order))

  await Promise.all(targetOrders.map(order => db.collection('order').doc(order._id).update({
    data: {
      status: 'pending_prepare',
      frontDeskConfirmed: true,
      kitchenPrintStatus: 'sent',
      updateTime: db.serverDate()
    }
  })))

  return {
    success: true,
    data: {
      updated: targetOrders.length
    }
  }
}
async function sendOrderDishesToKitchen(orderId, dishIndexes) {
  if (!orderId) {
    return {
      success: false,
      code: 'ORDER_ID_REQUIRED',
      message: 'order id required'
    }
  }

  const validIndexes = Array.from(new Set((dishIndexes || []).map(index => Math.floor(Number(index)))))
    .filter(index => Number.isInteger(index) && index >= 0)
    .sort((a, b) => a - b)

  if (validIndexes.length === 0) {
    return {
      success: false,
      code: 'DISH_INDEX_REQUIRED',
      message: 'dish index required'
    }
  }

  const orderRes = await db.collection('order').doc(orderId).get()
  const order = orderRes.data
  if (!order || !isKitchenPrintableOrder(order)) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: 'order not found'
    }
  }
  if (isAdminPaidOrder(order)) {
    return {
      success: false,
      code: 'ORDER_PAID',
      message: 'paid order cannot send kitchen here'
    }
  }

  const goods = Array.isArray(order.goods) ? order.goods : []
  const missingIndex = validIndexes.find(index => !goods[index])
  if (missingIndex !== undefined) {
    return {
      success: false,
      code: 'DISH_NOT_FOUND',
      message: 'dish not found'
    }
  }

  const indexSet = new Set(validIndexes)
  const sendTime = new Date()
  const nextGoods = goods.map((item, index) => {
    if (!indexSet.has(index)) return item
    return {
      ...item,
      kitchenSent: true,
      kitchenStatus: 'sent',
      kitchenSentAt: sendTime
    }
  })
  const allSent = nextGoods.length > 0 && nextGoods.every(item => item.kitchenSent === true || item.kitchenStatus === 'sent')
  const dishEntries = await enrichDishEntriesForPrinter(validIndexes.map(index => ({
    index,
    item: goods[index] || {}
  })))
  const printerDispatch = await dispatchKitchenPrint('kitchen', order, dishEntries)
  const kitchenLogs = dishEntries.map(entry => {
    const index = entry.index
    const item = entry.item || {}
    const printerResult = printerDispatch.byDishIndex[index] || {}
    return {
      type: 'send_kitchen',
      dishIndex: index,
      dishId: item.dishId || '',
      dishName: item.dishName || item.name || '',
      count: Number(item.count || 0),
      printerId: printerResult.printerId || getDishPrinterId(item, order),
      printerName: printerResult.printerName || PRINTER_NAMES[getDishPrinterId(item, order)] || '',
      printerStatus: printerResult.status || 'skipped',
      createTime: sendTime
    }
  })

  await db.collection('order').doc(orderId).update({
    data: {
      goods: nextGoods,
      status: 'pending_prepare',
      frontDeskConfirmed: true,
      kitchenPrinted: allSent,
      kitchenPrintStatus: allSent ? 'sent' : 'partial_sent',
      kitchenLogs: [
        ...(Array.isArray(order.kitchenLogs) ? order.kitchenLogs : []),
        ...kitchenLogs
      ],
      updateTime: db.serverDate()
    }
  })

  return {
    success: true,
    data: {
      orderId,
      sentCount: validIndexes.length,
      allSent,
      printers: printerDispatch.results
    }
  }
}

async function adminSendKitchenItems(payload) {
  const items = Array.isArray(payload.items) ? payload.items : []
  const groupedItems = {}

  items.forEach(item => {
    const orderId = String(item && (item.orderId || item.groupId) || '').trim()
    const dishIndex = Math.floor(Number(item && item.dishIndex))
    if (!orderId || !Number.isInteger(dishIndex) || dishIndex < 0) return
    if (!groupedItems[orderId]) groupedItems[orderId] = []
    groupedItems[orderId].push(dishIndex)
  })

  const orderIds = Object.keys(groupedItems)
  if (orderIds.length === 0) {
    return {
      success: false,
      code: 'DISH_INDEX_REQUIRED',
      message: 'dish index required'
    }
  }

  const results = []
  for (const orderId of orderIds) {
    const result = await sendOrderDishesToKitchen(orderId, groupedItems[orderId])
    if (!result.success) return result
    results.push(result.data)
  }

  return {
    success: true,
    data: {
      updatedOrders: results.length,
      sentCount: results.reduce((sum, item) => sum + Number(item.sentCount || 0), 0),
      results
    }
  }
}

function buildKitchenPrinterPayload(type, order, printerId, dishEntries) {
  const parsedTable = parseAdminTableNumber(order.tableNumber)
  const orderScene = isCampingOrder(order) ? 'camping' : 'dineIn'
  const sceneName = orderScene === 'camping' ? '露营' : '堂食'
  return {
    type,
    printerId,
    printerName: PRINTER_NAMES[printerId] || printerId,
    tenantId: process.env.TENANT_ID || DEFAULT_TENANT_ID,
    orderId: order._id,
    orderScene,
    orderType: orderScene,
    sceneName,
    tableNumber: order.tableNumber || '',
    tableArea: parsedTable ? parsedTable.areaName : '',
    title: type === 'urge' ? `${sceneName}催菜单` : `${sceneName}后厨单`,
    printTime: new Date().toISOString(),
    dishes: dishEntries.map(entry => {
      const item = entry.item || {}
      return {
        dishIndex: entry.index,
        dishId: item.dishId || '',
        dishName: item.dishName || item.name || '',
        categoryId: item.categoryId || '',
        categoryName: item.categoryName || '',
        count: Number(item.count || 0),
        tags: normalizeTags(item.tags),
        tagText: normalizeTags(item.tags).join('、'),
        remark: item.remark || item.note || ''
      }
    })
  }
}

async function dispatchPrinterPayload(printerId, payload) {
  const printerUrl = getPrinterWebhookUrl(printerId)
  if (!printerUrl) {
    return {
      printerId,
      printerName: PRINTER_NAMES[printerId] || printerId,
      enabled: false,
      status: 'skipped',
      message: 'printer webhook not configured'
    }
  }

  try {
    const response = await postJson(printerUrl, payload)
    return {
      printerId,
      printerName: PRINTER_NAMES[printerId] || printerId,
      enabled: true,
      status: 'sent',
      response
    }
  } catch (err) {
    return {
      printerId,
      printerName: PRINTER_NAMES[printerId] || printerId,
      enabled: true,
      status: 'failed',
      message: err.message || 'printer dispatch failed'
    }
  }
}

async function dispatchKitchenPrint(type, order, dishEntries) {
  const groupedEntries = groupDishEntriesByPrinter(dishEntries, order)
  const results = []

  for (const printerId of Object.keys(groupedEntries)) {
    const payload = buildKitchenPrinterPayload(type, order, printerId, groupedEntries[printerId])
    const result = await dispatchPrinterPayload(printerId, payload)
    results.push({
      ...result,
      dishIndexes: groupedEntries[printerId].map(entry => entry.index)
    })
  }

  return {
    results,
    byDishIndex: results.reduce((map, result) => {
      ;(result.dishIndexes || []).forEach(index => {
        map[index] = result
      })
      return map
    }, {})
  }
}

async function urgeOrderDishes(orderId, dishIndexes) {
  if (!orderId) {
    return {
      success: false,
      code: 'ORDER_ID_REQUIRED',
      message: 'order id required'
    }
  }

  const validIndexes = Array.from(new Set((dishIndexes || []).map(index => Math.floor(Number(index)))))
    .filter(index => Number.isInteger(index) && index >= 0)
    .sort((a, b) => a - b)

  if (validIndexes.length === 0) {
    return {
      success: false,
      code: 'DISH_INDEX_REQUIRED',
      message: 'dish index required'
    }
  }

  const orderRes = await db.collection('order').doc(orderId).get()
  const order = orderRes.data
  if (!order || !isKitchenPrintableOrder(order)) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: 'order not found'
    }
  }
  if (isAdminPaidOrder(order)) {
    return {
      success: false,
      code: 'ORDER_PAID',
      message: 'paid order cannot urge dish here'
    }
  }

  const goods = Array.isArray(order.goods) ? order.goods : []
  const missingIndex = validIndexes.find(index => !goods[index])
  if (missingIndex !== undefined) {
    return {
      success: false,
      code: 'DISH_NOT_FOUND',
      message: 'dish not found'
    }
  }

  const urgeTime = new Date()
  const dishEntries = await enrichDishEntriesForPrinter(validIndexes.map(index => ({
    index,
    item: goods[index] || {}
  })))
  const printerDispatch = await dispatchKitchenPrint('urge', order, dishEntries)
  const kitchenLogs = dishEntries.map(entry => ({
    type: 'urge_kitchen',
    dishIndex: entry.index,
    dishId: entry.item.dishId || '',
    dishName: entry.item.dishName || entry.item.name || '',
    count: Number(entry.item.count || 0),
    printerId: (printerDispatch.byDishIndex[entry.index] || {}).printerId || getDishPrinterId(entry.item, order),
    printerName: (printerDispatch.byDishIndex[entry.index] || {}).printerName || PRINTER_NAMES[getDishPrinterId(entry.item, order)] || '',
    printerStatus: (printerDispatch.byDishIndex[entry.index] || {}).status || 'skipped',
    createTime: urgeTime
  }))

  await db.collection('order').doc(orderId).update({
    data: {
      kitchenLogs: [
        ...(Array.isArray(order.kitchenLogs) ? order.kitchenLogs : []),
        ...kitchenLogs
      ],
      lastUrgeAt: urgeTime,
      updateTime: db.serverDate()
    }
  })

  return {
    success: true,
    data: {
      orderId,
      urgedCount: validIndexes.length,
      printers: printerDispatch.results
    }
  }
}

async function adminUrgeKitchenItems(payload) {
  const items = Array.isArray(payload.items) ? payload.items : []
  const groupedItems = {}

  items.forEach(item => {
    const orderId = String(item && (item.orderId || item.groupId) || '').trim()
    const dishIndex = Math.floor(Number(item && item.dishIndex))
    if (!orderId || !Number.isInteger(dishIndex) || dishIndex < 0) return
    if (!groupedItems[orderId]) groupedItems[orderId] = []
    groupedItems[orderId].push(dishIndex)
  })

  const orderIds = Object.keys(groupedItems)
  if (orderIds.length === 0) {
    return {
      success: false,
      code: 'DISH_INDEX_REQUIRED',
      message: 'dish index required'
    }
  }

  const results = []
  for (const orderId of orderIds) {
    const result = await urgeOrderDishes(orderId, groupedItems[orderId])
    if (!result.success) return result
    results.push(result.data)
  }

  return {
    success: true,
    data: {
      updatedOrders: results.length,
      urgedCount: results.reduce((sum, item) => sum + Number(item.urgedCount || 0), 0),
      results
    }
  }
}
async function refundOrderDishes(orderId, dishIndexes) {
  if (!orderId) {
    return {
      success: false,
      code: 'ORDER_ID_REQUIRED',
      message: 'order id required'
    }
  }
  const validIndexes = Array.from(new Set((dishIndexes || []).map(index => Math.floor(Number(index)))))
    .filter(index => Number.isInteger(index) && index >= 0)
    .sort((a, b) => a - b)

  if (validIndexes.length === 0) {
    return {
      success: false,
      code: 'DISH_INDEX_REQUIRED',
      message: 'dish index required'
    }
  }

  const orderRes = await db.collection('order').doc(orderId).get()
  const order = orderRes.data
  if (!order || !isAdminTableOrder(order)) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: 'order not found'
    }
  }
  if (isAdminPaidOrder(order)) {
    return {
      success: false,
      code: 'ORDER_PAID',
      message: 'paid order cannot refund dish here'
    }
  }

  const goods = Array.isArray(order.goods) ? order.goods : []
  const missingIndex = validIndexes.find(index => !goods[index])
  if (missingIndex !== undefined) {
    return {
      success: false,
      code: 'DISH_NOT_FOUND',
      message: 'dish not found'
    }
  }

  const indexSet = new Set(validIndexes)
  const removedItems = goods
    .map((item, index) => ({ item, index }))
    .filter(entry => indexSet.has(entry.index))
  const nextGoods = goods.filter((_, index) => !indexSet.has(index))
  const totalPrice = roundMoney(nextGoods.reduce((sum, item) => {
    const count = Number(item.count || 0)
    const subtotal = item.subtotal !== undefined
      ? Number(item.subtotal || 0)
      : Number(item.price || 0) * count
    return sum + subtotal
  }, 0))

  const refundLogs = removedItems.map(entry => ({
    type: 'dish_refund',
    dishIndex: entry.index,
    dishId: entry.item.dishId || '',
    dishName: entry.item.dishName || entry.item.name || '',
    count: Number(entry.item.count || 0),
    subtotal: roundMoney(entry.item.subtotal !== undefined
      ? entry.item.subtotal
      : Number(entry.item.price || 0) * Number(entry.item.count || 0)),
    createTime: new Date()
  }))
  const updateData = {
    goods: nextGoods,
    totalPrice,
    finalPrice: totalPrice,
    updateTime: db.serverDate(),
    refundLogs: [
      ...(Array.isArray(order.refundLogs) ? order.refundLogs : []),
      ...refundLogs
    ]
  }

  if (nextGoods.length === 0) {
    updateData.status = 'cancelled'
  }

  await db.collection('order').doc(orderId).update({
    data: updateData
  })

  return {
    success: true,
    data: {
      orderId,
      removed: removedItems.map(entry => entry.item),
      removedCount: removedItems.length,
      totalPrice,
      remainingCount: nextGoods.reduce((sum, item) => sum + Number(item.count || 0), 0)
    }
  }
}

async function adminRefundDish(payload) {
  const orderId = String(payload.orderId || payload.groupId || '').trim()
  const dishIndex = Math.floor(Number(payload.dishIndex))
  return refundOrderDishes(orderId, [dishIndex])
}

async function adminRefundDishes(payload) {
  const items = Array.isArray(payload.items) ? payload.items : []
  const groupedItems = {}

  items.forEach(item => {
    const orderId = String(item && (item.orderId || item.groupId) || '').trim()
    const dishIndex = Math.floor(Number(item && item.dishIndex))
    if (!orderId || !Number.isInteger(dishIndex) || dishIndex < 0) return
    if (!groupedItems[orderId]) groupedItems[orderId] = []
    groupedItems[orderId].push(dishIndex)
  })

  const orderIds = Object.keys(groupedItems)
  if (orderIds.length === 0) {
    return {
      success: false,
      code: 'DISH_INDEX_REQUIRED',
      message: 'dish index required'
    }
  }

  const results = []
  for (const orderId of orderIds) {
    const result = await refundOrderDishes(orderId, groupedItems[orderId])
    if (!result.success) return result
    results.push(result.data)
  }

  return {
    success: true,
    data: {
      updatedOrders: results.length,
      removedCount: results.reduce((sum, item) => sum + Number(item.removedCount || 0), 0),
      results
    }
  }
}

async function giftOrderDishes(orderId, dishIndexes) {
  if (!orderId) {
    return {
      success: false,
      code: 'ORDER_ID_REQUIRED',
      message: 'order id required'
    }
  }
  const validIndexes = Array.from(new Set((dishIndexes || []).map(index => Math.floor(Number(index)))))
    .filter(index => Number.isInteger(index) && index >= 0)
    .sort((a, b) => a - b)

  if (validIndexes.length === 0) {
    return {
      success: false,
      code: 'DISH_INDEX_REQUIRED',
      message: 'dish index required'
    }
  }

  const orderRes = await db.collection('order').doc(orderId).get()
  const order = orderRes.data
  if (!order || !isAdminTableOrder(order)) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: 'order not found'
    }
  }
  if (isAdminPaidOrder(order)) {
    return {
      success: false,
      code: 'ORDER_PAID',
      message: 'paid order cannot gift dish here'
    }
  }

  const goods = Array.isArray(order.goods) ? order.goods : []
  const missingIndex = validIndexes.find(index => !goods[index])
  if (missingIndex !== undefined) {
    return {
      success: false,
      code: 'DISH_NOT_FOUND',
      message: 'dish not found'
    }
  }

  const indexSet = new Set(validIndexes)
  const giftTime = new Date()
  const giftLogs = []
  const nextGoods = goods.map((item, index) => {
    if (!indexSet.has(index)) return item

    const count = Number(item.count || 0)
    const originalSubtotal = roundMoney(item.originalSubtotal !== undefined
      ? item.originalSubtotal
      : item.subtotal !== undefined
        ? item.subtotal
        : Number(item.price || 0) * count)
    const originalPrice = roundMoney(item.originalPrice !== undefined ? item.originalPrice : item.price || 0)

    giftLogs.push({
      type: 'gift_dish',
      dishIndex: index,
      dishId: item.dishId || '',
      dishName: item.dishName || item.name || '',
      count,
      originalPrice,
      originalSubtotal,
      createTime: giftTime
    })

    return {
      ...item,
      isGift: true,
      giftDish: true,
      giftAt: giftTime,
      originalPrice,
      originalSubtotal,
      subtotal: 0
    }
  })
  const totalPrice = roundMoney(nextGoods.reduce((sum, item) => {
    const count = Number(item.count || 0)
    const subtotal = item.subtotal !== undefined
      ? Number(item.subtotal || 0)
      : Number(item.price || 0) * count
    return sum + subtotal
  }, 0))

  await db.collection('order').doc(orderId).update({
    data: {
      goods: nextGoods,
      totalPrice,
      finalPrice: totalPrice,
      giftLogs: [
        ...(Array.isArray(order.giftLogs) ? order.giftLogs : []),
        ...giftLogs
      ],
      updateTime: db.serverDate()
    }
  })

  return {
    success: true,
    data: {
      orderId,
      giftedCount: validIndexes.length,
      totalPrice
    }
  }
}

async function adminGiftDishes(payload) {
  const items = Array.isArray(payload.items) ? payload.items : []
  const groupedItems = {}

  items.forEach(item => {
    const orderId = String(item && (item.orderId || item.groupId) || '').trim()
    const dishIndex = Math.floor(Number(item && item.dishIndex))
    if (!orderId || !Number.isInteger(dishIndex) || dishIndex < 0) return
    if (!groupedItems[orderId]) groupedItems[orderId] = []
    groupedItems[orderId].push(dishIndex)
  })

  const orderIds = Object.keys(groupedItems)
  if (orderIds.length === 0) {
    return {
      success: false,
      code: 'DISH_INDEX_REQUIRED',
      message: 'dish index required'
    }
  }

  const results = []
  for (const orderId of orderIds) {
    const result = await giftOrderDishes(orderId, groupedItems[orderId])
    if (!result.success) return result
    results.push(result.data)
  }

  return {
    success: true,
    data: {
      updatedOrders: results.length,
      giftedCount: results.reduce((sum, item) => sum + Number(item.giftedCount || 0), 0),
      results
    }
  }
}

function normalizeTableNumber(tableNumber) {
  return String(tableNumber || '').trim()
}

const TABLE_SESSION_STALE_MS = 12 * 60 * 60 * 1000

function getTableSessionTimeValue(session) {
  return getTimeValue(session && (session.updateTime || session.createTime)) ||
    getTimeValue(session && (session.createTime || session.updateTime))
}

function isActiveTableSession(session) {
  if (!session) return false
  if (session.status === 'finished' || session.checkoutStatus === 'finished') return false
  const time = getTableSessionTimeValue(session)
  return !time || Date.now() - time <= TABLE_SESSION_STALE_MS
}

function getSharedCartSessionId(tableNumber) {
  const safeTable = encodeURIComponent(tableNumber).replace(/%/g, '_')
  return `table_${safeTable}`
}

function getSharedCartTableNumbersForAdminRef(ref) {
  if (!ref) return []
  const shortNumber = String(Number(ref.tableNumber || 0) || '')
  const candidates = getAdminTableNumberCandidates(ref.areaKey, ref.tableNumber)
  const numbers = ref.areaKey === 'normal'
    ? [ref.tableNumber, shortNumber].concat(candidates)
    : [formatAdminTableNumber(ref)].concat(candidates.filter(item => {
      return item !== ref.tableNumber && item !== shortNumber
    }))

  return Array.from(new Set(numbers.map(normalizeTableNumber).filter(Boolean)))
}

function getCheckoutSharedCartTableNumbers(orders, fallbackPayload) {
  const refMap = {}
  const fallbackRef = getAdminTableRef(fallbackPayload && fallbackPayload.areaKey, fallbackPayload && fallbackPayload.tableNumber)
  if (fallbackRef) refMap[fallbackRef.tableKey] = fallbackRef

  ;(orders || []).forEach(order => {
    const orderRef = getOrderTableRef(order)
    if (orderRef) refMap[orderRef.tableKey] = orderRef
    normalizeAdminTableRefs(order.tableGroupTables).forEach(ref => {
      refMap[ref.tableKey] = ref
    })
  })

  return Array.from(new Set(Object.keys(refMap).reduce((list, key) => {
    return list.concat(getSharedCartTableNumbersForAdminRef(refMap[key]))
  }, [])))
}

async function clearSharedCartSessionByTableNumber(tableNumber, finishedAt) {
  const normalizedTableNumber = normalizeTableNumber(tableNumber)
  if (!normalizedTableNumber) {
    return {
      tableNumber: normalizedTableNumber,
      removed: 0
    }
  }

  const sessionId = getSharedCartSessionId(normalizedTableNumber)
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

  const sessionRef = db.collection('tableOrderSession').doc(sessionId)
  const sessionRes = await sessionRef.get()
  if (sessionRes.data) {
    await sessionRef.update({
      data: {
        tableNumber: normalizedTableNumber,
        status: 'finished',
        checkoutStatus: 'finished',
        memberOpenids: [],
        finishedAt,
        updateTime: db.serverDate()
      }
    })
  }

  return {
    tableNumber: normalizedTableNumber,
    sessionId,
    removed: (res.data || []).length
  }
}

async function clearCheckoutSharedCarts(orders, payload, finishedAt) {
  const tableNumbers = getCheckoutSharedCartTableNumbers(orders, payload)
  const results = []

  for (const tableNumber of tableNumbers) {
    results.push(await clearSharedCartSessionByTableNumber(tableNumber, finishedAt))
  }

  return {
    tableNumbers,
    removed: results.reduce((sum, item) => sum + Number(item.removed || 0), 0),
    results
  }
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
    const shouldResetSession = oldSession.status === 'finished' ||
      oldSession.checkoutStatus === 'finished' ||
      !isActiveTableSession(oldSession)
    const updateData = {
      tableNumber,
      status: 'ordering',
      checkoutStatus: '',
      finishedAt: null,
      memberOpenids: shouldResetSession ? [auth.data.openid] : _.addToSet(auth.data.openid),
      updateTime: db.serverDate()
    }
    if (shouldResetSession) {
      updateData.createTime = db.serverDate()
    }
    await sessionRef.update({
      data: updateData
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

function normalizeAdminCategory(payload) {
  const category = payload.category || payload
  const menuType = getMenuType(category.menuType || payload.menuType)

  return {
    _id: String(category._id || category.categoryId || '').trim(),
    name: String(category.name || '').trim(),
    menuType,
    sort: Number(category.sort || 0),
    status: category.status === 0 ? 0 : 1
  }
}

async function adminListCategories(payload) {
  const menuType = getMenuType(payload.menuType)
  const res = await db.collection('dishCategory')
    .where({
      menuType: getMenuTypeWhere(menuType)
    })
    .orderBy('sort', 'asc')
    .limit(100)
    .get()

  return {
    success: true,
    data: (res.data || []).map(item => ({
      ...item,
      menuType: item.menuType || menuType
    }))
  }
}

async function adminSaveCategory(payload) {
  const category = normalizeAdminCategory(payload)
  if (!category.name) {
    return {
      success: false,
      code: 'CATEGORY_NAME_REQUIRED',
      message: 'category name required'
    }
  }

  const data = {
    name: category.name,
    menuType: category.menuType,
    sort: category.sort,
    status: category.status,
    updateTime: db.serverDate()
  }

  if (category._id) {
    await db.collection('dishCategory').doc(category._id).update({ data })
    await db.collection('dish')
      .where({ categoryId: category._id })
      .update({
        data: {
          categoryName: category.name,
          menuType: category.menuType,
          updateTime: db.serverDate()
        }
      })

    return {
      success: true,
      data: {
        _id: category._id
      }
    }
  }

  const addRes = await db.collection('dishCategory').add({
    data: {
      ...data,
      createTime: db.serverDate()
    }
  })

  return {
    success: true,
    data: {
      _id: addRes._id
    }
  }
}

async function adminDeleteCategory(payload) {
  const categoryId = String(payload.categoryId || payload._id || '').trim()
  if (!categoryId) {
    return {
      success: false,
      code: 'CATEGORY_ID_REQUIRED',
      message: 'category id required'
    }
  }

  await db.collection('dishCategory').doc(categoryId).remove()
  await db.collection('dish')
    .where({ categoryId })
    .update({
      data: {
        status: 0,
        updateTime: db.serverDate()
      }
    })

  return {
    success: true
  }
}

async function adminListDishes(payload) {
  const menuType = getMenuType(payload.menuType)
  const categoryId = String(payload.categoryId || '').trim()
  const keyword = String(payload.keyword || '').trim()
  const limit = getLimit(payload, 100, 100)

  if (keyword) {
    const matcher = db.RegExp({
      regexp: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      options: 'i'
    })
    const commonWhere = {
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

  if (!categoryId) {
    return {
      success: true,
      data: []
    }
  }

  const res = await db.collection('dish')
    .where({
      categoryId,
      menuType: getMenuTypeWhere(menuType)
    })
    .orderBy('sort', 'asc')
    .limit(limit)
    .get()

  return {
    success: true,
    data: res.data || []
  }
}

function normalizeAdminDish(payload) {
  const dish = payload.dish || payload
  const menuType = getMenuType(dish.menuType || payload.menuType)

  return {
    ...dish,
    _id: String(dish._id || dish.dishId || '').trim(),
    name: String(dish.name || '').trim(),
    categoryId: String(dish.categoryId || payload.categoryId || '').trim(),
    categoryName: String(dish.categoryName || '').trim(),
    menuType,
    price: roundMoney(dish.price || 0),
    originalPrice: roundMoney(dish.originalPrice || 0),
    description: String(dish.description || '').trim(),
    image: String(dish.image || '').trim(),
    unit: String(dish.unit || '份').trim() || '份',
    status: dish.status === 0 ? 0 : 1,
    sort: Number(dish.sort || 0),
    needPopup: dish.needPopup === true
  }
}

async function adminSaveDish(payload) {
  const dish = normalizeAdminDish(payload)
  if (!dish.name) {
    return {
      success: false,
      code: 'DISH_NAME_REQUIRED',
      message: 'dish name required'
    }
  }

  if (!dish.categoryId) {
    return {
      success: false,
      code: 'CATEGORY_ID_REQUIRED',
      message: 'category id required'
    }
  }

  let categoryName = dish.categoryName
  if (!categoryName) {
    const categoryRes = await db.collection('dishCategory').doc(dish.categoryId).get()
    categoryName = categoryRes.data && categoryRes.data.name || ''
  }

  const data = {
    name: dish.name,
    price: dish.price,
    originalPrice: dish.originalPrice,
    description: dish.description,
    image: dish.image,
    categoryId: dish.categoryId,
    categoryName,
    menuType: dish.menuType,
    unit: dish.unit,
    status: dish.status,
    sort: dish.sort,
    needPopup: dish.needPopup,
    tags: Array.isArray(dish.tags) ? dish.tags : [],
    options: Array.isArray(dish.options) ? dish.options : [],
    updateTime: db.serverDate()
  }

  if (dish._id) {
    await db.collection('dish').doc(dish._id).update({ data })
    return {
      success: true,
      data: {
        _id: dish._id
      }
    }
  }

  const addRes = await db.collection('dish').add({
    data: {
      ...data,
      createTime: db.serverDate()
    }
  })

  return {
    success: true,
    data: {
      _id: addRes._id
    }
  }
}

async function adminDeleteDish(payload) {
  const dishId = String(payload.dishId || payload._id || '').trim()
  if (!dishId) {
    return {
      success: false,
      code: 'DISH_ID_REQUIRED',
      message: 'dish id required'
    }
  }

  await db.collection('dish').doc(dishId).remove()
  return {
    success: true
  }
}

async function adminSetDishStatus(payload) {
  const dishId = String(payload.dishId || payload._id || '').trim()
  if (!dishId) {
    return {
      success: false,
      code: 'DISH_ID_REQUIRED',
      message: 'dish id required'
    }
  }

  await db.collection('dish').doc(dishId).update({
    data: {
      status: payload.status === 0 ? 0 : 1,
      updateTime: db.serverDate()
    }
  })

  return {
    success: true
  }
}

const ADMIN_COLLECTIONS = {
  notice: {
    orderBy: 'sort',
    order: 'asc',
    searchFields: ['content']
  },
  shopInfo: {
    orderBy: 'createTime',
    order: 'desc',
    searchFields: ['name', 'description']
  },
  user: {
    orderBy: 'createTime',
    order: 'desc',
    searchFields: ['nickName', 'nickname', 'phone', 'userCode']
  },
  order: {
    orderBy: 'createTime',
    order: 'desc',
    searchFields: ['orderNo', 'tableNumber', 'orderType', 'status']
  },
  queue: {
    orderBy: 'createTime',
    order: 'desc',
    searchFields: ['name', 'phone', 'queueNo', 'status']
  },
  reservation: {
    orderBy: 'createTime',
    order: 'desc',
    searchFields: ['name', 'phone', 'status']
  },
  outdoorGrill: {
    orderBy: 'sort',
    order: 'asc',
    searchFields: ['name', 'status']
  },
  printer: {
    orderBy: 'createTime',
    order: 'desc',
    searchFields: ['name', 'sn', 'status']
  },
  tableCode: {
    orderBy: 'sort',
    order: 'asc',
    searchFields: ['tableNumber', 'name', 'scene']
  },
  rechargeOptions: {
    orderBy: 'amount',
    order: 'asc',
    searchFields: ['description']
  }
}

function getAdminCollectionConfig(collection) {
  const key = String(collection || '').trim()
  const config = ADMIN_COLLECTIONS[key]
  if (!config) {
    throw new Error('admin collection not allowed')
  }
  return {
    key,
    ...config
  }
}

function cleanAdminData(data = {}) {
  const cleaned = {}
  Object.keys(data || {}).forEach(key => {
    if (!key || key === '_id' || key === '_openid') return
    if (key.indexOf('$') >= 0 || key.indexOf('.') >= 0) return
    const value = data[key]
    if (value === undefined) return
    cleaned[key] = value
  })
  return cleaned
}

function getAdminListWhere(config, payload) {
  const keyword = String(payload.keyword || '').trim()
  const filters = payload.filters && typeof payload.filters === 'object'
    ? cleanAdminData(payload.filters)
    : {}

  if (keyword) {
    const matcher = db.RegExp({
      regexp: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      options: 'i'
    })
    const searchFields = config.searchFields || []
    if (searchFields.length > 0) {
      return _.and([
        filters,
        _.or(searchFields.map(field => ({ [field]: matcher })))
      ])
    }
  }

  return filters
}

async function adminCollectionList(payload) {
  const config = getAdminCollectionConfig(payload.collection)
  const limit = getLimit(payload, 50, 100)
  const page = getPage(payload)
  const orderBy = String(payload.orderBy || config.orderBy || 'createTime')
  const order = payload.order === 'asc' ? 'asc' : (config.order || 'desc')
  const where = getAdminListWhere(config, payload)

  const res = await db.collection(config.key)
    .where(where)
    .orderBy(orderBy, order)
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

async function adminCollectionSave(payload) {
  const config = getAdminCollectionConfig(payload.collection)
  const item = payload.item || payload.data || {}
  const id = String(item._id || payload.id || '').trim()
  const data = {
    ...cleanAdminData(item),
    updateTime: db.serverDate()
  }

  if (id) {
    await db.collection(config.key).doc(id).update({ data })
    return {
      success: true,
      data: {
        _id: id
      }
    }
  }

  const addRes = await db.collection(config.key).add({
    data: {
      ...data,
      createTime: db.serverDate()
    }
  })

  return {
    success: true,
    data: {
      _id: addRes._id
    }
  }
}

async function adminCollectionUpdate(payload) {
  const config = getAdminCollectionConfig(payload.collection)
  const id = String(payload.id || payload._id || '').trim()
  if (!id) {
    return {
      success: false,
      code: 'ADMIN_DOC_ID_REQUIRED',
      message: 'document id required'
    }
  }

  await db.collection(config.key).doc(id).update({
    data: {
      ...cleanAdminData(payload.data || {}),
      updateTime: db.serverDate()
    }
  })

  return {
    success: true
  }
}

async function adminCollectionDelete(payload) {
  const config = getAdminCollectionConfig(payload.collection)
  const id = String(payload.id || payload._id || '').trim()
  if (!id) {
    return {
      success: false,
      code: 'ADMIN_DOC_ID_REQUIRED',
      message: 'document id required'
    }
  }

  await db.collection(config.key).doc(id).remove()
  return {
    success: true
  }
}

function buildAdminAuthToken(admin) {
  const secret = process.env.ADMIN_TOKEN_SECRET || process.env.WECHAT_SECRET || 'tenant-admin-token'
  return hashToken(`${admin && admin._id || ''}:${admin && admin.password || ''}:${secret}`)
}

async function requireAdminAuth(payload) {
  const token = String(payload.adminAuthToken || '').trim()
  const res = await db.collection('admin').limit(1).get()
  const admin = res.data && res.data[0]

  if (!admin) {
    return {
      success: false,
      code: 'ADMIN_NOT_FOUND',
      message: 'admin not found'
    }
  }

  if (!token || token !== buildAdminAuthToken(admin)) {
    return {
      success: false,
      code: 'ADMIN_AUTH_REQUIRED',
      message: 'admin auth required'
    }
  }

  return {
    success: true,
    admin
  }
}

async function getAdminStatus() {
  const res = await db.collection('admin').limit(1).get()
  return {
    success: true,
    data: {
      hasAdmin: !!(res.data && res.data.length > 0)
    }
  }
}

async function setAdminPassword(payload) {
  const password = String(payload.password || '').trim()
  if (password.length < 6) {
    return {
      success: false,
      code: 'INVALID_ADMIN_PASSWORD',
      message: 'password must be at least 6 characters'
    }
  }

  const res = await db.collection('admin').limit(1).get()
  if (res.data && res.data.length > 0) {
    return {
      success: false,
      code: 'ADMIN_ALREADY_EXISTS',
      message: 'admin already exists'
    }
  }

  const addRes = await db.collection('admin').add({
    data: {
      password,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })

  return {
    success: true,
    data: {
      adminAuthToken: buildAdminAuthToken({
        _id: addRes._id,
        password
      })
    }
  }
}

async function loginAdmin(payload) {
  const password = String(payload.password || '').trim()
  const res = await db.collection('admin').limit(1).get()
  const admin = res.data && res.data[0]

  if (!admin) {
    return {
      success: false,
      code: 'ADMIN_NOT_FOUND',
      message: 'admin not found'
    }
  }

  if (admin.password !== password) {
    return {
      success: false,
      code: 'ADMIN_PASSWORD_INVALID',
      message: 'invalid admin password'
    }
  }

  return {
    success: true,
    data: {
      adminAuthToken: buildAdminAuthToken(admin)
    }
  }
}

async function changeAdminPassword(payload) {
  const oldPassword = String(payload.oldPassword || '').trim()
  const newPassword = String(payload.newPassword || '').trim()

  if (newPassword.length < 6) {
    return {
      success: false,
      code: 'INVALID_ADMIN_PASSWORD',
      message: 'password must be at least 6 characters'
    }
  }

  const res = await db.collection('admin').limit(1).get()
  const admin = res.data && res.data[0]

  if (!admin) {
    return {
      success: false,
      code: 'ADMIN_NOT_FOUND',
      message: 'admin not found'
    }
  }

  if (admin.password !== oldPassword) {
    return {
      success: false,
      code: 'ADMIN_PASSWORD_INVALID',
      message: 'invalid admin password'
    }
  }

  await db.collection('admin').doc(admin._id).update({
    data: {
      password: newPassword,
      updateTime: db.serverDate()
    }
  })

  return {
    success: true,
    data: {
      adminAuthToken: buildAdminAuthToken({
        ...admin,
        password: newPassword
      })
    }
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
  if (action === 'admin.status') return getAdminStatus(payload)
  if (action === 'admin.setPassword') return setAdminPassword(payload)
  if (action === 'admin.login') return loginAdmin(payload)
  if (action === 'admin.changePassword') return changeAdminPassword(payload)

  if (
    action.indexOf('admin.category.') === 0 ||
    action.indexOf('admin.dish.') === 0 ||
    action.indexOf('admin.table.') === 0 ||
    action.indexOf('admin.order.') === 0 ||
    action.indexOf('admin.collection.') === 0
  ) {
    const adminAuth = await requireAdminAuth(payload)
    if (!adminAuth.success) return adminAuth
  }

  if (action === 'admin.category.list') return adminListCategories(payload)
  if (action === 'admin.category.save') return adminSaveCategory(payload)
  if (action === 'admin.category.delete') return adminDeleteCategory(payload)
  if (action === 'admin.dish.list') return adminListDishes(payload)
  if (action === 'admin.dish.save') return adminSaveDish(payload)
  if (action === 'admin.dish.delete') return adminDeleteDish(payload)
  if (action === 'admin.dish.status') return adminSetDishStatus(payload)
  if (action === 'admin.table.list') return adminListTables(payload)
  if (action === 'admin.table.detail') return adminGetTableDetail(payload)
  if (action === 'admin.table.updatePeople') return adminUpdateTablePeople(payload)
  if (action === 'admin.table.merge') return adminMergeTables(payload)
  if (action === 'admin.table.transfer') return adminTransferTable(payload)
  if (action === 'admin.table.finishCheckout') return adminFinishTableCheckout(payload)
  if (action === 'admin.table.clear') return adminClearTable(payload)
  if (action === 'admin.table.sendKitchen') return adminSendTableToKitchen(payload)
  if (action === 'admin.table.sendKitchenItems') return adminSendKitchenItems(payload)
  if (action === 'admin.table.urgeKitchenItems') return adminUrgeKitchenItems(payload)
  if (action === 'admin.order.sendKitchenItems') return adminSendKitchenItems(payload)
  if (action === 'admin.order.urgeKitchenItems') return adminUrgeKitchenItems(payload)
  if (action === 'admin.table.refundDish') return adminRefundDish(payload)
  if (action === 'admin.table.refundDishes') return adminRefundDishes(payload)
  if (action === 'admin.table.giftDishes') return adminGiftDishes(payload)
  if (action === 'admin.collection.list') return adminCollectionList(payload)
  if (action === 'admin.collection.save') return adminCollectionSave(payload)
  if (action === 'admin.collection.update') return adminCollectionUpdate(payload)
  if (action === 'admin.collection.delete') return adminCollectionDelete(payload)
  if (action === 'auth.login') return loginByWechatCode(payload)
  if (action === 'user.me') return getCurrentUser(payload)
  if (action === 'user.completeProfile') return completeUserProfile(payload)
  if (action === 'phone.getNumber') return getPhoneNumber(payload)
  if (action === 'reservation.create') return createReservation(payload)
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
