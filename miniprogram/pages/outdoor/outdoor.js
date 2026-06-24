// pages/outdoor/outdoor.js
const app = getApp()
const db = wx.cloud.database()

const DEFAULT_GRILLS = [
  { _id: 'default-A1', name: 'A1烤架', status: 'available' },
  { _id: 'default-A2', name: 'A2烤架', status: 'available' },
  { _id: 'default-A3', name: 'A3烤架', status: 'available' },
  { _id: 'default-B1', name: 'B1烤架', status: 'available' },
  { _id: 'default-B2', name: 'B2烤架', status: 'available' }
]

Page({
  data: {
    mode: 'outdoor',
    outdoorPointId: 'main',
    grills: [],
    selectedGrill: null,
    menuList: [],
    currentMenuId: '',
    goodsList: [],
    cart: {},
    cartCount: 0,
    cartTotalPrice: 0,
    cartTotalPriceText: '0.00',
    loadingGoods: false,
    submitting: false
  },

  onLoad(options = {}) {
    this.setData({
      mode: options.mode || 'outdoor',
      outdoorPointId: options.outdoorPointId || 'main'
    })
    this.loadGrills()
    this.loadMenu()
  },

  async loadGrills() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'outdoorManage',
        data: {
          action: 'getGrills',
          outdoorPointId: this.data.outdoorPointId
        }
      })

      const result = res.result || {}
      const list = result.success ? (result.data || []) : []
      this.setData({
        grills: list.length > 0 ? list : DEFAULT_GRILLS
      })
    } catch (err) {
      console.error('加载烤架失败', err)
      this.setData({
        grills: DEFAULT_GRILLS
      })
    }
  },

  async loadMenu() {
    wx.showLoading({ title: '加载菜单...' })
    try {
      const res = await wx.cloud.callFunction({ name: 'getCategory' })
      const result = res.result || {}
      const list = result.success ? (result.data || []) : []
      const firstId = list.length > 0 ? list[0]._id : ''
      this.setData({
        menuList: list,
        currentMenuId: firstId
      })
      if (firstId) {
        await this.loadGoods(firstId)
      }
    } catch (err) {
      console.error('加载分类失败', err)
      wx.showToast({ title: '菜单加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async loadGoods(categoryId) {
    if (!categoryId || this.data.loadingGoods) return
    this.setData({ loadingGoods: true })
    try {
      const res = await db.collection('dish')
        .where({
          categoryId,
          status: 1
        })
        .orderBy('sort', 'asc')
        .limit(100)
        .get()

      const list = (res.data || []).map(item => ({
        ...item,
        cartCount: this.getDishCartCount(item._id)
      }))

      this.setData({
        goodsList: list
      })
    } catch (err) {
      console.error('加载菜品失败', err)
      wx.showToast({ title: '菜品加载失败', icon: 'none' })
    } finally {
      this.setData({ loadingGoods: false })
    }
  },

  switchMenu(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      currentMenuId: id,
      goodsList: []
    })
    this.loadGoods(id)
  },

  selectGrill(e) {
    const grill = e.currentTarget.dataset.grill
    this.setData({
      selectedGrill: grill
    })
  },

  addDish(e) {
    const goods = e.currentTarget.dataset.goods
    const cart = { ...this.data.cart }
    if (cart[goods._id]) {
      cart[goods._id].count += 1
    } else {
      cart[goods._id] = {
        info: goods,
        count: 1
      }
    }
    this.updateCart(cart)
  },

  reduceDish(e) {
    const goods = e.currentTarget.dataset.goods
    const cart = { ...this.data.cart }
    if (!cart[goods._id]) return
    cart[goods._id].count -= 1
    if (cart[goods._id].count <= 0) {
      delete cart[goods._id]
    }
    this.updateCart(cart)
  },

  getDishCartCount(dishId) {
    const item = this.data.cart[dishId]
    return item ? item.count : 0
  },

  updateCart(cart) {
    let count = 0
    let total = 0
    Object.keys(cart).forEach(key => {
      const item = cart[key]
      count += item.count
      total += Number(item.info.price || 0) * item.count
    })

    const goodsList = this.data.goodsList.map(goods => ({
      ...goods,
      cartCount: cart[goods._id] ? cart[goods._id].count : 0
    }))

    this.setData({
      cart,
      cartCount: count,
      cartTotalPrice: total,
      cartTotalPriceText: total.toFixed(2),
      goodsList
    })
  },

  clearCart() {
    const goodsList = this.data.goodsList.map(goods => ({
      ...goods,
      cartCount: 0
    }))
    this.setData({
      cart: {},
      cartCount: 0,
      cartTotalPrice: 0,
      cartTotalPriceText: '0.00',
      goodsList
    })
  },

  buildOrderGoods() {
    return Object.keys(this.data.cart).map(key => {
      const item = this.data.cart[key]
      return {
        dishId: item.info._id,
        dishName: item.info.name,
        dishImage: item.info.image || '',
        price: Number(item.info.price || 0),
        count: item.count,
        tags: [],
        canUseMiandan: item.info.canUseMiandan || false
      }
    })
  },

  async submitOutdoorOrder() {
    if (this.data.submitting) return
    if (!this.data.selectedGrill) {
      wx.showToast({ title: '请选择烤架', icon: 'none' })
      return
    }
    if (this.data.cartCount === 0) {
      wx.showToast({ title: '请先选择菜品', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })

    try {
      const goods = this.buildOrderGoods()
      const res = await wx.cloud.callFunction({
        name: 'outdoorManage',
        data: {
          action: 'createOutdoorOrder',
          outdoorPointId: this.data.outdoorPointId,
          grillId: this.data.selectedGrill._id,
          grillName: this.data.selectedGrill.name,
          goods,
          totalPrice: this.data.cartTotalPrice,
          finalPrice: this.data.cartTotalPrice,
          userInfo: app.globalData.userInfo || {}
        }
      })

      const result = res.result || {}
      if (!result.success) {
        throw new Error(result.message || '提交失败')
      }

      wx.hideLoading()
      this.clearCart()
      wx.showModal({
        title: '订单已提交',
        content: '订单已提交，请等待商家备货。备货完成后，请到指定取餐处自取。',
        showCancel: false,
        success: () => {
          this.loadGrills()
        }
      })
    } catch (err) {
      wx.hideLoading()
      console.error('提交户外订单失败', err)
      wx.showToast({ title: err.message || '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
