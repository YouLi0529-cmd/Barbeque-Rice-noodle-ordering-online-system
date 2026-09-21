const PRIVACY_PROTECTION_GUIDE_PDF_URL = 'https://zmbbq-d0ggmremua04f027d-1449718669.tcloudbaseapp.com/legal/privacy-protection-guide-v1.pdf'

function openPrivacyProtectionGuideDocument() {
  wx.showLoading({
    title: '正在打开指引',
    mask: true
  })

  wx.downloadFile({
    url: PRIVACY_PROTECTION_GUIDE_PDF_URL,
    success: res => {
      if (res.statusCode !== 200) {
        wx.hideLoading()
        wx.showToast({
          title: '指引文件暂未发布',
          icon: 'none'
        })
        return
      }

      wx.openDocument({
        filePath: res.tempFilePath,
        fileType: 'pdf',
        showMenu: true,
        complete: () => wx.hideLoading(),
        fail: err => {
          console.error('open privacy protection guide failed', err)
          wx.showToast({
            title: '指引文件打开失败',
            icon: 'none'
          })
        }
      })
    },
    fail: err => {
      console.error('download privacy protection guide failed', err)
      wx.hideLoading()
      wx.showToast({
        title: '指引文件暂未发布',
        icon: 'none'
      })
    }
  })
}

module.exports = {
  PRIVACY_PROTECTION_GUIDE_PDF_URL,
  openPrivacyProtectionGuideDocument
}
