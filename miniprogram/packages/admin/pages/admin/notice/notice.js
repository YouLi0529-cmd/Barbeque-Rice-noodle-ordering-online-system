const apiClient = require('../../../../../utils/apiClient')

const COLLECTION = 'notice'
const EMPTY_HINT = '公告会显示在顾客点单页搜索栏下方'

const UI = {
  title: '公告管理',
  subtitle: '编辑顾客点单页公告，启用后会显示在堂食和露营点单页',
  refresh: '刷新',
  add: '新增公告',
  back: '返回',
  listTitle: '公告列表',
  editorTitle: '公告编辑',
  contentLabel: '公告内容',
  contentPlaceholder: '请输入公告内容',
  sortLabel: '排序',
  sortPlaceholder: '数字越小越靠前',
  statusLabel: '状态',
  enabled: '启用',
  disabled: '停用',
  previewLabel: '顾客端预览',
  save: '保存公告',
  delete: '删除公告',
  empty: '暂无公告，点击右上角新增',
  loading: '加载中...',
  saving: '保存中...',
  deleting: '删除中...',
  saved: '保存成功',
  deleted: '删除成功',
  failed: '操作失败',
  contentRequired: '公告内容不能为空',
  confirmDeleteTitle: '确认删除',
  confirmDeleteContent: '删除后顾客端将不再显示这条公告，确定继续吗？'
}

function normalizeNotice(item = {}) {
  const status = Number(item.status) === 0 ? 0 : 1
  const sort = Number(item.sort || 0)
  const content = String(item.content || '')

  return {
    ...item,
    content,
    sort,
    status,
    displayStatus: status === 1 ? UI.enabled : UI.disabled,
    statusClass: status === 1 ? 'enabled' : 'disabled',
    displaySort: `排序 ${sort}`,
    brief: content || '未填写公告内容',
    toggleText: status === 1 ? UI.disabled : UI.enabled
  }
}

function buildForm(source = {}) {
  return {
    _id: source._id || '',
    content: String(source.content || ''),
    sort: Number(source.sort || 0),
    status: Number(source.status) === 0 ? 0 : 1
  }
}

Page({
  data: {
    ui: UI,
    list: [],
    loading: false,
    saving: false,
    selectedNoticeId: '',
    form: buildForm(),
    contentLength: 0,
    previewText: EMPTY_HINT,
    statusOptions: [
      { label: UI.enabled, value: 1 },
      { label: UI.disabled, value: 0 }
    ]
  },

  onLoad() {
    this.loadList()
  },

  stopPropagation() {},

  goBack() {
    wx.navigateBack()
  },

  buildFormState(source = {}) {
    const form = buildForm(source)
    return {
      form,
      selectedNoticeId: form._id,
      contentLength: form.content.length,
      previewText: form.content || EMPTY_HINT
    }
  },

  async loadList() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const res = await apiClient.call('admin.collection.list', {
        collection: COLLECTION,
        orderBy: 'sort',
        order: 'asc',
        limit: 100
      })
      const list = (res.data || []).map(normalizeNotice)
      const currentId = this.data.selectedNoticeId
      const selected = list.find(item => item._id === currentId) || (currentId ? null : list[0])
      const nextData = {
        list,
        loading: false
      }

      if (selected) {
        Object.assign(nextData, this.buildFormState(selected))
      } else if (!currentId) {
        Object.assign(nextData, this.buildFormState())
      }

      this.setData(nextData)
    } catch (err) {
      console.error('load notice failed', err)
      this.setData({ loading: false })
      wx.showToast({ title: err.message || UI.failed, icon: 'none' })
    }
  },

  createNotice() {
    this.setData(this.buildFormState())
  },

  selectNotice(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.list.find(candidate => candidate._id === id)
    if (!item) return
    this.setData(this.buildFormState(item))
  },

  onContentInput(e) {
    const content = String(e.detail.value || '')
    const form = {
      ...this.data.form,
      content
    }
    this.setData({
      form,
      contentLength: content.length,
      previewText: content || EMPTY_HINT
    })
  },

  onSortInput(e) {
    const form = {
      ...this.data.form,
      sort: e.detail.value
    }
    this.setData({ form })
  },

  chooseStatus(e) {
    const status = Number(e.currentTarget.dataset.status) === 0 ? 0 : 1
    const form = {
      ...this.data.form,
      status
    }
    this.setData({ form })
  },

  buildSaveItem() {
    const form = this.data.form
    const item = {
      content: String(form.content || '').trim(),
      sort: Number(form.sort || 0),
      status: Number(form.status) === 0 ? 0 : 1
    }

    if (form._id) {
      item._id = form._id
    }

    return item
  },

  async saveNotice() {
    if (this.data.saving) return
    const item = this.buildSaveItem()

    if (!item.content) {
      wx.showToast({ title: UI.contentRequired, icon: 'none' })
      return
    }

    this.setData({ saving: true })
    wx.showLoading({ title: UI.saving })

    try {
      const res = await apiClient.call('admin.collection.save', {
        collection: COLLECTION,
        item
      })
      const savedId = (res.data && res.data._id) || item._id || ''
      wx.hideLoading()
      wx.showToast({ title: UI.saved, icon: 'success' })
      this.setData({
        saving: false,
        selectedNoticeId: savedId
      })
      this.loadList()
    } catch (err) {
      wx.hideLoading()
      console.error('save notice failed', err)
      this.setData({ saving: false })
      wx.showToast({ title: err.message || UI.failed, icon: 'none' })
    }
  },

  confirmDeleteCurrent() {
    const id = this.data.form._id
    if (!id) return
    this.confirmDelete(id)
  },

  deleteNotice(e) {
    this.confirmDelete(e.currentTarget.dataset.id)
  },

  confirmDelete(id) {
    if (!id) return
    wx.showModal({
      title: UI.confirmDeleteTitle,
      content: UI.confirmDeleteContent,
      success: res => {
        if (res.confirm) {
          this.removeNotice(id)
        }
      }
    })
  },

  async removeNotice(id) {
    wx.showLoading({ title: UI.deleting })

    try {
      await apiClient.call('admin.collection.delete', {
        collection: COLLECTION,
        id
      })
      wx.hideLoading()
      wx.showToast({ title: UI.deleted, icon: 'success' })
      const resetData = id === this.data.selectedNoticeId ? this.buildFormState() : {}
      this.setData(resetData)
      this.loadList()
    } catch (err) {
      wx.hideLoading()
      console.error('delete notice failed', err)
      wx.showToast({ title: err.message || UI.failed, icon: 'none' })
    }
  },

  async toggleNotice(e) {
    const id = e.currentTarget.dataset.id
    const currentStatus = Number(e.currentTarget.dataset.status) === 0 ? 0 : 1
    if (!id) return

    try {
      await apiClient.call('admin.collection.update', {
        collection: COLLECTION,
        id,
        data: {
          status: currentStatus === 1 ? 0 : 1
        }
      })
      this.loadList()
    } catch (err) {
      console.error('toggle notice failed', err)
      wx.showToast({ title: err.message || UI.failed, icon: 'none' })
    }
  }
})