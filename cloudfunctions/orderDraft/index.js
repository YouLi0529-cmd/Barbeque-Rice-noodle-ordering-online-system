const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database({
  throwOnNotFound: false
})

const ONE_DAY = 24 * 60 * 60 * 1000

function isExpired(draft) {
  if (!draft || !draft.expiresAt) return false
  return new Date(draft.expiresAt).getTime() <= Date.now()
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const action = event.action || 'get'

  try {
    if (action === 'save') {
      const cart = event.cart || {}
      if (!cart || Object.keys(cart).length === 0) {
        return {
          success: false,
          message: '购物车为空'
        }
      }

      const data = {
        _openid: openid,
        cart,
        totalPrice: Number(event.totalPrice || 0),
        expiresAt: new Date(Date.now() + ONE_DAY),
        updateTime: db.serverDate()
      }

      const oldRes = await db.collection('orderDraft').where({
        _openid: openid
      }).limit(1).get()

      const oldDraft = oldRes.data && oldRes.data[0]
      if (oldDraft) {
        await db.collection('orderDraft').doc(oldDraft._id).update({
          data
        })
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

    if (action === 'delete') {
      const oldRes = await db.collection('orderDraft').where({
        _openid: openid
      }).get()

      await Promise.all((oldRes.data || []).map(item => {
        return db.collection('orderDraft').doc(item._id).remove()
      }))

      return {
        success: true
      }
    }

    const draftRes = await db.collection('orderDraft').where({
      _openid: openid
    }).orderBy('updateTime', 'desc').limit(1).get()

    const draft = draftRes.data && draftRes.data[0]
    if (!draft) {
      return {
        success: true,
        data: null
      }
    }

    if (isExpired(draft)) {
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
  } catch (err) {
    console.error('orderDraft failed', err)
    return {
      success: false,
      message: err.message || '处理预点单失败'
    }
  }
}
