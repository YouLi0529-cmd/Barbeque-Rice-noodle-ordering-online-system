function parsePositiveInteger(value) {
  const raw = String(value == null ? '' : value).trim()
  if (!/^\d+$/.test(raw)) return null
  const count = Number(raw)
  return Number.isSafeInteger(count) && count >= 1 && count <= 999 ? count : null
}

module.exports = { parsePositiveInteger }
