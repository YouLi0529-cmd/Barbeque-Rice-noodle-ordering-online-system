const TENANT_ID = 'zhangnan'
const AUTH_TOKEN_KEY = 'tenantAuthToken'
const AUTH_EXPIRES_AT_KEY = 'tenantAuthExpiresAt'

// Fill this with the HTTP trigger URL of cloudfunctions/tenantApi after deployment.
// Example: https://xxxx.service.tcloudbase.com/tenantApi
const API_BASE_URL = 'https://zhrcloud-d1gsjuhij11024f72-1449718669.ap-shanghai.app.tcloudbase.com/tenantApi'

function getBaseUrl() {
  return wx.getStorageSync('tenantApiBaseUrl') || API_BASE_URL
}

function isEnabled() {
  return !!getBaseUrl()
}

function normalizeResponse(data) {
  if (typeof data !== 'string') return data || {}
  try {
    return JSON.parse(data)
  } catch (err) {
    return {}
  }
}

function getAuthToken() {
  return wx.getStorageSync(AUTH_TOKEN_KEY) || ''
}

function setAuth(data = {}) {
  if (data.token) {
    wx.setStorageSync(AUTH_TOKEN_KEY, data.token)
  }
  if (data.expiresAt) {
    wx.setStorageSync(AUTH_EXPIRES_AT_KEY, data.expiresAt)
  }
}

function clearAuth() {
  wx.removeStorageSync(AUTH_TOKEN_KEY)
  wx.removeStorageSync(AUTH_EXPIRES_AT_KEY)
}

function call(action, data = {}) {
  if (!isEnabled()) {
    return Promise.reject(new Error('TENANT_API_DISABLED'))
  }

  return new Promise((resolve, reject) => {
    const token = getAuthToken()
    wx.request({
      url: getBaseUrl(),
      method: 'POST',
      data: {
        tenantId: TENANT_ID,
        authToken: token,
        ...data,
        action
      },
      timeout: 15000,
      header: {
        'content-type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      success(res) {
        const result = normalizeResponse(res.data)
        if (res.statusCode >= 200 && res.statusCode < 300 && result.success !== false) {
          resolve(result)
          return
        }

        reject(new Error(result.message || `request failed: ${res.statusCode}`))
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

function login() {
  if (!isEnabled()) {
    return Promise.reject(new Error('TENANT_API_DISABLED'))
  }

  return new Promise((resolve, reject) => {
    wx.login({
      success(loginRes) {
        if (!loginRes.code) {
          reject(new Error('wx.login failed'))
          return
        }
        call('auth.login', {
          code: loginRes.code
        }).then(result => {
          if (result.data) {
            setAuth(result.data)
          }
          resolve(result)
        }).catch(reject)
      },
      fail: reject
    })
  })
}

module.exports = {
  TENANT_ID,
  API_BASE_URL,
  AUTH_TOKEN_KEY,
  getBaseUrl,
  isEnabled,
  getAuthToken,
  setAuth,
  clearAuth,
  call,
  login
}
