const apiClient = require('./apiClient')

const PRIVACY_PROTECTION_GUIDE_DOCUMENT = 'privacyProtectionGuide'

function writeDocumentFile(fileName, contentBase64) {
  return new Promise((resolve, reject) => {
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
    wx.getFileSystemManager().writeFile({
      filePath,
      data: contentBase64,
      encoding: 'base64',
      success: () => resolve(filePath),
      fail: reject
    })
  })
}

function openPrivacyProtectionGuideDocument() {
  wx.showLoading({
    title: '\u6b63\u5728\u6253\u5f00\u6307\u5f15',
    mask: true
  })

  apiClient.call('legal.documentContent', {
    document: PRIVACY_PROTECTION_GUIDE_DOCUMENT
  }).then(result => {
    const data = result && result.data || {}
    if (!data.fileName || !data.contentBase64) throw new Error('privacy protection guide content is unavailable')
    return writeDocumentFile(data.fileName, data.contentBase64)
  }).then(filePath => {
    wx.openDocument({
      filePath,
      fileType: 'pdf',
      showMenu: true,
      complete: () => wx.hideLoading(),
      fail: err => {
        console.error('open privacy protection guide failed', err)
        wx.showToast({
          title: '\u6307\u5f15\u6587\u4ef6\u6253\u5f00\u5931\u8d25',
          icon: 'none'
        })
      }
    })
  }).catch(err => {
    console.error('open privacy protection guide failed', err)
    wx.hideLoading()
    wx.showToast({
      title: '\u6307\u5f15\u6587\u4ef6\u6253\u5f00\u5931\u8d25',
      icon: 'none'
    })
  })
}

module.exports = {
  PRIVACY_PROTECTION_GUIDE_DOCUMENT,
  openPrivacyProtectionGuideDocument
}
