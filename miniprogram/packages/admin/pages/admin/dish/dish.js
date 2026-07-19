// packages/admin/pages/admin/dish/dish.js
const apiClient = require('../../../../../utils/apiClient')

const UI = {
  pageTitle: '\u83dc\u54c1\u7ba1\u7406',
  dineIn: '\u5802\u98df',
  camping: '\u9732\u8425',
  addCategory: '\u6dfb\u52a0\u5206\u7c7b',
  editCategory: '\u7f16\u8f91\u5206\u7c7b',
  addDish: '\u6dfb\u52a0\u83dc\u54c1',
  editDish: '\u7f16\u8f91\u83dc\u54c1',
  selectCategory: '\u8bf7\u9009\u62e9\u5206\u7c7b',
  emptyDish: '\u6682\u65e0\u83dc\u54c1',
  noImage: '\u6682\u65e0\u56fe\u7247',
  online: '\u5df2\u4e0a\u67b6',
  offline: '\u5df2\u4e0b\u67b6',
  setOnline: '\u4e0a\u67b6',
  setOffline: '\u4e0b\u67b6',
  edit: '\u7f16\u8f91',
  delete: '\u5220\u9664',
  cancel: '\u53d6\u6d88',
  save: '\u4fdd\u5b58',
  confirm: '\u786e\u8ba4',
  categoryName: '\u5206\u7c7b\u540d\u79f0',
  dishName: '\u83dc\u54c1\u540d\u79f0',
  price: '\u552e\u4ef7',
  originalPrice: '\u539f\u4ef7',
  unit: '\u5355\u4f4d',
  description: '\u63cf\u8ff0',
  image: '\u83dc\u54c1\u56fe\u7247',
  printer: '\u6253\u5370\u673a',
  printerNone: '\u4e0d\u6253\u5370',
  printerTip: '\u4e0d\u9009\u6253\u5370\u673a\u5219\u4e0d\u53d1\u9001\u540e\u53a8\u6253\u5370',
  sort: '\u6392\u5e8f',
  status: '\u4e0a\u67b6\u72b6\u6001',
  needPopup: '\u89c4\u683c\u5f39\u7a97',
  specTemplate: '\u89c4\u683c\u6a21\u677f',
  specPreviewTitle: '\u5f39\u7a97\u5185\u5bb9',
  specPreviewTip: '\u987e\u5ba2\u7aef\u5c06\u6309\u4ee5\u4e0b\u5185\u5bb9\u5c55\u793a',
  defaultSpecTitle: '\u53e3\u5473',
  specGroup: '\u9009\u9879',
  specRemark: '\u83dc\u54c1\u5907\u6ce8',
  specRemarkLimit: '\u6700\u591a10\u5b57',
  customSpecTitle: '\u81ea\u5b9a\u4e49\u6807\u9898',
  customSpecOptions: '\u81ea\u5b9a\u4e49\u9009\u9879',
  customSpecNote: '\u81ea\u5b9a\u4e49\u8bf4\u660e',
  inputCustomSpecTitle: '\u8bf7\u8f93\u5165\u6807\u9898',
  inputCustomSpecOptions: '\u8bf7\u8f93\u5165\u9009\u9879',
  inputCustomSpecNote: '\u53ef\u9009\u8bf4\u660e\uff0c\u4f1a\u663e\u793a\u5728\u5f39\u7a97\u91cc',
  customSpecOptionsTip: '\u7528\u987f\u53f7\u5206\u9694\uff0c\u4f8b\u5982\uff1a\u5c11\u82a5\u672b\u3001\u6b63\u5e38\u82a5\u672b',
  inputCategoryName: '\u8bf7\u8f93\u5165\u5206\u7c7b\u540d\u79f0',
  inputDishName: '\u8bf7\u8f93\u5165\u83dc\u54c1\u540d\u79f0',
  inputPrice: '\u8bf7\u8f93\u5165\u4ef7\u683c',
  inputUnit: '\u4f8b\u5982\uff1a\u4efd',
  inputDescription: '\u8bf7\u8f93\u5165\u63cf\u8ff0',
  uploadImage: '\u4e0a\u4f20\u56fe\u7247',
  changeImage: '\u66f4\u6362\u56fe\u7247',
  imageUploading: '\u4e0a\u4f20\u4e2d...',
  imageUploaded: '\u56fe\u7247\u5df2\u4e0a\u4f20',
  imageUploadFailed: '\u56fe\u7247\u4e0a\u4f20\u5931\u8d25',
  imageTooLarge: '\u56fe\u7247\u9700\u5c0f\u4e8e1MB',
  imageInvalid: '\u4ec5\u652f\u6301 jpg/png/webp',
  inputSort: '\u6570\u5b57\u8d8a\u5c0f\u8d8a\u9760\u524d',
  loading: '\u52a0\u8f7d\u4e2d...',
  saving: '\u4fdd\u5b58\u4e2d...',
  deleting: '\u5220\u9664\u4e2d...',
  saved: '\u4fdd\u5b58\u6210\u529f',
  deleted: '\u5220\u9664\u6210\u529f',
  failed: '\u64cd\u4f5c\u5931\u8d25',
  confirmDelete: '\u786e\u8ba4\u5220\u9664',
  confirmDeleteCategory: '\u786e\u5b9a\u5220\u9664\u8fd9\u4e2a\u5206\u7c7b\u5417\uff1f\u5176\u4e0b\u83dc\u54c1\u4f1a\u88ab\u4e0b\u67b6\u3002',
  confirmDeleteDish: '\u786e\u5b9a\u5220\u9664\u8fd9\u4e2a\u83dc\u54c1\u5417\uff1f',
  categoryRequired: '\u8bf7\u8f93\u5165\u5206\u7c7b\u540d\u79f0',
  dishRequired: '\u8bf7\u8f93\u5165\u83dc\u54c1\u540d\u79f0',
  priceRequired: '\u8bf7\u8f93\u5165\u6b63\u786e\u552e\u4ef7',
  currency: '\uffe5',
  slash: '/',
  defaultUnit: '\u4efd',
  searchPlaceholder: '\u641c\u7d22\u83dc\u54c1',
  searchResult: '\u641c\u7d22\u7ed3\u679c',
  emptySearch: '\u672a\u627e\u5230\u83dc\u54c1',
  clearSearch: '\u6e05\u7a7a',
  imageTip: '\u4ec5\u652f\u6301 jpg/png/webp\uff0c\u9009\u56fe\u540e\u53ef\u88c1\u526a\u4e3a\u65b9\u56fe\uff0c\u7cfb\u7edf\u4f1a\u81ea\u52a8\u538b\u7f29\u3002'
}

