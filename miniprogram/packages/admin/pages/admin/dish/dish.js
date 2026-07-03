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
  image: '\u56fe\u7247\u5730\u5740',
  sort: '\u6392\u5e8f',
  status: '\u4e0a\u67b6\u72b6\u6001',
  needPopup: '\u9700\u8981\u89c4\u683c\u5f39\u7a97',
  inputCategoryName: '\u8bf7\u8f93\u5165\u5206\u7c7b\u540d\u79f0',
  inputDishName: '\u8bf7\u8f93\u5165\u83dc\u54c1\u540d\u79f0',
  inputPrice: '\u8bf7\u8f93\u5165\u4ef7\u683c',
  inputUnit: '\u4f8b\u5982\uff1a\u4efd',
  inputDescription: '\u8bf7\u8f93\u5165\u63cf\u8ff0',
  inputImage: '\u53ef\u586b\u5199\u56fe\u7247 URL \u6216 fileID',
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
  imageTip: '\u56fe\u7247\u4e0a\u4f20\u5df2\u4ece\u65e7\u4e91\u73af\u5883\u79fb\u9664\uff0c\u6682\u65f6\u8bf7\u586b\u5199\u56fe\u7247\u5730\u5740\u3002'
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
  unit: '\u4efd',
  status: 1,
  sort: 0,
  needPopup: false,
  tags: [],
  options: []
}

function showToast(title, icon = 'none') {
  wx.showToast({ title, icon })
}

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
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
    loadingCategories: false,
    loadingDishes: false,
    showCategoryModal: false,
    editCategoryMode: false,
    currentCategory: { ...DEFAULT_CATEGORY },
    showDishModal: false,
    editDishMode: false,
    currentDish: { ...DEFAULT_DISH }
  },

  onLoad() {
    this.loadCategories()
  },

  async changeMenuType(e) {
    const menuType = e.currentTarget.dataset.type
    if (!menuType || menuType === this.data.currentMenuType) return

    this.setData({
      currentMenuType: menuType,
      currentCategoryId: '',
      categories: [],
      dishes: []
    })
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
    this.setData({ currentCategoryId: categoryId }, () => {
      this.loadDishes()
    })
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

    this.setData({
      showDishModal: true,
      editDishMode: false,
      currentDish: {
        ...DEFAULT_DISH,
        categoryId: currentCategory._id,
        categoryName: currentCategory.name,
        menuType: this.data.currentMenuType,
        sort: this.data.dishes.length
      }
    })
  },

  showEditDishModal(e) {
    const dish = e.currentTarget.dataset.dish
    this.setData({
      showDishModal: true,
      editDishMode: true,
      currentDish: { ...DEFAULT_DISH, ...dish }
    })
  },

  closeDishModal() {
    this.setData({ showDishModal: false })
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
    this.setData({ 'currentDish.needPopup': !!e.detail.value })
  },

  async saveDish() {
    const dish = {
      ...this.data.currentDish,
      menuType: this.data.currentMenuType,
      categoryId: this.data.currentCategoryId,
      categoryName: this.getCurrentCategoryName(),
      price: toNumber(this.data.currentDish.price, -1),
      originalPrice: toNumber(this.data.currentDish.originalPrice),
      sort: toNumber(this.data.currentDish.sort)
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
      this.setData({ showDishModal: false })
      showToast(UI.saved, 'success')
      await this.loadDishes()
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
      await this.loadDishes()
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
          await this.loadDishes()
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