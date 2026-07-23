const PRIVACY_POLICY_PDF_URL = 'https://zhrcloud-d1gsjuhij11024f72-1449718669.tcloudbaseapp.com/legal/privacy-policy-v1.pdf'

function openPrivacyPolicyDocument() {
  wx.showLoading({
    title: '正在打开政策',
    mask: true
  })

  wx.downloadFile({
    url: PRIVACY_POLICY_PDF_URL,
    success: res => {
      if (res.statusCode !== 200) {
        wx.hideLoading()
        wx.showToast({
          title: '政策文件暂未发布',
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
          console.error('open privacy policy document failed', err)
          wx.showToast({
            title: '政策文件打开失败',
            icon: 'none'
          })
        }
      })
    },
    fail: err => {
      console.error('download privacy policy document failed', err)
      wx.hideLoading()
      wx.showToast({
        title: '政策文件暂未发布',
        icon: 'none'
      })
    }
  })
}

module.exports = {
  PRIVACY_POLICY_PDF_URL,
  openPrivacyPolicyDocument
}