const DEFAULT_CATEGORY = {
  _id: '',
  name: '',
  sort: 0,
  status: 1
}

const DEFAULT_DISH = {
  _id: '',
  name: '',
  price: '',
  originalPrice: '',
  description: '',
  categoryId: '',
  categoryName: '',
  image: '',
  imagePreview: '',
  imageFileID: '',
  printerId: '',
  printerName: '',
  printerLabel: '\u4e0d\u6253\u5370',
  printerIndex: 0,
  unit: '\u4efd',
  status: 1,
  sort: 0,
  needPopup: false,
  needSpec: false,
  specTemplate: 'spicy',
  flavorTitle: '\u53e3\u5473',
  flavorOptions: [],
  flavorNote: '',
  optionGroups: [],
  customSpecTitle: '\u53e3\u5473',
  customSpecOptionsText: '',
  customSpecNote: '',
  tags: [],
  options: []
}

const MAX_IMAGE_SIZE = 1024 * 1024
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
const PRINTER_OPTIONS = [
  { label: UI.printerNone, value: '', name: '' },
  { label: '\u751f\u83dc\u6253\u5370\u673a', value: 'sheng2', name: '\u751f\u83dc\u6253\u5370\u673a' },
  { label: '\u719f\u98df\u6253\u5370\u673a', value: 'shu3', name: '\u719f\u98df\u6253\u5370\u673a' },
  { label: '\u751c\u54c1\u6253\u5370\u673a', value: 'tian4', name: '\u751c\u54c1\u6253\u5370\u673a' }
]
const DEFAULT_SPEC_OPTIONS = ['\u4e0d\u8fa3', '\u5fae\u8fa3', '\u6b63\u5e38\u8fa3']
const SPEC_TEMPLATES = [
  {
    label: '\u9ed8\u8ba4\u8fa3\u5ea6',
    value: 'spicy',
    title: '\u53e3\u5473',
    options: DEFAULT_SPEC_OPTIONS,
    note: ''
  },
  {
    label: '\u7cd6\u5ea6',
    value: 'sugar',
    title: '\u7cd6\u5ea6',
    options: ['\u65e0\u7cd6', '\u5fae\u7cd6', '\u6b63\u5e38\u7cd6'],
    note: '\u65e0\u7cd6\u6307\u7684\u662f\u4e0d\u989d\u5916\u52a0\u7cd6'
  },
  {
    label: '\u70ed\u5ea6',
    value: 'heat',
    title: '\u70ed\u5ea6',
    options: ['\u51b7', '\u70ed'],
    note: ''
  },
  {
    label: '\u7cd6\u5ea6+\u70ed\u5ea6',
    value: 'sugarHeat',
    title: '\u7cd6\u5ea6',
    options: ['\u65e0\u7cd6', '\u5fae\u7cd6', '\u6b63\u5e38\u7cd6'],
    note: '\u65e0\u7cd6\u6307\u7684\u662f\u4e0d\u989d\u5916\u52a0\u7cd6',
    optionGroups: [
      {
        id: 'temperature',
        title: '\u70ed\u5ea6',
        options: ['\u51b7', '\u70ed'],
        note: ''
      }
    ]
  },
  {
    label: '\u81ea\u5b9a\u4e49',
    value: 'custom'
  }
]

