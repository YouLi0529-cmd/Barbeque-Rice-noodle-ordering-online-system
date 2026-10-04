function isTransactionBusyError(error) {
  const message = String(error && (error.message || error.errMsg || error.code) || error || '')
  return message.includes('TransactionBusy') || message.includes('transaction is busy')
}

async function runTransactionSequentially(items, operation) {
  const results = []
  const list = items || []
  for (let index = 0; index < list.length; index += 1) {
    results.push(await operation(list[index], index))
  }
  return results
}

async function runTransactionWithBusyRetry(runTransaction, callback, options = {}) {
  const delays = Array.isArray(options.delays) ? options.delays : [120, 300]
  const sleep = options.sleep || (delay => new Promise(resolve => setTimeout(resolve, delay)))

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await runTransaction(callback)
    } catch (error) {
      if (!isTransactionBusyError(error) || attempt >= delays.length) throw error
      await sleep(delays[attempt])
    }
  }
}

module.exports = {
  isTransactionBusyError,
  runTransactionSequentially,
  runTransactionWithBusyRetry
}
