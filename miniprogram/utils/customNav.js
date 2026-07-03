function getCustomNavOptions() {
  const systemInfo = wx.getSystemInfoSync()
  const statusBarHeight = systemInfo.statusBarHeight || 0

  let navBarHeight = 44
  let navContentTop = 0
  let navContentHeight = 44
  let navTitleFontSize = 18
  let navIconSize = 14
  let navIconStroke = 2
  let navRightGap = 92

  try {
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const capsuleBottom = menuButton.top + menuButton.height
    navContentTop = Math.max(0, menuButton.top - statusBarHeight)
    navContentHeight = menuButton.height
    navBarHeight = Math.max(40, capsuleBottom - statusBarHeight)
    navTitleFontSize = Math.round(menuButton.height * 0.56)
    navIconSize = Math.round(menuButton.height * 0.294)
    navIconStroke = Math.max(1, Math.round(menuButton.height * 0.07))
    navRightGap = Math.max(92, systemInfo.windowWidth - menuButton.left + 12)
  } catch (err) {
    console.warn('获取胶囊按钮位置失败', err)
  }

  return {
    statusBarHeight,
    navBarHeight,
    navContentTop,
    navContentHeight,
    navTitleFontSize,
    navIconSize,
    navIconStroke,
    navRightGap
  }
}

module.exports = {
  getCustomNavOptions
}
