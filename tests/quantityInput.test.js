const assert = require('node:assert/strict')
const test = require('node:test')
const { parsePositiveInteger } = require('../miniprogram/utils/quantityInput')

test('accepts integer quantities in the supported range', () => {
  assert.equal(parsePositiveInteger('1'), 1)
  assert.equal(parsePositiveInteger('24'), 24)
  assert.equal(parsePositiveInteger('999'), 999)
})

test('rejects empty, fractional, non-numeric, and out-of-range quantities', () => {
  for (const value of ['', '0', '1000', '2.5', '-1', 'abc']) {
    assert.equal(parsePositiveInteger(value), null, `expected ${JSON.stringify(value)} to be rejected`)
  }
})
