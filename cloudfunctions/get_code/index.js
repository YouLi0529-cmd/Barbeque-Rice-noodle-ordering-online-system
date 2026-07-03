// 浜戝嚱鏁板叆鍙ｆ枃浠?
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 浜戝嚱鏁板叆鍙ｅ嚱鏁?
exports.main = async (event, context) => {
  const { page, scene } = event

  try {
    // 璋冪敤鐢熸垚灏忕▼搴忕爜鐨勬帴鍙?
    const result = await cloud.openapi.wxacode.getUnlimited({
      page: page || 'packages/order/pages/index/index',
      scene: scene || '',
      width: 280
    })

    // 灏嗙敓鎴愮殑灏忕▼搴忕爜涓婁紶鍒颁簯瀛樺偍涓?
    const upload = await cloud.uploadFile({
      cloudPath: 'tableCode/' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '.png',
      fileContent: result.buffer
    })

    return upload.fileID // 杩斿洖鏂囦欢鐨刦ileID,涔熷氨鏄鍥剧墖鍦板潃
  } catch (err) {
    console.error('鐢熸垚灏忕▼搴忕爜澶辫触', err)
    throw err
  }
}

