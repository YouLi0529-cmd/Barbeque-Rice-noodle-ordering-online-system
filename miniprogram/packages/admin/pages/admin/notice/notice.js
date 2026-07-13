const apiClient = require('../../../../../utils/apiClient')

const COLLECTION = 'notice'
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
  enabled: '\u542f\u7528',
  disabled: '\u505c\u7528',
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

function normalizeNoticeTarget(target) {
  return target === 'camping' ? 'camping' : 'dineIn'
}

function normalizeNoticeTargets(source) {
  const rawTargets = Array.isArray(source) ? source : (source ? [source] : [])
  const targets = rawTargets
    .map(target => target === 'camping' ? 'camping' : (target === 'dineIn' ? 'dineIn' : ''))
    .filter(Boolean)
  const uniqueTargets = Array.from(new Set(targets))
  return uniqueTargets
}

function buildTargetMap(targets) {
  const normalizedTargets = normalizeNoticeTargets(targets)
  return {
    dineIn: normalizedTargets.indexOf('dineIn') >= 0,
    camping: normalizedTargets.indexOf('camping') >= 0
  }
}

function getNoticeTargetLabel(targets) {
  const normalizedTargets = normalizeNoticeTargets(targets)
  if (!normalizedTargets.length) return '\u672a\u9009\u62e9'
  return normalizedTargets
    .map(target => target === 'camping' ? '\u9732\u8425' : '\u5802\u98df')
    .join('\u3001')
}

function normalizeNotice(item = {}) {
  const status = Number(item.status) === 0 ? 0 : 1
  const sort = Number(item.sort || 0)
  const content = String(item.content || '')
  const targets = normalizeNoticeTargets(item.targets || item.target)

  return {
    ...item,
    content,
    sort,
    status,
    target: targets[0],
    targets,
    targetMap: buildTargetMap(targets),
    displayTarget: getNoticeTargetLabel(targets),
    displayStatus: status === 1 ? UI.enabled : UI.disabled,
    statusClass: status === 1 ? 'enabled' : 'disabled',
    displaySort: `排序 ${sort}`,
    brief: content || '未填写公告内容',
    toggleText: status === 1 ? UI.disabled : UI.enabled
  }
}

function buildForm(source = {}) {
  const targets = normalizeNoticeTargets(source.targets || source.target)
  return {
    _id: source._id || '',
    content: String(source.content || ''),
    sort: Number(source.sort || 0),
    status: Number(source.status) === 0 ? 0 : 1,
    target: targets[0] || '',
    targets,
    targetMap: buildTargetMap(targets)
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
    targetLabel: '\u53d1\u5e03\u4f4d\u7f6e',
    targetErrorLabel: '\u8fd8\u672a\u9009\u62e9\u53d1\u5e03\u4f4d\u7f6e',
    targetError: false,
    dineInLabel: '\u5802\u98df',
    campingLabel: '\u9732\u8425'
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
      targetError: false
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
      contentLength: content.length
    })
  },

  onSortInput(e) {
    const form = {
      ...this.data.form,
      sort: e.detail.value
    }
    this.setData({ form })
  },

  chooseTarget(e) {
    const target = normalizeNoticeTarget(e.currentTarget.dataset.target)
    const currentTargets = normalizeNoticeTargets(this.data.form.targets || this.data.form.target)
    const exists = currentTargets.indexOf(target) >= 0
    const nextTargets = exists
      ? currentTargets.filter(item => item !== target)
      : currentTargets.concat(target)
    const form = {
      ...this.data.form,
      target: nextTargets[0] || '',
      targets: nextTargets,
      targetMap: buildTargetMap(nextTargets)
    }
    this.setData({
      form,
      targetError: false
    })
  },

  buildSaveItem() {
    const form = this.data.form
    const item = {
      content: String(form.content || '').trim(),
      sort: Number(form.sort || 0),
      status: Number(form.status) === 0 ? 0 : 1,
      target: normalizeNoticeTargets(form.targets || form.target)[0] || '',
      targets: normalizeNoticeTargets(form.targets || form.target)
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

    if (!item.targets.length) {
      this.setData({ targetError: true })
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
