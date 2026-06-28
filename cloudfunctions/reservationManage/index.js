// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-d9gapt5hcfe195b65' })

const db = cloud.database()

function ok(data = null, message = 'ok') {
  return { success: true, data, message }
}

function fail(message = '操作失败') {
  return { success: false, data: null, message }
}

async function createReservation(event) {
  const data = {
    name: event.name || '',
    phone: event.phone || '',
    people_count: Number(event.people_count || 0),
    reserve_date: event.reserve_date || '',
    reserve_time: event.reserve_time || '',
    remark: event.remark || '',
    status: 'pending',
    createTime: db.serverDate(),
    updateTime: db.serverDate()
  }
  const addRes = await db.collection('reservation').add({ data })
  return ok({ _id: addRes._id, ...data }, '预约已提交')
}

async function listReservations(event) {
  let query = {}
  if (event.status) {
    query.status = event.status
  }
  const res = await db.collection('reservation')
    .where(query)
    .orderBy('createTime', 'desc')
    .limit(event.limit || 100)
    .get()
  return ok(res.data || [], '查询成功')
}

async function updateReservationStatus(id, status) {
  if (!id) return fail('缺少预约记录ID')
  await db.collection('reservation').doc(id).update({
    data: {
      status,
      updateTime: db.serverDate()
    }
  })
  return ok({ _id: id, status }, '更新成功')
}

exports.main = async (event) => {
  const action = event.action
  try {
    if (action === 'create') return await createReservation(event)
    if (action === 'list') return await listReservations(event)
    if (action === 'confirm') return await updateReservationStatus(event.id, 'confirmed')
    if (action === 'arrive') return await updateReservationStatus(event.id, 'arrived')
    if (action === 'cancel') return await updateReservationStatus(event.id, 'cancelled')
    return fail('未知操作')
  } catch (err) {
    console.error('reservationManage error', err)
    return fail(err.message || '预约操作失败')
  }
}
