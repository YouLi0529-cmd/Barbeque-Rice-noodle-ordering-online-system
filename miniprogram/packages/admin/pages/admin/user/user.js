// packages/admin/pages/admin/user/user.js
const db = wx.cloud.database()
Page({
  data: {
    users: [],
    searchKeyword: '',
    // 分页相关
    userPage: 0,
    userPageSize: 20,
    userHasMore: true,
    loadingUsers: false
  },

  onLoad() {
    this.loadUsers()
  },

  onShow() {
    this.loadUsers()
  },

  // 加载用户列表
  async loadUsers(append = false) {
    if (this.data.loadingUsers) {
      return
    }

    if (!append) {
      wx.showLoading({ title: '加载中...' })
    }

    this.setData({ loadingUsers: true })

    try {
      const keyword = this.data.searchKeyword.trim()
      const pageSize = this.data.userPageSize
      const page = append ? this.data.userPage + 1 : 0
      
      // 调用云函数获取用户列表（使用聚合查询）
      const res = await wx.cloud.callFunction({
        name: 'getUserList',
        data: {
          keyword: keyword,
          page: page,
          pageSize: pageSize
        }
      })
      
      if (res.result && res.result.success) {
        const { list, hasMore } = res.result.data
        
        const newUsers = append ? this.data.users.concat(list) : list

        this.setData({
          users: newUsers,
          userPage: page,
          userHasMore: hasMore
        })
      } else {
        throw new Error(res.result?.error || '获取用户列表失败')
      }
    } catch (err) {
      console.error('加载用户失败', err)
      if (!append) {
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    } finally {
      if (!append) {
        wx.hideLoading()
      }
      this.setData({ loadingUsers: false })
    }
  },

  // 触底加载更多
  onReachBottom() {
    if (this.data.userHasMore && !this.data.loadingUsers) {
      this.loadUsers(true)
    }
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  // 执行搜索
  doSearch() {
    this.loadUsers()
  },

  // 清空搜索
  clearSearch() {
    this.setData({
      searchKeyword: '',
      // 重置分页状态
      userPage: 0,
      userHasMore: true,
      users: []
    }, () => {
      this.loadUsers()
    })
  },

  // 阻止冒泡
  stopPropagation() {}
})

