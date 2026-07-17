const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const https = require('https')
const { createPrintService } = require('./printService')

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
const MAX_DISH_IMAGE_SIZE = 1024 * 1024
const DISH_IMAGE_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}
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

function normalizePrinterId(value) {
  const printerId = String(value || '').trim()
  return Object.prototype.hasOwnProperty.call(PRINTER_NAMES, printerId) ? printerId : ''
}

function getPrinterName(printerId) {
  return PRINTER_NAMES[normalizePrinterId(printerId)] || ''
}

const printService = createPrintService({
  db,
  _,
  defaultTenantId: DEFAULT_TENANT_ID
})

let ensureSessionCollectionPromise = null

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

function requestBuffer(url, method = 'GET', data) {
  return new Promise((resolve, reject) => {
    const body = data === undefined ? null : Buffer.from(JSON.stringify(data))
    const request = https.request(url, {
      method,
      headers: body ? {
        'Content-Type': 'application/json',
        'Content-Length': body.length
      } : {}
    }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers || {},
          body: Buffer.concat(chunks)
        })
      })
    })

    request.on('error', reject)
    if (body) request.write(body)
    request.end()
  })
}

let wechatAccessTokenCache = {
  value: '',
  expiresAt: 0
}

async function getWechatAccessToken() {
  if (wechatAccessTokenCache.value && wechatAccessTokenCache.expiresAt > Date.now()) {
    return wechatAccessTokenCache.value
  }

  const appid = process.env.WECHAT_APPID
  const secret = process.env.WECHAT_SECRET
  if (!appid || !secret) {
    throw new Error('missing WECHAT_APPID or WECHAT_SECRET')
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`
  const data = await requestJson(url)
  if (!data.access_token) {
    throw new Error(data.errmsg || 'failed to get wechat access token')
  }

  const expiresIn = Math.max(300, Number(data.expires_in || 7200) - 120)
  wechatAccessTokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000
  }
  return wechatAccessTokenCache.value
}

async function createWechatMiniProgramCode(scene, page) {
  const accessToken = await getWechatAccessToken()
  const response = await requestBuffer(
    `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(accessToken)}`,
    'POST',
    {
      scene,
      page,
      env_version: 'release',
      check_path: false,
      width: 430,
      auto_color: false,
      line_color: {
        r: 58,
        g: 36,
        b: 24
      },
      is_hyaline: false
    }
  )
  const contentType = String(response.headers['content-type'] || '')

  if (response.statusCode < 200 || response.statusCode >= 300 || contentType.indexOf('image/') === -1) {
    const error = parseJson(response.body.toString('utf8'))
    throw new Error(error.errmsg || `wechat code request failed: ${response.statusCode}`)
  }

  if (!response.body.length) {
    throw new Error('wechat code image is empty')
  }

  return response.body
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
      printerId: normalizePrinterId(dish.printerId || dish.kitchenPrinterId || ''),
      printerName: getPrinterName(dish.printerId || dish.kitchenPrinterId || ''),
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

  if (orderScene !== 'camping') {
    const sharedSessionId = String(payload.sharedSessionId || getSharedCartSessionId(tableNumber)).trim()
    const sessionRes = await db.collection('tableOrderSession').doc(sharedSessionId).get()
    const session = sessionRes.data
    if (!isActiveTableSession(session)) {
      return {
        success: false,
        code: 'TABLE_SESSION_CLOSED',
        message: '本桌订单已结账，请重新扫码开台'
      }
    }
    if (!buildSharedCartPeopleState(session).peopleConfirmed) {
      return {
        success: false,
        code: 'TABLE_PEOPLE_REQUIRED',
        message: '请先确认用餐人数'
      }
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
      if (isAdminPaidOrder(parentOrder)) {
        throw new Error('paid order cannot add dishes')
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
      storeId: getTenantId(payload),
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

function getUserOrderHistoryStartTime() {
  const now = new Date()
  const targetYear = now.getFullYear()
  const targetMonth = now.getMonth() - 3
  const targetDay = Math.min(
    now.getDate(),
    new Date(targetYear, targetMonth + 1, 0).getDate()
  )

  return new Date(
    targetYear,
    targetMonth,
    targetDay,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  )
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
    deleted: _.neq(true),
    createTime: _.gte(getUserOrderHistoryStartTime())
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

  const orders = await normalizeOrderGoodsImages(
    (res.data || []).filter(order => !isExpiredSavedOrder(order))
  )

  return {
    success: true,
    data: orders,
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

  const orders = await normalizeOrderGoodsImages(
    (res.data || []).filter(order => !isExpiredSavedOrder(order))
  )

  return {
    success: true,
    data: orders
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
  const sessionPeopleState = buildSharedCartPeopleState(tableSession)
  const hasConfirmedSession = hasActiveSession && sessionPeopleState.peopleConfirmed

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

  const sessionPeopleCount = sessionPeopleState.peopleCount
  if (!peopleCount && sessionPeopleCount > 0) {
    peopleCount = sessionPeopleCount
  }
  if (!peopleCount && activeOrders.length > 0) {
    peopleCount = Math.max(1, userIds.length)
  }
  if (!scannedAt && hasConfirmedSession) {
    scannedAt = getTimeValue(tableSession.peopleConfirmedAt || tableSession.createTime || tableSession.updateTime)
  }

  const status = activeOrders.length > 0
    ? getAdminTableStatus(activeOrders)
    : (hasConfirmedSession ? 'submitted' : 'empty')

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
    const remark = String(item.remark || item.note || '').trim()
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
      remark,
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

function isCampingOrder(order = {}) {
  return order.orderScene === 'camping' || order.orderType === 'camping'
}

function getDishPrinterId(item = {}, order = {}) {
  return normalizePrinterId(item.printerId || item.kitchenPrinterId || item.printer)
}

function groupDishEntriesByPrinter(dishEntries, order = {}) {
  return (dishEntries || []).reduce((groups, entry) => {
    const printerId = getDishPrinterId(entry.item || {}, order)
    if (!printerId) return groups
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
    if ((!item.categoryName || !item.printerId) && item.dishId) {
      const dishRes = await db.collection('dish').doc(item.dishId).get()
      const dish = dishRes.data || {}
      item.categoryId = item.categoryId || dish.categoryId || ''
      item.categoryName = item.categoryName || dish.categoryName || ''
      item.printerId = item.printerId || normalizePrinterId(dish.printerId || dish.kitchenPrinterId || '')
      item.printerName = item.printerName || getPrinterName(item.printerId)
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
      frontDeskConfirmed: order.frontDeskConfirmed === true,
      canSendKitchen: !isAdminPaidOrder(order) && isKitchenPrintableOrder(order)
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
  const ordersWithImages = await normalizeOrderGoodsImages(orders)
  const billGroups = buildAdminBillGroups(ordersWithImages)
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
  const hasRateDiscount = (discountType === 'discount' || discountType === 'reduce') &&
    Number.isFinite(discountValue) && discountValue >= 0 && discountValue <= 10
  const priceAfterRateDiscount = hasRateDiscount
    ? roundMoney(totalPrice * discountValue / 10)
    : totalPrice
  const directReduceValueRaw = payload.directReduceValue !== '' && payload.directReduceValue != null
    ? payload.directReduceValue
    : (discountType === 'direct_reduce' ? discountValueRaw : '')
  const directReduceValue = directReduceValueRaw === '' || directReduceValueRaw == null
    ? ''
    : Number(directReduceValueRaw)
  const hasDirectReduction = Number.isFinite(directReduceValue) &&
    directReduceValue >= 0 && directReduceValue <= priceAfterRateDiscount
  const receivable = hasDirectReduction
    ? roundMoney(Math.max(0, priceAfterRateDiscount - directReduceValue))
    : priceAfterRateDiscount

  return {
    totalPrice,
    receivable,
    paymentMethod: String(payload.paymentMethod || 'wechat_alipay').trim() || 'wechat_alipay',
    discountType: hasRateDiscount ? 'discount' : (hasDirectReduction ? 'direct_reduce' : ''),
    discountValue: hasRateDiscount ? discountValue : (hasDirectReduction ? directReduceValue : ''),
    directReduceValue: hasDirectReduction ? directReduceValue : ''
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
      checkoutDirectReduceValue: checkoutSummary.directReduceValue,
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
  let cashierPrintJobs = []
  let cashierPrintError = ''
  try {
    const printResult = await printService.queueCashierReceipt({
      id: getTenantId(payload),
      ticketType: 'checkout',
      orders: targetOrders,
      checkoutSummary,
      eventKey: `checkout:${targetOrders.map(order => order._id).sort().join(',')}`
    })
    cashierPrintJobs = (printResult.jobs || []).map(job => job._id)
  } catch (err) {
    cashierPrintError = err.message || 'checkout print task creation failed'
    console.error('checkout receipt job failed', err)
  }

  return {
    success: true,
    data: {
      updated: targetOrders.length,
      totalPrice: checkoutSummary.totalPrice,
      receivable: checkoutSummary.receivable,
      paymentMethod: checkoutSummary.paymentMethod,
      sharedCartRemoved: sharedCartClearResult.removed,
      sharedCartTables: sharedCartClearResult.tableNumbers,
      cashierPrintJobs,
      cashierPrintError
    }
  }
}

async function adminPrintTableReceipt(payload, ticketType) {
  const orders = await getAdminTableOrders(payload)
  const targets = orders.filter(order => !order.deleted && order.status !== 'cancelled')
  if (!targets.length) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: 'no printable order found'
    }
  }

  const result = await printService.queueCashierReceipt({
    id: getTenantId(payload),
    ticketType,
    orders: targets,
    checkoutSummary: buildAdminCheckoutSummary(targets, payload),
    eventKey: `${ticketType}:${targets.map(order => order._id).sort().join(',')}`
  })

  return {
    success: true,
    data: {
      jobs: (result.jobs || []).map(job => job._id),
      skipped: !!result.skipped,
      reason: result.reason || ''
    }
  }
}

async function adminPrintPrebill(payload) {
  return adminPrintTableReceipt(payload, 'prebill')
}

async function adminPrintCustomerOrder(payload) {
  return adminPrintTableReceipt(payload, 'customer_order')
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
  const results = []
  for (const order of targetOrders) {
    const indexes = (Array.isArray(order.goods) ? order.goods : []).map((_, index) => index)
    if (!indexes.length) continue
    const result = await sendOrderDishesToKitchen(order._id, indexes)
    if (!result.success) return result
    results.push(result.data)
  }

  return {
    success: true,
    data: {
      updated: results.length,
      queuedJobs: results.reduce((count, item) => count + ((item.printers || []).filter(printer => printer.status === 'queued').length), 0)
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

  const sendTime = new Date()
  const dishEntries = await enrichDishEntriesForPrinter(validIndexes.map(index => ({
    index,
    item: goods[index] || {}
  })))
  const printerDispatch = await dispatchKitchenPrint('kitchen', order, dishEntries)
  const indexSet = new Set(validIndexes)
  const nextGoods = goods.map((item, index) => {
    if (!indexSet.has(index)) return item
    const dispatch = printerDispatch.byDishIndex[index] || {}
    const queued = dispatch.status === 'queued' || dispatch.status === 'claimed' || dispatch.status === 'sending'
    const skipped = dispatch.status === 'skipped'
    return {
      ...item,
      kitchenSent: queued || skipped,
      kitchenStatus: queued ? 'queued' : (skipped ? 'not_required' : 'failed'),
      kitchenSentAt: queued ? sendTime : item.kitchenSentAt || null,
      kitchenPrintError: dispatch.message || ''
    }
  })
  const allSent = nextGoods.length > 0 && nextGoods.every(item => item.kitchenSent === true || item.kitchenStatus === 'sent')
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
      kitchenPrintStatus: allSent ? 'queued' : 'partial_failed',
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
  const skippedPaidOrderIds = []
  for (const orderId of orderIds) {
    const result = await sendOrderDishesToKitchen(orderId, groupedItems[orderId])
    if (!result.success) {
      if (result.code === 'ORDER_PAID') {
        skippedPaidOrderIds.push(orderId)
        continue
      }
      return result
    }
    results.push(result.data)
  }

  return {
    success: true,
    data: {
      updatedOrders: results.length,
      sentCount: results.reduce((sum, item) => sum + Number(item.sentCount || 0), 0),
      skippedPaidOrderIds,
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
  return printService.queueKitchenJobs({
    id: String(order.storeId || getTenantId({})).trim(),
    order,
    dishEntries,
    kind: type === 'urge' ? 'urge' : 'kitchen_order',
    eventKey: `${type}:${dishEntries.map(entry => entry.index).join(',')}`
  })
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
async function refundOrderDishes(orderId, dishIndexes, payload = {}) {
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

  let refundPrintJobs = []
  let refundPrintError = ''
  try {
    const refundEntries = removedItems.map(entry => ({ index: entry.index, item: entry.item }))
    const kitchenResult = await printService.queueKitchenJobs({
      id: getTenantId(payload),
      order,
      dishEntries: refundEntries,
      kind: 'refund',
      eventKey: `refund:${orderId}:${validIndexes.join(',')}`,
      reason: String(payload.refundReason || '').trim()
    })
    refundPrintJobs = (kitchenResult.results || []).map(result => result.jobId).filter(Boolean)
    if (nextGoods.length === 0) {
      const cashierResult = await printService.queueCashierReceipt({
        id: getTenantId(payload),
        ticketType: 'refund',
        orders: [{ ...order, goods: [], finalPrice: 0, totalPrice: 0 }],
        eventKey: `refund-receipt:${orderId}`
      })
      refundPrintJobs = refundPrintJobs.concat((cashierResult.jobs || []).map(job => job._id))
    }
  } catch (err) {
    refundPrintError = err.message || 'refund print task creation failed'
    console.error('refund print job failed', err)
  }

  return {
    success: true,
    data: {
      orderId,
      removed: removedItems.map(entry => entry.item),
      removedCount: removedItems.length,
      totalPrice,
      remainingCount: nextGoods.reduce((sum, item) => sum + Number(item.count || 0), 0),
      refundPrintJobs,
      refundPrintError
    }
  }
}

async function adminRefundDish(payload) {
  const orderId = String(payload.orderId || payload.groupId || '').trim()
  const dishIndex = Math.floor(Number(payload.dishIndex))
  return refundOrderDishes(orderId, [dishIndex], payload)
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
    const result = await refundOrderDishes(orderId, groupedItems[orderId], payload)
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

async function adminUpdateTableDish(payload) {
  const orderId = String(payload.orderId || payload.groupId || '').trim()
  const dishIndex = Math.floor(Number(payload.dishIndex))
  if (!orderId) {
    return {
      success: false,
      code: 'ORDER_ID_REQUIRED',
      message: 'order id required'
    }
  }
  if (!Number.isInteger(dishIndex) || dishIndex < 0) {
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
      message: 'paid order cannot update dish here'
    }
  }

  const goods = Array.isArray(order.goods) ? order.goods : []
  const item = goods[dishIndex]
  if (!item) {
    return {
      success: false,
      code: 'DISH_NOT_FOUND',
      message: 'dish not found'
    }
  }

  const count = Number(item.count || 0)
  const tags = normalizeTags(payload.tags)
  const remark = String(payload.remark || '').trim().slice(0, 50)
  const editTime = new Date()
  const originalPrice = roundMoney(item.originalPrice !== undefined ? item.originalPrice : item.price || 0)
  const price = roundMoney(item.price || 0)
  const subtotal = item.isGift === true || item.giftDish === true
    ? 0
    : roundMoney(price * count)
  const originalSubtotal = roundMoney(originalPrice * count)
  const previous = {
    count: Number(item.count || 0),
    tags: normalizeTags(item.tags),
    remark: item.remark || item.note || '',
    subtotal: roundMoney(item.subtotal !== undefined
      ? item.subtotal
      : Number(item.price || 0) * Number(item.count || 0))
  }

  const nextGoods = goods.map((goodsItem, index) => {
    if (index !== dishIndex) return goodsItem
    return {
      ...goodsItem,
      count,
      tags,
      remark,
      note: remark,
      originalPrice,
      originalSubtotal,
      subtotal,
      adminEdited: true,
      adminEditedAt: editTime
    }
  })
  const totalPrice = roundMoney(nextGoods.reduce((sum, goodsItem) => {
    const itemCount = Number(goodsItem.count || 0)
    const itemSubtotal = goodsItem.subtotal !== undefined
      ? Number(goodsItem.subtotal || 0)
      : Number(goodsItem.price || 0) * itemCount
    return sum + itemSubtotal
  }, 0))

  const editLog = {
    type: 'dish_update',
    dishIndex,
    dishId: item.dishId || '',
    dishName: item.dishName || item.name || '',
    previous,
    next: {
      count,
      tags,
      remark,
      subtotal
    },
    createTime: editTime
  }

  await db.collection('order').doc(orderId).update({
    data: {
      goods: nextGoods,
      totalPrice,
      finalPrice: totalPrice,
      dishEditLogs: [
        ...(Array.isArray(order.dishEditLogs) ? order.dishEditLogs : []),
        editLog
      ],
      updateTime: db.serverDate()
    }
  })

  return {
    success: true,
    data: {
      orderId,
      dishIndex,
      totalPrice,
      item: nextGoods[dishIndex]
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
        peopleCount: 0,
        peopleConfirmed: false,
        peopleConfirmedAt: null,
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

async function clearSharedCartItemsBySessionId(sessionId) {
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

  return (res.data || []).length
}

async function autoClearPaidTableOrdersForNewSession(tableNumber, clearedAt) {
  const parsed = parseAdminTableNumber(tableNumber)
  if (!parsed) {
    return {
      clearedOrders: 0,
      clearedGroups: 0
    }
  }

  const orders = await getAdminTableOrders({
    areaKey: parsed.areaKey,
    tableNumber: parsed.tableNumber
  })
  const paidOrders = (orders || []).filter(order => {
    return isAdminPaidOrder(order) && order.tableCleared !== true
  })

  if (paidOrders.length === 0) {
    return {
      clearedOrders: 0,
      clearedGroups: 0
    }
  }

  await Promise.all(paidOrders.map(order => db.collection('order').doc(order._id).update({
    data: {
      tableCleared: true,
      tableClearedAt: clearedAt,
      updateTime: db.serverDate()
    }
  })))

  const groupIds = Array.from(new Set(paidOrders
    .map(order => String(order.tableGroupId || '').trim())
    .filter(Boolean)))

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

  return {
    clearedOrders: paidOrders.length,
    clearedGroups: groupIds.length
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

function getSharedCartPeopleCount(session) {
  const value = Math.floor(Number(session && session.peopleCount || 0))
  return value > 0 ? value : 0
}

function buildSharedCartPeopleState(session) {
  const peopleCount = getSharedCartPeopleCount(session)
  const peopleConfirmed = peopleCount > 0 && (!session || session.peopleConfirmed !== false)
  return {
    peopleCount,
    peopleConfirmed,
    peopleRequired: !peopleConfirmed
  }
}

function buildSharedCartSessionState(session) {
  const sessionActive = isActiveTableSession(session)
  return {
    sessionActive,
    sessionClosed: !session || !sessionActive,
    sessionStatus: String(session && session.status || ''),
    checkoutStatus: String(session && session.checkoutStatus || ''),
    // Changes whenever cart items change. Clients can skip re-reading all items
    // when the version they already hold is still current.
    cartVersion: Math.max(0, Math.floor(Number(session && session.cartVersion || 0)))
  }
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
  let nextSession = oldSession
  let clearedForNewSession = {
    clearedOrders: 0,
    clearedGroups: 0
  }

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
      updateData.peopleCount = 0
      updateData.peopleConfirmed = false
      updateData.peopleConfirmedAt = null
      updateData.cartVersion = 0
      await clearSharedCartItemsBySessionId(sessionId)
      clearedForNewSession = await autoClearPaidTableOrdersForNewSession(tableNumber, new Date())
    }
    await sessionRef.update({
      data: updateData
    })
    nextSession = shouldResetSession
      ? {
        tableNumber,
        status: 'ordering',
        peopleCount: 0,
        peopleConfirmed: false,
        cartVersion: 0
      }
      : oldSession
  } else {
    await sessionRef.set({
      data: {
        tableNumber,
        status: 'ordering',
        peopleCount: 0,
        peopleConfirmed: false,
        peopleConfirmedAt: null,
        cartVersion: 0,
        memberOpenids: [auth.data.openid],
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    clearedForNewSession = await autoClearPaidTableOrdersForNewSession(tableNumber, new Date())
    nextSession = {
      tableNumber,
      status: 'ordering',
      peopleCount: 0,
      peopleConfirmed: false,
      cartVersion: 0
    }
  }

  return {
    success: true,
    sessionId,
    tableNumber,
    ...buildSharedCartPeopleState(nextSession),
    ...buildSharedCartSessionState(nextSession),
    clearedForNewSession
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

  const sessionRes = await db.collection('tableOrderSession').doc(sessionId).get()
  const sessionState = buildSharedCartSessionState(sessionRes.data)
  if (sessionState.sessionClosed) {
    return {
      success: true,
      items: [],
      ...buildSharedCartPeopleState(sessionRes.data),
      ...sessionState
    }
  }

  const clientCartVersion = Math.max(0, Math.floor(Number(payload.cartVersion || 0)))
  const shouldSkipItemQuery = payload.force !== true &&
    payload.cartVersion !== undefined &&
    clientCartVersion === sessionState.cartVersion

  if (shouldSkipItemQuery) {
    return {
      success: true,
      unchanged: true,
      ...buildSharedCartPeopleState(sessionRes.data),
      ...sessionState
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
    items: res.data || [],
    ...buildSharedCartPeopleState(sessionRes.data),
    ...sessionState
  }
}

async function setSharedCartPeople(payload) {
  const auth = await getAuthSession(payload)
  if (!auth.success) return auth

  const tableNumber = normalizeTableNumber(payload.tableNumber)
  const sessionId = String(payload.sessionId || (tableNumber ? getSharedCartSessionId(tableNumber) : '')).trim()
  const peopleCount = Math.floor(Number(payload.peopleCount || 0))
  if (!sessionId || !tableNumber) {
    return {
      success: false,
      code: 'SESSION_REQUIRED',
      message: 'shared cart session required'
    }
  }
  if (!Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > 99) {
    return {
      success: false,
      code: 'PEOPLE_COUNT_INVALID',
      message: 'people count invalid'
    }
  }

  const sessionRef = db.collection('tableOrderSession').doc(sessionId)
  const oldSessionRes = await sessionRef.get()
  const oldSession = oldSessionRes.data
  const oldPeopleState = buildSharedCartPeopleState(oldSession)

  if (oldSession && !isActiveTableSession(oldSession)) {
    return {
      success: false,
      code: 'SESSION_CLOSED',
      message: '本桌订单已结账，请重新扫码开台'
    }
  }

  if (oldSession && isActiveTableSession(oldSession) && oldPeopleState.peopleConfirmed) {
    await sessionRef.update({
      data: {
        memberOpenids: _.addToSet(auth.data.openid),
        updateTime: db.serverDate()
      }
    })
    return {
      success: true,
      sessionId,
      tableNumber,
      alreadyConfirmed: true,
      ...oldPeopleState
    }
  }

  const data = {
    tableNumber,
    status: 'ordering',
    checkoutStatus: '',
    finishedAt: null,
    peopleCount,
    peopleConfirmed: true,
    peopleConfirmedAt: db.serverDate(),
    memberOpenids: oldSession ? _.addToSet(auth.data.openid) : [auth.data.openid],
    updateTime: db.serverDate()
  }

  if (oldSession) {
    await sessionRef.update({ data })
  } else {
    await sessionRef.set({
      data: {
        ...data,
        createTime: db.serverDate()
      }
    })
  }

  return {
    success: true,
    sessionId,
    tableNumber,
    peopleCount,
    peopleConfirmed: true,
    peopleRequired: false
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

  const sessionRef = db.collection('tableOrderSession').doc(sessionId)
  const sessionRes = await sessionRef.get()
  if (!isActiveTableSession(sessionRes.data)) {
    return {
      success: false,
      code: 'SESSION_CLOSED',
      message: '本桌订单已结账，请重新扫码开台'
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

  await sessionRef.update({
    data: {
      tableNumber,
      memberOpenids: _.addToSet(auth.data.openid),
      cartVersion: _.inc(1),
      updateTime: db.serverDate()
    }
  })

  return {
    success: true,
    cartVersion: Math.max(0, Math.floor(Number(sessionRes.data && sessionRes.data.cartVersion || 0))) + 1
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
      cartVersion: _.inc(1),
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

const DEFAULT_DISH_IMAGE_FILES = [
  '一碗包谷粑.jpg',
  '伊比利亚茴香黑猪肉.jpg',
  '凉拌鲫鱼.jpg',
  '包浆豆腐.jpg',
  '咖喱鸡柳.jpg',
  '咸蛋黄虾球.jpg',
  '土豆片.jpg',
  '嫩滑牛肉片.jpg',
  '小薄饼.jpg',
  '手工苕皮.jpg',
  '烤榴莲.jpg',
  '甜肠.jpg',
  '芝士年糕.jpg',
  '菠萝什锦炒饭.jpg',
  '葱心豆干.jpg',
  '蒜香口蘑.jpg',
  '素菜拼盘.jpg',
  '薄切五花肉.jpg',
  '金针菇.jpg',
  '韭菜.jpg',
  '鱼排.jpg',
  '鲜虾.jpg',
  '黄金蛋炒饭.jpg',
  '齐齐哈尔拌牛肉.jpg'
]

const DEFAULT_DISH_IMAGE_BASE_URL = 'cloud://zhrcloud-d1gsjuhij11024f72.7a68-zhrcloud-d1gsjuhij11024f72-1449718669/dish pic'
const DEFAULT_DISH_IMAGE_FILE_ID_PREFIX = DEFAULT_DISH_IMAGE_BASE_URL.replace(/\/dish pic$/, '')
const DEFAULT_DISH_IMAGE_CDN_HOST = '7a68-zhrcloud-d1gsjuhij11024f72-1449718669.tcb.qcloud.la'

const DISH_IMAGE_NAME_ALIASES = {
  '蒜香口蘑': ['蒜蓉口蘑']
}

function stripImageExtension(value) {
  return String(value || '').replace(/\.(png|jpe?g|webp|gif|bmp|avif)$/i, '')
}

function getImageBaseName(value) {
  const raw = String(value || '').split('?')[0].split('#')[0]
  const normalized = raw.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)
  const name = segments.length ? segments[segments.length - 1] : normalized

  try {
    return decodeURIComponent(name)
  } catch (err) {
    return name
  }
}

function normalizeDishImageKey(value) {
  return stripImageExtension(value)
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, '')
    .replace(/[·•._\-—、，,。/\\|]/g, '')
    .replace(/[\[\]【】]/g, '')
    .toLowerCase()
}

function joinDishImageUrl(baseUrl, fileName, encodeFileName = true) {
  const base = String(baseUrl || '').trim().replace(/[\\/]+$/, '')
  const name = String(fileName || '').trim()
  if (!base || !name) return ''
  const shouldEncode = encodeFileName && !isCloudFileID(base)
  return `${base}/${shouldEncode ? encodeURI(name) : name}`
}

function normalizeDishImageEntry(entry, payload = {}) {
  const baseUrl = payload.imageBaseUrl || payload.baseUrl || payload.imagePrefix || DEFAULT_DISH_IMAGE_BASE_URL
  const encodeFileName = payload.encodeFileName !== false

  if (typeof entry === 'string') {
    const fileName = getImageBaseName(entry)
    const isDirectImage = /^(https?:\/\/|cloud:\/\/|\/)/i.test(entry)
    const image = isDirectImage ? entry : joinDishImageUrl(baseUrl, fileName, encodeFileName)
    const rawDishName = stripImageExtension(fileName)

    return {
      fileName,
      image,
      dishNames: DISH_IMAGE_NAME_ALIASES[rawDishName] || [rawDishName]
    }
  }

  const fileName = getImageBaseName(entry.fileName || entry.name || entry.path || entry.url || entry.fileID || entry.image || '')
  const rawDishName = String(entry.dishName || stripImageExtension(fileName)).trim()
  const image = String(entry.image || entry.url || entry.fileID || '').trim() || joinDishImageUrl(baseUrl, fileName, encodeFileName)

  return {
    fileName,
    image,
    dishNames: Array.isArray(entry.dishNames) && entry.dishNames.length
      ? entry.dishNames.map(name => String(name || '').trim()).filter(Boolean)
      : (DISH_IMAGE_NAME_ALIASES[rawDishName] || [rawDishName])
  }
}

function isCloudFileID(value) {
  return /^cloud:\/\//i.test(String(value || '').trim())
}

function getLegacyDishImageFileID(value) {
  const image = String(value || '').trim()
  if (!image || isCloudFileID(image)) return image

  try {
    const url = new URL(image)
    if (url.hostname !== DEFAULT_DISH_IMAGE_CDN_HOST) return ''
    const cloudPath = decodeURIComponent(url.pathname || '').replace(/^\/+/, '')
    return cloudPath ? `${DEFAULT_DISH_IMAGE_FILE_ID_PREFIX}/${cloudPath}` : ''
  } catch (err) {
    return ''
  }
}

async function resolveDishImageUrls(list = []) {
  const dishes = (list || []).map(item => {
    const image = String(item && item.image || '').trim()
    const imageFileID = isCloudFileID(image) ? image : getLegacyDishImageFileID(image)
    return imageFileID && imageFileID !== image
      ? { ...item, imageFileID }
      : { ...item }
  })
  const fileIDs = Array.from(new Set(dishes
    .map(item => String(item.imageFileID || item.image || '').trim())
    .filter(isCloudFileID)))

  if (fileIDs.length === 0) {
    return dishes
  }

  try {
    const tempMap = {}
    for (let index = 0; index < fileIDs.length; index += 50) {
      const res = await cloud.getTempFileURL({
        fileList: fileIDs.slice(index, index + 50)
      })
      ;(res.fileList || []).forEach(item => {
        if (item && item.fileID && item.tempFileURL) {
          tempMap[item.fileID] = item.tempFileURL
        }
      })
    }

    return dishes.map(item => {
      const imageFileID = String(item.imageFileID || item.image || '').trim()
      if (!isCloudFileID(imageFileID)) return item
      return {
        ...item,
        imageFileID,
        image: tempMap[imageFileID] || ''
      }
    })
  } catch (err) {
    console.error('resolve dish image urls failed', err)
    return dishes.map(item => {
      const imageFileID = String(item.imageFileID || item.image || '').trim()
      if (!isCloudFileID(imageFileID)) return item
      return {
        ...item,
        imageFileID,
        image: ''
      }
    })
  }
}

function getOrderGoodsField(order = {}) {
  const fields = ['goods', 'orderGoods', 'goodsList', 'items']
  return fields.find(field => Array.isArray(order[field])) || ''
}

function getOrderGoodsImage(item = {}) {
  return String(item.dishImage || item.image || item.img || '').trim()
}

function getOrderGoodsDishId(item = {}) {
  return String(item.dishId || item.goodsId || '').trim()
}

async function getDishImageMap(dishIds = []) {
  const ids = Array.from(new Set((dishIds || []).map(id => String(id || '').trim()).filter(Boolean)))
  const imageMap = {}

  for (let index = 0; index < ids.length; index += 50) {
    const batch = ids.slice(index, index + 50)
    const res = await db.collection('dish')
      .where({ _id: _.in(batch) })
      .limit(50)
      .get()

    ;(res.data || []).forEach(dish => {
      const dishId = String(dish && dish._id || '').trim()
      const image = String(dish && dish.image || '').trim()
      if (dishId && image) imageMap[dishId] = image
    })
  }

  return imageMap
}

async function normalizeOrderGoodsImages(orders = []) {
  const sourceOrders = Array.isArray(orders) ? orders : []
  const missingDishIds = []

  sourceOrders.forEach(order => {
    const goodsField = getOrderGoodsField(order)
    if (!goodsField) return
    order[goodsField].forEach(item => {
      if (!getOrderGoodsImage(item)) {
        const dishId = getOrderGoodsDishId(item)
        if (dishId) missingDishIds.push(dishId)
      }
    })
  })

  const fallbackImageMap = missingDishIds.length > 0
    ? await getDishImageMap(missingDishIds)
    : {}
  const imageSources = new Set()

  sourceOrders.forEach(order => {
    const goodsField = getOrderGoodsField(order)
    if (!goodsField) return
    order[goodsField].forEach(item => {
      const image = getOrderGoodsImage(item) || fallbackImageMap[getOrderGoodsDishId(item)] || ''
      if (image) imageSources.add(image)
    })
  })

  const resolvedImages = await resolveDishImageUrls(
    Array.from(imageSources).map(image => ({ image }))
  )
  const imageUrlMap = resolvedImages.reduce((map, item) => {
    const source = String(item.imageFileID || item.image || '').trim()
    if (source) map[source] = String(item.image || '').trim()
    return map
  }, {})

  return sourceOrders.map(order => {
    const goodsField = getOrderGoodsField(order)
    if (!goodsField) return { ...order }

    return {
      ...order,
      [goodsField]: order[goodsField].map(item => {
        const source = getOrderGoodsImage(item) || fallbackImageMap[getOrderGoodsDishId(item)] || ''
        const image = imageUrlMap[source] || (isCloudFileID(source) ? '' : source)
        return {
          ...item,
          dishImage: image,
          ...(isCloudFileID(source) ? { dishImageFileID: source } : {})
        }
      })
    }
  })
}

function getDishNeedPopup(dish = {}) {
  if (Object.prototype.hasOwnProperty.call(dish, 'needSpec')) {
    return dish.needSpec !== false
  }
  if (Object.prototype.hasOwnProperty.call(dish, 'needPopup')) {
    return dish.needPopup === true
  }
  return true
}

function normalizeStringArray(list = []) {
  if (!Array.isArray(list)) return []
  return list
    .map(item => String(item || '').trim())
    .filter(Boolean)
}

function normalizeSpecOptionGroups(optionGroups = []) {
  if (!Array.isArray(optionGroups)) return []
  return optionGroups
    .map((group, index) => {
      const options = normalizeStringArray(group.options)
      if (!options.length) return null
      return {
        id: String(group.id || `group_${index + 1}`).trim(),
        title: String(group.title || group.name || '').trim(),
        options,
        note: String(group.note || '').trim()
      }
    })
    .filter(Boolean)
}

function normalizeDishSpecFields(dish = {}) {
  const needPopup = getDishNeedPopup(dish)
  return {
    ...dish,
    needPopup,
    needSpec: needPopup
  }
}

async function normalizeDishListForClient(list = []) {
  const data = await resolveDishImageUrls(list)
  return data.map(item => normalizeDishSpecFields(item))
}

async function getAllDishesForImageMatch(menuType) {
  const limit = 100
  const all = []
  let page = 0

  while (true) {
    let query = db.collection('dish')
    if (menuType) {
      query = query.where({
        menuType: getMenuTypeWhere(menuType)
      })
    }

    const res = await query
      .skip(page * limit)
      .limit(limit)
      .get()

    const data = res.data || []
    all.push(...data)
    if (data.length < limit) break
    page += 1
  }

  return all
}

async function getDishesForImageMatch(menuType, dishNames = []) {
  const names = Array.from(new Set((dishNames || [])
    .map(name => String(name || '').trim())
    .filter(Boolean)))

  if (names.length === 0) {
    return []
  }

  const where = {
    name: _.in(names)
  }

  if (menuType) {
    where.menuType = getMenuTypeWhere(menuType)
  }

  const res = await db.collection('dish')
    .where(where)
    .limit(100)
    .get()

  return res.data || []
}

async function adminMatchDishImages(payload) {
  const allImages = Array.isArray(payload.images) && payload.images.length
    ? payload.images
    : DEFAULT_DISH_IMAGE_FILES
  const imageOffset = Math.max(0, Math.floor(Number(payload.imageOffset || payload.offset || 0)))
  const batchSize = Math.min(Math.max(Math.floor(Number(payload.batchSize || payload.limit || 5)), 1), 10)
  const images = allImages.slice(imageOffset, imageOffset + batchSize)
  const menuType = payload.menuType ? getMenuType(payload.menuType) : ''
  const overwrite = payload.overwrite !== false
  const dryRun = payload.dryRun === true
  const entries = images.map(image => normalizeDishImageEntry(image, payload))
  const entryDishNames = entries.reduce((result, entry) => {
    return result.concat(entry.dishNames || [])
  }, [])
  const dishList = await getDishesForImageMatch(menuType, entryDishNames)
  const matched = []
  const unmatched = []
  let updated = 0
  let skipped = 0

  const dishGroups = dishList.reduce((groups, dish) => {
    const key = normalizeDishImageKey(dish.name)
    if (!key) return groups
    if (!groups[key]) groups[key] = []
    groups[key].push(dish)
    return groups
  }, {})

  for (const entry of entries) {
    const targetKeys = Array.from(new Set((entry.dishNames || []).map(normalizeDishImageKey).filter(Boolean)))
    const dishes = targetKeys.reduce((result, key) => result.concat(dishGroups[key] || []), [])

    if (!entry.image || dishes.length === 0) {
      unmatched.push({
        fileName: entry.fileName,
        image: entry.image,
        dishNames: entry.dishNames || []
      })
      continue
    }

    for (const dish of dishes) {
      const shouldUpdate = overwrite || !dish.image
      if (!shouldUpdate) {
        skipped += 1
        matched.push({
          fileName: entry.fileName,
          dishId: dish._id,
          dishName: dish.name,
          image: dish.image,
          skipped: true
        })
        continue
      }

      if (!dryRun) {
        await db.collection('dish').doc(dish._id).update({
          data: {
            image: entry.image,
            imageFileName: entry.fileName,
            updateTime: db.serverDate()
          }
        })
      }

      updated += 1
      matched.push({
        fileName: entry.fileName,
        dishId: dish._id,
        dishName: dish.name,
        image: entry.image,
        dryRun
      })
    }
  }

  return {
    success: true,
    data: {
      matched,
      unmatched,
      updated,
      skipped,
      dryRun,
      imageOffset,
      batchSize,
      nextImageOffset: imageOffset + images.length,
      hasMore: imageOffset + images.length < allImages.length,
      totalImages: allImages.length
    }
  }
}

function getImageTypeFromBuffer(buffer) {
  if (!buffer || buffer.length < 12) return null

  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return {
      ext: 'jpg',
      contentType: DISH_IMAGE_TYPES.jpg
    }
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return {
      ext: 'png',
      contentType: DISH_IMAGE_TYPES.png
    }
  }

  if (
    buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
    buffer.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return {
      ext: 'webp',
      contentType: DISH_IMAGE_TYPES.webp
    }
  }

  return null
}

function sanitizeCloudPathName(value, fallback = 'dish') {
  const name = String(value || '').trim()
    .replace(/[\\/:*?"<>|#%&{}$!@+=`~]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)

  return name || fallback
}

