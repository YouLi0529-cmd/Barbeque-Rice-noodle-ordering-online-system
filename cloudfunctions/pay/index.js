const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database({
  throwOnNotFound: false
})

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const orderId = event.outTradeNo

  if (!orderId) {
    throw new Error('缺少订单号')
  }

  const orderRes = await db.collection('order').doc(orderId).get()
  const order = orderRes.data

  if (!order) {
    throw new Error('订单不存在')
  }
  if (order._openid !== openid) {
    throw new Error('不能支付他人的订单')
  }
  if (order.pay_status) {
    throw new Error('订单已支付')
  }

  const finalPrice = Number(order.finalPrice || 0)
  const totalFee = Math.round(finalPrice * 100)

  if (!Number.isFinite(totalFee) || totalFee <= 0) {
    throw new Error('订单金额不正确')
  }

  return cloud.cloudPay.unifiedOrder({
    body: event.body || '点餐订单支付',
    outTradeNo: orderId,
    spbillCreateIp: '127.0.0.1',
    subMchId: '填入你的商户ID',
    totalFee,
    envId: wxContext.ENV || process.env.TCB_ENV,
    functionName: 'pay_success',
    nonceStr: event.nonceStr || Math.random().toString(36).slice(2) + Date.now().toString(36),
    tradeType: 'JSAPI'
  })
}
