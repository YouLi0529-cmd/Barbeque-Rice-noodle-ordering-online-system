const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database({
  throwOnNotFound: false
})
const _ = db.command

const BATCH_LIMIT = 100
const MAX_BATCHES = 10

function isSavedOrder(order) {
  return order && (
    order.pay_status === false ||
    order.savedOnly === true ||
    order.isDraft === true
  )
}

function isCollectionNotFound(err) {
  const text = `${err && err.errCode ? err.errCode : ''} ${err && err.message ? err.message : ''} ${err && err.errMsg ? err.errMsg : ''}`
  return text.includes('-502005') || text.includes('collection not exists') || text.includes('Db or Table not exist')
}

async function removeDocs(collectionName, query, filter) {
  let removed = 0
  let scanned = 0

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    let res
    try {
      res = await db.collection(collectionName)
        .where(query)
        .limit(BATCH_LIMIT)
        .get()
    } catch (err) {
      if (isCollectionNotFound(err)) {
        return { scanned, removed, skipped: true }
      }
      throw err
    }

    const list = res.data || []
    scanned += list.length

    const targets = typeof filter === 'function'
      ? list.filter(filter)
      : list

    await Promise.all(targets.map(item => {
      return db.collection(collectionName).doc(item._id).remove()
    }))
    removed += targets.length

    if (list.length < BATCH_LIMIT) {
      break
    }
  }

  return { scanned, removed, skipped: false }
}

exports.main = async () => {
  const now = new Date()

  try {
    const draftResult = await removeDocs('orderDraft', {
      expiresAt: _.lte(now)
    })

    const orderResult = await removeDocs('order', {
      type: 'order',
      expiresAt: _.lte(now),
      deleted: _.neq(true)
    }, isSavedOrder)

    return {
      success: true,
      now,
      orderDraft: draftResult,
      order: orderResult
    }
  } catch (err) {
    console.error('cleanupExpiredDraftOrders failed', err)
    return {
      success: false,
      message: err.message || '清理过期预点单失败'
    }
  }
}