async function adminUploadDishImage(payload) {
  const tenantId = getTenantId(payload)
  const dishId = String(payload.dishId || payload._id || '').trim()
  const dishName = String(payload.dishName || payload.name || '').trim()
  const base64 = String(payload.fileBase64 || payload.base64 || '').replace(/^data:image\/\w+;base64,/, '')

  if (!base64) {
    return {
      success: false,
      code: 'IMAGE_REQUIRED',
      message: 'image required'
    }
  }

  const fileContent = Buffer.from(base64, 'base64')
  if (!fileContent.length || fileContent.length > MAX_DISH_IMAGE_SIZE) {
    return {
      success: false,
      code: 'IMAGE_TOO_LARGE',
      message: 'image must be 1MB or less'
    }
  }

  const imageType = getImageTypeFromBuffer(fileContent)
  if (!imageType) {
    return {
      success: false,
      code: 'IMAGE_TYPE_INVALID',
      message: 'only jpg/png/webp images are allowed'
    }
  }

  const safeTenantId = sanitizeCloudPathName(tenantId, DEFAULT_TENANT_ID)
  const safeDishName = sanitizeCloudPathName(dishName || dishId || 'dish')
  const random = crypto.randomBytes(4).toString('hex')
  const cloudPath = `tenant/${safeTenantId}/dish/${safeDishName}-${Date.now()}-${random}.${imageType.ext}`
  const uploadRes = await cloud.uploadFile({
    cloudPath,
    fileContent
  })
  const fileID = uploadRes.fileID || ''
  let image = ''

  if (fileID) {
    try {
      const tempRes = await cloud.getTempFileURL({
        fileList: [fileID]
      })
      image = tempRes.fileList && tempRes.fileList[0] && tempRes.fileList[0].tempFileURL || ''
    } catch (err) {
      console.error('get uploaded dish image temp url failed', err)
    }
  }

  if (dishId && fileID) {
    await db.collection('dish').doc(dishId).update({
      data: {
        image: fileID,
        imageFileName: `${safeDishName}.${imageType.ext}`,
        updateTime: db.serverDate()
      }
    })
  }

  return {
    success: true,
    data: {
      fileID,
      image,
      cloudPath,
      size: fileContent.length,
      contentType: imageType.contentType
    }
  }
}

