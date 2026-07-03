const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database({
  throwOnNotFound: false
})
const _ = db.command

exports.main = async (event) => {
  const orderId = event.outTradeNo
  const returnCode = event.returnCode

  if (returnCode !== 'SUCCESS') {
    return {
      errcode: 1,
      errmsg: '支付未成功'
    }
  }

  if (!orderId) {
    return {
      errcode: 1,
      errmsg: '缺少订单号'
    }
  }

  try {
    await db.runTransaction(async transaction => {
      const orderRes = await transaction.collection('order').doc(orderId).get()
      const order = orderRes.data

      if (!order) {
        throw new Error('订单不存在')
      }

      if (order.pay_status) {
        return
      }

      await transaction.collection('order').doc(orderId).update({
        data: {
          pay_status: true,
          payTime: db.serverDate()
        }
      })

      if (order.type === 'order' && order._openid) {
        const userRes = await transaction.collection('user').where({
          _openid: order._openid,
          status: _.neq(0)
        }).limit(1).get()

        const user = userRes.data && userRes.data[0]
        if (user) {
          const countField = order.orderScene === 'camping' ? 'campingOrderCount' : 'dineInOrderCount'
          await transaction.collection('user').doc(user._id).update({
            data: {
              orderCount: _.inc(1),
              [countField]: _.inc(1),
              lastOrderTime: db.serverDate()
            }
          })
        }
      }
    })

    return {
      errcode: 0,
      errmsg: '支付成功'
    }
  } catch (err) {
    console.error('pay_success failed', err)
    return {
      errcode: 1,
      errmsg: err.message || '服务器异常'
    }
  }
}
