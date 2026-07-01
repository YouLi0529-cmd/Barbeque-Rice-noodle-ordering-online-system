const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database({
  throwOnNotFound: false
})
const _ = db.command

async function getNextUserCode(transaction) {
  const counterRef = transaction.collection('counter').doc('userCode')
  const counterRes = await counterRef.get()
  const counter = counterRes.data

  if (!counter) {
    await counterRef.set({
      data: {
        next: 23002,
        updateTime: db.serverDate()
      }
    })
    return '23001'
  }

  const next = Number(counter.next || 23001)
  await counterRef.update({
    data: {
      next: _.inc(1),
      updateTime: db.serverDate()
    }
  })

  return String(next).padStart(5, '0')
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const avatarUrl = event.avatarUrl || ''
  const phoneNumber = String(event.phoneNumber || '').trim()

  if (!phoneNumber) {
    return {
      success: false,
      error: '缺少手机号'
    }
  }

  try {
    const user = await db.runTransaction(async transaction => {
      const userRes = await transaction.collection('user').where({
        _openid: openid
      }).limit(1).get()

      const oldUser = userRes.data && userRes.data[0]

      if (oldUser) {
        const userCode = oldUser.userCode || await getNextUserCode(transaction)
        const nickName = String(event.nickName || '').trim() || `会员${userCode}`
        const data = {
          avatarUrl,
          nickName,
          phoneNumber,
          userCode,
          profileCompleted: true,
          status: oldUser.status === 0 ? 1 : (oldUser.status || 1),
          updateTime: db.serverDate()
        }

        if (oldUser.orderCount === undefined) {
          data.orderCount = 0
        }
        if (oldUser.dineInOrderCount === undefined) {
          data.dineInOrderCount = 0
        }
        if (oldUser.campingOrderCount === undefined) {
          data.campingOrderCount = 0
        }

        await transaction.collection('user').doc(oldUser._id).update({ data })

        return {
          ...oldUser,
          ...data,
          updateTime: new Date()
        }
      }

      const userCode = await getNextUserCode(transaction)
      const nickName = String(event.nickName || '').trim() || `会员${userCode}`
      const newUser = {
        _openid: openid,
        userCode,
        avatarUrl,
        nickName,
        phoneNumber,
        profileCompleted: true,
        orderCount: 0,
        dineInOrderCount: 0,
        campingOrderCount: 0,
        status: 1,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }

      const addRes = await transaction.collection('user').add({
        data: newUser
      })

      return {
        ...newUser,
        _id: addRes._id,
        createTime: new Date(),
        updateTime: new Date()
      }
    })

    return {
      success: true,
      data: {
        user
      }
    }
  } catch (err) {
    console.error('completeUserProfile failed', err)
    return {
      success: false,
      error: err.message || '保存用户信息失败'
    }
  }
}
