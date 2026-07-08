const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database({
  throwOnNotFound: false
})
const _ = db.command

const CART_LIMIT = 200
let ensureCollectionsPromise = null

function isCollectionExistsError(err) {
  const text = `${err && err.errCode ? err.errCode : ''} ${err && err.message ? err.message : ''} ${err && err.errMsg ? err.errMsg : ''}`
  return text.includes('already exists') ||
    text.includes('already exist') ||
    text.includes('已存在') ||
    text.includes('DATABASE_COLLECTION_ALREADY_EXIST')
}

async function ensureCollection(name) {
  if (typeof db.createCollection !== 'function') {
    return
  }

  try {
    await db.createCollection(name)
  } catch (err) {
    if (!isCollectionExistsError(err)) {
      throw err
    }
  }
}

async function ensureSharedCartCollections() {
  if (!ensureCollectionsPromise) {
    ensureCollectionsPromise = Promise.all([
      ensureCollection('tableOrderSession'),
      ensureCollection('tableCartItem')
    ])
  }
  return ensureCollectionsPromise
}

function normalizeTableNumber(tableNumber) {
  return String(tableNumber || '').trim()
}

function getSessionId(tableNumber) {
  const safeTable = encodeURIComponent(tableNumber).replace(/%/g, '_')
  return `table_${safeTable}`
}

function getCartDocId(sessionId, cartKey) {
  const hash = crypto.createHash('md5').update(String(cartKey || '')).digest('hex')
  return `${sessionId}_${hash}`
}

function normalizeCount(count) {
  const value = Math.floor(Number(count) || 0)
  return value > 0 ? value : 0
}

function getPeopleCount(session) {
  const value = Math.floor(Number(session && session.peopleCount || 0))
  return value > 0 ? value : 0
}

function buildPeopleState(session) {
  const peopleCount = getPeopleCount(session)
  const peopleConfirmed = peopleCount > 0 && (!session || session.peopleConfirmed !== false)
  return {
    peopleCount,
    peopleConfirmed,
    peopleRequired: !peopleConfirmed
  }
}

function isSessionClosed(session) {
  return !!session && (session.status === 'finished' || session.checkoutStatus === 'finished')
}

function buildSessionState(session) {
  const sessionClosed = isSessionClosed(session)
  return {
    sessionActive: !!session && !sessionClosed,
    sessionClosed: !session || sessionClosed,
    sessionStatus: String(session && session.status || ''),
    checkoutStatus: String(session && session.checkoutStatus || '')
  }
}

