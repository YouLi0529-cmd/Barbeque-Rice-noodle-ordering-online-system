const apiClient = require('../../../../../utils/apiClient')

const UI = {
  title: '\u684c\u7801\u7ba1\u7406',
  subtitle: '\u751f\u6210\u540e\u53ef\u76f4\u63a5\u6253\u5f00\u5802\u98df\u70b9\u5355',
  refresh: '\u5237\u65b0',
  generateMissing: '\u751f\u6210\u7f3a\u5c11\u684c\u7801',
  generating: '\u751f\u6210\u4e2d',
  generate: '\u751f\u6210',
  regenerate: '\u91cd\u65b0\u751f\u6210',
  preview: '\u9884\u89c8',
  save: '\u4fdd\u5b58\u56fe\u7247',
  notGenerated: '\u672a\u751f\u6210\u684c\u7801',
  generated: '\u5df2\u751f\u6210',
  loadFailed: '\u684c\u7801\u52a0\u8f7d\u5931\u8d25',
  generateFailed: '\u751f\u6210\u5931\u8d25',
  saveFailed: '\u4fdd\u5b58\u5931\u8d25',
  saved: '\u5df2\u4fdd\u5b58\u5230\u76f8\u518c',
  allReady: '\u684c\u7801\u5df2\u5168\u90e8\u751f\u6210',
  tableSuffix: '\u53f7\u684c'
}

const TABLE_SECTIONS = [
  { areaKey: 'normal', name: '\u666e\u901a\u533a', count: 15 },
  { areaKey: 'vip', name: 'VIP', count: 5 },
  { areaKey: 'sky', name: '\u5929\u697c', count: 13 }
]

function getTableKey(areaKey, tableNumber) {
  return `${areaKey}-${tableNumber}`
}

function buildSections(records = []) {
  const recordMap = (records || []).reduce((map, item) => {
    if (item && item.tableKey) map[item.tableKey] = item
    return map
  }, {})

  return TABLE_SECTIONS.map(section => ({
    ...section,
    tables: Array.from({ length: section.count }, (_, index) => {
      const tableNumber = String(index + 1).padStart(2, '0')
      const tableKey = getTableKey(section.areaKey, tableNumber)
      const record = recordMap[tableKey] || {}
      const qrCodeUrl = String(record.qrCodeUrl || '').trim()
      return {
        ...record,
        tableKey,
        areaKey: section.areaKey,
        tableNumber,
        qrCodeUrl,
        hasCode: !!qrCodeUrl
      }
    })
  }))
}

function getMissingTables(sections = []) {
  return (sections || []).reduce((list, section) => {
    return list.concat((section.tables || []).filter(item => !item.hasCode))
  }, [])
}

Page({
  data: {
    ui: UI,
    sections: buildSections(),
    loading: false,
    generatingKey: '',
    batchGenerating: false,
    batchProgress: ''
  },

  onLoad() {
    this.loadList()
  },

  onShow() {
    this.loadList()
  },

  async loadList() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const res = await apiClient.call('admin.tableCode.list')
      this.setData({
        sections: buildSections(res.data || []),
        loading: false
      })
    } catch (err) {
      console.error('load table codes failed', err)
      this.setData({ loading: false })
      wx.showToast({ title: err.message || UI.loadFailed, icon: 'none' })
    }
  },

  applyGeneratedCode(record) {
    if (!record || !record.tableKey) return
    const sections = (this.data.sections || []).map(section => ({
      ...section,
      tables: (section.tables || []).map(item => {
        if (item.tableKey !== record.tableKey) return item
        const qrCodeUrl = String(record.qrCodeUrl || '').trim()
        return {
          ...item,
          ...record,
          qrCodeUrl,
          hasCode: !!qrCodeUrl
        }
      })
    }))
    this.setData({ sections })
  },

  async requestGenerate(areaKey, tableNumber) {
    const res = await apiClient.call('admin.tableCode.generate', {
      areaKey,
      tableNumber
    })
    this.applyGeneratedCode(res.data || {})
    return res.data || {}
  },

  async generateCode(e) {
    const { areaKey, tableNumber, tableKey } = e.currentTarget.dataset
    if (!areaKey || !tableNumber || this.data.generatingKey || this.data.batchGenerating) return

    this.setData({ generatingKey: tableKey || getTableKey(areaKey, tableNumber) })
    try {
      await this.requestGenerate(areaKey, tableNumber)
      wx.showToast({ title: UI.generated, icon: 'success' })
    } catch (err) {
      console.error('generate table code failed', err)
      wx.showToast({ title: err.message || UI.generateFailed, icon: 'none' })
    } finally {
      this.setData({ generatingKey: '' })
    }
  },

  async generateMissingCodes() {
    if (this.data.batchGenerating || this.data.generatingKey) return
    const targets = getMissingTables(this.data.sections)
    if (targets.length === 0) {
      wx.showToast({ title: UI.allReady, icon: 'none' })
      return
    }

    this.setData({
      batchGenerating: true,
      batchProgress: `0/${targets.length}`
    })

    let failed = 0
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index]
      this.setData({
        generatingKey: target.tableKey,
        batchProgress: `${index + 1}/${targets.length}`
      })
      try {
        await this.requestGenerate(target.areaKey, target.tableNumber)
      } catch (err) {
        failed += 1
        console.error('generate missing table code failed', target.tableKey, err)
      }
    }

    this.setData({
      generatingKey: '',
      batchGenerating: false,
      batchProgress: ''
    })
    wx.showToast({
      title: failed ? `\u5b8c\u6210\uff0c${failed}\u5f20\u5931\u8d25` : UI.generated,
      icon: failed ? 'none' : 'success'
    })
  },

  previewCode(e) {
    const url = String(e.currentTarget.dataset.url || '').trim()
    if (!url) return
    wx.previewImage({
      current: url,
      urls: [url]
    })
  },

  saveCode(e) {
    const url = String(e.currentTarget.dataset.url || '').trim()
    if (!url) return
    wx.downloadFile({
      url,
      success: res => {
        if (res.statusCode !== 200) {
          wx.showToast({ title: UI.saveFailed, icon: 'none' })
          return
        }
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: UI.saved, icon: 'success' }),
          fail: () => wx.showToast({ title: UI.saveFailed, icon: 'none' })
        })
      },
      fail: () => wx.showToast({ title: UI.saveFailed, icon: 'none' })
    })
  }
})