function showToast(title, icon = 'none') {
  wx.showToast({ title, icon })
}

function getPrinterOption(value) {
  const explicit = PRINTER_OPTIONS.find(item => item.value === value)
  if (explicit) return explicit
  return PRINTER_OPTIONS[0]
}

function normalizeDishPrinterFields(dish = {}) {
  const printerId = String(dish.printerId || dish.kitchenPrinterId || '').trim()
  const option = getPrinterOption(printerId)
  const printerIndex = PRINTER_OPTIONS.findIndex(item => item.value === option.value)
  return {
    ...dish,
    printerId: option.value,
    printerName: option.name,
    printerLabel: option.label,
    printerIndex: printerIndex >= 0 ? printerIndex : 0
  }
}

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function getFileExtension(filePath = '') {
  const cleanPath = String(filePath || '').split('?')[0].split('#')[0]
  const match = cleanPath.match(/\.([a-z0-9]+)$/i)
  return match ? match[1].toLowerCase() : ''
}

function getDishNeedPopup(dish = {}) {
  if (Object.prototype.hasOwnProperty.call(dish, 'needSpec')) {
    return dish.needSpec !== false
  }
  if (Object.prototype.hasOwnProperty.call(dish, 'needPopup')) {
    return dish.needPopup === true
  }
  return true
}

function normalizeOptionList(options) {
  if (!Array.isArray(options)) return []
  return options
    .map(option => String(option || '').trim())
    .filter(Boolean)
}

function splitSpecOptionsText(value) {
  return String(value || '')
    .split(/(?:\u3001|,|\uff0c|\s)+/)
    .map(option => option.trim())
    .filter(Boolean)
}

function formatSpecOptionsText(options) {
  return normalizeOptionList(options).join('\u3001')
}

function getSpecTemplate(templateValue) {
  return SPEC_TEMPLATES.find(item => item.value === templateValue) || SPEC_TEMPLATES[0]
}

function guessSpecTemplateByCategory(categoryName = '') {
  const name = String(categoryName || '')
  if (
    name.indexOf('\u8d35\u5dde\u51b0\u6d46') >= 0 ||
    name.indexOf('\u96ea\u51b0') >= 0 ||
    name.indexOf('\u751c\u54c1\u996e\u6599') >= 0
  ) {
    return 'sugar'
  }
  return 'spicy'
}

