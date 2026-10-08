const CLOUD_ENV_ID = 'zmbbq-d0ggmremua04f027d'
const TABLE_BOARD_SIGNAL_COLLECTION = 'tableBoardSignal'
const TABLE_BOARD_SIGNAL_ID = '__admin_table_board_signal__'

let initialized = false
let unavailable = false

function init() {
  if (initialized) return true
  if (unavailable || !wx.cloud || typeof wx.cloud.init !== 'function') return false

  try {
    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true
    })
    initialized = true
    return true
  } catch (err) {
    unavailable = true
    console.warn('cloud realtime init failed', err)
    return false
  }
}

function getDatabase() {
  if (!init()) return null
  try {
    // Do not rely on the DevTools default cloud environment. This listener
    // must read the same environment that tenantApi writes its marker to.
    return wx.cloud.database({
      config: { env: CLOUD_ENV_ID }
    })
  } catch (err) {
    console.warn('cloud realtime database unavailable', err)
    return null
  }
}

module.exports = {
  CLOUD_ENV_ID,
  TABLE_BOARD_SIGNAL_COLLECTION,
  TABLE_BOARD_SIGNAL_ID,
  init,
  getDatabase
}
