const apiClient = require('../../../../../utils/apiClient')

const MAX_IMAGE_SIZE = 1024 * 1024

function showToast(title, icon = 'none') {
  wx.showToast({ title, icon })
}

function getFileInfo(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileInfo({
      filePath,
      success: resolve,
      fail: reject
    })
  })
}

function compressImage(filePath, quality = 72) {
  return new Promise(resolve => {
    wx.compressImage({
      src: filePath,
      quality,
      success: res => resolve(res.tempFilePath || filePath),
      fail: () => resolve(filePath)
    })
  })
}

function chooseContactImage() {
  return new Promise((resolve, reject) => {
    const success = res => {
      const file = res.tempFiles && res.tempFiles[0]
      const filePath = file && file.tempFilePath || (res.tempFilePaths && res.tempFilePaths[0]) || ''
      if (!filePath) {
        reject(new Error('image not selected'))
        return
      }
      resolve({ filePath, size: file && file.size || 0 })
    }

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success,
        fail: reject
      })
      return
    }

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success,
      fail: reject
    })
  })
}

function uploadContactImageFile(filePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: apiClient.getBaseUrl(),
      filePath,
      name: 'file',
      formData: {
        tenantId: apiClient.TENANT_ID,
        adminAuthToken: apiClient.getAdminAuthToken(),
        action: 'admin.shop.uploadFile'
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
        reject(new Error(result.message || `upload failed: ${res.statusCode}`))
      },
      fail: reject
    })
  })
}

Page({
  data: {
    shopInfoId: '',
    contactPhone: '',
    contactImage: '',
    contactImageFileID: '',
    saving: false,
    uploading: false
  },

  onLoad() {
    this.loadShopInfo()
  },

  async loadShopInfo() {
    try {
      wx.showLoading({ title: '加载中' })
      const result = await apiClient.call('shop.info')
      const shopInfo = result.data || {}
      this.setData({
        shopInfoId: shopInfo._id || '',
        contactPhone: shopInfo.contactPhone || '',
        contactImage: shopInfo.contactImage || '',
        contactImageFileID: shopInfo.contactImageFileID || shopInfo.contactImage || ''
      })
    } catch (err) {
      console.error('load shop contact info failed', err)
      showToast(err.message || '加载失败')
    } finally {
      wx.hideLoading()
    }
  },

  goBack() {
    wx.navigateBack()
  },

  onPhoneInput(e) {
    this.setData({ contactPhone: e.detail.value })
  },

  async chooseContactImage() {
    if (this.data.uploading) return

    try {
      const selected = await chooseContactImage()
      let targetPath = selected.filePath
      let info = await getFileInfo(targetPath)
      if ((info.size || selected.size || 0) > MAX_IMAGE_SIZE) {
        targetPath = await compressImage(targetPath, 72)
        info = await getFileInfo(targetPath)
      }
      if ((info.size || 0) > MAX_IMAGE_SIZE) {
        targetPath = await compressImage(selected.filePath, 45)
        info = await getFileInfo(targetPath)
      }
      if ((info.size || 0) > MAX_IMAGE_SIZE) {
        showToast('图片压缩后仍超过1MB')
        return
      }

      this.setData({ uploading: true })
      wx.showLoading({ title: '上传中' })
      const upload = await uploadContactImageFile(targetPath)
      this.setData({
        contactImageFileID: upload.fileID || '',
        contactImage: upload.image || targetPath
      })
      showToast('图片已上传', 'success')
    } catch (err) {
      if (!/cancel/i.test(String(err && err.errMsg || err && err.message || ''))) {
        console.error('upload contact image failed', err)
        showToast(err.message || '上传失败')
      }
    } finally {
      wx.hideLoading()
      this.setData({ uploading: false })
    }
  },

  async saveShopInfo() {
    const contactPhone = String(this.data.contactPhone || '').trim()
    if (contactPhone && !/^1\d{10}$/.test(contactPhone)) {
      showToast('请输入11位联系电话')
      return
    }

    try {
      this.setData({ saving: true })
      wx.showLoading({ title: '保存中' })
      const result = await apiClient.call('admin.shop.save', {
        contactPhone,
        contactImageFileID: this.data.contactImageFileID
      })
      const shopInfo = result.data || {}
      this.setData({
        shopInfoId: shopInfo._id || this.data.shopInfoId,
        contactPhone: shopInfo.contactPhone || contactPhone,
        contactImage: shopInfo.contactImage || this.data.contactImage,
        contactImageFileID: shopInfo.contactImageFileID || this.data.contactImageFileID
      })
      showToast('保存成功', 'success')
    } catch (err) {
      console.error('save shop contact info failed', err)
      showToast(err.message || '保存失败')
    } finally {
      wx.hideLoading()
      this.setData({ saving: false })
    }
  }
})
