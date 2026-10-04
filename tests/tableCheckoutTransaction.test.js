const assert = require('node:assert/strict')
const test = require('node:test')
const {
  runTransactionSequentially,
  runTransactionWithBusyRetry
} = require('../cloudfunctions/tenantApi/tableCheckoutTransaction')

test('transaction operations run one at a time and preserve results', async () => {
  let active = 0
  const order = []
  const results = await runTransactionSequentially([1, 2, 3], async value => {
    active += 1
    assert.equal(active, 1)
    order.push(`start-${value}`)
    await Promise.resolve()
    order.push(`end-${value}`)
    active -= 1
    return value * 2
  })

  assert.deepEqual(results, [2, 4, 6])
  assert.deepEqual(order, ['start-1', 'end-1', 'start-2', 'end-2', 'start-3', 'end-3'])
})

test('retries a transaction busy failure with bounded delays', async () => {
  let attempts = 0
  const delays = []
  const result = await runTransactionWithBusyRetry(async callback => {
    attempts += 1
    if (attempts < 3) throw new Error('ResourceUnavailable.TransactionBusy')
    return callback({ id: 'transaction' })
  }, transaction => transaction.id, {
    sleep: async delay => delays.push(delay)
  })

  assert.equal(result, 'transaction')
  assert.equal(attempts, 3)
  assert.deepEqual(delays, [120, 300])
})

test('does not retry non-busy transaction errors', async () => {
  let attempts = 0
  await assert.rejects(() => runTransactionWithBusyRetry(async () => {
    attempts += 1
    throw new Error('permission denied')
  }, () => undefined, { sleep: async () => {} }), /permission denied/)
  assert.equal(attempts, 1)
})
