const CLOUD_ENV_ID = 'zmbbq-d0ggmremua04f027d'
const COLLECTION = 'tableBoardSignal'
const SIGNAL_ID = 'zhangnan'

let initialized = false

function ensureCloudInitialized() {
  if (!wx.cloud || typeof wx.cloud.init !== 'function' || typeof wx.cloud.database !== 'function') {
    return false
  }

  if (!initialized) {
    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true
    })
    initialized = true
  }

  return true
}

function watch(onChange, onError) {
  if (!ensureCloudInitialized()) return null

  try {
    const db = wx.cloud.database({ env: CLOUD_ENV_ID })
    return db.collection(COLLECTION).doc(SIGNAL_ID).watch({
      onChange(snapshot) {
        const docs = Array.isArray(snapshot && snapshot.docs) ? snapshot.docs : []
        const signal = docs[0] || null
        if (typeof onChange === 'function') onChange(signal, snapshot || {})
      },
      onError(err) {
        if (typeof onError === 'function') onError(err)
      }
    })
  } catch (err) {
    if (typeof onError === 'function') onError(err)
    return null
  }
}

module.exports = {
  watch
}
