const TENANT_ID = 'zhangnan'
const AUTH_TOKEN_KEY = 'tenantAuthToken'
const AUTH_EXPIRES_AT_KEY = 'tenantAuthExpiresAt'
const ADMIN_AUTH_TOKEN_KEY = 'adminAuthToken'

// Fill this with the HTTP trigger URL of cloudfunctions/tenantApi after deployment.
// Example: https://xxxx.service.tcloudbase.com/tenantApi
const API_BASE_URL = 'https://zmbbq-d0ggmremua04f027d-1449718669.ap-shanghai.app.tcloudbase.com/tenantApi'

function getBaseUrl() {
  const override = wx.getStorageSync('tenantApiBaseUrl')
  if (override) return override

  // Local development must opt in to a test endpoint. This prevents requests
  // from the developer build from silently reaching the production backend.
  try {
    const accountInfo = wx.getAccountInfoSync()
    if (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion === 'develop') return ''
  } catch (err) {
    // Fail closed when the runtime cannot identify the current build.
    return ''
  }
  return API_BASE_URL
}

function getDisabledMessage() {
  try {
    const accountInfo = wx.getAccountInfoSync()
    if (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion === 'develop') {
      return '\u672c\u5730\u5f00\u53d1\u73af\u5883\u5df2\u963b\u6b62\u8bbf\u95ee\u6b63\u5f0f\u4e91\u51fd\u6570\uff0c\u8bf7\u5148\u914d\u7f6e cloud1 \u7684 tenantApi \u5730\u5740'
    }
  } catch (err) {
    // Fall through to the generic message.
  }
  return 'TENANT_API_DISABLED'
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

function getAdminAuthToken() {
  return wx.getStorageSync(ADMIN_AUTH_TOKEN_KEY) || ''
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
    return Promise.reject(new Error(getDisabledMessage()))
  }

  return new Promise((resolve, reject) => {
    const token = getAuthToken()
    const adminToken = getAdminAuthToken()
    wx.request({
      url: getBaseUrl(),
      method: 'POST',
      data: {
        tenantId: TENANT_ID,
        authToken: token,
        adminAuthToken: adminToken,
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

        const error = new Error(result.message || `request failed: ${res.statusCode}`)
        error.code = result.code || ''
        error.data = result
        error.statusCode = res.statusCode
        reject(error)
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

function login() {
  if (!isEnabled()) {
    return Promise.reject(new Error(getDisabledMessage()))
  }

  return new Promise((resolve, reject) => {
    wx.login({
      success(loginRes) {
        if (!loginRes.code) {
          reject(new Error('wx.login failed'))
          return
      }
      call('auth.login', {
        code: loginRes.code,
        // The backend only resumes this token after confirming that the
        // current WeChat OpenID is the same one that created the session.
        resumeToken: getAuthToken()
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
  ADMIN_AUTH_TOKEN_KEY,
  getBaseUrl,
  isEnabled,
  getAuthToken,
  getAdminAuthToken,
  setAuth,
  clearAuth,
  call,
  login
}