const TABLE_CODE_PAGE = 'packages/order/pages/index/index'

function getTableCodeScene(ref) {
  if (!ref) return ''
  if (ref.areaKey === 'vip') return `VIP${ref.tableNumber}`
  if (ref.areaKey === 'sky') return `T${ref.tableNumber}`
  return ref.tableNumber
}

function getTableCodeSort(ref) {
  const offsets = {
    normal: 0,
    vip: 100,
    sky: 200
  }
  return Number(offsets[ref && ref.areaKey] || 0) + Number(ref && ref.tableNumber || 0)
}

function getTableCodeDefinitions() {
  return ADMIN_TABLE_SECTIONS.reduce((list, section) => {
    for (let index = 1; index <= section.count; index += 1) {
      const ref = getAdminTableRef(section.areaKey, String(index).padStart(2, '0'))
      if (!ref) continue
      list.push({
        tableKey: ref.tableKey,
        areaKey: ref.areaKey,
        areaName: ref.areaName,
        tableNumber: ref.tableNumber,
        scene: getTableCodeScene(ref),
        page: TABLE_CODE_PAGE,
        sort: getTableCodeSort(ref)
      })
    }
    return list
  }, [])
}

function getTableCodeRecordKey(item = {}) {
  const tableKey = String(item.tableKey || '').trim()
  if (tableKey) return tableKey
  const ref = parseAdminTableNumber(item.scene || item.tableNumber) ||
    getAdminTableRef(item.areaKey, item.tableNumber)
  return ref ? ref.tableKey : ''
}

