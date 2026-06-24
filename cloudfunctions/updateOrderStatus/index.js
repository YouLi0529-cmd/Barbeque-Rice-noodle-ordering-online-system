// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: '填写你的环境ID' })

const db = cloud.database()

function ok(data = null, message = 'ok') {
  return { success: true, data, message }
}

function fail(message = '操作失败') {
  return { success: false, data: null, message }
}

async function updateStatus(event) {
  if (!event.id) return fail('缺少订单ID')
  if (!event.status) return fail('缺少订单状态')

  const data = {
    status: event.status,
    updateTime: db.serverDate()
  }

  await db.collection('order').doc(event.id).update({ data })
  return ok({ _id: event.id, status: event.status }, '状态已更新')
}

async function confirmOfflinePaid(event) {
  if (!event.id) return fail('缺少订单ID')

  const data = {
    pay_status: true,
    payStatus: true,
    status: event.status || 'paid',
    payMethod: 'offline',
    payTime: db.serverDate(),
    updateTime: db.serverDate()
  }

  await db.collection('order').doc(event.id).update({ data })
  return ok({ _id: event.id, pay_status: true, payStatus: true }, '已确认付款')
}

exports.main = async (event) => {
  const action = event.action
  try {
    if (action === 'updateStatus') return await updateStatus(event)
    if (action === 'confirmOfflinePaid') return await confirmOfflinePaid(event)
    return fail('未知操作')
  } catch (err) {
    console.error('updateOrderStatus error', err)
    return fail(err.message || '订单状态更新失败')
  }
}