function getDishSpecTemplate(dish = {}, categoryName = '') {
  if (dish.specTemplate) return dish.specTemplate

  const title = String(dish.flavorTitle || '').trim()
  const options = normalizeOptionList(dish.flavorOptions)
  const optionGroups = Array.isArray(dish.optionGroups) ? dish.optionGroups : []
  const hasHeatGroup = optionGroups.some(group => {
    const groupTitle = String(group.title || group.name || '').trim()
    return groupTitle.indexOf('\u70ed\u5ea6') >= 0
  })

  if (title.indexOf('\u7cd6') >= 0 && hasHeatGroup) return 'sugarHeat'
  if (title.indexOf('\u7cd6') >= 0) return 'sugar'
  if (title.indexOf('\u70ed') >= 0) return 'heat'
  if (title && title !== UI.defaultSpecTitle) return 'custom'
  if (options.length && formatSpecOptionsText(options) !== formatSpecOptionsText(DEFAULT_SPEC_OPTIONS)) {
    return 'custom'
  }

  return guessSpecTemplateByCategory(categoryName || dish.categoryName)
}

function getCustomSpecFields(dish = {}) {
  const options = normalizeOptionList(dish.flavorOptions)
  const customOptions = options.length ? options : DEFAULT_SPEC_OPTIONS
  return {
    customSpecTitle: String(dish.customSpecTitle || dish.flavorTitle || UI.defaultSpecTitle).trim() || UI.defaultSpecTitle,
    customSpecOptionsText: String(dish.customSpecOptionsText || formatSpecOptionsText(customOptions)).trim(),
    customSpecNote: String(dish.customSpecNote || dish.flavorNote || '').trim()
  }
}

function cloneOptionGroups(optionGroups) {
  return (Array.isArray(optionGroups) ? optionGroups : []).map(group => ({
    ...group,
    options: normalizeOptionList(group.options)
  })).filter(group => group.options.length)
}

function applySpecTemplateToDish(dish = {}, templateValue = 'spicy') {
  const template = getSpecTemplate(templateValue)
  const next = {
    ...dish,
    specTemplate: template.value
  }

  if (template.value === 'custom') {
    const customFields = getCustomSpecFields(next)
    const customOptions = splitSpecOptionsText(customFields.customSpecOptionsText)
    const options = customOptions.length ? customOptions : DEFAULT_SPEC_OPTIONS
    return {
      ...next,
      ...customFields,
      customSpecOptionsText: customFields.customSpecOptionsText,
      flavorTitle: customFields.customSpecTitle || UI.defaultSpecTitle,
      flavorOptions: options,
      flavorNote: customFields.customSpecNote || '',
      optionGroups: []
    }
  }

  return {
    ...next,
    customSpecTitle: template.title,
    customSpecOptionsText: formatSpecOptionsText(template.options),
    customSpecNote: template.note || '',
    flavorTitle: template.title,
    flavorOptions: [...template.options],
    flavorNote: template.note || '',
    optionGroups: cloneOptionGroups(template.optionGroups)
  }
}

function prepareDishSpecForEditor(dish = {}, categoryName = '') {
  const templateValue = getDishSpecTemplate(dish, categoryName)
  return applySpecTemplateToDish({
    ...dish,
    ...getCustomSpecFields(dish)
  }, templateValue)
}

function buildSpecPreviewGroups(dish = {}) {
  const groups = []
  const flavorOptions = normalizeOptionList(dish.flavorOptions)
  const mainOptions = flavorOptions.length ? flavorOptions : DEFAULT_SPEC_OPTIONS
  groups.push({
    title: String(dish.flavorTitle || UI.defaultSpecTitle).trim() || UI.defaultSpecTitle,
    options: mainOptions,
    note: String(dish.flavorNote || '').trim()
  })

  const optionGroups = Array.isArray(dish.optionGroups) ? dish.optionGroups : []
  optionGroups.forEach((group, index) => {
    const options = normalizeOptionList(group.options)
    if (!options.length) return
    groups.push({
      title: String(group.title || group.name || `${UI.specGroup}${index + 1}`).trim(),
      options,
      note: String(group.note || '').trim()
    })
  })

  return groups
}

