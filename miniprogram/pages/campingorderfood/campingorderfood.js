// pages/index/index.js
const app = getApp()
const db = wx.cloud.database()
const _ = db.command
const { getCustomNavOptions } = require('../../utils/customNav')

const orderLoadingFrames = [
  '/images/loadinggif_frames/frame_00.png',
  '/images/loadinggif_frames/frame_01.png',
  '/images/loadinggif_frames/frame_02.png',
  '/images/loadinggif_frames/frame_03.png',
  '/images/loadinggif_frames/frame_04.png',
  '/images/loadinggif_frames/frame_05.png',
  '/images/loadinggif_frames/frame_06.png',
  '/images/loadinggif_frames/frame_07.png',
  '/images/loadinggif_frames/frame_08.png',
  '/images/loadinggif_frames/frame_09.png',
  '/images/loadinggif_frames/frame_10.png',
  '/images/loadinggif_frames/frame_11.png',
  '/images/loadinggif_frames/frame_12.png',
  '/images/loadinggif_frames/frame_13.png',
  '/images/loadinggif_frames/frame_14.png',
  '/images/loadinggif_frames/frame_15.png',
  '/images/loadinggif_frames/frame_16.png'
]

Page({
  data: {
    menuList: [], // 菜品分类列表
    currentMenuId: '', // 当前选中的分类ID
    goodsList: [], // 当前分类的菜品列表
    searchKeyword: '',
    isSearching: false,
    searchLoading: false,
    actionLoading: false,
    actionLoadingText: '',
    actionLoadingGif: '/images/loadinggif-cutout-transparent.gif',
    searchGoodsList: [],
    categorySections: [],
    loadedCategoryCount: 0,
    categoryBatchSize: 3,
    scrollIntoSection: '',
    categorySectionPositions: [],
    goodsScrollTop: 0,
    goodsViewportHeight: 0,
    cartMeatAnimations: [],
    cart: {}, // 购物车 {goodsId: {info: goodsInfo, count: num, tags: {}}}
    cartCount: 0, // 购物车总数量
    cartTotalPrice: 0, // 购物车总价
    cartTotalPriceText: '0.00', // 购物车总价文本（格式化后）
    showCart: false, // 是否显示购物车详情
    userInfo: null, // 用户信息
    noticeList: [], // 公告列表
    noticeText: '', // 公告文本（用于vant组件）
    shopInfo: {}, // 店铺信息
    showTagModal: false, // 显示标签选择弹窗
    currentDish: null, // 当前选择的菜品
    selectedTags: {}, // 当前选择的标签 {tagId: [选项]}
    modalDishCount: 1, // 弹窗中选择的商品数量
    modalTotalPrice: 0, // 弹窗中商品小计
    specAddOriginPoint: null, // 打开规格弹窗时的菜单加号位置
    showAuthModal: false, // 显示授权弹窗
    statusBarHeight: 0,
    navBarHeight: 44,
    navContentTop: 0,
    navContentHeight: 44,
    navTitleFontSize: 18,
    navIconSize: 14,
    navIconStroke: 2,
    searchRowHeight: 38,
    searchRowTop: 50,
    shopNavTotalHeight: 84,
    tableNumber: '', // 桌码号
    // 菜品分页
    goodsPage: 0,
    goodsPageSize: 20,
    goodsHasMore: true,
    goodsLoading: false,
    menuLoading: false,
    loadingFrameIndex: 0,
    orderLoadingFrames,
    modalFlavorTitle: '\u53e3\u5473',
    modalFlavorOptions: ['\u4e0d\u8fa3', '\u5fae\u8fa3', '\u6b63\u5e38\u8fa3'],
    modalOptionGroups: []
  },

  refreshCustomNav() {
    const navOptions = getCustomNavOptions()
    const searchRowHeight = 38
    this.setData({
      ...navOptions,
      searchRowHeight,
      searchRowTop: navOptions.navBarHeight + 8,
      shopNavTotalHeight: navOptions.navBarHeight + searchRowHeight + 16
    })
  },

  showActionLoading(text = '加载中') {
    this.setData({
      actionLoading: true,
      actionLoadingText: text
    })
  },

  hideActionLoading() {
    this.setData({
      actionLoading: false,
      actionLoadingText: ''
    })
  },

  catchActionLoadingMove() {},

  onLoad(options) {
    this.refreshCustomNav()
    
    // 检查是否从扫码进入，获取桌码号
    // 小程序码扫码进入时，scene参数会在options.scene中
    if (options.scene) {
      // scene参数是经过URL编码的，需要解码
      try {
        const scene = decodeURIComponent(options.scene)
        if (scene) {
          this.setData({
            tableNumber: scene
          })
        }
      } catch (e) {
        console.error('解析scene参数失败', e)
      }
    }
    
    this.loadShopInfo()
    this.loadMenu()
    this.loadUserInfo()
    this.loadNotices()
  },

  onReady() {
    this.refreshCustomNav()
    setTimeout(() => this.refreshCustomNav(), 120)
  },

  onShow() {
    this.refreshCustomNav()
    this.loadUserInfo()
  },

  onUnload() {
    this.stopOrderLoadingAnimation()
    this.clearCartFxTimers()
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
      this.searchTimer = null
    }
  },

  startOrderLoadingAnimation() {
    // Loading uses a native GIF image now, so no frame timer is needed.
  },

  stopOrderLoadingAnimation() {
    if (this.orderLoadingTimer) {
      clearInterval(this.orderLoadingTimer)
      this.orderLoadingTimer = null
    }
  },

  getTapPoint(e) {
    if (e && typeof e.x === 'number' && typeof e.y === 'number') {
      return {
        x: e.x,
        y: e.y
      }
    }

    const touch = e && ((e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]))
    if (touch && typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
      return {
        x: touch.clientX,
        y: touch.clientY
      }
    }

    if (e && e.detail && typeof e.detail.x === 'number' && typeof e.detail.y === 'number') {
      return {
        x: e.detail.x,
        y: e.detail.y
      }
    }

    const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    return {
      x: systemInfo.windowWidth / 2,
      y: systemInfo.windowHeight * 0.72
    }
  },

  pushCartFxTimer(timer) {
    if (!this.cartFxTimers) {
      this.cartFxTimers = []
    }
    this.cartFxTimers.push(timer)
  },

  clearCartFxTimers() {
    if (!this.cartFxTimers) return
    this.cartFxTimers.forEach(timer => clearTimeout(timer))
    this.cartFxTimers = []
  },

  playCartAddEffect(e) {
    const start = this.getTapPoint(e)
    const query = wx.createSelectorQuery()

    query.select('.cart-icon-wrapper').boundingClientRect(rect => {
      if (!rect) return

      const targetX = rect.left + rect.width / 2
      const targetY = rect.top + rect.height * 0.48
      const id = `camp-meat-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      const meat = {
        id,
        left: start.x - 23,
        top: start.y - 17,
        translateX: 0,
        translateY: 0,
        scale: 1,
        rotate: -8,
        opacity: 1
      }

      this.setData({
        cartMeatAnimations: this.data.cartMeatAnimations.concat(meat)
      })

      this.pushCartFxTimer(setTimeout(() => {
        const cartMeatAnimations = this.data.cartMeatAnimations.map(item => (
          item.id === id
            ? {
                ...item,
                translateX: targetX - start.x,
                translateY: targetY - start.y,
                scale: 0.58,
                rotate: 14,
                opacity: 1
              }
            : item
        ))
        this.setData({ cartMeatAnimations })
      }, 20))

      this.pushCartFxTimer(setTimeout(() => {
        const cartMeatAnimations = this.data.cartMeatAnimations.map(item => (
          item.id === id ? { ...item, opacity: 0 } : item
        ))
        this.setData({ cartMeatAnimations })
      }, 620))

      this.pushCartFxTimer(setTimeout(() => {
        this.setData({
          cartMeatAnimations: this.data.cartMeatAnimations.filter(item => item.id !== id)
        })
      }, 820))
    }).exec()
  },

  // 加载店铺信息
  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.reLaunch({ url: '/pages/covertest/covertest' })
      }
    })
  },

  async loadShopInfo() {
    try {
      const res = await db.collection('shopInfo').limit(1).get()
      
      if (res.data && res.data.length > 0) {
        this.setData({
          shopInfo: res.data[0]
        })
      }
    } catch (err) {
      console.error('加载店铺信息失败', err)
    }
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const openid = app.globalData.openid
      const res = await db.collection('user').where({
        _openid: openid
      }).get()
      
      if (res.data && res.data.length > 0) {
        const user = res.data[0]
        // 如果没有余额字段，初始化为 0
        if (typeof user.balance === 'undefined') {
          await db.collection('user').doc(user._id).update({
            data: {
              balance: 0
            }
          })
          user.balance = 0
        }

        this.setData({
          userInfo: user
        })
      }
    } catch (err) {
      console.error('获取用户信息失败', err)
    }
  },

  // 加载公告
  async loadNotices() {
    try {
      const res = await db.collection('notice')
        .where({ status: 1 }) // 只显示启用的公告
        .orderBy('sort', 'asc')
        .limit(10)
        .get()
      
      // 将公告内容拼接成一个字符串，用于vant notice-bar滚动显示
      const noticeText = res.data.map(item => item.content).join('    ')
      
      this.setData({
        noticeList: res.data || [],
        noticeText: noticeText
      })
    } catch (err) {
      console.error('加载公告失败', err)
    }
  },


  // 加载菜品分类
  async loadMenu(showLoading = true) {
    if (showLoading) {
      this.setData({
        menuLoading: true,
        loadingFrameIndex: 0
      })
      this.startOrderLoadingAnimation()
    }
    try {
      const res = await wx.cloud.callFunction({
        name: 'getCategory',
        data: {
          menuType: 'camping'
        }
      })
      const result = res.result || {}
      const list = result.success ? (result.data || []) : []
      
      if (list.length > 0) {
        const firstId = list[0]._id
        this.setData({
          menuList: list,
          currentMenuId: firstId,
          searchKeyword: '',
          isSearching: false,
          searchLoading: false,
          searchGoodsList: [],
          goodsPage: 0,
          goodsHasMore: true,
          categorySections: [],
          loadedCategoryCount: 0,
          goodsList: [],
          scrollIntoSection: ''
        })
        await this.loadNextCategoryBatch(false)
      } else {
        if (showLoading) {
          wx.showToast({ title: '暂无菜品分类', icon: 'none' })
        }
      }
    } catch (err) {
      console.error('加载菜品分类失败', err)
      if (showLoading) {
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    } finally {
      if (showLoading) {
        this.stopOrderLoadingAnimation()
        this.setData({ menuLoading: false })
      }
    }
  },

  // 加载指定分类的菜品
  async loadGoods(menuId, append = false, showLoading = true) {
    if (!menuId) return
    if (this.data.goodsLoading) return

    if (!append && showLoading) {
      this.setData({ loadingFrameIndex: 0 })
      this.startOrderLoadingAnimation()
    }

    this.setData({ goodsLoading: true })

    try {
      const pageSize = this.data.goodsPageSize
      const page = append ? this.data.goodsPage + 1 : 0
      const skip = page * pageSize

      const goodsRes = await db.collection('dish')
        .where({
          categoryId: menuId,
          menuType: 'camping',
          status: 1 // 1表示上架
        })
        .orderBy('sort', 'asc')
        .skip(skip)
        .limit(pageSize)
        .get()
      
      // 为每个菜品添加购物车数量
      const list = goodsRes.data || []
      const mapped = list.map(goods => {
        goods.cartCount = this.getDishCartCount(goods._id)
        return goods
      })
      
      this.setData({
        goodsList: append ? this.data.goodsList.concat(mapped) : mapped,
        goodsPage: page,
        goodsHasMore: list.length === pageSize
      })
    } catch (err) {
      console.error('加载菜品失败', err)
      if (showLoading) {
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    } finally {
      if (!append && showLoading) {
        this.stopOrderLoadingAnimation()
      }
      this.setData({ goodsLoading: false })
    }
  },

  async loadCategoryGoods(category) {
    const goodsRes = await db.collection('dish')
      .where({
        categoryId: category._id,
        menuType: 'camping',
        status: 1
      })
      .orderBy('sort', 'asc')
      .limit(100)
      .get()

    const goods = (goodsRes.data || []).map(item => ({
      ...item,
      cartCount: this.getDishCartCount(item._id)
    }))

    return {
      id: category._id,
      name: category.name,
      goods
    }
  },

  async loadNextCategoryBatch(showLoading = true) {
    if (this.data.isSearching) return
    if (this.data.goodsLoading) return

    const menuList = this.data.menuList || []
    const start = this.data.loadedCategoryCount || 0
    if (start >= menuList.length) {
      this.setData({ goodsHasMore: false })
      return
    }

    const end = Math.min(start + this.data.categoryBatchSize, menuList.length)
    const categories = menuList.slice(start, end)

    if (showLoading && this.data.categorySections.length === 0) {
      this.setData({ loadingFrameIndex: 0 })
      this.startOrderLoadingAnimation()
    }

    this.setData({ goodsLoading: true })

    try {
      const sections = await Promise.all(categories.map(category => this.loadCategoryGoods(category)))
      const categorySections = this.data.categorySections.concat(sections)
      const goodsList = categorySections.reduce((result, section) => result.concat(section.goods), [])

      this.setData({
        categorySections,
        goodsList,
        loadedCategoryCount: end,
        goodsHasMore: end < menuList.length
      }, () => {
        this.measureCategorySections()
      })
    } catch (err) {
      console.error('加载菜品分区失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      if (showLoading && this.data.categorySections.length === 0) {
        this.stopOrderLoadingAnimation()
      }
      this.setData({ goodsLoading: false })
    }
  },

  // 切换菜品分类
  async switchMenu(e) {
    const menuId = e.currentTarget.dataset.id
    const menuList = this.data.menuList || []
    const targetIndex = menuList.findIndex(item => item._id === menuId)
    this.clearSearchState(false)
    this.setData({
      currentMenuId: menuId,
      scrollIntoSection: ''
    })

    let guard = 0
    while (targetIndex >= 0 && this.data.loadedCategoryCount <= targetIndex && this.data.goodsHasMore && guard < menuList.length + 2) {
      guard++
      if (this.data.goodsLoading) {
        await new Promise(resolve => setTimeout(resolve, 80))
      } else {
        const beforeCount = this.data.loadedCategoryCount
        await this.loadNextCategoryBatch(false)
        if (this.data.loadedCategoryCount === beforeCount) break
      }
    }

    setTimeout(() => {
      this.setData({
        scrollIntoSection: `category-${menuId}`
      })
    }, 0)
  },

  loadMoreCategorySections() {
    if (this.data.isSearching) return
    if (this.data.goodsHasMore && !this.data.goodsLoading) {
      this.loadNextCategoryBatch(true)
    }
  },

  measureCategorySections() {
    setTimeout(() => {
      const query = wx.createSelectorQuery()
      query.select('.goods-list').boundingClientRect()
      query.selectAll('.category-section').boundingClientRect()
      query.exec(res => {
        const goodsRect = res && res[0]
        const sectionRects = res && res[1]
        if (!goodsRect || !sectionRects || sectionRects.length === 0) return

        const scrollTop = this.data.goodsScrollTop || 0
        const positions = sectionRects.map(rect => ({
          id: rect.id.replace('category-', ''),
          top: rect.top - goodsRect.top + scrollTop
        }))

        this.setData({
          categorySectionPositions: positions,
          goodsViewportHeight: goodsRect.height
        })
        this.updateCurrentMenuByScroll(scrollTop)
      })
    }, 80)
  },

  onGoodsScroll(e) {
    if (this.data.isSearching) return
    const scrollTop = e.detail.scrollTop || 0
    this.data.goodsScrollTop = scrollTop

    if (this.goodsScrollTimer) return
    this.goodsScrollTimer = setTimeout(() => {
      this.goodsScrollTimer = null
      this.updateCurrentMenuByScroll(this.data.goodsScrollTop || 0)
    }, 80)
  },

  updateCurrentMenuByScroll(scrollTop) {
    if (this.data.isSearching) return
    const positions = this.data.categorySectionPositions || []
    if (positions.length === 0) return

    const viewportHeight = this.data.goodsViewportHeight || 0
    const triggerLine = scrollTop + viewportHeight / 2
    let currentId = positions[0].id

    for (const item of positions) {
      if (item.top <= triggerLine) {
        currentId = item.id
      } else {
        break
      }
    }

    if (currentId && currentId !== this.data.currentMenuId) {
      this.setData({ currentMenuId: currentId })
    }
  },

  onSearchInput(e) {
    const value = e.detail.value || ''
    const keyword = value.trim()

    this.setData({
      searchKeyword: value
    })

    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
      this.searchTimer = null
    }

    if (!keyword) {
      this.clearSearchState(false)
      return
    }

    this.searchTimer = setTimeout(() => {
      this.searchDishes(keyword)
    }, 260)
  },

  confirmSearch() {
    const keyword = (this.data.searchKeyword || '').trim()
    if (keyword) {
      this.searchDishes(keyword)
    }
  },

  clearSearch() {
    this.clearSearchState(true)
  },

  clearSearchState(clearText = true) {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
      this.searchTimer = null
    }
    this.searchToken = null

    const data = {
      isSearching: false,
      searchLoading: false,
      searchGoodsList: []
    }
    if (clearText) {
      data.searchKeyword = ''
    }
    this.setData(data)
  },

  escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  },

  async searchDishes(keyword) {
    const currentKeyword = (keyword || '').trim()
    if (!currentKeyword) {
      this.clearSearchState(false)
      return
    }

    const token = Date.now()
    this.searchToken = token
    this.setData({
      isSearching: true,
      searchLoading: true,
      scrollIntoSection: ''
    })

    try {
      const matcher = db.RegExp({
        regexp: this.escapeRegExp(currentKeyword),
        options: 'i'
      })
      const res = await db.collection('dish')
        .where(_.or([
          { status: 1, menuType: 'camping', name: matcher },
          { status: 1, menuType: 'camping', categoryName: matcher },
          { status: 1, menuType: 'camping', description: matcher }
        ]))
        .limit(50)
        .get()

      if (this.searchToken !== token) return

      const searchGoodsList = (res.data || []).map(item => ({
        ...item,
        cartCount: this.getDishCartCount(item._id)
      }))

      this.setData({
        searchGoodsList,
        searchLoading: false
      })
    } catch (err) {
      if (this.searchToken !== token) return
      console.error('搜索露营菜品失败', err)
      this.setData({
        searchGoodsList: [],
        searchLoading: false
      })
      wx.showToast({
        title: '搜索失败',
        icon: 'none'
      })
    }
  },

  showCampingFreeBucketTip() {
    wx.showToast({
      title: '点单满188元自动提供',
      icon: 'none'
    })
  },

  // 添加到购物车 - 显示标签选择弹窗
  addToCart(e) {
    const goods = e.currentTarget.dataset.goods
    const specAddOriginPoint = this.getTapPoint(e)
    const flavorOptions = goods.flavorOptions && goods.flavorOptions.length
      ? goods.flavorOptions
      : ['\u4e0d\u8fa3', '\u5fae\u8fa3', '\u6b63\u5e38\u8fa3']
    const optionGroups = (goods.optionGroups || []).map(group => ({
      ...group,
      selectedOption: group.options && group.options.length ? group.options[0] : ''
    }))
    
    // 初始化标签选择状态，多选标签初始化为数组
    const selectedTags = {}
    if (goods.tags && goods.tags.length > 0) {
      goods.tags.forEach(tag => {
        if (tag.type === 'multiple') {
          selectedTags[tag.id] = []
        }
      })
    }
    
    // 总是显示弹窗，让用户选择数量
    this.setData({
      showTagModal: true,
      currentDish: {
        ...goods,
        tags: []
      },
      selectedTags: {
        flavor: flavorOptions[0],
        ...optionGroups.reduce((result, group) => {
          if (group.id && group.options && group.options.length) {
            result[group.id] = group.options[0]
          }
          return result
        }, {}),
        remark: ''
      },
      modalFlavorTitle: goods.flavorTitle || '\u53e3\u5473',
      modalFlavorOptions: flavorOptions,
      modalOptionGroups: optionGroups,
      modalRemark: '',
      modalRemarkCount: 0,
      modalDishCount: 1,
      modalTotalPrice: this.formatModalPrice(goods.price * 1),
      specAddOriginPoint
    })
  },

  formatModalPrice(price) {
    const value = Number(price) || 0
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  },

  // 确认添加到购物车
  confirmAddToCart(e) {
    const { currentDish, selectedTags, modalDishCount } = this.data
    const cart = this.data.cart
    
    // 验证必选标签
    if (currentDish.tags && currentDish.tags.length > 0) {
      for (let tag of currentDish.tags) {
        if (tag.required) {
          const selectedValue = selectedTags[tag.id]
          if (!selectedValue || 
              (Array.isArray(selectedValue) && selectedValue.length === 0)) {
            wx.showToast({
              title: `请选择${tag.name}`,
              icon: 'none'
            })
            return
          }
        }
      }
    }
    
    // 生成唯一的购物车ID（包含标签信息）
    const cartKey = this.generateCartKey(currentDish._id, selectedTags)
    
    // 转换标签为可显示的数组
    const tagLabels = []
    if (selectedTags.flavor) {
      tagLabels.push(selectedTags.flavor)
    }
    if (currentDish.optionGroups && currentDish.optionGroups.length > 0) {
      currentDish.optionGroups.forEach(group => {
        const value = selectedTags[group.id]
        if (value) {
          tagLabels.push(value)
        }
      })
    }
    if (selectedTags.remark) {
      tagLabels.push(`\u5907\u6ce8\uff1a${selectedTags.remark}`)
    }
    if (currentDish.tags && currentDish.tags.length > 0) {
      for (let tagId in selectedTags) {
        const tag = currentDish.tags.find(t => t.id === tagId)
        if (tag) {
          const value = selectedTags[tagId]
          if (Array.isArray(value)) {
            tagLabels.push(...value)
          } else {
            tagLabels.push(value)
          }
        }
      }
    }
    
    if (cart[cartKey]) {
      cart[cartKey].count += modalDishCount
    } else {
      cart[cartKey] = {
        info: currentDish,
        count: modalDishCount,
        tags: { ...selectedTags },
        tagLabels: tagLabels, // 用于显示的标签数组
        dishId: currentDish._id // 保存原始菜品ID
      }
    }
    
    this.updateCart(cart)
    this.playCartAddEffect(this.data.specAddOriginPoint || e)
    this.closeTagModal()
  },

  // 生成购物车Key（包含标签信息）
  generateCartKey(dishId, tags) {
    if (!tags || Object.keys(tags).length === 0) {
      return dishId
    }
    
    const tagStr = Object.keys(tags).sort().map(key => {
      const val = tags[key]
      return `${key}:${Array.isArray(val) ? val.sort().join(',') : val}`
    }).join('|')
    
    return `${dishId}_${tagStr}`
  },

  // 获取菜品在购物车中的数量（包括所有标签组合）
  getDishCartCount(dishId, cart) {
    // 如果传入了 cart 参数，使用传入的 cart，否则使用 this.data.cart
    const cartData = cart !== undefined ? cart : this.data.cart
    let totalCount = 0
    
    // 遍历购物车，找到所有该菜品的数量（包括不同标签组合）
    for (let cartKey in cartData) {
      if (cartData[cartKey] && cartData[cartKey].dishId === dishId) {
        totalCount += cartData[cartKey].count || 0
      }
    }
    
    return totalCount
  },

  // 从菜品列表直接添加到购物车（无标签版本）
  addDishToCartDirect(e) {
    const goods = e.currentTarget.dataset.goods
    if (goods.needSpec !== false) {
      this.addToCart(e)
      return
    }
    
    // 如果菜品没有标签，直接添加（使用菜品ID作为key）
    if (!goods.tags || goods.tags.length === 0) {
      const cart = { ...this.data.cart }
      const cartKey = goods._id
      const minOrderCount = goods.minOrderCount || 1
      
      if (cart[cartKey]) {
        // 已存在，增加数量
        cart[cartKey].count++
      } else {
        // 不存在，创建新项
        cart[cartKey] = {
          info: goods,
          count: minOrderCount,
          tags: {},
          tagLabels: [],
          dishId: goods._id
        }
      }
      
      this.updateCart(cart)
      this.playCartAddEffect(e)
      wx.showToast({
        title: '已添加',
        icon: 'success',
        duration: 1000
      })
    } else {
      // 有标签，显示弹窗让用户选择
      this.addToCart(e)
    }
  },

  // 从菜品列表减少数量（无标签版本）
  reduceDishFromCart(e) {
    const goods = e.currentTarget.dataset.goods
    const cart = { ...this.data.cart }
    const cartKey = goods._id
    const minOrderCount = goods.minOrderCount || 1
    
    if (cart[cartKey]) {
      if (cart[cartKey].count <= minOrderCount) {
        delete cart[cartKey]
      } else {
        cart[cartKey].count--
      }
      this.updateCart(cart)
    } else {
      // 如果直接key不存在，可能是带标签的，需要查找所有该菜品的项
      // 找到第一个并减少（优先减少无标签的）
      for (let key in cart) {
        if (cart[key] && cart[key].dishId === goods._id) {
          const itemMinOrderCount = cart[key].info && cart[key].info.minOrderCount ? cart[key].info.minOrderCount : 1
          if (cart[key].count <= itemMinOrderCount) {
            delete cart[key]
          } else {
            cart[key].count--
          }
          this.updateCart(cart)
          break
        }
      }
    }
  },

  // 从购物车减少
  editDishCountFromList(e) {
    const goods = e.currentTarget.dataset.goods
    if (!goods || !goods._id) return

    const cart = { ...this.data.cart }
    const cartKeys = Object.keys(cart).filter(key => cart[key] && cart[key].dishId === goods._id)

    if (cartKeys.length > 1 || (cartKeys.length === 1 && cartKeys[0] !== goods._id)) {
      wx.showToast({
        title: '请在购物车里修改',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: goods.name || '修改数量',
      editable: true,
      placeholderText: '输入数量，0为删除',
      content: String(goods.cartCount || 1),
      success: (res) => {
        if (!res.confirm) return

        const count = parseInt((res.content || '').trim(), 10)
        if (Number.isNaN(count) || count < 0) {
          wx.showToast({
            title: '请输入正确数量',
            icon: 'none'
          })
          return
        }

        const minOrderCount = goods.minOrderCount || 1
        if (count > 0 && count < minOrderCount) {
          wx.showToast({
            title: `${minOrderCount}个起卖`,
            icon: 'none'
          })
          return
        }

        const cartKey = goods._id
        if (count === 0) {
          delete cart[cartKey]
        } else if (cart[cartKey]) {
          cart[cartKey].count = count
        } else {
          cart[cartKey] = {
            info: goods,
            count,
            tags: {},
            tagLabels: [],
            dishId: goods._id
          }
        }

        this.updateCart(cart)
      }
    })
  },

  reduceFromCart(e) {
    const cartKey = e.currentTarget.dataset.id
    const cart = { ...this.data.cart }
    
    if (cart[cartKey]) {
      const minOrderCount = cart[cartKey].info && cart[cartKey].info.minOrderCount ? cart[cartKey].info.minOrderCount : 1
      if (cart[cartKey].count <= minOrderCount) {
        delete cart[cartKey]
      } else {
        cart[cartKey].count--
      }
    }
    
    this.updateCart(cart)
  },

  // 从购物车增加
  addToCartFromCart(e) {
    const cartKey = e.currentTarget.dataset.id
    const cart = { ...this.data.cart }
    
    if (cart[cartKey]) {
      cart[cartKey].count++
    }
    
    this.updateCart(cart)
  },

  // 选择标签选项（单选）
  editCartItemCount(e) {
    const cartKey = e.currentTarget.dataset.id
    const cart = { ...this.data.cart }
    const item = cart[cartKey]
    if (!item) return

    wx.showModal({
      title: item.info && item.info.name ? item.info.name : '修改数量',
      editable: true,
      placeholderText: '输入数量，0为删除',
      content: String(item.count || 1),
      success: (res) => {
        if (!res.confirm) return

        const count = parseInt((res.content || '').trim(), 10)
        if (Number.isNaN(count) || count < 0) {
          wx.showToast({
            title: '请输入正确数量',
            icon: 'none'
          })
          return
        }

        const minOrderCount = item.info && item.info.minOrderCount ? item.info.minOrderCount : 1
        if (count > 0 && count < minOrderCount) {
          wx.showToast({
            title: `${minOrderCount}个起卖`,
            icon: 'none'
          })
          return
        }

        if (count === 0) {
          delete cart[cartKey]
        } else {
          cart[cartKey].count = count
        }

        this.updateCart(cart)
      }
    })
  },

  selectTagOption(e) {
    const { tagId, option } = e.currentTarget.dataset
    const selectedTags = { ...this.data.selectedTags }
    selectedTags[tagId] = option
    
    this.setData({
      selectedTags: selectedTags
    })
  },

  // 切换标签选项（多选）
  toggleTagOption(e) {
    const { tagId, option } = e.currentTarget.dataset
    
    if (!tagId || !option) {
      console.error('标签ID或选项为空', { tagId, option })
      return
    }
    
    console.log('多选标签点击', { tagId, option, currentSelectedTags: this.data.selectedTags })
    
    // 深拷贝，确保不修改原数据
    const selectedTags = JSON.parse(JSON.stringify(this.data.selectedTags || {}))
    
    // 确保 tagId 对应的值是数组
    if (!selectedTags[tagId]) {
      selectedTags[tagId] = []
    } else if (!Array.isArray(selectedTags[tagId])) {
      // 如果是字符串或其他类型，转为数组
      selectedTags[tagId] = [selectedTags[tagId]]
    }
    
    // 创建新数组，避免直接修改
    const tagArray = [...selectedTags[tagId]]
    const index = tagArray.indexOf(option)
    
    if (index > -1) {
      // 已选中，移除
      tagArray.splice(index, 1)
    } else {
      // 未选中，添加
      tagArray.push(option)
    }
    
    selectedTags[tagId] = tagArray
    
    console.log('更新后的标签', selectedTags)
    
    // 强制更新
    this.setData({
      selectedTags: selectedTags
    }, () => {
      console.log('setData完成，当前selectedTags:', this.data.selectedTags)
    })
  },

  // 关闭标签弹窗
  selectFlavorOption(e) {
    const option = e.currentTarget.dataset.option
    this.setData({
      'selectedTags.flavor': option
    })
  },

  selectOptionGroupOption(e) {
    const groupId = e.currentTarget.dataset.groupId
    const option = e.currentTarget.dataset.option
    if (!groupId) return

    const modalOptionGroups = (this.data.modalOptionGroups || []).map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          selectedOption: option
        }
      }
      return group
    })

    this.setData({
      [`selectedTags.${groupId}`]: option,
      modalOptionGroups
    })
  },

  onRemarkInput(e) {
    const value = (e.detail.value || '').slice(0, 10)
    this.setData({
      modalRemark: value,
      modalRemarkCount: value.length,
      'selectedTags.remark': value
    })
  },

  closeTagModal() {
    this.setData({
      showTagModal: false,
      currentDish: null,
      selectedTags: {},
      modalFlavorTitle: '\u53e3\u5473',
      modalFlavorOptions: ['\u4e0d\u8fa3', '\u5fae\u8fa3', '\u6b63\u5e38\u8fa3'],
      modalOptionGroups: [],
      modalRemark: '',
      modalRemarkCount: 0,
      modalDishCount: 1,
      modalTotalPrice: 0,
      specAddOriginPoint: null
    })
  },

  // 增加弹窗商品数量
  increaseModalCount() {
    const newCount = this.data.modalDishCount + 1
    const price = this.data.currentDish ? this.data.currentDish.price : 0
    this.setData({
      modalDishCount: newCount,
      modalTotalPrice: this.formatModalPrice(price * newCount)
    })
  },

  // 减少弹窗商品数量
  decreaseModalCount() {
    if (this.data.modalDishCount > 1) {
      const newCount = this.data.modalDishCount - 1
      const price = this.data.currentDish ? this.data.currentDish.price : 0
      this.setData({
        modalDishCount: newCount,
        modalTotalPrice: this.formatModalPrice(price * newCount)
      })
    }
  },

  // 阻止冒泡
  editModalDishCount() {
    wx.showModal({
      title: '修改份数',
      editable: true,
      placeholderText: '请输入份数',
      content: String(this.data.modalDishCount || 1),
      success: (res) => {
        if (!res.confirm) return

        const count = parseInt((res.content || '').trim(), 10)
        if (Number.isNaN(count) || count < 1) {
          wx.showToast({
            title: '份数不能低于1',
            icon: 'none'
          })
          return
        }

        const price = this.data.currentDish ? this.data.currentDish.price : 0
        this.setData({
          modalDishCount: count,
          modalTotalPrice: this.formatModalPrice(price * count)
        })
      }
    })
  },

  stopPropagation() {},

  // 用户信息保存回调（来自 avatarNicknameModal）
  async onUserInfoSaved(e) {
    const { avatarUrl, nickName, phoneNumber } = e.detail || {}

    // 先在本地更新，避免再次点击时仍判断为未完善
    this.setData({
      userInfo: {
        ...(this.data.userInfo || {}),
        avatarUrl,
        nickName,
        phoneNumber
      },
      showAuthModal: false
    })

    // 再从数据库刷新一次，保证余额等字段最新
    try {
      await this.loadUserInfo()
    } catch (err) {
      console.error('刷新用户信息失败', err)
    }

    // 信息完善后重新尝试结算
    this.goToSettle()
  },

  // 处理用户授权
  async handleUserAuth(e) {
    const { avatarUrl, nickName, phoneNumber } = e.detail
    
    if (!phoneNumber) {
      wx.showToast({
        title: '请先获取手机号',
        icon: 'none'
      })
      return
    }
    
    try {
      this.showActionLoading('授权中')
          
      const openid = app.globalData.openid
      
      // 上传头像到云存储
      const cloudPath = `avatar/${openid}_${Date.now()}.png`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: avatarUrl
      })
      
      // 更新用户信息
      const userRes = await db.collection('user').where({
        _openid: openid
      }).get()
      
      const updateData = {
        avatarUrl: uploadRes.fileID,
        nickName,
        phoneNumber,
        updateTime: new Date()
      }
      
      if (userRes.data && userRes.data.length > 0) {
        await db.collection('user').doc(userRes.data[0]._id).update({
          data: updateData
        })
      } else {
        await db.collection('user').add({
          data: {
            ...updateData,
            balance: 0,
            createTime: new Date()
          }
        })
      }
      
      // 重新加载用户信息，确保获取完整的数据
      await this.loadUserInfo()
      
      this.setData({
        showAuthModal: false
      })
      
      this.hideActionLoading()
      wx.showToast({
        title: '授权成功',
        icon: 'success'
      })
      
      // 授权成功后，再次尝试下单
      setTimeout(() => {
        this.goToSettle()
      }, 500)
      
    } catch (err) {
      this.hideActionLoading()
      console.error('授权失败', err)
      wx.showToast({
        title: '授权失败，请重试',
        icon: 'none'
      })
    }
  },

  // 更新购物车
  updateCart(cart) {
    let totalCount = 0
    let totalPrice = 0
    
    for (let cartKey in cart) {
      if (cart[cartKey] && cart[cartKey].info && cart[cartKey].count) {
        totalCount += cart[cartKey].count
        totalPrice += cart[cartKey].info.price * cart[cartKey].count
      }
    }
    
    // 更新菜品列表中的购物车数量（传入新的 cart 参数，确保使用最新的购物车数据）
    const categorySections = this.data.categorySections.map(section => ({
      ...section,
      goods: section.goods.map(goods => ({
        ...goods,
        cartCount: this.getDishCartCount(goods._id, cart)
      }))
    }))
    const goodsList = categorySections.reduce((result, section) => result.concat(section.goods), [])
    const searchGoodsList = this.data.searchGoodsList.map(goods => ({
      ...goods,
      cartCount: this.getDishCartCount(goods._id, cart)
    }))
    
    this.setData({
      cart: cart,
      cartCount: totalCount,
      cartTotalPrice: totalPrice,
      cartTotalPriceText: totalPrice.toFixed(2),
      categorySections,
      goodsList: goodsList, // 更新菜品列表，包含购物车数量
      searchGoodsList,
      showCart: totalCount > 0 ? this.data.showCart : false // 购物车为空时自动关闭
    })
  },

  // 显示/隐藏购物车详情
  toggleCart() {
    if (this.data.cartCount === 0) return
    this.setData({
      showCart: !this.data.showCart
    })
  },

  // 清空购物车
  clearCart() {
    // 更新菜品列表中的购物车数量
    const categorySections = this.data.categorySections.map(section => ({
      ...section,
      goods: section.goods.map(goods => ({
        ...goods,
        cartCount: 0
      }))
    }))
    const goodsList = categorySections.reduce((result, section) => result.concat(section.goods), [])
    const searchGoodsList = this.data.searchGoodsList.map(goods => ({
      ...goods,
      cartCount: 0
    }))
    
    this.setData({
      cart: {},
      cartCount: 0,
      cartTotalPrice: 0,
      cartTotalPriceText: '0.00',
      categorySections,
      goodsList: goodsList,
      searchGoodsList,
      showCart: false
    })
  },

  // 去结算
  goToSettle() {
    if (this.data.cartCount === 0) {
      wx.showToast({ title: '购物车为空', icon: 'none' })
      return
    }

    this.navigateToSettle()
  },

  getActiveOrderSessionForSettle() {
    try {
      const session = wx.getStorageSync('activeOrderSession')
      if (!session || session.orderScene !== 'camping') {
        return null
      }

      return session
    } catch (err) {
      console.error('读取当前露营订单失败', err)
      return null
    }
  },

  // 跳转到结算页面
  navigateToSettle() {
    // 将购物车数据存储到本地，供结算页面使用
    try {
      wx.setStorageSync('settleCartData', {
        cart: this.data.cart,
        totalPrice: this.data.cartTotalPrice,
        tableNumber: '',
        orderType: 'camping',
        orderScene: 'camping',
        activeOrderSession: this.getActiveOrderSessionForSettle()
      })
      
      // 跳转到结算页面
      wx.navigateTo({
        url: '/pages/settle/settle'
      })
    } catch (err) {
      console.error('跳转结算页面失败', err)
      wx.showToast({
        title: '跳转失败',
        icon: 'none'
      })
    }
  },

  // 扫码获取桌码
  scanTableCode() {
    this.showActionLoading('识别中')
    wx.scanCode({
      onlyFromCamera: false, // 允许从相册选择
      scanType: ['qrCode', 'barCode', 'wxCode'],
      success: (res) => {
        this.hideActionLoading()
        console.log(res)
        let tableNumber = ''
        
        // 从 path 的 scene 参数中提取桌码号
        if (res.path) {
          const queryStr = res.path.split('?')[1]
          if (queryStr) {
            const params = queryStr.split('&')
            for (let param of params) {
              const [key, value] = param.split('=')
              if (key === 'scene' && value) {
                tableNumber = decodeURIComponent(value).trim()
                break
              }
            }
          }
        }
        
        if (tableNumber) {
          this.setData({
            tableNumber: tableNumber
          }, () => {
            this.navigateToSettle()
          })
        } else {
          wx.showToast({
            title: '未能识别桌码',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        this.hideActionLoading()
        console.error('扫码失败', err)
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({
            title: '扫码失败',
            icon: 'none'
          })
        }
      }
    })
  },

  // 创建订单
  async createOrder(options = {}) {
    const { payWithBalance = true } = options
    this.showActionLoading('下单中')
    
    try {
      const openid = app.globalData.openid
      
      // 构造订单商品列表
      const orderGoods = []
      for (let cartKey in this.data.cart) {
        const item = this.data.cart[cartKey]
        // 将 tags 对象转换为字符串数组
        let tagsArray = []
        if (item.tagLabels && Array.isArray(item.tagLabels)) {
          // 如果已有 tagLabels，直接使用
          tagsArray = item.tagLabels
        } else if (item.tags && typeof item.tags === 'object') {
          // 将 tags 对象转换为数组
          Object.keys(item.tags).forEach(tagId => {
            const value = item.tags[tagId]
            if (Array.isArray(value)) {
              tagsArray.push(...value)
            } else if (value) {
              tagsArray.push(value)
            }
          })
        }
        
        orderGoods.push({
          dishId: item.dishId || item.info._id,
          dishName: item.info.name,
          dishImage: item.info.image,
          price: item.info.price,
          count: item.count,
          tags: tagsArray, // 改为字符串数组
          canUseMiandan: item.info.canUseMiandan || false // 是否可以参与免单
        })
      }
      
      // 检查是否有免单次数（仅用于前端提示，实际扣减在云函数事务中）
      const miandanRes = await db.collection('freeBuy').where({
        _openid: openid
      }).get()
      
      let useMiandan = false
      let finalPrice = this.data.cartTotalPrice
      
      if (miandanRes.data && miandanRes.data.length > 0 && miandanRes.data[0].count > 0) {
        // 有免单次数，询问是否使用
        const modalRes = await new Promise((resolve) => {
          wx.showModal({
            title: '免单机会',
            content: `您有${miandanRes.data[0].count}次免单机会，是否使用？`,
            success: (res) => resolve(res)
          })
        })
        
        if (modalRes.confirm) {
          useMiandan = true
          finalPrice = 0
        }
      }
      
      // 调用云函数，使用事务处理订单创建、余额扣除、免单次数减少
      const doBuyRes = await wx.cloud.callFunction({
        name: 'doBuy',
        data: {
          orderGoods,
          totalPrice: this.data.cartTotalPrice,
          finalPrice,
          useMiandan,
          payWithBalance,
          tableNumber: this.data.tableNumber || '' // 传递桌码号
        }
      })

      if (!doBuyRes.result || !doBuyRes.result.success) {
        const errorMsg = doBuyRes.result?.error || '下单失败'
        throw new Error(errorMsg)
      }

      const orderId = doBuyRes.result.orderId

      if (payWithBalance) {
        // 余额支付：云函数已处理完成
        this.hideActionLoading()
        wx.showToast({ title: '下单成功', icon: 'success' })
      } else {
        // 微信支付：调用统一下单云函数
        this.showActionLoading('拉起支付中')

        const nonceStr = Math.random().toString(36).substr(2, 15) + Date.now().toString(36)

        const payRes = await wx.cloud.callFunction({
          name: 'pay',
          data: {
            body: `点餐订单支付¥${finalPrice.toFixed(2)}`,
            outTradeNo: orderId,
            totalFee: finalPrice, // 元，云函数里会转为分
            nonceStr
          }
        })

        const payment = payRes.result && payRes.result.payment ? payRes.result.payment : payRes.result

        if (!payment || !payment.timeStamp || !payment.nonceStr || !payment.package || !payment.paySign) {
          throw new Error('微信支付未配置，暂时无法拉起支付')
        }

        this.hideActionLoading()
        await wx.requestPayment(payment)

        wx.showToast({ title: '支付成功，已下单', icon: 'success' })
      }
      
      // 清空购物车
      this.setData({
        cart: {},
        cartCount: 0,
        cartTotalPrice: 0,
        cartTotalPriceText: '0.00',
        showCart: false
      })
      
      // 刷新用户信息
      this.loadUserInfo()
      
      // 跳转到订单页面
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/myorder/myorder'
        })
      }, 1500)
      
    } catch (err) {
      console.error('创建订单失败', err)
      this.hideActionLoading()
      wx.showToast({ 
        title: err.message || '下单失败', 
        icon: 'none' 
      })
    }
  },


  // 页面触底加载更多菜品
  onReachBottom() {
    this.loadMoreCategorySections()
  },

  // 分享功能
  onShareAppMessage() {
    return {
      title: this.data.shopInfo.name || '餐饮点餐',
      path: '/pages/index/index',
      imageUrl: '' // 可以设置分享图片，留空则使用小程序默认图片
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: this.data.shopInfo.name || '餐饮点餐',
      query: '',
      imageUrl: '' // 可以设置分享图片，留空则使用小程序默认图片
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    try {
      // 重置分页状态
      this.setData({
        goodsPage: 0,
        goodsHasMore: true,
        goodsLoading: false,
        categorySections: [],
        loadedCategoryCount: 0,
        goodsList: [],
        scrollIntoSection: ''
      })

      // 并行刷新所有数据（不显示 loading，使用系统下拉刷新动画）
      await Promise.all([
        this.loadShopInfo(),
        this.loadMenu(false), // 不显示 loading
        this.loadUserInfo(),
        this.loadNotices()
      ])
    } catch (err) {
      console.error('刷新失败', err)
    } finally {
      // 停止下拉刷新动画
      wx.stopPullDownRefresh()
    }
  }
})


