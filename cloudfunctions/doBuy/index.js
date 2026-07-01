const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database({
  throwOnNotFound: false
})

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function normalizeCount(count) {
  const value = Math.floor(Number(count) || 0)
  if (value <= 0) {
    throw new Error('菜品数量不正确')
  }
  if (value > 99) {
    throw new Error('单个菜品数量过多')
  }
  return value
}

function normalizeTags(tags) {
  if (!tags) return []
  if (Array.isArray(tags)) {
    return tags.filter(Boolean).map(item => String(item))
  }
  if (typeof tags === 'object') {
    return Object.values(tags).flat().filter(Boolean).map(item => String(item))
  }
  return [String(tags)]
}

async function getActiveUser(transaction, openid) {
  const userRes = await transaction.collection('user').where({
    _openid: openid,
    status: db.command.neq(0)
  }).limit(1).get()

  const user = userRes.data && userRes.data[0]
  if (!user) {
    throw new Error('请先完善个人信息')
  }
  if (!user.phoneNumber) {
    throw new Error('请先授权手机号')
  }
  return user
}

async function buildServerOrderGoods(transaction, orderGoods) {
  if (!Array.isArray(orderGoods) || orderGoods.length === 0) {
    throw new Error('购物车为空')
  }

  const list = []
  let totalPrice = 0

  for (const item of orderGoods) {
    const dishId = item && item.dishId
    if (!dishId) {
      throw new Error('菜品信息缺失')
    }

    const count = normalizeCount(item.count)
    const dishRes = await transaction.collection('dish').doc(dishId).get()
    const dish = dishRes.data

    if (!dish) {
      throw new Error('菜品不存在或已删除')
    }
    if (dish.status !== undefined && dish.status !== 1) {
      throw new Error(`菜品“${dish.name || item.dishName || ''}”已下架`)
    }

    const price = roundMoney(dish.price)
    const subtotal = roundMoney(price * count)
    totalPrice = roundMoney(totalPrice + subtotal)

    list.push({
      dishId,
      dishName: dish.name || item.dishName || '',
      dishImage: dish.image || item.dishImage || '',
      price,
      count,
      subtotal,
      tags: normalizeTags(item.tags)
    })
  }

  return {
    goods: list,
    totalPrice,
    finalPrice: totalPrice
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const orderScene = event.orderScene === 'camping' || event.orderType === 'camping'
    ? 'camping'
    : 'dineIn'
  const tableNumber = String(event.tableNumber || '').trim()
  const parentOrderId = String(event.parentOrderId || '').trim()
  const isAddOnOrder = !!parentOrderId
  const addOnIndex = Math.max(0, Math.floor(Number(event.addOnIndex) || 0))

  if (orderScene !== 'camping' && !tableNumber) {
    return {
      success: false,
      error: '请先扫码绑定桌号'
    }
  }

  try {
    const result = await db.runTransaction(async transaction => {
      const user = await getActiveUser(transaction, openid)
      const priceResult = await buildServerOrderGoods(transaction, event.orderGoods)
      let rootOrderId = ''

      if (isAddOnOrder) {
        const parentRes = await transaction.collection('order').doc(parentOrderId).get()
        const parentOrder = parentRes.data

        if (!parentOrder) {
          throw new Error('原订单不存在，无法加菜')
        }
        if (parentOrder._openid !== openid) {
          throw new Error('不能给他人的订单加菜')
        }
        if (parentOrder.orderScene !== orderScene) {
          throw new Error('加菜场景与原订单不一致')
        }
        if (orderScene !== 'camping' && String(parentOrder.tableNumber || '') !== tableNumber) {
          throw new Error('加菜桌号与原订单不一致')
        }

        rootOrderId = parentOrder.rootOrderId || parentOrder._id || parentOrderId
      }

      const orderData = {
        type: 'order',
        orderScene,
        orderType: orderScene,
        isAddOnOrder,
        parentOrderId: isAddOnOrder ? parentOrderId : '',
        rootOrderId,
        addOnIndex: isAddOnOrder ? addOnIndex : 0,
        orderCardTitle: event.orderCardTitle || (isAddOnOrder ? `加菜单${addOnIndex}` : '第一单'),
        goods: priceResult.goods,
        totalPrice: priceResult.totalPrice,
        finalPrice: priceResult.finalPrice,
        pay_status: true,
        payTime: db.serverDate(),
        createTime: db.serverDate(),
        _openid: openid,
        userId: user._id,
        userCode: user.userCode || '',
        userSnapshot: {
          userCode: user.userCode || '',
          nickName: user.nickName || '',
          avatarUrl: user.avatarUrl || '',
          phoneNumber: user.phoneNumber || ''
        },
        userNickName: user.nickName || '',
        userAvatar: user.avatarUrl || '',
        userPhone: user.phoneNumber || '',
        tableNumber: orderScene === 'camping' ? '' : tableNumber
      }

      const orderRes = await transaction.collection('order').add({
        data: orderData
      })
      const savedRootOrderId = rootOrderId || orderRes._id

      if (!rootOrderId) {
        await transaction.collection('order').doc(orderRes._id).update({
          data: {
            rootOrderId: savedRootOrderId
          }
        })
      }

      return {
        success: true,
        orderId: orderRes._id,
        order: {
          ...orderData,
          _id: orderRes._id,
          rootOrderId: savedRootOrderId
        }
      }
    })

    return result
  } catch (err) {
    console.error('doBuy failed', err)
    return {
      success: false,
      error: err.message || '下单失败'
    }
  }
}
