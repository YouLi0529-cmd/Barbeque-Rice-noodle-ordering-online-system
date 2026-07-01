// 浜戝嚱鏁板叆鍙ｆ枃浠?
const cloud = require('wx-server-sdk')
const TcbRouter = require('tcb-router')
const axios = require('axios')
const crypto = require('crypto')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const baseUrl = 'https://iot-device.trenditiot.com'
//璁块棶https://open.trenditiot.com 娉ㄥ唽鐧诲綍锛屽緱鍒癮ppid鍜宎ppsecret
const appid = '濉啓浣犵殑appid' // 濉啓浣犵殑appid
const appsecret = '濉啓浣犵殑appsecret' // 濉啓浣犵殑appsecret

// 鐢熸垚闅忔満瀛楃涓?
function getNonceStr() {
  return Math.random().toString(36).substr(2, 15) + Date.now().toString(36)
}

// 鐢熸垚绛惧悕
function getSign(uid, stime, appid, body) {
  const requestBody = JSON.stringify(body)
  const strToSign = `${uid}${appid}${stime}${appsecret}${requestBody}`
  const md5sum = crypto.createHash('md5')
  md5sum.update(strToSign)
  const signature = md5sum.digest('hex')
  return signature
}

// HTTP璇锋眰灏佽
async function request(options) {
  try {
    const response = await axios({
      url: options.url,
      method: options.method || 'GET',
      data: options.data,
      params: options.params,
      headers: options.headers || {},
      timeout: options.timeout || 30000
    })
    return response.data
  } catch (error) {
    if (error.response) {
      // 鏈嶅姟鍣ㄨ繑鍥炰簡閿欒鐘舵€佺爜
      throw {
        code: error.response.status,
        message: error.response.data?.message || error.message,
        data: error.response.data
      }
    } else if (error.request) {
      // 璇锋眰宸插彂閫佷絾娌℃湁鏀跺埌鍝嶅簲
      throw {
        code: -1,
        message: '缃戠粶璇锋眰澶辫触锛岃妫€鏌ョ綉缁滆繛鎺?
      }
    } else {
      // 璇锋眰閰嶇疆鍑洪敊
      throw {
        code: -1,
        message: error.message || '璇锋眰澶辫触'
      }
    }
  }
}

