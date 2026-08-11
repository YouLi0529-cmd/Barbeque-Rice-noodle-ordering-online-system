// packages/admin/pages/admin/dish/dish.js
const apiClient = require('../../../../../utils/apiClient')

const UI = {
  pageTitle: '\u83dc\u54c1\u7ba1\u7406',
  contentDish: '\u83dc\u54c1',
  contentPackage: '\u5957\u9910',
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
  dishCategory: '\u6240\u5c5e\u5206\u7c7b',
  dishName: '\u83dc\u54c1\u540d\u79f0',
  price: '\u552e\u4ef7',
  originalPrice: '\u539f\u4ef7',
  unit: '\u5355\u4f4d',
  description: '\u63cf\u8ff0',
  image: '\u83dc\u54c1\u56fe\u7247',
  station: '\u51fa\u54c1\u6863\u53e3',
  stationNone: '\u4e0d\u6253\u5370',
  stationTip: '\u4e0d\u9009\u51fa\u54c1\u6863\u53e3\u5219\u4e0d\u5411\u540e\u53a8\u53d1\u9001\u8fd9\u9053\u83dc',
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
  searchPackagePlaceholder: '\u641c\u7d22\u5957\u9910',
  searchResult: '\u641c\u7d22\u7ed3\u679c',
  emptySearch: '\u672a\u627e\u5230\u83dc\u54c1',
  clearSearch: '\u6e05\u7a7a',
  imageTip: '\u4ec5\u652f\u6301 jpg/png/webp\uff0c\u9009\u56fe\u540e\u53ef\u88c1\u526a\u4e3a\u65b9\u56fe\uff0c\u7cfb\u7edf\u4f1a\u81ea\u52a8\u538b\u7f29\u3002',
  addPackage: '\u6dfb\u52a0\u5957\u9910',
  editPackage: '\u7f16\u8f91\u5957\u9910',
  emptyPackage: '\u6682\u65e0\u5957\u9910',
  packageName: '\u5957\u9910\u540d\u79f0',
  packageItems: '\u5957\u9910\u5305\u542b\u83dc\u54c1',
  packagePrice: '\u5957\u9910\u552e\u4ef7',
  inputPackageName: '\u8bf7\u8f93\u5165\u5957\u9910\u540d\u79f0',
  packageRequired: '\u8bf7\u8f93\u5165\u5957\u9910\u540d\u79f0',
  packageItemsRequired: '\u81f3\u5c11\u9009\u62e9\u4e00\u9053\u5957\u9910\u83dc\u54c1',
  confirmDeletePackage: '\u786e\u5b9a\u5220\u9664\u8fd9\u4e2a\u5957\u9910\u5417\uff1f',
  packageInternalTip: '\u5957\u9910\u4ec5\u4f9b\u5546\u6237\u7aef\u4f7f\u7528\uff0c\u4e0d\u4f1a\u51fa\u73b0\u5728\u987e\u5ba2\u70b9\u5355\u9875\u3002'
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
  categoryIndex: 0,
  image: '',
  imagePreview: '',
  imageFileID: '',
  stationId: '',
  stationName: '',
  stationLabel: '\u4e0d\u6253\u5370',
  stationIndex: 0,
  printEnabled: false,
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

const DEFAULT_PACKAGE = {
  _id: '',
  name: '',
  price: '',
  description: '',
  status: 1,
  sort: 0,
  items: []
}

const MAX_IMAGE_SIZE = 1024 * 1024
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
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
    label: '\u5fae\u8fa3/\u6b63\u5e38/\u52a0\u8fa3',
    value: 'spicyPlus',
    title: '\u53e3\u5473',
    options: ['\u5fae\u8fa3', '\u6b63\u5e38', '\u52a0\u8fa3'],
    note: ''
  },
  {
    label: '\u82a5\u672b',
    value: 'mustard',
    title: '\u53e3\u5473',
    options: ['\u5c11\u82a5\u672b', '\u6b63\u5e38\u82a5\u672b'],
    note: ''
  },
  {
    label: '\u6728\u59dc\u5b50',
    value: 'mujiangzi',
    title: '\u53e3\u5473',
    options: ['\u5c11\u6728\u59dc\u5b50', '\u6b63\u5e38\u6728\u59dc\u5b50', '\u591a\u6728\u59dc\u5b50'],
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
    label: '\u7cd6\u5ea6+\u4ec5\u70ed',
    value: 'sugarHotOnly',
    title: '\u7cd6\u5ea6',
    options: ['\u65e0\u7cd6', '\u5fae\u7cd6', '\u6b63\u5e38\u7cd6'],
    note: '\u65e0\u7cd6\u6307\u7684\u662f\u4e0d\u989d\u5916\u52a0\u7cd6',
    optionGroups: [
      {
        id: 'temperature',
        title: '\u70ed\u5ea6',
        options: ['\u70ed'],
        note: '\u53ea\u6709\u70ed'
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

function buildStationOptions(stations = []) {
  return [
    { label: UI.stationNone, value: '', name: '' },
    ...(Array.isArray(stations) ? stations : []).map(station => ({
      label: station.name || UI.stationNone,
      value: String(station._id || '').trim(),
      name: station.name || ''
    })).filter(option => option.value)
  ]
}

function getStationOption(value, stationOptions = []) {
  const explicit = stationOptions.find(item => item.value === value)
  if (explicit) return explicit
  return stationOptions[0] || { label: UI.stationNone, value: '', name: '' }
}

function normalizeDishStationFields(dish = {}, stationOptions = []) {
  const stationId = String(dish.stationId || '').trim()
  const option = getStationOption(stationId, stationOptions)
  const stationIndex = stationOptions.findIndex(item => item.value === option.value)
  return {
    ...dish,
    stationId: option.value,
    stationName: option.name,
    stationLabel: option.label,
    stationIndex: stationIndex >= 0 ? stationIndex : 0,
    printEnabled: !!option.value
  }
}

function normalizeDishCategoryFields(dish = {}, categories = []) {
  const categoryId = String(dish.categoryId || '').trim()
  const categoryIndex = (Array.isArray(categories) ? categories : [])
    .findIndex(category => category._id === categoryId)
  const category = categoryIndex >= 0 ? categories[categoryIndex] : null
  return {
    ...dish,
    categoryId: category ? category._id : categoryId,
    categoryName: category ? category.name || '' : String(dish.categoryName || '').trim(),
    categoryIndex: categoryIndex >= 0 ? categoryIndex : 0
  }
}

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function getPackageItemCount(items, dishId) {
  const item = (Array.isArray(items) ? items : []).find(entry => entry.dishId === dishId)
  return item ? Math.max(0, Number(item.count || 0)) : 0
}

function buildPackageDishCatalog(dishes = [], items = []) {
  return (Array.isArray(dishes) ? dishes : []).map(dish => ({
    ...dish,
    selectedCount: getPackageItemCount(items, dish._id),
    selected: getPackageItemCount(items, dish._id) > 0
  }))
}

function findPackageDishResults(dishes = [], keyword = '') {
  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  if (!normalizedKeyword) return []
  return (Array.isArray(dishes) ? dishes : [])
    .filter(dish => {
      const name = String(dish.name || '').toLowerCase()
      const categoryName = String(dish.categoryName || '').toLowerCase()
      return name.includes(normalizedKeyword) || categoryName.includes(normalizedKeyword)
    })
    .slice(0, 12)
}

function buildPackageItemSummary(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter(item => item && item.dishName && Number(item.count || 0) > 0)
    .map(item => `${item.dishName} x${item.count}`)
    .join('\u3001')
}

function normalizePackageForList(mealPackage = {}) {
  const items = Array.isArray(mealPackage.items) ? mealPackage.items : []
  return {
    ...mealPackage,
    items,
    itemSummary: buildPackageItemSummary(items),
    itemCount: items.reduce((sum, item) => sum + Number(item.count || 0), 0)
  }
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

function isSameOptionList(left, right) {
  const leftOptions = normalizeOptionList(left)
  const rightOptions = normalizeOptionList(right)
  return leftOptions.length === rightOptions.length && leftOptions.every((item, index) => item === rightOptions[index])
}

function getOptionGroupsSignature(optionGroups) {
  return (Array.isArray(optionGroups) ? optionGroups : [])
    .map(group => {
      const options = normalizeOptionList(group.options)
      if (!options.length) return ''
      const title = String(group.title || group.name || '').trim()
      const note = String(group.note || '').trim()
      return `${title}\u0001${options.join('\u0001')}\u0001${note}`
    })
    .filter(Boolean)
    .join('\u0002')
}

function isDishMatchingSpecTemplate(dish = {}, template = {}) {
  const title = String(dish.flavorTitle || UI.defaultSpecTitle).trim() || UI.defaultSpecTitle
  const templateTitle = String(template.title || UI.defaultSpecTitle).trim() || UI.defaultSpecTitle
  return title === templateTitle &&
    isSameOptionList(dish.flavorOptions, template.options) &&
    String(dish.flavorNote || '').trim() === String(template.note || '').trim() &&
    getOptionGroupsSignature(dish.optionGroups) === getOptionGroupsSignature(template.optionGroups)
}

function getDishSpecTemplate(dish = {}, categoryName = '') {
  const options = normalizeOptionList(dish.flavorOptions)
  const optionGroups = Array.isArray(dish.optionGroups) ? dish.optionGroups : []
  const hasStoredSpecContent = options.length > 0 || optionGroups.some(group => normalizeOptionList(group.options).length > 0)

  // The customer-facing fields are the source of truth. A stale template label must not overwrite them.
  if (hasStoredSpecContent) {
    const matchingTemplate = SPEC_TEMPLATES.find(template => {
      return template.value !== 'custom' && isDishMatchingSpecTemplate(dish, template)
    })
    return matchingTemplate ? matchingTemplate.value : 'custom'
  }

  const storedTemplate = String(dish.specTemplate || '').trim()
  if (SPEC_TEMPLATES.some(template => template.value === storedTemplate)) return storedTemplate
  return guessSpecTemplateByCategory(categoryName || dish.categoryName)
}

function getCustomSpecFields(dish = {}) {
  const options = normalizeOptionList(dish.flavorOptions)
  return {
    customSpecTitle: String(dish.flavorTitle || dish.customSpecTitle || UI.defaultSpecTitle).trim() || UI.defaultSpecTitle,
    customSpecOptionsText: options.length
      ? formatSpecOptionsText(options)
      : String(dish.customSpecOptionsText || '').trim(),
    customSpecNote: String(dish.flavorNote || dish.customSpecNote || '').trim()
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
  const next = {
    ...dish,
    ...getCustomSpecFields(dish)
  }
  const templateValue = getDishSpecTemplate(dish, categoryName)
  const flavorOptions = normalizeOptionList(next.flavorOptions)
  const optionGroups = cloneOptionGroups(next.optionGroups)

  // Only a new/incomplete popup needs a preset filled in. Existing dish options stay untouched.
  if (getDishNeedPopup(next) && !flavorOptions.length && !optionGroups.length) {
    return applySpecTemplateToDish(next, templateValue)
  }

  return {
    ...next,
    specTemplate: templateValue,
    flavorTitle: String(next.flavorTitle || UI.defaultSpecTitle).trim() || UI.defaultSpecTitle,
    flavorOptions,
    flavorNote: String(next.flavorNote || '').trim(),
    optionGroups
  }
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
    managementTabs: [
      { label: UI.dineIn, value: 'dineIn', menuType: 'dineIn', contentMode: 'dish' },
      { label: UI.camping, value: 'camping', menuType: 'camping', contentMode: 'dish' },
      { label: UI.contentPackage, value: 'package', menuType: 'dineIn', contentMode: 'package' }
    ],
    currentManagementTab: 'dineIn',
    currentContentMode: 'dish',
    currentMenuType: 'dineIn',
    categories: [],
    currentCategoryId: '',
    dishes: [],
    packages: [],
    packageDishCatalog: [],
    loadingPackages: false,
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
    showPackageModal: false,
    editPackageMode: false,
    currentPackage: { ...DEFAULT_PACKAGE },
    packageDishKeyword: '',
    packageSearchResults: [],
    showCategoryDropdown: false,
    showStationDropdown: false,
    specPreviewGroups: [],
    stationOptions: buildStationOptions(),
    specTemplates: SPEC_TEMPLATES
  },

  onLoad() {
    this.loadPrintStations()
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
      packages: [],
      searchKeyword: '',
      isSearching: false
    })
    this.searchToken = null
    await this.loadCategories()
    if (this.data.currentContentMode === 'package') await this.loadPackages()
  },

  async changeContentMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (!mode || mode === this.data.currentContentMode) return

    this.clearSearchTimer()
    this.searchToken = null
    this.setData({
      currentContentMode: mode,
      searchKeyword: '',
      isSearching: false
    })
    if (mode === 'package') {
      await this.loadPackages()
      return
    }
    await this.loadCategories()
  },

  async changeManagementTab(e) {
    const value = e.currentTarget.dataset.value
    const tab = this.data.managementTabs.find(item => item.value === value)
    if (!tab || tab.value === this.data.currentManagementTab) return

    this.clearSearchTimer()
    this.searchToken = null
    this.setData({
      currentManagementTab: tab.value,
      currentContentMode: tab.contentMode,
      currentMenuType: tab.menuType,
      currentCategoryId: '',
      categories: [],
      dishes: [],
      packages: [],
      searchKeyword: '',
      isSearching: false
    })

    if (tab.contentMode === 'package') {
      await this.loadPackages()
      return
    }
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

  async loadPrintStations() {
    try {
      const res = await apiClient.call('admin.print.stations.list')
      const stationOptions = buildStationOptions(res.data || [])
      const currentDish = this.data.showDishModal
        ? normalizeDishStationFields(this.data.currentDish || {}, stationOptions)
        : this.data.currentDish
      this.setData({ stationOptions, currentDish })
      return stationOptions
    } catch (err) {
      console.error('load print stations failed', err)
      return this.data.stationOptions
    }
  },

  async loadDishPrintRoute(dishId) {
    if (!dishId) return
    try {
      const res = await apiClient.call('admin.print.dishes.get', { dishId })
      const currentDish = this.data.currentDish || {}
      if (!this.data.showDishModal || currentDish._id !== dishId) return

      const route = res.data || {}
      const nextDish = normalizeDishStationFields({
        ...currentDish,
        stationId: route.printEnabled ? route.stationId || '' : '',
        stationName: route.printEnabled ? route.stationName || '' : '',
        printEnabled: route.printEnabled === true
      }, this.data.stationOptions)
      this.setData({ currentDish: nextDish })
    } catch (err) {
      console.error('load dish print route failed', err)
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

  async loadPackages(keyword = '') {
    this.setData({ loadingPackages: true })
    try {
      const res = await apiClient.call('admin.package.list', {
        menuType: this.data.currentMenuType,
        keyword: String(keyword || '').trim(),
        limit: 100
      })
      this.setData({
        packages: (res.data || []).map(normalizePackageForList),
        loadingPackages: false
      })
    } catch (err) {
      console.error('load packages failed', err)
      this.setData({ loadingPackages: false })
      showToast(err.message || UI.failed)
    }
  },

  async loadPackageDishCatalog(items = []) {
    const res = await apiClient.call('admin.package.dishOptions', {
      menuType: this.data.currentMenuType,
      limit: 100
    })
    const packageDishCatalog = buildPackageDishCatalog(res.data || [], items)
    this.setData({
      packageDishCatalog,
      packageSearchResults: findPackageDishResults(packageDishCatalog, this.data.packageDishKeyword)
    })
    return packageDishCatalog
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
        if (this.data.currentContentMode === 'package') this.loadPackages()
        else this.loadDishes()
      })
      return
    }

    this.searchTimer = setTimeout(() => {
      if (this.data.currentContentMode === 'package') this.searchPackages(keyword)
      else this.searchDishes(keyword)
    }, 260)
  },

  confirmSearch() {
    const keyword = String(this.data.searchKeyword || '').trim()
    if (keyword) {
      this.clearSearchTimer()
      if (this.data.currentContentMode === 'package') this.searchPackages(keyword)
      else this.searchDishes(keyword)
    }
  },

  clearSearch() {
    this.clearSearchTimer()
    this.searchToken = null
    this.setData({
      searchKeyword: '',
      isSearching: false
    }, () => {
      if (this.data.currentContentMode === 'package') this.loadPackages()
      else this.loadDishes()
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

  async searchPackages(keyword) {
    const currentKeyword = String(keyword || '').trim()
    if (!currentKeyword) {
      this.clearSearch()
      return
    }
    this.searchToken = Date.now()
    const token = this.searchToken
    this.setData({ isSearching: true, loadingPackages: true })
    try {
      const res = await apiClient.call('admin.package.list', {
        menuType: this.data.currentMenuType,
        keyword: currentKeyword,
        limit: 100
      })
      if (this.searchToken !== token) return
      this.setData({
        packages: (res.data || []).map(normalizePackageForList),
        loadingPackages: false
      })
    } catch (err) {
      if (this.searchToken !== token) return
      console.error('search packages failed', err)
      this.setData({ loadingPackages: false })
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

  async showAddDishModal() {
    const currentCategory = this.data.categories.find(item => item._id === this.data.currentCategoryId)
    if (!currentCategory) {
      showToast(UI.selectCategory)
      return
    }

    if (this.data.stationOptions.length <= 1) await this.loadPrintStations()
    const currentDish = normalizeDishCategoryFields(normalizeDishStationFields(prepareDishSpecForEditor({
      ...DEFAULT_DISH,
      categoryId: currentCategory._id,
      categoryName: currentCategory.name,
      menuType: this.data.currentMenuType,
      sort: this.data.dishes.length
    }, currentCategory.name), this.data.stationOptions), this.data.categories)

    this.setData({
      showDishModal: true,
      editDishMode: false,
      showCategoryDropdown: false,
      showStationDropdown: false,
      currentDish,
      specPreviewGroups: buildSpecPreviewGroups(currentDish)
    })
  },

  async showEditDishModal(e) {
    const dish = e.currentTarget.dataset.dish
    if (this.data.stationOptions.length <= 1) await this.loadPrintStations()
    const currentDish = normalizeDishCategoryFields(normalizeDishStationFields(prepareDishSpecForEditor({
      ...DEFAULT_DISH,
      ...dish,
      image: dish.imageFileID || dish.image || '',
      imagePreview: dish.image || dish.imageFileID || '',
      imageFileID: dish.imageFileID || '',
      needPopup: getDishNeedPopup(dish),
      needSpec: getDishNeedPopup(dish)
    }, dish.categoryName), this.data.stationOptions), this.data.categories)

    this.setData({
      showDishModal: true,
      editDishMode: true,
      showCategoryDropdown: false,
      showStationDropdown: false,
      currentDish,
      specPreviewGroups: buildSpecPreviewGroups(currentDish)
    }, () => {
      this.loadDishPrintRoute(dish._id)
    })
  },

  closeDishModal() {
    this.setData({
      showDishModal: false,
      showCategoryDropdown: false,
      showStationDropdown: false
    })
  },

  onDishInput(e) {
    const field = e.currentTarget.dataset.field
    if (!field) return
    this.setData({ [`currentDish.${field}`]: e.detail.value })
  },

  toggleDishCategoryDropdown() {
    this.setData({
      showCategoryDropdown: !this.data.showCategoryDropdown,
      showStationDropdown: false
    })
  },

  closeDishCategoryDropdown() {
    this.setData({ showCategoryDropdown: false })
  },

  selectDishCategory(e) {
    const categoryIndex = Number(e.currentTarget.dataset.index)
    const category = this.data.categories[categoryIndex]
    if (!category) return
    this.setData({
      'currentDish.categoryId': category._id,
      'currentDish.categoryName': category.name || '',
      'currentDish.categoryIndex': categoryIndex,
      showCategoryDropdown: false
    })
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

  toggleStationDropdown() {
    this.setData({
      showStationDropdown: !this.data.showStationDropdown,
      showCategoryDropdown: false
    })
  },

  selectStationOption(e) {
    const index = Number(e.currentTarget.dataset.index || 0)
    const option = this.data.stationOptions[index] || this.data.stationOptions[0]
    this.setData({
      'currentDish.stationId': option.value,
      'currentDish.stationName': option.name,
      'currentDish.stationLabel': option.label,
      'currentDish.stationIndex': index,
      'currentDish.printEnabled': !!option.value,
      showStationDropdown: false
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
      printerId: '',
      printerName: '',
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
      const saveRes = await apiClient.call('admin.dish.save', { dish })
      const dishId = saveRes && saveRes.data && saveRes.data._id
      if (!dishId) throw new Error(UI.failed)

      await apiClient.call('admin.print.dishes.save', {
        dishIds: [dishId],
        stationId: currentDish.stationId || '',
        printEnabled: currentDish.printEnabled === true && !!currentDish.stationId
      })
      wx.hideLoading()
      this.setData({
        showDishModal: false,
        showCategoryDropdown: false,
        showStationDropdown: false
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

  async showAddPackageModal() {
    try {
      const currentPackage = {
        ...DEFAULT_PACKAGE,
        menuType: this.data.currentMenuType,
        sort: this.data.packages.length
      }
      await this.loadPackageDishCatalog(currentPackage.items)
      this.setData({
        showPackageModal: true,
        editPackageMode: false,
      currentPackage,
      packageDishKeyword: '',
      packageSearchResults: []
      })
    } catch (err) {
      console.error('open add package modal failed', err)
      showToast(err.message || UI.failed)
    }
  },

  async showEditPackageModal(e) {
    const mealPackage = e.currentTarget.dataset.package
    if (!mealPackage) return
    try {
      const currentPackage = {
        ...DEFAULT_PACKAGE,
        ...mealPackage,
        items: (mealPackage.items || []).map(item => ({ ...item }))
      }
      await this.loadPackageDishCatalog(currentPackage.items)
      this.setData({
        showPackageModal: true,
        editPackageMode: true,
        currentPackage,
        packageDishKeyword: '',
        packageSearchResults: []
      })
    } catch (err) {
      console.error('open edit package modal failed', err)
      showToast(err.message || UI.failed)
    }
  },

  closePackageModal() {
    this.setData({
      showPackageModal: false,
      packageDishKeyword: '',
      packageDishCatalog: [],
      packageSearchResults: []
    })
  },

  onPackageInput(e) {
    const field = e.currentTarget.dataset.field
    if (!field) return
    this.setData({ [`currentPackage.${field}`]: e.detail.value })
  },

  onPackageStatusChange(e) {
    this.setData({ 'currentPackage.status': e.detail.value ? 1 : 0 })
  },

  onPackageDishSearch(e) {
    const packageDishKeyword = String(e.detail.value || '').trim()
    this.setData({
      packageDishKeyword,
      packageSearchResults: findPackageDishResults(this.data.packageDishCatalog, packageDishKeyword)
    })
  },

  getPackageDishItemsWithCount(dishId, nextCount) {
    const currentItems = (this.data.currentPackage.items || []).map(item => ({ ...item }))
    const index = currentItems.findIndex(item => item.dishId === dishId)
    if (nextCount <= 0) {
      if (index >= 0) currentItems.splice(index, 1)
      return currentItems
    }

    const selectedDish = this.data.packageDishCatalog.find(item => item._id === dishId) || {}
    const item = {
      dishId,
      dishName: selectedDish.name || '',
      dishPrice: toNumber(selectedDish.price),
      dishUnit: selectedDish.unit || UI.defaultUnit,
      count: Math.min(99, Math.max(1, nextCount))
    }
    if (index >= 0) currentItems[index] = item
    else currentItems.push(item)
    return currentItems
  },

  updatePackageDishSelection(dishId, count) {
    const items = this.getPackageDishItemsWithCount(dishId, count)
    this.setData({
      'currentPackage.items': items,
      packageDishCatalog: buildPackageDishCatalog(this.data.packageDishCatalog, items),
      packageSearchResults: findPackageDishResults(
        buildPackageDishCatalog(this.data.packageDishCatalog, items),
        this.data.packageDishKeyword
      )
    })
  },

  addPackageDish(e) {
    const dish = e.currentTarget.dataset.dish
    if (!dish) return
    const count = getPackageItemCount(this.data.currentPackage.items, dish._id)
    if (count > 0) return
    this.updatePackageDishSelection(dish._id, 1)
  },

  changePackageDishCount(e) {
    const dishId = e.currentTarget.dataset.id
    const delta = Number(e.currentTarget.dataset.delta || 0)
    if (!dishId || !delta) return
    const count = getPackageItemCount(this.data.currentPackage.items, dishId)
    this.updatePackageDishSelection(dishId, count + delta)
  },

  async savePackage() {
    const currentPackage = this.data.currentPackage || {}
    const mealPackage = {
      ...currentPackage,
      menuType: this.data.currentMenuType,
      price: toNumber(currentPackage.price, -1),
      sort: toNumber(currentPackage.sort),
      items: (currentPackage.items || []).map(item => ({
        dishId: item.dishId,
        count: Math.max(1, Math.floor(Number(item.count || 0)))
      }))
    }
    if (!String(mealPackage.name || '').trim()) {
      showToast(UI.packageRequired)
      return
    }
    if (mealPackage.price < 0) {
      showToast(UI.priceRequired)
      return
    }
    if (!mealPackage.items.length) {
      showToast(UI.packageItemsRequired)
      return
    }

    try {
      wx.showLoading({ title: UI.saving })
      await apiClient.call('admin.package.save', { mealPackage })
      wx.hideLoading()
      this.closePackageModal()
      showToast(UI.saved, 'success')
      await this.loadPackages(this.data.isSearching ? this.data.searchKeyword : '')
    } catch (err) {
      wx.hideLoading()
      console.error('save package failed', err)
      showToast(err.message || UI.failed)
    }
  },

  async togglePackageStatus(e) {
    const mealPackage = e.currentTarget.dataset.package
    if (!mealPackage) return
    try {
      await apiClient.call('admin.package.status', {
        packageId: mealPackage._id,
        status: mealPackage.status === 1 ? 0 : 1
      })
      await this.loadPackages(this.data.isSearching ? this.data.searchKeyword : '')
    } catch (err) {
      console.error('toggle package status failed', err)
      showToast(err.message || UI.failed)
    }
  },

  deletePackage(e) {
    const mealPackage = e.currentTarget.dataset.package
    if (!mealPackage) return
    wx.showModal({
      title: UI.confirmDelete,
      content: UI.confirmDeletePackage,
      success: async res => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: UI.deleting })
          await apiClient.call('admin.package.delete', { packageId: mealPackage._id })
          wx.hideLoading()
          showToast(UI.deleted, 'success')
          await this.loadPackages(this.data.isSearching ? this.data.searchKeyword : '')
        } catch (err) {
          wx.hideLoading()
          console.error('delete package failed', err)
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
