// pages/admin/grill/grill.js
Page({
  data: {
    list: [],
    newGrillName: '',
    loading: false,
    defaults: ['A1烤架', 'A2烤架', 'A3烤架', 'B1烤架', 'B2烤架']
  },

  onLoad() {
    this.loadList()
  },

  onShow() {
    this.loadList()
  },

  mapStatus(status) {
    const map = {
      available: '可用',
      occupied: '占用中',
      disabled: '已停用'
    }
    return map[status] || status || '未知'
  },

  async loadList() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'outdoorManage',
        data: { action: 'listGrills', outdoorPointId: 'main' }
      })
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '加载失败')
      const list = (result.data || []).map(item => ({
        ...item,
        statusText: this.mapStatus(item.status),
        nextStatus: item.status === 'available' ? 'disabled' : 'available',
        nextText: item.status === 'available' ? '停用' : '启用'
      }))
      this.setData({ list })
    } catch (err) {
      console.error('加载烤架失败', err)
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onNameInput(e) {
    this.setData({ newGrillName: e.detail.value })
  },

  async addGrillByName(name, sort = 0) {
    const res = await wx.cloud.callFunction({
      name: 'outdoorManage',
      data: {
        action: 'addGrill',
        name,
        sort,
        outdoorPointId: 'main',
        status: 'available'
      }
    })
    const result = res.result || {}
    if (!result.success) throw new Error(result.message || '新增失败')
  },

  async addGrill() {
    const name = this.data.newGrillName.trim()
    if (!name) {
      wx.showToast({ title: '请填写烤架名称', icon: 'none' })
      return
    }

    wx.showLoading({ title: '新增中...' })
    try {
      await this.addGrillByName(name)
      wx.hideLoading()
      wx.showToast({ title: '新增成功', icon: 'success' })
      this.setData({ newGrillName: '' })
      this.loadList()
    } catch (err) {
      wx.hideLoading()
      console.error('新增烤架失败', err)
      wx.showToast({ title: err.message || '新增失败', icon: 'none' })
    }
  },

  async createDefaults() {
    wx.showLoading({ title: '创建中...' })
    try {
      for (let i = 0; i < this.data.defaults.length; i++) {
        await this.addGrillByName(this.data.defaults[i], i + 1)
      }
      wx.hideLoading()
      wx.showToast({ title: '已创建默认烤架', icon: 'success' })
      this.loadList()
    } catch (err) {
      wx.hideLoading()
      console.error('创建默认烤架失败', err)
      wx.showToast({ title: err.message || '创建失败', icon: 'none' })
    }
  },

  async toggleStatus(e) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    wx.showLoading({ title: '更新中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'outdoorManage',
        data: {
          action: 'updateGrillStatus',
          id,
          status
        }
      })
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '更新失败')
      wx.hideLoading()
      wx.showToast({ title: '已更新', icon: 'success' })
      this.loadList()
    } catch (err) {
      wx.hideLoading()
      console.error('更新烤架失败', err)
      wx.showToast({ title: err.message || '更新失败', icon: 'none' })
    }
  }
})
