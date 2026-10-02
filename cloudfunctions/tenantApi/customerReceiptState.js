function text(value) {
  return String(value || '').trim()
}

function getCustomerReceiptOrderId(session = {}, currentOrderId = '', fallbackRootOrderId = '') {
  return text(session.customerReceiptOrderId) ||
    text(session.activeOrderRootId) ||
    text(fallbackRootOrderId) ||
    text(currentOrderId)
}

function buildCustomerReceiptSessionFields(session = {}, receiptOrderId = '') {
  const orderId = text(receiptOrderId)
  const sameOrder = orderId && text(session.customerReceiptOrderId) === orderId
  const alreadyCreated = sameOrder && (
    session.customerReceiptStatus === 'task_created' || session.customerReceiptStatus === 'queued'
  )

  return {
    customerReceiptOrderId: orderId,
    customerReceiptStatus: alreadyCreated ? session.customerReceiptStatus : 'pending',
    customerReceiptJobIds: alreadyCreated && Array.isArray(session.customerReceiptJobIds)
      ? session.customerReceiptJobIds
      : [],
    customerReceiptAttemptCount: sameOrder
      ? Math.max(0, Math.floor(Number(session.customerReceiptAttemptCount) || 0))
      : 0
  }
}

function getCustomerReceiptEventKey(receiptOrderId) {
  const orderId = text(receiptOrderId)
  return orderId ? `auto-submit:${orderId}` : ''
}

async function retryCustomerReceiptQueue(task, options = {}) {
  const maxAttempts = Math.max(1, Math.floor(Number(options.maxAttempts) || 3))
  const delays = Array.isArray(options.delays) ? options.delays : [200, 500]
  const wait = typeof options.wait === 'function'
    ? options.wait
    : ms => new Promise(resolve => setTimeout(resolve, ms))
  let result = null
  let lastError = ''

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      result = await task(attempt)
      if (result && result.skipped) return result
      if (result && !result.error && Array.isArray(result.jobs) && result.jobs.length > 0) return result
      lastError = result && result.error || 'customer receipt task was not created'
    } catch (err) {
      lastError = err && err.message || 'customer receipt task creation failed'
    }
    if (attempt + 1 < maxAttempts) {
      await wait(Math.max(0, Number(delays[attempt]) || 0))
    }
  }

  return {
    ...(result || {}),
    jobs: result && Array.isArray(result.jobs) ? result.jobs : [],
    error: lastError
  }
}

module.exports = {
  getCustomerReceiptOrderId,
  buildCustomerReceiptSessionFields,
  getCustomerReceiptEventKey,
  retryCustomerReceiptQueue
}