// 浜戝嚱鏁板叆鍙ｅ嚱鏁?
exports.main = async (event, context) => {
  const app = new TcbRouter({ event })

  // 鍏ㄥ眬涓棿浠?
  app.use(async (ctx, next) => {
    // ctx.data = {}
    ctx.event = event
    await next()
  })

  // 缁戝畾鎵撳嵃鏈?
  app.router('addPrinter', async (ctx, next) => {
    const { sn, key, name } = ctx.event
    const uid = getNonceStr()
    const time = new Date().getTime()
    const body = [{
      sn: sn,
      key: key,
      name: name || `鎵撳嵃鏈?{sn}`
    }]

    try {
      const result = await request({
        url: baseUrl + '/openapi/addPrinter',
        method: 'POST',
        data: body,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'appid': appid,
          'uid': uid,
          'stime': time,
          'sign': getSign(uid, time, appid, body)
        }
      })
      ctx.body = { success: true, data: result }
    } catch (error) {
      console.error('缁戝畾鎵撳嵃鏈哄け璐?, error)
      ctx.body = {
        success: false,
        error: error.message || '缁戝畾澶辫触',
        code: error.code,
        data: error.data
      }
    }
  })

  // 瑙ｇ粦鎵撳嵃鏈?
  app.router('delPrinter', async (ctx, next) => {
    const { sn } = ctx.event
    const uid = getNonceStr()
    const time = new Date().getTime()
    const body = Array.isArray(sn) ? sn : [sn]

    try {
      const result = await request({
        url: baseUrl + '/openapi/delPrinter',
        method: 'POST',
        data: body,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'appid': appid,
          'uid': uid,
          'stime': time,
          'sign': getSign(uid, time, appid, body)
        }
      })
      ctx.body = { success: true, data: result }
    } catch (error) {
      console.error('瑙ｇ粦鎵撳嵃鏈哄け璐?, error)
      ctx.body = {
        success: false,
        error: error.message || '瑙ｇ粦澶辫触',
        code: error.code,
        data: error.data
      }
    }
  })

  // 璁剧疆鎵撳嵃娴撳害
  app.router('setDensity', async (ctx, next) => {
    const { sn, density } = ctx.event
    const uid = getNonceStr()
    const time = new Date().getTime()
    const body = { sn, density }

    try {
      const result = await request({
        url: baseUrl + '/openapi/setDensity',
        method: 'POST',
        data: body,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'appid': appid,
          'uid': uid,
          'stime': time,
          'sign': getSign(uid, time, appid, body)
        }
      })
      ctx.body = { success: true, data: result }
    } catch (error) {
      console.error('璁剧疆鎵撳嵃娴撳害澶辫触', error)
      ctx.body = {
        success: false,
        error: error.message || '璁剧疆澶辫触',
        code: error.code,
        data: error.data
      }
    }
  })

  // 璁剧疆鎵撳嵃閫熷害
  app.router('setPrintSpeed', async (ctx, next) => {
    const { sn, printSpeed } = ctx.event
    const uid = getNonceStr()
    const time = new Date().getTime()
    const body = { sn, printSpeed }

    try {
      const result = await request({
        url: baseUrl + '/openapi/setPrintSpeed',
        method: 'POST',
        data: body,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'appid': appid,
          'uid': uid,
          'stime': time,
          'sign': getSign(uid, time, appid, body)
        }
      })
      ctx.body = { success: true, data: result }
    } catch (error) {
      console.error('璁剧疆鎵撳嵃閫熷害澶辫触', error)
      ctx.body = {
        success: false,
        error: error.message || '璁剧疆澶辫触',
        code: error.code,
        data: error.data
      }
    }
  })

  // 璁剧疆闊抽噺
  app.router('setVolume', async (ctx, next) => {
    const { sn, volume } = ctx.event
    const uid = getNonceStr()
    const time = new Date().getTime()
    const body = { sn, volume }

    try {
      const result = await request({
        url: baseUrl + '/openapi/setVolume',
        method: 'POST',
        data: body,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'appid': appid,
          'uid': uid,
          'stime': time,
          'sign': getSign(uid, time, appid, body)
        }
      })
      ctx.body = { success: true, data: result }
    } catch (error) {
      console.error('璁剧疆闊抽噺澶辫触', error)
      ctx.body = {
        success: false,
        error: error.message || '璁剧疆澶辫触',
        code: error.code,
        data: error.data
      }
    }
  })

  // 鏌ヨ鎵撳嵃鏈虹姸鎬?
  app.router('getDeviceStatus', async (ctx, next) => {
    const { sn } = ctx.event
    const uid = getNonceStr()
    const time = new Date().getTime()
    const body = { sn }

    try {
      const result = await request({
        url: baseUrl + '/openapi/getDeviceStatus',
        method: 'POST',
        data: body,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'appid': appid,
          'uid': uid,
          'stime': time,
          'sign': getSign(uid, time, appid, body)
        }
      })
      ctx.body = { success: true, data: result }
    } catch (error) {
      console.error('鏌ヨ鎵撳嵃鏈虹姸鎬佸け璐?, error)
      ctx.body = {
        success: false,
        error: error.message || '鏌ヨ澶辫触',
        code: error.code,
        data: error.data
      }
    }
  })

  // 鎵撳嵃灏忕エ
  app.router('printNote', async (ctx, next) => {
    const { $url, ...printData } = ctx.event
    const uid = getNonceStr()
    const time = new Date().getTime()

    try {
      const result = await request({
        url: baseUrl + '/openapi/print',
        method: 'POST',
        data: printData,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'appid': appid,
          'uid': uid,
          'stime': time,
          'sign': getSign(uid, time, appid, printData)
        }
      })
      ctx.body = { success: true, data: result }
    } catch (error) {
      console.error('鎵撳嵃灏忕エ澶辫触', error)
      ctx.body = {
        success: false,
        error: error.message || '鎵撳嵃澶辫触',
        code: error.code,
        data: error.data
      }
    }
  })

  // 娓呯┖鎵撳嵃闃熷垪
  app.router('cleanWaitingQueue', async (ctx, next) => {
    const { sn } = ctx.event
    const uid = getNonceStr()
    const time = new Date().getTime()
    const body = { sn }

    try {
      const result = await request({
        url: baseUrl + '/openapi/cleanWaitingQueue',
        method: 'POST',
        data: body,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'appid': appid,
          'uid': uid,
          'stime': time,
          'sign': getSign(uid, time, appid, body)
        }
      })
      ctx.body = { success: true, data: result }
    } catch (error) {
      console.error('娓呯┖鎵撳嵃闃熷垪澶辫触', error)
      ctx.body = {
        success: false,
        error: error.message || '娓呯┖澶辫触',
        code: error.code,
        data: error.data
      }
    }
  })

  return app.serve()
}
