const apiClient = require('../../../../../utils/apiClient')

const CACHE_KEY = 'adminWaiterMenuCacheV2'
const CACHE_TTL = 10 * 60 * 1000

function decode(value) {
  try { return decodeURIComponent(value || '') } catch (err) { return value || '' }
}

function money(value) {
  const number = Number(value || 0)
  return Number.isInteger(number) ? String(number) : number.toFixed(2)
}

function defaultOption(list) {
  const options = Array.isArray(list) ? list : []
  return options.find(item => String(item).includes('正常')) || options[0] || ''
}

function buildPackageSummary(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter(item => item && item.dishName && Number(item.count || 0) > 0)
    .map(item => `${item.dishName} x${item.count}`)
    .join('\u3001')
}

Page({
  data: {
    areaKey: 'normal', areaName: '', tableNumber: '', peopleCount: 1,
    mode: 'add', modeText: '服务员加菜',
    menuContentMode: 'dish',
    categories: [], sections: [], currentCategoryId: '', goodsCache: {},
    packages: [], loadingPackages: false,
    loading: true, scrollIntoView: '', goodsScrollTop: 0,
    searchOpen: false, searchKeyword: '', searchResults: [],
    cartOpen: false, cart: {}, cartList: [], cartCount: 0, totalPriceText: '0',
    submitting: false, showSpecModal: false, currentDish: null,
    flavorTitle: '口味', flavorOptions: [], optionGroups: [],
    selectedOptions: {}, remark: '', modalCount: 1
  },

  onLoad(options = {}) {
    const mode = options.mode === 'create' ? 'create' : 'add'
    this.setData({
      areaKey: decode(options.areaKey) || 'normal',
      areaName: decode(options.areaName),
      tableNumber: decode(options.tableNumber),
      peopleCount: Math.max(1, Math.floor(Number(options.peopleCount || 1))),
      mode,
      modeText: mode === 'create' ? '代客开单' : '服务员加菜'
    })
    this.restoreMenuCache()
    this.refreshMenu()
    this.loadPackages()
  },

  onUnload() {
    if (this.scrollTimer) clearTimeout(this.scrollTimer)
    if (this.searchTimer) clearTimeout(this.searchTimer)
  },

  getDishCountMap(cart = this.data.cart) {
    return Object.keys(cart || {}).reduce((map, key) => {
      const item = cart[key]
      map[item.dishId] = (map[item.dishId] || 0) + Number(item.count || 0)
      return map
    }, {})
  },

  buildSections(categories = this.data.categories, goodsCache = this.data.goodsCache, cart = this.data.cart) {
    const countMap = this.getDishCountMap(cart)
    return (categories || []).filter(category => Array.isArray(goodsCache[category._id])).map(category => ({
      id: category._id,
      name: category.name,
      goods: goodsCache[category._id].map(dish => ({ ...dish, cartCount: countMap[dish._id] || 0 }))
    }))
  },

  restoreMenuCache() {
    const cache = wx.getStorageSync(CACHE_KEY)
    if (!cache || !Array.isArray(cache.categories) || !cache.categories.length) return
    const currentCategoryId = cache.currentCategoryId || cache.categories[0]._id
    const goodsCache = cache.goodsCache || {}
    this.setData({
      categories: cache.categories,
      currentCategoryId,
      goodsCache,
      sections: this.buildSections(cache.categories, goodsCache),
      loading: false
    }, () => this.measureSections())
  },

  saveMenuCache() {
    wx.setStorageSync(CACHE_KEY, {
      categories: this.data.categories,
      currentCategoryId: this.data.currentCategoryId,
      goodsCache: this.data.goodsCache,
      updateTime: Date.now()
    })
  },

  async refreshMenu(force = false) {
    const cached = wx.getStorageSync(CACHE_KEY)
    if (!force && cached && Date.now() - Number(cached.updateTime || 0) < CACHE_TTL && this.data.sections.length) return
    try {
      const result = await apiClient.call('menu.categories', { menuType: 'dineIn' })
      const categories = result.data || []
      const currentCategoryId = categories.some(item => item._id === this.data.currentCategoryId)
        ? this.data.currentCategoryId : categories[0] && categories[0]._id || ''
      this.setData({ categories, currentCategoryId })
      await this.loadAllCategoryGoods(categories, force)
    } catch (err) {
      if (!this.data.sections.length) wx.showToast({ title: '菜单加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadAllCategoryGoods(categories, force) {
    const goodsCache = { ...this.data.goodsCache }
    const targets = categories.filter(category => force || !Array.isArray(goodsCache[category._id]))
    const results = await Promise.all(targets.map(category => apiClient.call('menu.categoryGoods', {
      menuType: 'dineIn', categoryId: category._id, limit: 100
    }).then(result => ({ id: category._id, goods: result.data || [] }))
      .catch(err => ({ id: category._id, error: err }))))
    results.forEach(result => { if (!result.error) goodsCache[result.id] = result.goods })
    const sections = this.buildSections(categories, goodsCache)
    this.setData({ goodsCache, sections }, () => {
      this.saveMenuCache()
      this.measureSections()
      this.applySearch()
    })
  },

  async loadPackages() {
    this.setData({ loadingPackages: true })
    try {
      const result = await apiClient.call('admin.package.list', {
        menuType: 'dineIn',
        limit: 100
      })
      const packages = (result.data || [])
        .filter(item => item.status === 1)
        .map(item => ({ ...item, itemSummary: buildPackageSummary(item.items) }))
      this.setData({ packages, loadingPackages: false }, () => this.applySearch())
    } catch (err) {
      console.error('load staff packages failed', err)
      this.setData({ loadingPackages: false })
    }
  },

  selectCategory(event) {
    const id = event.currentTarget.dataset.id
    this.setData({ currentCategoryId: id, scrollIntoView: `category-${id}` })
  },

  measureSections() {
    setTimeout(() => {
      wx.createSelectorQuery().in(this)
        .select('.dish-list').boundingClientRect()
        .selectAll('.category-section').boundingClientRect()
        .exec(result => {
          const viewport = result && result[0]
          const rects = result && result[1]
          if (!viewport || !Array.isArray(rects)) return
          this.sectionPositions = rects.map(rect => ({
            id: String(rect.id || '').replace('category-', ''),
            top: rect.top - viewport.top + Number(this.data.goodsScrollTop || 0)
          }))
          this.goodsViewportHeight = viewport.height
        })
    }, 60)
  },

  onGoodsScroll(event) {
    this.data.goodsScrollTop = Number(event.detail.scrollTop || 0)
    if (this.scrollTimer) return
    this.scrollTimer = setTimeout(() => {
      this.scrollTimer = null
      const trigger = this.data.goodsScrollTop + Number(this.goodsViewportHeight || 0) / 2
      const positions = this.sectionPositions || []
      let current = positions[0] && positions[0].id
      positions.forEach(item => { if (item.top <= trigger) current = item.id })
      if (current && current !== this.data.currentCategoryId) this.setData({ currentCategoryId: current })
    }, 60)
  },

  toggleSearch() {
    const searchOpen = !this.data.searchOpen
    this.setData({ searchOpen, searchKeyword: searchOpen ? this.data.searchKeyword : '', searchResults: [] })
  },

  onSearchInput(event) {
    this.setData({ searchKeyword: String(event.detail.value || '').trim() })
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => this.applySearch(), 120)
  },

  applySearch() {
    const keyword = String(this.data.searchKeyword || '').toLowerCase()
    if (!keyword) {
      this.setData({ searchResults: [] })
      return
    }
    if (this.data.menuContentMode === 'package') {
      const searchResults = this.data.packages
        .filter(item => String(item.name || '').toLowerCase().includes(keyword))
      this.setData({ searchResults })
      return
    }
    const countMap = this.getDishCountMap()
    const results = this.data.sections.reduce((list, section) => list.concat(section.goods), [])
      .filter(dish => String(dish.name || '').toLowerCase().includes(keyword))
      .map(dish => ({ ...dish, cartCount: countMap[dish._id] || 0 }))
    this.setData({ searchResults: results })
  },

  refreshTap() {
    wx.removeStorageSync(CACHE_KEY)
    this.setData({ goodsCache: {}, loading: true })
    this.refreshMenu(true)
    this.loadPackages()
  },

  changeMenuContentMode(event) {
    const menuContentMode = event.currentTarget.dataset.mode
    if (!menuContentMode || menuContentMode === this.data.menuContentMode) return
    this.setData({ menuContentMode, searchKeyword: '', searchResults: [] })
    if (menuContentMode === 'package' && !this.data.packages.length) this.loadPackages()
  },

  toggleCart() { this.setData({ cartOpen: !this.data.cartOpen }) },

  selectDish(event) {
    const dish = event.currentTarget.dataset.dish
    if (!dish) return
    if (dish.needSpec === false) {
      this.addCartItem(dish, {}, [], 1)
      return
    }
    const flavorOptions = Array.isArray(dish.flavorOptions) && dish.flavorOptions.length
      ? dish.flavorOptions : ['不辣', '微辣', '正常辣']
    const optionGroups = (dish.optionGroups || []).map(group => ({ ...group }))
    const selectedOptions = { flavor: defaultOption(flavorOptions) }
    optionGroups.forEach(group => { selectedOptions[group.id] = defaultOption(group.options) })
    this.setData({
      showSpecModal: true, currentDish: dish,
      flavorTitle: dish.flavorTitle || '口味', flavorOptions, optionGroups,
      selectedOptions, remark: '', modalCount: 1
    })
  },

  reduceDish(event) {
    const dishId = event.currentTarget.dataset.id
    const cart = { ...this.data.cart }
    const key = Object.keys(cart).reverse().find(itemKey => cart[itemKey].dishId === dishId)
    if (!key) return
    cart[key].count -= 1
    if (cart[key].count <= 0) delete cart[key]
    this.updateCart(cart)
  },

  chooseFlavor(event) { this.setData({ 'selectedOptions.flavor': event.currentTarget.dataset.value }) },
  chooseGroupOption(event) {
    this.setData({ selectedOptions: { ...this.data.selectedOptions, [event.currentTarget.dataset.id]: event.currentTarget.dataset.value } })
  },
  onRemarkInput(event) { this.setData({ remark: String(event.detail.value || '').slice(0, 20) }) },
  increaseModalCount() { this.setData({ modalCount: this.data.modalCount + 1 }) },
  decreaseModalCount() { this.setData({ modalCount: Math.max(1, this.data.modalCount - 1) }) },
  closeSpecModal() { this.setData({ showSpecModal: false, currentDish: null }) },
  stopTap() {},

  confirmSpec() {
    const selected = this.data.selectedOptions
    const labels = []
    if (selected.flavor) labels.push(selected.flavor)
    this.data.optionGroups.forEach(group => { if (selected[group.id]) labels.push(selected[group.id]) })
    if (this.data.remark) labels.push(`备注：${this.data.remark}`)
    this.addCartItem(this.data.currentDish, { ...selected, remark: this.data.remark }, labels, this.data.modalCount)
    this.closeSpecModal()
  },

  addCartItem(dish, tags, tagLabels, count) {
    const key = `${dish._id}_${tagLabels.join('|')}`
    const cart = { ...this.data.cart }
    if (cart[key]) cart[key].count += count
    else cart[key] = { key, dishId: dish._id, info: dish, count, tags, tagLabels, tagText: tagLabels.join('、') }
    this.updateCart(cart)
  },

  findCachedDish(dishId) {
    const goodsCache = this.data.goodsCache || {}
    const categories = this.data.categories || []
    for (const category of categories) {
      const dish = (goodsCache[category._id] || []).find(item => item._id === dishId)
      if (dish) return dish
    }
    return null
  },

  addPackageToCart(event) {
    const mealPackage = event.currentTarget.dataset.package
    if (!mealPackage || !Array.isArray(mealPackage.items) || !mealPackage.items.length) return

    const resolvedItems = mealPackage.items.map(item => ({
      config: item,
      dish: this.findCachedDish(item.dishId)
    }))
    if (resolvedItems.some(item => !item.dish)) {
      wx.showToast({ title: '套餐中有菜品已下架', icon: 'none' })
      return
    }

    const cart = { ...this.data.cart }
    const existingPackageItem = Object.keys(cart)
      .map(key => cart[key])
      .find(item => item.packageId === mealPackage._id)
    const nextPackageCount = Math.max(1, Number(existingPackageItem && existingPackageItem.packageCount || 0) + 1)

    resolvedItems.forEach(({ config, dish }) => {
      const packageItemCount = Math.max(1, Math.floor(Number(config.count || 0)))
      const key = `package:${mealPackage._id}:${dish._id}`
      cart[key] = {
        key,
        dishId: dish._id,
        info: dish,
        count: packageItemCount * nextPackageCount,
        tags: {},
        tagLabels: [],
        tagText: `套餐：${mealPackage.name || ''}`,
        packageId: mealPackage._id,
        packageName: mealPackage.name || '',
        packagePrice: Number(mealPackage.price || 0),
        packageCount: nextPackageCount,
        packageItemCount
      }
    })
    this.updateCart(cart)
  },

  changeCartCount(event) {
    const { key, delta } = event.currentTarget.dataset
    const cart = { ...this.data.cart }
    if (!cart[key]) return
    if (cart[key].packageId) {
      const packageId = cart[key].packageId
      const nextPackageCount = Math.max(0, Number(cart[key].packageCount || 0) + Number(delta))
      Object.keys(cart).forEach(itemKey => {
        const item = cart[itemKey]
        if (item.packageId !== packageId) return
        if (nextPackageCount <= 0) {
          delete cart[itemKey]
          return
        }
        item.packageCount = nextPackageCount
        item.count = Number(item.packageItemCount || 1) * nextPackageCount
      })
      this.updateCart(cart)
      return
    }
    cart[key].count += Number(delta)
    if (cart[key].count <= 0) delete cart[key]
    this.updateCart(cart)
  },

  clearCart() { this.updateCart({}) },
  updateCart(cart) {
    const cartList = Object.keys(cart).map(key => cart[key])
    const cartCount = cartList.reduce((sum, item) => sum + item.count, 0)
    const packageTotalMap = {}
    const total = cartList.reduce((sum, item) => {
      if (!item.packageId) return sum + Number(item.info.price || 0) * item.count
      if (packageTotalMap[item.packageId]) return sum
      packageTotalMap[item.packageId] = true
      return sum + Number(item.packagePrice || 0) * Number(item.packageCount || 0)
    }, 0)
    const sections = this.buildSections(this.data.categories, this.data.goodsCache, cart)
    this.setData({ cart, cartList, cartCount, totalPriceText: money(total), sections }, () => this.applySearch())
  },

  async submitOrder() {
    if (!this.data.cartCount || this.data.submitting) return
    const orderGoods = this.data.cartList.map(item => ({
      dishId: item.dishId, dishName: item.info.name, price: Number(item.info.price || 0),
      count: item.count, tags: item.tagLabels,
      packageId: item.packageId || '',
      packageCount: item.packageId ? Number(item.packageCount || 0) : 0
    }))
    this.setData({ submitting: true })
    try {
      await apiClient.call('admin.order.createOffline', {
        mode: this.data.mode, areaKey: this.data.areaKey, tableNumber: this.data.tableNumber,
        peopleCount: this.data.peopleCount, orderGoods
      })
      wx.showToast({ title: this.data.mode === 'create' ? '开单成功' : '加菜成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (err) {
      wx.showToast({ title: err.message || '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
