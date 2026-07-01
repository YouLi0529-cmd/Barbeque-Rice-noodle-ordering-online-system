// 浜戝嚱鏁板叆鍙ｆ枃浠?
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 浜戝嚱鏁板叆鍙ｅ嚱鏁?
exports.main = async (event, context) => {
  console.log('鎵撳嵃鍥炶皟鏁版嵁:', event)
  
  try {
    // 瑙ｆ瀽 body锛堝鏋滄槸瀛楃涓插垯瑙ｆ瀽涓?JSON锛?
    let bodyData = event
    if (event.body) {
      try {
        bodyData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
      } catch (parseErr) {
        console.error('瑙ｆ瀽 body 澶辫触', parseErr, event.body)
        // 濡傛灉 body 瑙ｆ瀽澶辫触锛屽皾璇曠洿鎺ヤ娇鐢?event
        bodyData = event
      }
    }
    
    const { type, rtime, data } = bodyData
    
    // 绫诲瀷 0锛氬洖璋冨湴鍧€杩為€氭€ф牎楠?
    if (type === 0) {
      return {
        code: 0,
        message: 'ok'
      }
    }
    
    // 绫诲瀷 5锛氫换鍔＄粨鏋滈€氱煡
    if (type === 5) {
      // 瑙ｆ瀽 data锛圝SON 瀛楃涓诧級
      let dataObj
      try {
        dataObj = typeof data === 'string' ? JSON.parse(data) : data
      } catch (parseErr) {
        console.error('瑙ｆ瀽鍥炶皟 data 澶辫触', parseErr, data)
        return {
          code: -1,
          message: '鏁版嵁瑙ｆ瀽澶辫触'
        }
      }
      
      const { sn, printId, status, outTradeNo } = dataObj
      
      // status: 2鎴愬姛銆?澶辫触銆?宸插彇娑堬紙鍙細鍥炶皟鏈€缁堢姸鎬侊級
      // 灏?status 杞崲涓烘暟瀛楃被鍨?
      const printStatus = parseInt(status)
      
      // 鍙鐞嗘渶缁堢姸鎬侊細2鎴愬姛銆?澶辫触銆?鍙栨秷
      if (printStatus === 2 || printStatus === 3 || printStatus === 4) {
        if (outTradeNo) {
          try {
            // 鏇存柊璁㈠崟鐨勬墦鍗扮姸鎬?
            await db.collection('order').doc(outTradeNo).update({
              data: {
                printStatus: printStatus,  // 鎵撳嵃鐘舵€侊細2鎴愬姛銆?澶辫触銆?鍙栨秷
                printTime: db.serverDate(),  // 鎵撳嵃鏃堕棿
                printId: printId,  // 鎵撳嵃浠诲姟ID
                sn: sn,  // 鎵撳嵃鏈篠N
                rtime: rtime  // 鎵撳嵃鍥炶皟鏃堕棿
              }
            })
            console.log('璁㈠崟鎵撳嵃鐘舵€佹洿鏂版垚鍔?, {
              orderId: outTradeNo,
              printId: printId,
              printStatus: printStatus,
              statusText: printStatus === 2 ? '鎴愬姛' : printStatus === 3 ? '澶辫触' : '宸插彇娑?
            })
          } catch (updateErr) {
            console.error('鏇存柊璁㈠崟鎵撳嵃鐘舵€佸け璐?, updateErr, {
              orderId: outTradeNo,
              printId: printId,
              printStatus: printStatus
            })
            // 鍗充娇鏇存柊澶辫触锛屼篃杩斿洖鎴愬姛锛岄伩鍏嶉噸澶嶅洖璋?
          }
        } else {
          console.log('鍥炶皟鏁版嵁涓棤 outTradeNo锛岃烦杩囪鍗曟洿鏂?, dataObj)
        }
      } else {
        console.log('鎵撳嵃浠诲姟鐘舵€佸紓甯革紝鐘舵€?', status, '璁㈠崟:', outTradeNo)
      }
      
      return {
        code: 0,
        message: 'ok'
      }
    }
    
    // 鏈煡绫诲瀷
    console.log('鏈煡鐨勫洖璋冪被鍨?', type)
    return {
      code: 0,
      message: 'ok'
    }
    
  } catch (err) {
    console.error('澶勭悊鎵撳嵃鍥炶皟寮傚父', err)
    // 鍗充娇寮傚父涔熻繑鍥炴垚鍔燂紝閬垮厤閲嶅鍥炶皟
    return {
      code: 0,
      message: 'ok'
    }
  }
}
