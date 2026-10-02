function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function createPatchId() {
  return `cart_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

async function retryWithBackoff(task, options = {}) {
  const maxAttempts = Math.max(1, Math.floor(Number(options.maxAttempts) || 3))
  const delays = Array.isArray(options.delays) ? options.delays : [250, 600]
  let lastError

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await task(attempt)
    } catch (err) {
      lastError = err
      if (attempt + 1 >= maxAttempts) break
      if (typeof options.shouldRetry === 'function' && !options.shouldRetry(err)) break
      await delay(Math.max(0, Number(delays[attempt]) || 0))
    }
  }

  throw lastError || new Error('shared cart sync failed')
}

function normalizeCount(value) {
  const count = Math.floor(Number(value) || 0)
  return count > 0 ? count : 0
}

function getCartCountMap(cart = {}) {
  const counts = {}
  Object.keys(cart || {}).forEach(cartKey => {
    const count = normalizeCount(cart[cartKey] && cart[cartKey].count)
    if (count > 0) counts[cartKey] = count
  })
  return counts
}

function getSharedItemCountMap(items = []) {
  const counts = {}
  ;(Array.isArray(items) ? items : []).forEach(item => {
    const cartKey = String(item && item.cartKey || '').trim()
    const count = normalizeCount(item && item.count)
    if (cartKey && count > 0) counts[cartKey] = count
  })
  return counts
}

function hasSameCartCounts(cart, items) {
  const expected = getCartCountMap(cart)
  const actual = getSharedItemCountMap(items)
  const expectedKeys = Object.keys(expected).sort()
  const actualKeys = Object.keys(actual).sort()
  return expectedKeys.length === actualKeys.length &&
    expectedKeys.every((key, index) => key === actualKeys[index] && expected[key] === actual[key])
}

module.exports = {
  createPatchId,
  retryWithBackoff,
  getCartCountMap,
  getSharedItemCountMap,
  hasSameCartCounts
}
