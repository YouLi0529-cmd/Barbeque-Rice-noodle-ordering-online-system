// Date-bounded reads for the existing business overview. No history-wide fallback.
function mergeBusinessStatsIntervals(intervals) {
  const sorted = intervals.map(({ startAt, endAt }) => {
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
      throw new Error('营业统计日期范围无效')
    }
    return { startAt, endAt }
  }).sort((left, right) => left.startAt - right.startAt)
  const merged = []
  for (const interval of sorted) {
    const previous = merged[merged.length - 1]
    if (previous && interval.startAt <= previous.endAt) previous.endAt = Math.max(previous.endAt, interval.endAt)
    else merged.push({ ...interval })
  }
  return merged
}

function createBusinessStatsReader({ db, _ }) {
  return async function readBusinessStatsRecords({ collection, type, tenantId, intervals }) {
    const records = new Map()
    for (const { startAt, endAt } of mergeBusinessStatsIntervals(intervals)) {
      const conditions = [
        { type, storeId: tenantId, deleted: _.neq(true) },
        { checkoutAt: _.gte(new Date(startAt)) },
        { checkoutAt: _.lt(new Date(endAt)) }
      ]
      const upperResult = await db.collection(collection).where(_.and(conditions))
        .field({ _id: true }).orderBy('_id', 'desc').limit(1).get()
      const upperId = upperResult.data && upperResult.data[0] && upperResult.data[0]._id
      if (!upperId) continue
      let lastId = ''
      while (true) {
        const bounds = [{ _id: _.lte(upperId) }]
        if (lastId) bounds.push({ _id: _.gt(lastId) })
        const result = await db.collection(collection).where(_.and([...conditions, ...bounds]))
          .orderBy('_id', 'asc').limit(100).get()
        const rows = result.data || []
        if (!rows.length) break
        for (const row of rows) records.set(row._id, row)
        const nextId = rows[rows.length - 1]._id
        if (nextId === lastId) throw new Error('营业统计分页未推进，请重试')
        lastId = nextId
      }
    }
    return [...records.values()]
  }
}

module.exports = { createBusinessStatsReader, mergeBusinessStatsIntervals }
