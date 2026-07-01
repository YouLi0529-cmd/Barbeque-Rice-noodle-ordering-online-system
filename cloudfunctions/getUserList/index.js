const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const keyword = (event.keyword || '').trim()
  const page = Math.max(Number(event.page) || 0, 0)
  const pageSize = Math.min(Math.max(Number(event.pageSize) || 20, 1), 100)

  try {
    let query = {
      status: _.neq(0)
    }

    if (keyword) {
      query = _.and([
        query,
        _.or([
          {
            nickName: db.RegExp({
              regexp: keyword,
              options: 'i'
            })
          },
          {
            phoneNumber: db.RegExp({
              regexp: keyword,
              options: 'i'
            })
          },
          {
            userCode: db.RegExp({
              regexp: keyword,
              options: 'i'
            })
          }
        ])
      ])
    }

    const res = await db.collection('user')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(page * pageSize)
      .limit(pageSize)
      .get()

    return {
      success: true,
      data: {
        list: res.data || [],
        hasMore: (res.data || []).length === pageSize,
        page,
        total: (res.data || []).length
      }
    }
  } catch (err) {
    console.error('getUserList failed', err)
    return {
      success: false,
      error: err.message || '获取用户列表失败'
    }
  }
}