function normalizeItem(item) {
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

async function joinSession(openid, tableNumber) {
  const sessionId = getSessionId(tableNumber)
  const sessionRef = db.collection('tableOrderSession').doc(sessionId)
  const oldSessionRes = await sessionRef.get()
  const oldSession = oldSessionRes.data
  let nextSession = oldSession

  if (oldSession) {
    const shouldResetSession = oldSession.status === 'finished' ||
      oldSession.checkoutStatus === 'finished'
    const updateData = {
      tableNumber,
      status: 'ordering',
      checkoutStatus: '',
      finishedAt: null,
      memberOpenids: shouldResetSession ? [openid] : _.addToSet(openid),
      updateTime: db.serverDate()
    }
    if (shouldResetSession) {
      updateData.createTime = db.serverDate()
      updateData.peopleCount = 0
      updateData.peopleConfirmed = false
      updateData.peopleConfirmedAt = null
      await clearCartItemsBySessionId(sessionId)
    }
    await sessionRef.update({
      data: updateData
    })
    nextSession = shouldResetSession
      ? {
        tableNumber,
        status: 'ordering',
        peopleCount: 0,
        peopleConfirmed: false
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
        memberOpenids: [openid],
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    nextSession = {
      tableNumber,
      status: 'ordering',
      peopleCount: 0,
      peopleConfirmed: false
    }
  }

  return {
    success: true,
    sessionId,
    tableNumber,
    ...buildPeopleState(nextSession),
    ...buildSessionState(nextSession)
  }
}

async function clearCartItemsBySessionId(sessionId) {
  const res = await db.collection('tableCartItem')
    .where({
      sessionId,
      deleted: _.neq(true)
    })
    .limit(CART_LIMIT)
    .get()

  await Promise.all((res.data || []).map(item => {
    return db.collection('tableCartItem').doc(item._id).remove()
  }))

  return (res.data || []).length
}

async function getCartItems(sessionId) {
  const sessionRes = await db.collection('tableOrderSession').doc(sessionId).get()
  const sessionState = buildSessionState(sessionRes.data)
  if (sessionState.sessionClosed) {
    return {
      success: true,
      items: [],
      ...buildPeopleState(sessionRes.data),
      ...sessionState
    }
  }

  const res = await db.collection('tableCartItem')
    .where({
      sessionId,
      deleted: _.neq(true)
    })
    .limit(CART_LIMIT)
    .get()

  return {
    success: true,
    items: res.data || [],
    ...buildPeopleState(sessionRes.data),
    ...sessionState
  }
}

async function setPeople(openid, event) {
  const tableNumber = normalizeTableNumber(event.tableNumber)
  const sessionId = String(event.sessionId || (tableNumber ? getSessionId(tableNumber) : '')).trim()
  const peopleCount = Math.floor(Number(event.peopleCount || 0))

  if (!sessionId || !tableNumber) {
    return {
      success: false,
      message: '缺少桌台信息'
    }
  }

  if (!Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > 99) {
    return {
      success: false,
      message: '人数不正确'
    }
  }

  const sessionRef = db.collection('tableOrderSession').doc(sessionId)
  const oldSessionRes = await sessionRef.get()
  const oldSession = oldSessionRes.data
  const oldPeopleState = buildPeopleState(oldSession)

  if (buildSessionState(oldSession).sessionClosed) {
    return {
      success: false,
      code: 'SESSION_CLOSED',
      message: '本桌订单已结账，请重新扫码开台'
    }
  }

  if (oldSession && oldPeopleState.peopleConfirmed && oldSession.status !== 'finished' && oldSession.checkoutStatus !== 'finished') {
    await sessionRef.update({
      data: {
        memberOpenids: _.addToSet(openid),
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
    memberOpenids: oldSession ? _.addToSet(openid) : [openid],
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

async function patchCart(openid, event) {
  const sessionId = String(event.sessionId || '').trim()
  const tableNumber = normalizeTableNumber(event.tableNumber)
  const operations = Array.isArray(event.operations) ? event.operations : []

  if (!sessionId || !tableNumber) {
    return {
      success: false,
      message: '缺少桌台信息'
    }
  }

  if (operations.length === 0) {
    return {
      success: true
    }
  }

  const sessionRef = db.collection('tableOrderSession').doc(sessionId)
  const sessionRes = await sessionRef.get()
  if (buildSessionState(sessionRes.data).sessionClosed) {
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

      const docId = getCartDocId(sessionId, cartKey)
      const itemRef = transaction.collection('tableCartItem').doc(docId)
      const oldRes = await itemRef.get()
      const oldItem = oldRes.data
      const normalizedItem = normalizeItem(operation.item || {})
      const nextCount = normalizeCount((oldItem ? Number(oldItem.count || 0) : 0) + delta)

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
        updatedByOpenid: openid,
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
            createdByOpenid: openid
          }
        })
      }
    }
  })

  await sessionRef.update({
    data: {
      tableNumber,
      memberOpenids: _.addToSet(openid),
      updateTime: db.serverDate()
    }
  })

  return {
    success: true
  }
}

async function clearCart(sessionId) {
  const res = await db.collection('tableCartItem')
    .where({
      sessionId,
      deleted: _.neq(true)
    })
    .limit(CART_LIMIT)
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

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const action = event.action || 'get'
  const tableNumber = normalizeTableNumber(event.tableNumber)
  const sessionId = String(event.sessionId || (tableNumber ? getSessionId(tableNumber) : '')).trim()

  try {
    await ensureSharedCartCollections()

    if (action === 'join') {
      if (!tableNumber) {
        return {
          success: false,
          message: '缺少桌号'
        }
      }
      return await joinSession(openid, tableNumber)
    }

    if (!sessionId) {
      return {
        success: false,
        message: '缺少点单会话'
      }
    }

    if (action === 'patch') {
      return await patchCart(openid, {
        ...event,
        sessionId,
        tableNumber
      })
    }

    if (action === 'setPeople') {
      return await setPeople(openid, {
        ...event,
        sessionId,
        tableNumber
      })
    }

    if (action === 'clear') {
      return await clearCart(sessionId)
    }

    return await getCartItems(sessionId)
  } catch (err) {
    console.error('sharedCart failed', err)
    return {
      success: false,
      message: err.message || '共同点单处理失败'
    }
  }
}
