// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function ok(data = null, message = 'ok') {
  return { success: true, data, message }
}

function fail(message = '操作失败') {
  return { success: false, data: null, message }
}

function escapeHtml(value) {
  if (value === undefined || value === null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatDate(time) {
  let date = new Date()
  if (time instanceof Date) {
    date = time
  } else if (time && typeof time.getTime === 'function') {
    date = new Date(time.getTime())
  } else if (time) {
    date = new Date(time)
  }

  const pad = n => (n < 10 ? `0${n}` : `${n}`)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getOrderTypeText(order) {
  if (order.orderType === 'dineIn') return '堂食'
  if (order.orderType === 'camping' || order.orderScene === 'camping') return '露营'
  if (order.orderType === 'outdoor') return '户外烧烤'
  if (order.orderType === 'takeOut') return '打包'
  return '点餐'
}

function buildKitchenTicket(order, shopInfo) {
  const shopName = shopInfo && shopInfo.name ? shopInfo.name : '张南烤肉'
  const orderTypeText = getOrderTypeText(order)
  const goods = order.goods || []
  const frontDeskRemark = order.frontDeskRemark || ''

  let content = ''
  content += `<C><font# bolder=1 height=2 width=2>厨房菜单</font#></C><BR>`
  content += `<C>${escapeHtml(shopName)}</C><BR>`
  content += `<C>********************************</C><BR>`
  content += `<LEFT>类型: ${orderTypeText}</LEFT><BR>`
  content += `<LEFT>订单号: ${escapeHtml(order._id)}</LEFT><BR>`
  content += `<LEFT>下单时间: ${formatDate(order.createTime)}</LEFT><BR>`

  if (order.tableNumber) {
    content += `<C><font# bolder=1 height=2 width=2>桌号: ${escapeHtml(order.tableNumber)}</font#></C><BR>`
  }

  if (order.orderType === 'outdoor' && order.grillName) {
    content += `<C><font# bolder=1 height=2 width=2>烤架: ${escapeHtml(order.grillName)}</font#></C><BR>`
    content += `<C>取餐方式: 顾客自取</C><BR>`
  }

  content += `<C>--------------菜品--------------</C><BR>`
  if (goods.length) {
    goods.forEach(item => {
      const name = escapeHtml(item.dishName || item.goodsName || '未命名菜品')
      const count = item.count || 1
      content += `<LEFT><font# bolder=1 height=2 width=1>${name} x${count}</font#></LEFT><BR>`

      if (item.tags && Array.isArray(item.tags) && item.tags.length) {
        content += `<LEFT>  ${escapeHtml(item.tags.join(' '))}</LEFT><BR>`
      }

      if (item.remark) {
        content += `<LEFT>  商品备注: ${escapeHtml(item.remark)}</LEFT><BR>`
      }
    })
  } else {
    content += `<LEFT>暂无菜品</LEFT><BR>`
  }

  if (frontDeskRemark) {
    content += `<C>------------前台备注------------</C><BR>`
    content += `<LEFT>${escapeHtml(frontDeskRemark)}</LEFT><BR>`
  }

  content += `<C>********************************</C><BR>`
  content += `<C><font# bolder=1 height=2 width=1>前台已确认</font#></C><BR>`
  content += `<BR><BR><BR>`
  return content
}

async function printKitchenOrder(orderId, order) {
  const printerRes = await db.collection('printer').limit(1).get()
  if (!printerRes.data || !printerRes.data.length) {
    throw new Error('还没有绑定厨房打印机')
  }

  const printer = printerRes.data[0]
  const shopRes = await db.collection('shopInfo').limit(1).get()
  const shopInfo = shopRes.data && shopRes.data.length ? shopRes.data[0] : null
  const voice = order.orderType === 'dineIn' ? '16' : '19'

  const printRes = await cloud.callFunction({
    name: 'printManage',
    data: {
      $url: 'printNote',
      sn: printer.sn,
      voice,
      voicePlayTimes: 1,
      voicePlayInterval: 3,
      content: buildKitchenTicket(order, shopInfo),
      copies: 1,
      expiresInSeconds: 7200,
      outTradeNo: orderId
    }
  })

  const result = printRes.result || {}
  if (!result.success) {
    throw new Error(result.error || result.message || '厨房打印失败')
  }

  await db.collection('order').doc(orderId).update({
    data: {
      kitchenPrinted: true,
      kitchenPrintStatus: 'sent',
      kitchenPrintTime: db.serverDate(),
      printError: '',
      updateTime: db.serverDate()
    }
  })

  return result
}

async function getOrder(id) {
  if (!id) throw new Error('缺少订单ID')
  const res = await db.collection('order').doc(id).get()
  if (!res.data) throw new Error('订单不存在')
  return res.data
}

async function updateStatus(event) {
  if (!event.id) return fail('缺少订单ID')
  if (!event.status) return fail('缺少订单状态')

  const allowedStatus = [
    'waiting_pay',
    'pending_prepare',
    'preparing',
    'served',
    'ready_pickup',
    'picked_up',
    'completed',
    'cancelled'
  ]

  if (allowedStatus.indexOf(event.status) === -1) {
    return fail('不支持的订单状态')
  }

  const data = {
    status: event.status,
    updateTime: db.serverDate()
  }

  if (event.status === 'preparing') data.prepareStartTime = db.serverDate()
  if (event.status === 'served') data.servedTime = db.serverDate()
  if (event.status === 'ready_pickup') data.readyPickupTime = db.serverDate()
  if (event.status === 'picked_up') data.pickedUpTime = db.serverDate()
  if (event.status === 'completed') data.completedTime = db.serverDate()

  await db.collection('order').doc(event.id).update({ data })
  return ok({ _id: event.id, status: event.status }, '状态已更新')
}

async function confirmOfflinePaid(event) {
  if (!event.id) return fail('缺少订单ID')

  const data = {
    pay_status: true,
    payStatus: true,
    payMethod: 'offline',
    payTime: db.serverDate(),
    updateTime: db.serverDate()
  }

  await db.collection('order').doc(event.id).update({ data })
  return ok({ _id: event.id, pay_status: true, payStatus: true }, '已确认线下收款')
}

async function saveFrontDeskRemark(event) {
  if (!event.id) return fail('缺少订单ID')
  const frontDeskRemark = String(event.frontDeskRemark || '').trim()

  await db.collection('order').doc(event.id).update({
    data: {
      frontDeskRemark,
      updateTime: db.serverDate()
    }
  })

  return ok({ _id: event.id, frontDeskRemark }, '前台备注已保存')
}

function normalizeOrderGoods(goods = []) {
  return goods
    .map(item => {
      const price = Number(item.price || 0)
      const count = Math.max(1, parseInt(item.count || 1, 10))
      return {
        dishId: item.dishId || item._id || '',
        dishName: item.dishName || item.goodsName || item.name || '未命名菜品',
        dishImage: item.dishImage || item.image || '',
        price,
        count,
        tags: Array.isArray(item.tags) ? item.tags : [],
        subtotal: (price * count).toFixed(2),
        canUseMiandan: !!item.canUseMiandan
      }
    })
    .filter(item => item.dishId && item.count > 0)
}

async function updateOrderGoods(event) {
  if (!event.id) return fail('缺少订单ID')
  const order = await getOrder(event.id)

  if (order.frontDeskConfirmed || order.kitchenPrinted) {
    return fail('订单已发送厨房，如需改菜请先走加菜单或重打流程')
  }

  if (order.status && ['pending_prepare', 'preparing', 'served', 'ready_pickup', 'picked_up', 'completed'].indexOf(order.status) !== -1) {
    return fail('订单已进入厨房流程，暂不能直接修改点菜单')
  }

  const goods = normalizeOrderGoods(event.goods || [])
  if (!goods.length) return fail('订单至少保留一项菜品')

  const totalPrice = Number(goods.reduce((sum, item) => sum + item.price * item.count, 0).toFixed(2))
  const oldGoods = normalizeOrderGoods(order.goods || [])
  const oldTotalPrice = Number(order.totalPrice || order.finalPrice || 0)
  const oldLogs = Array.isArray(order.orderEditLogs) ? order.orderEditLogs : []

  const editLog = {
    action: 'update_goods',
    oldGoods,
    newGoods: goods,
    oldTotalPrice,
    newTotalPrice: totalPrice,
    reason: String(event.reason || '').trim(),
    createTime: new Date()
  }

  await db.collection('order').doc(event.id).update({
    data: {
      goods,
      totalPrice,
      finalPrice: totalPrice,
      useMiandan: false,
      menuEdited: true,
      menuEditTime: db.serverDate(),
      orderEditLogs: oldLogs.concat(editLog),
      updateTime: db.serverDate()
    }
  })

  return ok({
    _id: event.id,
    goods,
    totalPrice,
    finalPrice: totalPrice
  }, '点菜单已更新')
}

async function sendToKitchen(event) {
  try {
    const order = await getOrder(event.id)
    if (order.type !== 'order') return fail('只能发送点餐订单')

    const frontDeskRemark = event.frontDeskRemark !== undefined
      ? String(event.frontDeskRemark || '').trim()
      : (order.frontDeskRemark || '')

    const data = {
      frontDeskConfirmed: true,
      frontDeskRemark,
      status: order.status === 'cancelled' ? 'cancelled' : 'pending_prepare',
      kitchenPrintStatus: 'sending',
      confirmTime: db.serverDate(),
      updateTime: db.serverDate()
    }

    await db.collection('order').doc(event.id).update({ data })

    const orderForPrint = {
      ...order,
      ...data,
      _id: event.id
    }

    try {
      await printKitchenOrder(event.id, orderForPrint)
      return ok({ _id: event.id, printSuccess: true }, '已发送厨房')
    } catch (printErr) {
      await db.collection('order').doc(event.id).update({
        data: {
          kitchenPrinted: false,
          kitchenPrintStatus: 'failed',
          printError: printErr.message || '厨房打印失败',
          updateTime: db.serverDate()
        }
      })
      return ok({
        _id: event.id,
        printSuccess: false,
        printError: printErr.message || '厨房打印失败'
      }, '订单已确认，但厨房打印失败，请重打')
    }
  } catch (err) {
    return fail(err.message || '发送厨房失败')
  }
}

async function reprintKitchenOrder(event) {
  try {
    const order = await getOrder(event.id)
    if (order.type !== 'order') return fail('只能重打点餐订单')
    await printKitchenOrder(event.id, order)
    return ok({ _id: event.id, printSuccess: true }, '已重新发送厨房')
  } catch (err) {
    if (event.id) {
      await db.collection('order').doc(event.id).update({
        data: {
          kitchenPrintStatus: 'failed',
          printError: err.message || '厨房打印失败',
          updateTime: db.serverDate()
        }
      })
    }
    return fail(err.message || '厨房打印失败')
  }
}

async function cancelOrder(event) {
  if (!event.id) return fail('缺少订单ID')
  const order = await getOrder(event.id)

  await db.collection('order').doc(event.id).update({
    data: {
      status: 'cancelled',
      cancelReason: event.reason || 'frontdesk_cancel',
      cancelTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })

  if (order.orderType === 'outdoor' && order.grillId && order.grillId.indexOf('default-') !== 0) {
    try {
      await db.collection('outdoorGrill').doc(order.grillId).update({
        data: {
          status: 'available',
          currentOrderId: '',
          updateTime: db.serverDate()
        }
      })
    } catch (err) {
      console.warn('释放户外烤架失败', err)
    }
  }

  return ok({ _id: event.id, status: 'cancelled' }, '订单已取消')
}

exports.main = async (event) => {
  const action = event.action
  try {
    if (action === 'updateStatus') return await updateStatus(event)
    if (action === 'confirmOfflinePaid') return await confirmOfflinePaid(event)
    if (action === 'saveFrontDeskRemark') return await saveFrontDeskRemark(event)
    if (action === 'updateOrderGoods') return await updateOrderGoods(event)
    if (action === 'sendToKitchen') return await sendToKitchen(event)
    if (action === 'reprintKitchenOrder') return await reprintKitchenOrder(event)
    if (action === 'cancelOrder') return await cancelOrder(event)
    return fail('未知操作')
  } catch (err) {
    console.error('updateOrderStatus error', err)
    return fail(err.message || '订单状态更新失败')
  }
}