Page({
  data: {
    ui: UI,
    menuTypes: [
      { label: UI.dineIn, value: 'dineIn' },
      { label: UI.camping, value: 'camping' }
    ],
    currentMenuType: 'dineIn',
    categories: [],
    currentCategoryId: '',
    dishes: [],
    searchKeyword: '',
    isSearching: false,
    loadingCategories: false,
    loadingDishes: false,
    showCategoryModal: false,
    editCategoryMode: false,
    currentCategory: { ...DEFAULT_CATEGORY },
    showDishModal: false,
    editDishMode: false,
    currentDish: { ...DEFAULT_DISH },
    showPrinterDropdown: false,
    specPreviewGroups: [],
    printerOptions: PRINTER_OPTIONS,
    specTemplates: SPEC_TEMPLATES
  },

  onLoad() {
    this.loadCategories()
  },

  onUnload() {
    this.clearSearchTimer()
    this.searchToken = null
  },

  async changeMenuType(e) {
    const menuType = e.currentTarget.dataset.type
    if (!menuType || menuType === this.data.currentMenuType) return

    this.setData({
      currentMenuType: menuType,
      currentCategoryId: '',
      categories: [],
      dishes: [],
      searchKeyword: '',
      isSearching: false
    })
    this.searchToken = null
    await this.loadCategories()
  },

  async loadCategories() {
    this.setData({ loadingCategories: true })
    try {
      const res = await apiClient.call('admin.category.list', {
        menuType: this.data.currentMenuType
      })
      const categories = res.data || []
      const exists = categories.some(item => item._id === this.data.currentCategoryId)
      const currentCategoryId = exists
        ? this.data.currentCategoryId
        : (categories[0] ? categories[0]._id : '')

      this.setData({
        categories,
        currentCategoryId,
        loadingCategories: false
      })
      await this.loadDishes()
    } catch (err) {
      console.error('load categories failed', err)
      this.setData({ loadingCategories: false })
      showToast(err.message || UI.failed)
    }
  },

  async loadDishes() {
    if (!this.data.currentCategoryId) {
      this.setData({ dishes: [] })
      return
    }

    this.setData({ loadingDishes: true })
    try {
      const res = await apiClient.call('admin.dish.list', {
        menuType: this.data.currentMenuType,
        categoryId: this.data.currentCategoryId,
        limit: 100
      })
      this.setData({
        dishes: res.data || [],
        loadingDishes: false
      })
    } catch (err) {
      console.error('load dishes failed', err)
      this.setData({ loadingDishes: false })
      showToast(err.message || UI.failed)
    }
  },

  switchCategory(e) {
    const categoryId = e.currentTarget.dataset.id
    this.clearSearchTimer()
    this.searchToken = null
    this.setData({
      currentCategoryId: categoryId,
      searchKeyword: '',
      isSearching: false
    }, () => {
      this.loadDishes()
    })
  },

  clearSearchTimer() {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
      this.searchTimer = null
    }
  },

  onSearchInput(e) {
    const searchKeyword = e.detail.value || ''
    this.setData({ searchKeyword })
    this.clearSearchTimer()

    const keyword = searchKeyword.trim()
    if (!keyword) {
      this.searchToken = null
      this.setData({ isSearching: false }, () => {
        this.loadDishes()
      })
      return
    }

    this.searchTimer = setTimeout(() => {
      this.searchDishes(keyword)
    }, 260)
  },

  confirmSearch() {
    const keyword = String(this.data.searchKeyword || '').trim()
    if (keyword) {
      this.clearSearchTimer()
      this.searchDishes(keyword)
    }
  },

  clearSearch() {
    this.clearSearchTimer()
    this.searchToken = null
    this.setData({
      searchKeyword: '',
      isSearching: false
    }, () => {
      this.loadDishes()
    })
  },

  async searchDishes(keyword) {
    const currentKeyword = String(keyword || '').trim()
    if (!currentKeyword) {
      this.clearSearch()
      return
    }

    this.searchToken = Date.now()
    const token = this.searchToken
    this.setData({
      isSearching: true,
      loadingDishes: true
    })

    try {
      const res = await apiClient.call('admin.dish.list', {
        menuType: this.data.currentMenuType,
        keyword: currentKeyword,
        limit: 100
      })
      if (this.searchToken !== token) return

      this.setData({
        dishes: res.data || [],
        loadingDishes: false
      })
    } catch (err) {
      if (this.searchToken !== token) return
      console.error('search admin dishes failed', err)
      this.setData({ loadingDishes: false })
      showToast(err.message || UI.failed)
    }
  },

  showAddCategoryModal() {
    this.setData({
      showCategoryModal: true,
      editCategoryMode: false,
      currentCategory: {
        ...DEFAULT_CATEGORY,
        sort: this.data.categories.length
      }
    })
  },

  showEditCategoryModal(e) {
    const category = e.currentTarget.dataset.category
    this.setData({
      showCategoryModal: true,
      editCategoryMode: true,
      currentCategory: { ...DEFAULT_CATEGORY, ...category }
    })
  },

  closeCategoryModal() {
    this.setData({ showCategoryModal: false })
  },

  onCategoryNameInput(e) {
    this.setData({ 'currentCategory.name': e.detail.value })
  },

  onCategorySortInput(e) {
    this.setData({ 'currentCategory.sort': e.detail.value })
  },

  async saveCategory() {
    const category = {
      ...this.data.currentCategory,
      menuType: this.data.currentMenuType,
      sort: toNumber(this.data.currentCategory.sort)
    }

    if (!String(category.name || '').trim()) {
      showToast(UI.categoryRequired)
      return
    }

    try {
      wx.showLoading({ title: UI.saving })
      const res = await apiClient.call('admin.category.save', { category })
      wx.hideLoading()
      this.setData({
        showCategoryModal: false,
        currentCategoryId: res.data && res.data._id ? res.data._id : this.data.currentCategoryId
      })
      showToast(UI.saved, 'success')
      await this.loadCategories()
    } catch (err) {
      wx.hideLoading()
      console.error('save category failed', err)
      showToast(err.message || UI.failed)
    }
  },

  deleteCategory(e) {
    const category = e.currentTarget.dataset.category
    wx.showModal({
      title: UI.confirmDelete,
      content: UI.confirmDeleteCategory,
      success: async res => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: UI.deleting })
          await apiClient.call('admin.category.delete', { categoryId: category._id })
          wx.hideLoading()
          showToast(UI.deleted, 'success')
          this.setData({ currentCategoryId: '' })
          await this.loadCategories()
        } catch (err) {
          wx.hideLoading()
          console.error('delete category failed', err)
          showToast(err.message || UI.failed)
        }
      }
    })
  },

  showAddDishModal() {
    const currentCategory = this.data.categories.find(item => item._id === this.data.currentCategoryId)
    if (!currentCategory) {
      showToast(UI.selectCategory)
      return
    }

    const currentDish = normalizeDishPrinterFields(prepareDishSpecForEditor({
      ...DEFAULT_DISH,
      categoryId: currentCategory._id,
      categoryName: currentCategory.name,
      menuType: this.data.currentMenuType,
      sort: this.data.dishes.length
    }, currentCategory.name))

    this.setData({
      showDishModal: true,
      editDishMode: false,
      showPrinterDropdown: false,
      currentDish,
      specPreviewGroups: buildSpecPreviewGroups(currentDish)
    })
  },

  showEditDishModal(e) {
    const dish = e.currentTarget.dataset.dish
    const currentDish = normalizeDishPrinterFields(prepareDishSpecForEditor({
      ...DEFAULT_DISH,
      ...dish,
      image: dish.imageFileID || dish.image || '',
      imagePreview: dish.image || dish.imageFileID || '',
      imageFileID: dish.imageFileID || '',
      needPopup: getDishNeedPopup(dish),
      needSpec: getDishNeedPopup(dish)
    }, dish.categoryName))

    this.setData({
      showDishModal: true,
      editDishMode: true,
      showPrinterDropdown: false,
      currentDish,
      specPreviewGroups: buildSpecPreviewGroups(currentDish)
    })
  },

  closeDishModal() {
    this.setData({
      showDishModal: false,
      showPrinterDropdown: false
    })
  },

  onDishInput(e) {
    const field = e.currentTarget.dataset.field
    if (!field) return
    this.setData({ [`currentDish.${field}`]: e.detail.value })
  },

  onDishStatusChange(e) {
    this.setData({ 'currentDish.status': e.detail.value ? 1 : 0 })
  },

  onDishNeedPopupChange(e) {
    const needPopup = !!e.detail.value
    let currentDish = {
      ...this.data.currentDish,
      needPopup,
      needSpec: needPopup
    }
    if (needPopup) {
      currentDish = applySpecTemplateToDish(currentDish, currentDish.specTemplate || 'spicy')
    }
    this.setData({
      currentDish,
      specPreviewGroups: buildSpecPreviewGroups(currentDish)
    })
  },

  togglePrinterDropdown() {
    this.setData({
      showPrinterDropdown: !this.data.showPrinterDropdown
    })
  },

  selectPrinterOption(e) {
    const index = Number(e.currentTarget.dataset.index || 0)
    const option = this.data.printerOptions[index] || this.data.printerOptions[0]
    this.setData({
      'currentDish.printerId': option.value,
      'currentDish.printerName': option.name,
      'currentDish.printerLabel': option.label,
      'currentDish.printerIndex': index,
      showPrinterDropdown: false
    })
  },

  selectSpecTemplate(e) {
    const templateValue = e.currentTarget.dataset.template
    const currentDish = applySpecTemplateToDish({
      ...this.data.currentDish,
      needPopup: true,
      needSpec: true
    }, templateValue)

    this.setData({
      currentDish,
      specPreviewGroups: buildSpecPreviewGroups(currentDish)
    })
  },

  onCustomSpecInput(e) {
    const field = e.currentTarget.dataset.field
    if (!field) return

    const currentDish = applySpecTemplateToDish({
      ...this.data.currentDish,
      [field]: e.detail.value,
      specTemplate: 'custom',
      needPopup: true,
      needSpec: true
    }, 'custom')

    this.setData({
      currentDish,
      specPreviewGroups: buildSpecPreviewGroups(currentDish)
    })
  },

  chooseDishImage() {
    if (!wx.chooseMedia) {
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async res => {
          const filePath = res.tempFilePaths && res.tempFilePaths[0]
          if (!filePath) return

          try {
            const croppedPath = await this.cropDishImage(filePath)
            if (!croppedPath) return
            await this.uploadDishImage(croppedPath)
          } catch (err) {
            wx.hideLoading()
            console.error('upload dish image failed', err)
            showToast(err.message || UI.imageUploadFailed)
          }
        }
      })
      return
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async res => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file || !file.tempFilePath) return

        try {
          const croppedPath = await this.cropDishImage(file.tempFilePath)
          if (!croppedPath) return
          await this.uploadDishImage(croppedPath, file.size || 0)
        } catch (err) {
          wx.hideLoading()
          console.error('upload dish image failed', err)
          showToast(err.message || UI.imageUploadFailed)
        }
      }
    })
  },

  cropDishImage(filePath) {
    if (!wx.cropImage) return Promise.resolve(filePath)

    return new Promise((resolve, reject) => {
      wx.cropImage({
        src: filePath,
        cropScale: '1:1',
        success: res => resolve(res.tempFilePath || filePath),
        fail: err => {
          if (/cancel/i.test(String(err && err.errMsg || ''))) {
            resolve('')
            return
          }
          reject(err)
        }
      })
    })
  },

  getFileInfo(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileInfo({
        filePath,
        success: resolve,
        fail: reject
      })
    })
  },

  compressImage(filePath, quality = 72) {
    return new Promise(resolve => {
      wx.compressImage({
        src: filePath,
        quality,
        success: res => resolve(res.tempFilePath || filePath),
        fail: () => resolve(filePath)
      })
    })
  },

  uploadDishImageFile(filePath, dish = {}) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: apiClient.getBaseUrl(),
        filePath,
        name: 'file',
        formData: {
          tenantId: apiClient.TENANT_ID,
          adminAuthToken: apiClient.getAdminAuthToken(),
          action: 'admin.dish.uploadFile',
          dishId: dish._id || '',
          dishName: dish.name || ''
        },
        timeout: 30000,
        success: res => {
          let result = {}
          try {
            result = typeof res.data === 'string' ? JSON.parse(res.data) : (res.data || {})
          } catch (err) {
            result = {}
          }

          if (res.statusCode >= 200 && res.statusCode < 300 && result.success !== false) {
            resolve(result.data || {})
            return
          }

          const error = new Error(result.message || `upload failed: ${res.statusCode}`)
          error.code = result.code || ''
          reject(error)
        },
        fail: reject
      })
    })
  },

  async uploadDishImage(filePath, originalSize = 0) {
    const ext = getFileExtension(filePath)
    if (ext && !ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      showToast(UI.imageInvalid)
      return
    }

    wx.showLoading({ title: UI.imageUploading })

    let compressTarget = ext === 'webp' ? filePath : await this.compressImage(filePath)
    let fileInfo = await this.getFileInfo(compressTarget)
    let finalSize = fileInfo.size || originalSize || 0
    if (finalSize > MAX_IMAGE_SIZE && ext !== 'webp') {
      compressTarget = await this.compressImage(filePath, 45)
      fileInfo = await this.getFileInfo(compressTarget)
      finalSize = fileInfo.size || originalSize || 0
    }

    if (finalSize > MAX_IMAGE_SIZE) {
      wx.hideLoading()
      showToast(UI.imageTooLarge)
      return
    }

    const currentDish = this.data.currentDish || {}
    const data = await this.uploadDishImageFile(compressTarget, currentDish)
    const fileID = data.fileID || ''

    wx.hideLoading()
    this.setData({
      'currentDish.image': fileID,
      'currentDish.imageFileID': fileID,
      'currentDish.imagePreview': data.image || compressTarget
    })
    showToast(UI.imageUploaded, 'success')

    if (currentDish._id && !this.data.showDishModal) {
      await this.loadDishes()
    }
  },

  async saveDish() {
    const currentDish = this.data.currentDish || {}
    const dish = {
      ...currentDish,
      image: currentDish.imageFileID || currentDish.image || '',
      needPopup: currentDish.needPopup === true,
      needSpec: currentDish.needPopup === true,
      printerId: currentDish.printerId || '',
      printerName: currentDish.printerName || '',
      menuType: this.data.currentMenuType,
      categoryId: currentDish.categoryId || this.data.currentCategoryId,
      categoryName: currentDish.categoryName || this.getCurrentCategoryName(),
      price: toNumber(currentDish.price, -1),
      originalPrice: toNumber(currentDish.originalPrice),
      sort: toNumber(currentDish.sort)
    }

    if (!String(dish.name || '').trim()) {
      showToast(UI.dishRequired)
      return
    }

    if (dish.price < 0) {
      showToast(UI.priceRequired)
      return
    }

    try {
      wx.showLoading({ title: UI.saving })
      await apiClient.call('admin.dish.save', { dish })
      wx.hideLoading()
      this.setData({
        showDishModal: false,
        showPrinterDropdown: false
      })
      showToast(UI.saved, 'success')
      if (this.data.isSearching && this.data.searchKeyword.trim()) {
        await this.searchDishes(this.data.searchKeyword)
      } else {
        await this.loadDishes()
      }
    } catch (err) {
      wx.hideLoading()
      console.error('save dish failed', err)
      showToast(err.message || UI.failed)
    }
  },

  async toggleDishStatus(e) {
    const dish = e.currentTarget.dataset.dish
    const status = dish.status === 1 ? 0 : 1
    try {
      await apiClient.call('admin.dish.status', {
        dishId: dish._id,
        status
      })
      if (this.data.isSearching && this.data.searchKeyword.trim()) {
        await this.searchDishes(this.data.searchKeyword)
      } else {
        await this.loadDishes()
      }
    } catch (err) {
      console.error('toggle dish status failed', err)
      showToast(err.message || UI.failed)
    }
  },

  deleteDish(e) {
    const dish = e.currentTarget.dataset.dish
    wx.showModal({
      title: UI.confirmDelete,
      content: UI.confirmDeleteDish,
      success: async res => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: UI.deleting })
          await apiClient.call('admin.dish.delete', { dishId: dish._id })
          wx.hideLoading()
          showToast(UI.deleted, 'success')
          if (this.data.isSearching && this.data.searchKeyword.trim()) {
            await this.searchDishes(this.data.searchKeyword)
          } else {
            await this.loadDishes()
          }
        } catch (err) {
          wx.hideLoading()
          console.error('delete dish failed', err)
          showToast(err.message || UI.failed)
        }
      }
    })
  },

  getCurrentCategoryName() {
    const category = this.data.categories.find(item => item._id === this.data.currentCategoryId)
    return category ? category.name : ''
  },

  stopPropagation() {}
})
