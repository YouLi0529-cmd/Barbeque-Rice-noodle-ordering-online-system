const ORDER_FIELDS = Object.fromEntries([
  '_id', 'type', 'deleted', 'orderScene', 'orderType', 'tableNumber', 'status',
  'createTime', 'peopleCount', 'rootOrderId', 'tableGroupId', 'tableVisitId',
  'checkoutBatchId', 'tableCleared', 'pay_status', 'payStatus'
].map(key => [key, true]))

const SESSION_FIELDS = Object.fromEntries([
  '_id', 'tableNumber', 'peopleConfirmed', 'peopleCount', 'peopleConfirmedAt',
  'createTime', 'updateTime', 'status', 'checkoutStatus', 'mergedIntoSessionId',
  'activeOrderRootId', 'tableGroupId', 'visitId', 'checkoutBatchId'
].map(key => [key, true]))

function createTableArrivalReader({ db, _ }) {
  async function readAll(collection, condition, fields) {
    const upperResult = await db.collection(collection).where(condition)
      .field({ _id: true }).orderBy('_id', 'desc').limit(1).get()
    const upperId = upperResult.data && upperResult.data[0] && upperResult.data[0]._id
    if (!upperId) return []
    const records = []
    let lastId = ''
    while (true) {
      const bounds = [{ _id: _.lte(upperId) }]
      if (lastId) bounds.push({ _id: _.gt(lastId) })
      const result = await db.collection(collection).where(_.and([condition, ...bounds]))
        .field(fields).orderBy('_id', 'asc').limit(1000).get()
      const rows = result.data || []
      // End on an empty page, including environments that cap page sizes below 1000.
      if (!rows.length) return records
      const nextId = rows[rows.length - 1]._id
      if (!nextId || nextId <= lastId) throw new Error('到店人数分页未推进，请重试')
      records.push(...rows)
      lastId = nextId
    }
  }

  function dated(field, startAt, endAt) {
    return [{ [field]: _.gte(new Date(startAt)) }, { [field]: _.lt(new Date(endAt)) }]
  }

  function missingTime(field) {
    return _.or([{ [field]: _.exists(false) }, { [field]: _.in([null, '', 0, false]) }])
  }

  function orders(startAt, endAt) {
    return readAll('order', _.and([
      { type: 'order' }, ...dated('createTime', startAt, endAt)
    ]), ORDER_FIELDS)
  }

  async function sessions(startAt, endAt) {
    // Preserve peopleConfirmedAt || createTime || updateTime for older sessions.
    const records = new Map()
    const timeFields = ['peopleConfirmedAt', 'createTime', 'updateTime']
    for (let index = 0; index < timeFields.length; index++) {
      const condition = _.and([
        { peopleConfirmed: true },
        ...timeFields.slice(0, index).map(missingTime),
        ...dated(timeFields[index], startAt, endAt)
      ])
      const rows = await readAll('tableOrderSession', condition, SESSION_FIELDS)
      for (const row of rows) records.set(row._id, row)
    }
    return [...records.values()]
  }

  return { orders, sessions }
}

module.exports = { createTableArrivalReader }
