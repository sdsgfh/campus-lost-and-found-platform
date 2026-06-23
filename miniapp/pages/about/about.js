// pages/about/about.js
Page({
  onLoad() {
    // 适配状态栏高度
    const systemInfo = wx.getSystemInfoSync();
    wx.setStorageSync('statusBarHeight', systemInfo.statusBarHeight || 20);
    wx.setNavigationBarColor({
      frontColor: '#000000',
      backgroundColor: '#A5CFA9'
    });
  },

  goBack() {
    wx.navigateBack();
  },

  // 优化用户协议格式（换行+缩进，去掉同意按钮）
  openUserAgreement() {
    wx.showModal({ 
      title: '用户服务协议', 
      content: `校觅用户服务协议

  1. 适用范围
      本协议适用于所有使用校觅小程序的用户，包括高校师生及其他授权用户。

  2. 服务内容
      校觅为用户提供失物招领、闲置交易、需求对接等校园生活服务，
      用户应遵守校园管理规定及相关法律法规。

  3. 用户义务
      用户保证发布的信息真实、合法，不得利用本平台发布违法、违规内容，
      不得侵犯他人合法权益。

  4. 免责声明
      校觅仅提供信息展示平台，不对用户发布的信息真实性、准确性承担连带责任。`,
      // 去掉同意/取消按钮，只保留确定
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // 优化隐私政策格式（换行+缩进，去掉同意按钮）
  openPrivacyPolicy() {
    wx.showModal({ 
      title: '隐私政策', 
      content: `校觅隐私政策

  1. 信息收集
      我们仅收集必要的用户信息（如昵称、手机号），用于身份验证和服务提供，
      不会收集无关隐私信息。

  2. 信息使用
      用户信息仅用于本平台服务优化、消息通知，
      不会向第三方泄露（法律法规要求除外）。

  3. 信息保护
      我们采用加密技术保护用户信息安全，定期进行安全审计，防止信息泄露。

  4. 用户权利
      用户可随时查看、修改、删除自己的个人信息，
      如需注销账号可联系平台客服。`,
      showCancel: false,
      confirmText: '我知道了'
    });
  }
});