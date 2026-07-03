const apiClient = require('../../../utils/apiClient')

const BASE_UI = {
  searchPlaceholder: '\u641c\u7d22',
  add: '\u65b0\u589e',
  edit: '\u7f16\u8f91',
  delete: '\u5220\u9664',
  refresh: '\u5237\u65b0',
  save: '\u4fdd\u5b58',
  cancel: '\u53d6\u6d88',
  confirmDeleteTitle: '\u786e\u8ba4\u5220\u9664',
  confirmDeleteContent: '\u5220\u9664\u540e\u4e0d\u53ef\u6062\u590d\uff0c\u786e\u5b9a\u7ee7\u7eed\u5417\uff1f',
  empty: '\u6682\u65e0\u6570\u636e',
  loading: '\u52a0\u8f7d\u4e2d...',
  saving: '\u4fdd\u5b58\u4e2d...',
  deleting: '\u5220\u9664\u4e2d...',
  saved: '\u4fdd\u5b58\u6210\u529f',
  deleted: '\u5220\u9664\u6210\u529f',
  updated: '\u5df2\u66f4\u65b0',
  failed: '\u64cd\u4f5c\u5931\u8d25',
  yes: '\u662f',
  no: '\u5426'
}

function formatTime(time) {
  if (!time) return ''
  const date = time instanceof Date ? time : new Date(time)
  if (Number.isNaN(date.getTime())) return ''
  const pad = n => (n < 10 ? `0${n}` : `${n}`)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fieldValue(item, key) {
  if (!item || !key) return ''
  const value = item[key]
  if (value === true) return BASE_UI.yes
  if (value === false) return BASE_UI.no
  if (key.toLowerCase().indexOf('time') >= 0) return formatTime(value)
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object') return ''
  return value === undefined || value === null ? '' : String(value)
}

function showToast(title, icon = 'none') {
  wx.showToast({ title, icon })
}

function normalizeByType(value, type) {
  if (type === 'number') {
    const number = Number(value)
    return Number.isFinite(number) ? number : 0
  }
  if (type === 'switch') return !!value
  return value === undefined || value === null ? '' : value
}

function createDefaultForm(fields) {
  const form = {}
  fields.forEach(field => {
    if (field.type === 'number') form[field.key] = field.defaultValue !== undefined ? field.defaultValue : 0
    else if (field.type === 'switch') form[field.key] = field.defaultValue !== undefined ? !!field.defaultValue : true
    else form[field.key] = field.defaultValue !== undefined ? field.defaultValue : ''
  })
  return form
}

function buildFormFields(fields, form) {
  return fields.map(field => ({
    ...field,
    value: form[field.key]
  }))
}

function createCollectionPage(config) {
  const fields = config.fields || []
  const listFields = config.listFields || fields.slice(0, 4).map(field => field.key)
  const defaultForm = createDefaultForm(fields)

  return {
    data: {
      ui: {
        ...BASE_UI,
        title: config.title || '',
        empty: config.emptyText || BASE_UI.empty
      },
      collection: config.collection,
      canAdd: config.canAdd !== false,
      canEdit: config.canEdit !== false,
      canDelete: config.canDelete !== false,
      allowSearch: config.allowSearch !== false,
      actions: config.actions || [],
      list: [],
      keyword: '',
      loading: false,
      showModal: false,
      editMode: false,
      form: { ...defaultForm },
      formFields: buildFormFields(fields, defaultForm)
    },

    onLoad() {
      this.loadList()
    },

    onShow() {
      if (config.refreshOnShow !== false) {
        this.loadList()
      }
    },

    formatItem(item) {
      const titleKey = config.titleKey || (fields[0] && fields[0].key) || '_id'
      const subtitleKey = config.subtitleKey || ''
      const statusKey = config.statusKey || 'status'
      const lines = listFields.map(key => {
        const field = fields.find(candidate => candidate.key === key) || { key, label: key }
        return {
          key,
          label: field.label || key,
          value: fieldValue(item, key)
        }
      }).filter(line => line.value !== '')

      return {
        ...item,
        _displayTitle: fieldValue(item, titleKey) || item._id || config.title,
        _displaySubtitle: subtitleKey ? fieldValue(item, subtitleKey) : '',
        _displayStatus: fieldValue(item, statusKey),
        _displayLines: lines,
        _actions: config.actions || []
      }
    },

    async loadList() {
      if (this.data.loading) return
      this.setData({ loading: true })

      try {
        const res = await apiClient.call('admin.collection.list', {
          collection: config.collection,
          keyword: this.data.keyword,
          orderBy: config.orderBy,
          order: config.order,
          filters: config.filters || {},
          limit: config.limit || 80
        })
        this.setData({
          list: (res.data || []).map(item => this.formatItem(item)),
          loading: false
        })
      } catch (err) {
        console.error('admin list failed', err)
        this.setData({ loading: false })
        showToast(err.message || BASE_UI.failed)
      }
    },

    onSearchInput(e) {
      this.setData({ keyword: e.detail.value })
    },

    doSearch() {
      this.loadList()
    },

    clearSearch() {
      this.setData({ keyword: '' }, () => this.loadList())
    },

    showAddModal() {
      const form = createDefaultForm(fields)
      this.setData({
        showModal: true,
        editMode: false,
        form,
        formFields: buildFormFields(fields, form)
      })
    },

    showEditModal(e) {
      const source = e.currentTarget.dataset.item || {}
      const form = {
        ...createDefaultForm(fields),
        ...source
      }
      this.setData({
        showModal: true,
        editMode: true,
        form,
        formFields: buildFormFields(fields, form)
      })
    },

    closeModal() {
      this.setData({ showModal: false })
    },

    onFieldInput(e) {
      const key = e.currentTarget.dataset.key
      if (!key) return
      const value = e.detail.value
      const form = {
        ...this.data.form,
        [key]: value
      }
      this.setData({
        form,
        formFields: buildFormFields(fields, form)
      })
    },

    onFieldSwitch(e) {
      const key = e.currentTarget.dataset.key
      if (!key) return
      const form = {
        ...this.data.form,
        [key]: !!e.detail.value
      }
      this.setData({
        form,
        formFields: buildFormFields(fields, form)
      })
    },

    buildSaveItem() {
      const item = {}
      if (this.data.form._id) {
        item._id = this.data.form._id
      }
      fields.forEach(field => {
        item[field.key] = normalizeByType(this.data.form[field.key], field.type)
      })
      return item
    },

    async saveItem() {
      const item = this.buildSaveItem()
      const required = fields.find(field => field.required && !String(item[field.key] || '').trim())
      if (required) {
        showToast(`${required.label}\u4e0d\u80fd\u4e3a\u7a7a`)
        return
      }

      try {
        wx.showLoading({ title: BASE_UI.saving })
        await apiClient.call('admin.collection.save', {
          collection: config.collection,
          item
        })
        wx.hideLoading()
        showToast(BASE_UI.saved, 'success')
        this.setData({ showModal: false })
        this.loadList()
      } catch (err) {
        wx.hideLoading()
        console.error('admin save failed', err)
        showToast(err.message || BASE_UI.failed)
      }
    },

    deleteItem(e) {
      const item = e.currentTarget.dataset.item
      wx.showModal({
        title: BASE_UI.confirmDeleteTitle,
        content: BASE_UI.confirmDeleteContent,
        success: async res => {
          if (!res.confirm) return
          try {
            wx.showLoading({ title: BASE_UI.deleting })
            await apiClient.call('admin.collection.delete', {
              collection: config.collection,
              id: item._id
            })
            wx.hideLoading()
            showToast(BASE_UI.deleted, 'success')
            this.loadList()
          } catch (err) {
            wx.hideLoading()
            console.error('admin delete failed', err)
            showToast(err.message || BASE_UI.failed)
          }
        }
      })
    },

    async runAction(e) {
      const id = e.currentTarget.dataset.id
      const index = Number(e.currentTarget.dataset.index || 0)
      const action = this.data.actions[index] || {}
      const field = action.field
      const value = action.value
      if (!id || !field) return

      try {
        await apiClient.call('admin.collection.update', {
          collection: config.collection,
          id,
          data: {
            [field]: value
          }
        })
        showToast(BASE_UI.updated, 'success')
        this.loadList()
      } catch (err) {
        console.error('admin action failed', err)
        showToast(err.message || BASE_UI.failed)
      }
    },

    stopPropagation() {}
  }
}

module.exports = {
  createCollectionPage
}
