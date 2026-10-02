const apiClient = require('./apiClient')

const PRIVACY_POLICY_DOCUMENT = 'privacyPolicy'

function downloadDocument(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      success: res => {
        if (res.statusCode === 200) {
          resolve(res.tempFilePath)
          return
        }
        reject(new Error(`document download failed: ${res.statusCode}`))
      },
      fail: reject
    })
  })
}

function openPrivacyPolicyDocument() {
  wx.showLoading({
    title: '\u6b63\u5728\u6253\u5f00\u653f\u7b56',
    mask: true
  })

  apiClient.call('legal.documentUrl', {
    document: PRIVACY_POLICY_DOCUMENT
  }).then(result => {
    const url = result && result.data && result.data.url
    if (!url) throw new Error('privacy policy URL is unavailable')
    return downloadDocument(url)
  }).then(filePath => {
    wx.openDocument({
      filePath,
      fileType: 'pdf',
      showMenu: true,
      complete: () => wx.hideLoading(),
      fail: err => {
        console.error('open privacy policy document failed', err)
        wx.showToast({
          title: '\u653f\u7b56\u6587\u4ef6\u6253\u5f00\u5931\u8d25',
          icon: 'none'
        })
      }
    })
  }).catch(err => {
    console.error('download privacy policy document failed', err)
    wx.hideLoading()
    wx.showToast({
      title: '\u653f\u7b56\u6587\u4ef6\u6682\u672a\u53d1\u5e03',
      icon: 'none'
    })
  })
}

module.exports = {
  PRIVACY_POLICY_DOCUMENT,
  openPrivacyPolicyDocument
}