async function resolveTableCodeUrls(list = []) {
  const records = (list || []).map(item => ({ ...item }))
  const fileIDs = Array.from(new Set(records
    .map(item => String(item.qrCodeFileID || item.qrCodeUrl || '').trim())
    .filter(isCloudFileID)))

  if (fileIDs.length === 0) return records

  try {
    const res = await cloud.getTempFileURL({ fileList: fileIDs })
    const urlMap = (res.fileList || []).reduce((map, item) => {
      if (item && item.fileID && item.tempFileURL) map[item.fileID] = item.tempFileURL
      return map
    }, {})
    return records.map(item => {
      const fileID = String(item.qrCodeFileID || item.qrCodeUrl || '').trim()
      return {
        ...item,
        qrCodeFileID: isCloudFileID(fileID) ? fileID : (item.qrCodeFileID || ''),
        qrCodeUrl: isCloudFileID(fileID) ? (urlMap[fileID] || '') : fileID
      }
    })
  } catch (err) {
    console.error('resolve table code urls failed', err)
    return records
  }
}

async function adminListTableCodes() {
  const res = await db.collection('tableCode').limit(100).get()
  const existingMap = (res.data || []).reduce((map, item) => {
    const tableKey = getTableCodeRecordKey(item)
    if (tableKey) map[tableKey] = item
    return map
  }, {})

  const records = getTableCodeDefinitions().map(definition => {
    const existing = existingMap[definition.tableKey] || {}
    return {
      ...definition,
      _id: existing._id || '',
      status: existing.status !== false,
      qrCodeFileID: String(existing.qrCodeFileID || (isCloudFileID(existing.qrCodeUrl) ? existing.qrCodeUrl : '') || '').trim(),
      qrCodeUrl: String(existing.qrCodeUrl || '').trim(),
      generatedAt: existing.generatedAt || null,
      updateTime: existing.updateTime || null
    }
  })

  return {
    success: true,
    data: await resolveTableCodeUrls(records)
  }
}

