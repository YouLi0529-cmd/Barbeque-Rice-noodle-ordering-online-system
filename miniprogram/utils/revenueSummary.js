// Financial rules mirror the existing business overview. Parity is regression-tested.
function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function getTimeValue(value) {
  if (!value) return 0
  const source = value && value.$date ? value.$date : value
  const date = source instanceof Date ? source : new Date(source)
  const time = date.getTime()
  return Number.isNaN(time) ? 0 : time
}

function isAdminPaidOrder(order) {
  const status = String(order && order.status || '')
  return order && (
    order.pay_status === true ||
    order.payStatus === true ||
    status === 'paid' ||
    status === 'completed'
  )
}

function isCampingOrder(order = {}) {
  return order.orderScene === 'camping' || order.orderType === 'camping'
}

function getBusinessStatsPaidTime(order = {}) {
  return getTimeValue(
    order.checkoutAt ||
    order.paidAt ||
    order.payTime ||
    order.finishTime ||
    order.completedAt ||
    order.updateTime
  )
}

function getBusinessStatsGroupKey(order = {}) {
  const scene = isCampingOrder(order) ? 'camping' : 'dineIn'
  const checkoutBatchId = String(order.checkoutBatchId || '').trim()
  if (checkoutBatchId) return `${scene}:checkout:${checkoutBatchId}`
  const tableGroupId = String(order.tableGroupId || '').trim()
  if (scene === 'dineIn' && tableGroupId) return `table-group:${tableGroupId}`
  return `${scene}:${String(order.rootOrderId || order._id || '')}`
}

function isAllocatedJointCheckoutOrder(order = {}) {
  return !!String(order && order.jointCheckoutId || '').trim() &&
    Number(order && order.jointCheckoutAllocationVersion || 0) >= 1
}

function isJointCheckoutGroup(orders = []) {
  // Older joint checkouts keep one payment record and cannot be safely edited.
  // New checkouts allocate that payment to each table, so they behave as normal
  // settlement records while retaining jointCheckoutId as audit metadata.
  return (orders || []).some(order => {
    return !!String(order && order.jointCheckoutId || '').trim() && !isAllocatedJointCheckoutOrder(order)
  })
}

function getJointCheckoutPaymentBreakdown(payment = {}) {
  const total = roundMoney(Math.max(0, Number(payment.receivable) || 0))
  const cashAmount = Number(payment.cashAmount)
  const onlineAmount = Number(payment.onlineAmount)
  if (Number.isFinite(cashAmount) && cashAmount >= 0 && Number.isFinite(onlineAmount) && onlineAmount >= 0) {
    const cash = roundMoney(cashAmount)
    const online = roundMoney(onlineAmount)
    if (cash + online <= total + 0.01) {
      return { cash, online, other: roundMoney(Math.max(0, total - cash - online)) }
    }
  }
  const paymentMethod = String(payment.paymentMethod || '').trim()
  if (paymentMethod === 'cash') return { cash: total, online: 0, other: 0 }
  if (['wechat_alipay', 'wechat', 'alipay', 'online'].includes(paymentMethod)) return { cash: 0, online: total, other: 0 }
  return { cash: 0, online: 0, other: total }
}

function getBusinessStatsGroupRevenue(orders = []) {
  const storedAmounts = orders
    .map(order => {
      const value = order.checkoutReceivable !== undefined && order.checkoutReceivable !== ''
        ? order.checkoutReceivable
        : order.receivedAmount
      return Number(value)
    })
    .filter(amount => Number.isFinite(amount) && amount >= 0)

  if (storedAmounts.length > 0) {
    // A table checkout stores the same group receivable on every add-on card.
    return roundMoney(Math.max(...storedAmounts))
  }

  const total = roundMoney(orders.reduce((sum, order) => {
    return sum + Number(order.finalPrice || order.totalPrice || 0)
  }, 0))
  const discountOrder = orders.find(order => {
    return (order.discountValue !== undefined && order.discountValue !== '') ||
      (order.directReduceValue !== undefined && order.directReduceValue !== '') ||
      order.discountType
  }) || {}
  const discountType = String(discountOrder.discountType || '')
  const discountValue = Number(discountOrder.discountValue)
  const directReduceValue = Number(discountOrder.directReduceValue)
  const afterDiscount = (discountType === 'discount' || discountType === 'reduce') &&
    Number.isFinite(discountValue) && discountValue >= 0 && discountValue <= 10
    ? roundMoney(total * discountValue / 10)
    : total

  return Number.isFinite(directReduceValue) && directReduceValue >= 0
    ? roundMoney(Math.max(0, afterDiscount - directReduceValue))
    : afterDiscount
}

