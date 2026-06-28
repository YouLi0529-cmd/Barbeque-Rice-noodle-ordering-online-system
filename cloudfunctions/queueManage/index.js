// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-d9gapt5hcfe195b65' })

const db = cloud.database()
const _ = db.command

function ok(data = null, message = 'ok') {
  return { success: true, data, message }
}

function fail(message = '操作失败') {
  return { success: false, data: null, message }
}

function formatDate(date) {
  const pad = n => (n < 10 ? `0${n}` : `${n}`)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

async function createQueue(event) {
  const now = new Date()
  const createDate = formatDate(now)
  const countRes = await db.collection('queue')
    .where({ createDate })
    .count()
  const sequenceNo = (countRes.total || 0) + 1
  const queueNo = `Q${String(sequenceNo).padStart(3, '0')}`

  const waitingRes = await db.collection('queue')
    .where({
      createDate,
      status: 'waiting'
    })
    .count()

  const data = {
    queue_no: queueNo,
    sequenceNo,
    people_count: Number(event.people_count || 0),
    table_type: event.table_type || '',
    nickname: event.nickname || '',
    phone: event.phone || '',
    status: 'waiting',
    createDate,
    createTime: db.serverDate(),
    callTime: null,
    seatedTime: null
  }

  const addRes = await db.collection('queue').add({ data })
  return ok({
    _id: addRes._id,
    ...data,
    statusText: '等待中',
    waitingBefore: waitingRes.total || 0
  }, '取号成功')
}

async function listQueue(event) {
  const statuses = event.statuses || ['waiting', 'called', 'skipped']
  const res = await db.collection('queue')
    .where({
      status: _.in(statuses)
    })
    .orderBy('createTime', 'asc')
    .limit(event.limit || 100)
    .get()
  return ok(res.data || [], '查询成功')
}

async function updateQueueStatus(id, status, extraData = {}) {
  if (!id) return fail('缺少队列记录ID')
  await db.collection('queue').doc(id).update({
    data: {
      status,
      ...extraData,
      updateTime: db.serverDate()
    }
  })
  return ok({ _id: id, status }, '更新成功')
}

async function countWaitingBefore(event) {
  if (!event.id) return fail('缺少队列记录ID')
  const doc = await db.collection('queue').doc(event.id).get()
  const queue = doc.data
  if (!queue) return fail('队列记录不存在')

  const res = await db.collection('queue')
    .where({
      createDate: queue.createDate,
      status: 'waiting',
      sequenceNo: _.lt(queue.sequenceNo || 0)
    })
    .count()

  return ok({ waitingBefore: res.total || 0 }, '查询成功')
}

exports.main = async (event) => {
  const action = event.action
  try {
    if (action === 'create') return await createQueue(event)
    if (action === 'list') return await listQueue(event)
    if (action === 'call') return await updateQueueStatus(event.id, 'called', { callTime: db.serverDate() })
    if (action === 'skip') return await updateQueueStatus(event.id, 'skipped')
    if (action === 'seat') return await updateQueueStatus(event.id, 'seated', { seatedTime: db.serverDate() })
    if (action === 'cancel') return await updateQueueStatus(event.id, 'cancelled')
    if (action === 'countWaitingBefore') return await countWaitingBefore(event)
    return fail('未知操作')
  } catch (err) {
    console.error('queueManage error', err)
    return fail(err.message || '排队操作失败')
  }
}