async function adminGenerateTableCode(payload) {
  const ref = getAdminTableRef(payload.areaKey, payload.tableNumber)
  if (!ref) {
    return {
      success: false,
      code: 'TABLE_NOT_FOUND',
      message: 'table not found'
    }
  }

  const scene = getTableCodeScene(ref)
  const imageBuffer = await createWechatMiniProgramCode(scene, TABLE_CODE_PAGE)
  const tenantId = sanitizeCloudPathName(getTenantId(payload), DEFAULT_TENANT_ID)
  const cloudPath = `tenant/${tenantId}/table-code/${ref.tableKey}.png`
  const uploadRes = await cloud.uploadFile({
    cloudPath,
    fileContent: imageBuffer
  })
  const fileID = String(uploadRes.fileID || '').trim()
  if (!fileID) {
    throw new Error('failed to upload table code image')
  }

  const existingRes = await db.collection('tableCode')
    .where({ tableKey: ref.tableKey })
    .limit(1)
    .get()
  const existing = existingRes.data && existingRes.data[0]
  const codeData = {
    tableKey: ref.tableKey,
    areaKey: ref.areaKey,
    areaName: ref.areaName,
    tableNumber: ref.tableNumber,
    scene,
    page: TABLE_CODE_PAGE,
    qrCodeFileID: fileID,
    qrCodeUrl: fileID,
    status: existing ? existing.status !== false : true,
    sort: getTableCodeSort(ref),
    generatedAt: db.serverDate(),
    updateTime: db.serverDate()
  }

  let id = existing && existing._id
  if (id) {
    await db.collection('tableCode').doc(id).update({ data: codeData })
  } else {
    const addRes = await db.collection('tableCode').add({
      data: {
        ...codeData,
        createTime: db.serverDate()
      }
    })
    id = addRes._id
  }

  const records = await resolveTableCodeUrls([{
    ...codeData,
    _id: id
  }])
  return {
    success: true,
    data: records[0] || null
  }
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

  const data = await normalizeDishListForClient(res.data || [])

  return {
    success: true,
    data,
    page,
    limit,
    hasMore: (res.data || []).length === limit
  }
}

