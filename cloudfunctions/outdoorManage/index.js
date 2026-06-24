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

async function getGrills(event) {
  const outdoorPointId = event.outdoorPointId || 'main'
  const res = await db.collection('outdoorGrill')
    .where({
      outdoorPointId,
      status: 'available'
    })
    .orderBy('sort', 'asc')
    .limit(100)
    .get()
  return ok(res.data || [], '查询成功')
}

async function listGrills(event) {
  const outdoorPointId = event.outdoorPointId || 'main'
  const res = await db.collection('outdoorGrill')
    .where({ outdoorPointId })
    .orderBy('sort', 'asc')
    .limit(100)
    .get()
  return ok(res.data || [], '查询成功')
}

async function addGrill(event) {
  const name = event.name || ''
  if (!name) return fail('请填写烤架名称')
  const data = {
    name,
    outdoorPointId: event.outdoorPointId || 'main',
    status: event.status || 'available',
    sort: Number(event.sort || 0),
    createTime: db.serverDate(),
    updateTime: db.serverDate()
  }
  const addRes = await db.collection('outdoorGrill').add({ data })
  return ok({ _id: addRes._id, ...data }, '创建成功')
}

async function updateGrillStatus(event) {
  if (!event.id) return fail('缺少烤架ID')
  await db.collection('outdoorGrill').doc(event.id).update({
    data: {
      status: event.status || 'available',
      updateTime: db.serverDate()
    }
  })
  return ok({ _id: event.id, status: event.status || 'available' }, '更新成功')
}

async function createOutdoorOrder(event, context) {
  const wxContext = cloud.getWXContext()
  const goods = event.goods || []
  if (!event.grillId || !event.grillName) return fail('请选择烤架')
  if (!goods.length) return fail('请选择菜品')

  const userInfo = event.userInfo || {}
  const totalPrice = Number(event.totalPrice || 0)
  const finalPrice = Number(event.finalPrice || totalPrice)
  const orderData = {
    type: 'order',
    orderType: 'outdoor',
    outdoorPointId: event.outdoorPointId || 'main',
    grillId: event.grillId,
    grillName: event.grillName,
    pickupType: 'customer_pickup',
    goods,
    totalPrice,
    finalPrice,
    status: 'pending_prepare',
    pay_status: false,
    payStatus: false,
    createTime: db.serverDate(),
    _openid: wxContext.OPENID,
    userNickName: userInfo.nickName || '',
    userAvatar: userInfo.avatarUrl || '',
    userPhone: userInfo.phoneNumber || ''
  }

  const orderRes = await db.collection('order').add({ data: orderData })

  if (event.grillId.indexOf('default-') !== 0) {
    try {
      await db.collection('outdoorGrill').doc(event.grillId).update({
        data: {
          status: 'occupied',
          currentOrderId: orderRes._id,
          updateTime: db.serverDate()
        }
      })
    } catch (err) {
      console.warn('更新烤架占用状态失败', err)
    }
  }

  return ok({ orderId: orderRes._id, order: { _id: orderRes._id, ...orderData } }, '订单已提交')
}

async function listOutdoorOrders(event) {
  const res = await db.collection('order')
    .where({
      type: 'order',
      orderType: 'outdoor'
    })
    .orderBy('createTime', 'desc')
    .limit(event.limit || 100)
    .get()
  return ok(res.data || [], '查询成功')
}

async function updateOutdoorOrderStatus(event) {
  if (!event.id) return fail('缺少订单ID')
  const data = {
    status: event.status,
    updateTime: db.serverDate()
  }
  if (event.status === 'paid') {
    data.pay_status = true
    data.payStatus = true
    data.payTime = db.serverDate()
  }
  await db.collection('order').doc(event.id).update({ data })
  return ok({ _id: event.id, status: event.status }, '更新成功')
}

async function releaseGrill(event) {
  if (!event.grillId) return fail('缺少烤架ID')
  await db.collection('outdoorGrill').doc(event.grillId).update({
    data: {
      status: 'available',
      currentOrderId: '',
      updateTime: db.serverDate()
    }
  })
  return ok({ grillId: event.grillId }, '释放成功')
}

exports.main = async (event, context) => {
  const action = event.action
  try {
    if (action === 'getGrills') return await getGrills(event)
    if (action === 'listGrills') return await listGrills(event)
    if (action === 'addGrill') return await addGrill(event)
    if (action === 'updateGrillStatus') return await updateGrillStatus(event)
    if (action === 'createOutdoorOrder') return await createOutdoorOrder(event, context)
    if (action === 'listOutdoorOrders') return await listOutdoorOrders(event)
    if (action === 'updateOutdoorOrderStatus') return await updateOutdoorOrderStatus(event)
    if (action === 'releaseGrill') return await releaseGrill(event)
    return fail('未知操作')
  } catch (err) {
    console.error('outdoorManage error', err)
    return fail(err.message || '户外烧烤操作失败')
  }
}
