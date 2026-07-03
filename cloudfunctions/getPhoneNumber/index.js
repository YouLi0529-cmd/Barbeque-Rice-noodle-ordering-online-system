const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event) => {
  const { code } = event

  if (!code) {
    return {
      success: false,
      message: '缺少手机号授权码'
    }
  }

  try {
    const result = await cloud.openapi.phonenumber.getPhoneNumber({
      code
    })

    const phoneNumber = result && result.phoneInfo && result.phoneInfo.phoneNumber

    if (!phoneNumber) {
      return {
        success: false,
        message: '获取手机号失败'
      }
    }

    return {
      success: true,
      phoneNumber
    }
  } catch (err) {
    console.error('getPhoneNumber failed', err)
    return {
      success: false,
      message: err.message || '获取手机号失败'
    }
  }
}