function getBusinessStatsPaymentBreakdown(orders = [], groupRevenue = 0) {
  // Older joint checkouts keep their one payment in checkoutPayment. Newer
  // allocated joint checkouts pass through as ordinary per-table settlements.
  if (isJointCheckoutGroup(orders)) return { cash: 0, online: 0, other: 0 }

  const total = roundMoney(groupRevenue)
  const source = orders.find(order => order.checkoutCashAmount !== undefined || order.checkoutOnlineAmount !== undefined) || {}
  const cashAmount = Number(source.checkoutCashAmount)
  const onlineAmount = Number(source.checkoutOnlineAmount)

  if (Number.isFinite(cashAmount) && cashAmount >= 0 && Number.isFinite(onlineAmount) && onlineAmount >= 0) {
    const normalizedCash = roundMoney(cashAmount)
    const normalizedOnline = roundMoney(onlineAmount)
    const knownAmount = roundMoney(normalizedCash + normalizedOnline)
    if (knownAmount <= total + 0.01) {
      return {
        cash: normalizedCash,
        online: normalizedOnline,
        other: roundMoney(Math.max(0, total - knownAmount))
      }
    }
  }

  const paymentMethod = String((orders.find(order => order.paymentMethod || order.payMethod) || {}).paymentMethod ||
    (orders.find(order => order.payMethod) || {}).payMethod || '').trim()
  if (paymentMethod === 'cash') return { cash: total, online: 0, other: 0 }
  if (['wechat_alipay', 'wechat', 'alipay', 'online'].includes(paymentMethod)) return { cash: 0, online: total, other: 0 }
  return { cash: 0, online: 0, other: total }
}

function getCombinedSettlementEvents(order = {}) {
  if (!order || order.deleted === true || !Array.isArray(order.combinedSettlementEvents)) return []
  return order.combinedSettlementEvents
    .filter(event => event && event.type === 'combined_checkout')
    .map(event => {
      const receivedAmount = Number(event.receivedAmount)
      const amount = Number.isFinite(receivedAmount) && receivedAmount >= 0
        ? roundMoney(receivedAmount)
        : 0
      return {
        id: String(event.id || '').trim(),
        settledAt: getTimeValue(event.settledAt),
        amount,
        cashAmount: Number(event.cashAmount),
        onlineAmount: Number(event.onlineAmount),
        paymentMethod: String(event.paymentMethod || '').trim(),
        dishes: Array.isArray(event.dishes) ? event.dishes : []
      }
    })
}

function getCombinedSettlementEventPaymentBreakdown(event = {}) {
  const total = roundMoney(Math.max(0, Number(event.amount) || 0))
  const cashAmount = Number(event.cashAmount)
  const onlineAmount = Number(event.onlineAmount)
  if (Number.isFinite(cashAmount) && cashAmount >= 0 && Number.isFinite(onlineAmount) && onlineAmount >= 0) {
    const cash = roundMoney(cashAmount)
    const online = roundMoney(onlineAmount)
    if (cash + online <= total + 0.01) {
      return { cash, online, other: roundMoney(Math.max(0, total - cash - online)) }
    }
  }
  if (event.paymentMethod === 'cash') return { cash: total, online: 0, other: 0 }
  if (['wechat_alipay', 'wechat', 'alipay', 'online'].includes(event.paymentMethod)) {
    return { cash: 0, online: total, other: 0 }
  }
  return { cash: 0, online: 0, other: total }
}


function summarizeRevenue(orders, payments, interval) {
  const groups = new Map()
  const events = new Map()
  const jointPayments = new Map()
  const within = time => time > 0 && time >= interval.startAt && time < interval.endAt
  for (const order of orders) {
    for (const event of getCombinedSettlementEvents(order)) {
      if (event.id && within(event.settledAt)) events.set(event.id, event)
    }
    if (!isAdminPaidOrder(order) || order.deleted === true || !within(getBusinessStatsPaidTime(order))) continue
    const key = getBusinessStatsGroupKey(order)
    if (!key || key.endsWith(':')) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(order)
  }
  let totalRevenue = 0
  let cashRevenue = 0
  let onlineRevenue = 0
  const addPayment = payment => {
    cashRevenue = roundMoney(cashRevenue + payment.cash)
    onlineRevenue = roundMoney(onlineRevenue + payment.online)
  }
  for (const rows of groups.values()) {
    const amount = getBusinessStatsGroupRevenue(rows)
    totalRevenue += amount
    addPayment(getBusinessStatsPaymentBreakdown(rows, amount))
  }
  totalRevenue = roundMoney(totalRevenue)
  let partialRevenue = 0
  for (const event of events.values()) {
    partialRevenue += event.amount
    addPayment(getCombinedSettlementEventPaymentBreakdown(event))
  }
  for (const payment of payments) {
    if (!payment || payment.deleted === true || payment.type !== 'joint_checkout' || String(payment.allocationMode || '').trim() === 'per_table') continue
    const id = String(payment.jointCheckoutId || payment._id || '').trim()
    if (id && within(getTimeValue(payment.checkoutAt || payment.createTime || payment.updateTime))) jointPayments.set(id, payment)
  }
  for (const payment of jointPayments.values()) addPayment(getJointCheckoutPaymentBreakdown(payment))
  return { totalRevenue: roundMoney(totalRevenue + roundMoney(partialRevenue)), cashRevenue, onlineRevenue }
}

module.exports = { summarizeRevenue }