async function getMenuBootstrap(payload = {}) {
  const menuType = getMenuType(payload.menuType)
  const initialCategoryCount = Math.min(Math.max(Number(payload.initialCategoryCount) || 3, 1), 3)
  const [categoryResult, shopResult, noticeResult] = await Promise.all([
    listCategories({ menuType }),
    getShopInfo(),
    listNotices({ target: menuType })
  ])
  const categories = categoryResult.data || []
  const initialCategories = categories.slice(0, initialCategoryCount)
  const sectionResults = await Promise.all(initialCategories.map(category => (
    listCategoryGoods({
      menuType,
      categoryId: category._id,
      limit: 100
    })
  )))
  const sections = initialCategories.map((category, index) => ({
    id: category._id,
    name: category.name,
    goods: sectionResults[index].data || []
  }))

  return {
    success: true,
    data: {
      categories,
      sections,
      shopInfo: shopResult.data || null,
      notices: noticeResult.data || []
    }
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

  const data = await normalizeDishListForClient(res.data || [])

  return {
    success: true,
    data
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

function normalizeNoticeTarget(target) {
  return target === 'camping' ? 'camping' : 'dineIn'
}

function normalizeNoticeTargets(source) {
  const rawTargets = Array.isArray(source) ? source : (source ? [source] : [])
  const targets = rawTargets
    .map(target => target === 'camping' ? 'camping' : (target === 'dineIn' ? 'dineIn' : ''))
    .filter(Boolean)
  return Array.from(new Set(targets))
}

function isNoticeTargetMatched(notice = {}, target) {
  if (!target) return true
  const targets = normalizeNoticeTargets(notice.targets)
  if (targets.length) {
    return targets.indexOf(target) >= 0
  }
  return !notice.target || notice.target === target || notice.target === 'all'
}

async function listNotices(payload = {}) {
  const target = payload.target ? normalizeNoticeTarget(payload.target) : ''
  const res = await db.collection('notice')
    .where({ status: 1 })
    .orderBy('sort', 'asc')
    .limit(30)
    .get()
  const data = (res.data || [])
    .filter(item => isNoticeTargetMatched(item, target))
    .slice(0, 10)

  return {
    success: true,
    data
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

    const data = await normalizeDishListForClient(res.data || [])

    return {
      success: true,
      data
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

  const data = await normalizeDishListForClient(res.data || [])

  return {
    success: true,
    data
  }
}

function normalizeAdminDish(payload) {
  const dish = payload.dish || payload
  const menuType = getMenuType(dish.menuType || payload.menuType)
  const needPopup = getDishNeedPopup(dish)
  const flavorOptions = normalizeStringArray(dish.flavorOptions)
  const optionGroups = normalizeSpecOptionGroups(dish.optionGroups)
  const printerId = normalizePrinterId(dish.printerId || dish.kitchenPrinterId || '')

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
    printerId,
    printerName: getPrinterName(printerId),
    needPopup,
    needSpec: needPopup,
    specTemplate: String(dish.specTemplate || '').trim(),
    flavorTitle: String(dish.flavorTitle || '').trim(),
    flavorOptions,
    flavorNote: String(dish.flavorNote || '').trim(),
    optionGroups
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
    printerId: dish.printerId,
    printerName: dish.printerName,
    needPopup: dish.needPopup,
    needSpec: dish.needSpec,
    specTemplate: dish.specTemplate,
    flavorTitle: dish.flavorTitle,
    flavorOptions: dish.flavorOptions,
    flavorNote: dish.flavorNote,
    optionGroups: dish.optionGroups,
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
  const data = config.key === 'order'
    ? await normalizeOrderGoodsImages(res.data || [])
    : (res.data || [])

  return {
    success: true,
    data,
    page,
    limit,
    hasMore: (res.data || []).length === limit
  }
}

async function adminListInfoCenter(payload) {
  const [orderRes, reservationRes] = await Promise.all([
    db.collection('order')
      .where({
        type: 'order',
        status: 'submitted',
        deleted: _.neq(true)
      })
      .orderBy('createTime', 'desc')
      .limit(100)
      .get(),
    db.collection('reservation')
      .where({
        status: _.in(['pending', 'confirmed'])
      })
      .orderBy('createTime', 'desc')
      .limit(100)
      .get()
  ])

  const orders = (orderRes.data || [])
    .filter(order => order.tableCleared !== true)
    .map(order => ({
      _id: order._id,
      orderScene: order.orderScene || order.orderType || 'dineIn',
      tableNumber: order.tableNumber || '',
      userPhone: order.userPhone || order.userSnapshot && order.userSnapshot.phoneNumber || '',
      goodsCount: (Array.isArray(order.goods) ? order.goods : [])
        .reduce((sum, item) => sum + Number(item && item.count || 0), 0),
      finalPrice: Number(order.finalPrice || order.totalPrice || 0),
      createTime: order.createTime,
      updateTime: order.updateTime || order.createTime,
      isAddOnOrder: order.isAddOnOrder === true,
      addOnIndex: Number(order.addOnIndex || 0)
    }))
  const reservations = (reservationRes.data || []).map(item => ({
    _id: item._id,
    reservationDate: item.reservationDate || '',
    reservationDateText: item.reservationDateText || '',
    reservationTime: item.reservationTime || '',
    peopleCount: Number(item.peopleCount || 0),
    roomType: item.roomType || '',
    phone: item.phone || item.phoneNumber || '',
    status: item.status || '',
    updateTime: item.updateTime || item.createTime
  }))

  return {
    success: true,
    data: {
      orders,
      reservations
    }
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

  if (action === 'menu.bootstrap') return getMenuBootstrap(payload)
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
    action.indexOf('admin.tableCode.') === 0 ||
    action.indexOf('admin.order.') === 0 ||
    action.indexOf('admin.notification.') === 0 ||
    action.indexOf('admin.collection.') === 0 ||
    action.indexOf('admin.print.') === 0
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
  if (action === 'admin.dish.matchImages') return adminMatchDishImages(payload)
  if (action === 'admin.dish.uploadImage') return adminUploadDishImage(payload)
  if (action === 'admin.table.list') return adminListTables(payload)
  if (action === 'admin.table.detail') return adminGetTableDetail(payload)
  if (action === 'admin.table.updatePeople') return adminUpdateTablePeople(payload)
  if (action === 'admin.table.merge') return adminMergeTables(payload)
  if (action === 'admin.table.transfer') return adminTransferTable(payload)
  if (action === 'admin.table.finishCheckout') return adminFinishTableCheckout(payload)
  if (action === 'admin.table.prebill') return adminPrintPrebill(payload)
  if (action === 'admin.table.printCustomerOrder') return adminPrintCustomerOrder(payload)
  if (action === 'admin.table.clear') return adminClearTable(payload)
  if (action === 'admin.table.sendKitchen') return adminSendTableToKitchen(payload)
  if (action === 'admin.table.sendKitchenItems') return adminSendKitchenItems(payload)
  if (action === 'admin.table.urgeKitchenItems') return adminUrgeKitchenItems(payload)
  if (action === 'admin.tableCode.list') return adminListTableCodes(payload)
  if (action === 'admin.tableCode.generate') return adminGenerateTableCode(payload)
  if (action === 'admin.order.sendKitchenItems') return adminSendKitchenItems(payload)
  if (action === 'admin.order.urgeKitchenItems') return adminUrgeKitchenItems(payload)
  if (action === 'admin.table.refundDish') return adminRefundDish(payload)
  if (action === 'admin.table.refundDishes') return adminRefundDishes(payload)
  if (action === 'admin.table.giftDishes') return adminGiftDishes(payload)
  if (action === 'admin.table.updateDish') return adminUpdateTableDish(payload)
  if (action === 'admin.notification.list') return adminListInfoCenter(payload)
  if (action === 'admin.collection.list') return adminCollectionList(payload)
  if (action === 'admin.collection.save') return adminCollectionSave(payload)
  if (action === 'admin.collection.update') return adminCollectionUpdate(payload)
  if (action === 'admin.collection.delete') return adminCollectionDelete(payload)
  if (action.indexOf('admin.print.') === 0) {
    const printResult = await printService.handleAdminAction(action, payload)
    if (printResult) return printResult
  }
  if (action.indexOf('print.agent.') === 0) {
    const agentResult = await printService.handleAgentAction(action, payload)
    if (agentResult) return agentResult
  }
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
  if (action === 'sharedCart.setPeople') return setSharedCartPeople(payload)
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
