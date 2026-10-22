const GROUP_BUY_KEY = 'group-buy'

function todayBeijing() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function validateSalesFilters(startDate, endDate, categoryKey) {
  if (!startDate || !endDate) return '请选择查询时间段'
  const validDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(value + 'T00:00:00.000Z')
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  }
  if (!validDate(startDate) || !validDate(endDate)) return '查询日期无效'
  if (endDate < startDate) return '结束日期不能早于开始日期'
  if (!categoryKey) return '请选择查询品类'
  return ''
}

function mergeCategories(current, incoming) {
  const map = new Map(current.filter(item => item.key !== GROUP_BUY_KEY).map(item => [item.key, item]))
  for (const item of incoming) {
    const old = map.get(item.key)
    if (!old || old.historical || !item.historical) map.set(item.key, item)
  }
  const categories = [...map.values()].sort((a, b) => {
    if (!!a.historical !== !!b.historical) return a.historical ? 1 : -1
    return (Number(a.sort || 0) - Number(b.sort || 0)) || String(a.name).localeCompare(String(b.name), 'zh-CN')
  }).map(item => ({ ...item, label: item.name + (item.historical ? '（历史分类）' : '') }))
  return [{ key: GROUP_BUY_KEY, name: '团购', label: '团购' }, ...categories]
}

function mergeSalesRows(map, incoming) {
  for (const item of incoming) {
    if (!item.id || !Number.isSafeInteger(item.quantity) || item.quantity < 0 ||
        !Number.isSafeInteger(item.amountCents) || item.amountCents < 0) throw new Error('查询返回数据不完整，请重新查询')
    const prior = map.get(item.id) || { id: item.id, name: item.name, quantity: 0, amountCents: 0 }
    const quantity = prior.quantity + item.quantity
    const amountCents = prior.amountCents + item.amountCents
    if (!Number.isSafeInteger(quantity) || !Number.isSafeInteger(amountCents)) throw new Error('统计数值超出安全范围')
    map.set(item.id, { ...prior, name: prior.name || item.name || item.id, quantity, amountCents })
  }
}

function buildSalesResult(map) {
  const rows = [...map.values()].sort((a, b) => b.quantity - a.quantity || String(a.name).localeCompare(String(b.name), 'zh-CN'))
  let quantity = 0, amountCents = 0
  for (const row of rows) {
    quantity += row.quantity
    amountCents += row.amountCents
    if (!Number.isSafeInteger(quantity) || !Number.isSafeInteger(amountCents)) throw new Error('统计数值超出安全范围')
  }
  const money = cents => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
  return { rows: rows.map(row => ({ ...row, amountText: money(row.amountCents) })),
    quantity, amountText: money(amountCents) }
}

module.exports = { GROUP_BUY_KEY, todayBeijing, validateSalesFilters, mergeCategories, mergeSalesRows, buildSalesResult }
