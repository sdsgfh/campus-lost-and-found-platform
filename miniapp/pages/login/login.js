// pages/login/login.js
const app = getApp();

Page({
  data: {
    agreed: false,
  },

  // 勾选/取消协议
  handleAgreeChange(e) {
    console.log('复选框变化事件触发', e);
    console.log('选中值数组：', e.detail.value);
    const agreed = e.detail.value.includes('agree');
    console.log('设置 agreed 为：', agreed);
    this.setData({ agreed: agreed });
  },

  // 微信一键登录
  handleWechatLogin(e) {
    console.log('agreed =', this.data.agreed);
    console.log('按钮被点击了', e.detail);
    wx.showToast({ title: '点击成功' });

    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' });
      return;
    }

    const userInfo = e.detail.userInfo;
    if (!userInfo) {
      wx.showToast({ title: '您拒绝了授权，无法登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '登录中...' });

    // 调用 wx.login 获取 code
    wx.login({
      success: (res) => {
        if (res.code) {
          // 将 code 和用户信息发送到后端
          this.loginWithCode(res.code, userInfo);
        } else {
          wx.hideLoading();
          wx.showToast({ title: '登录失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  // 向后端发起登录请求（核心修改：新增拉取最新用户信息逻辑）
  loginWithCode(code, userInfo) {
    wx.request({
      url: `${app.globalData.baseUrl}/api/auth/login`,
      method: 'POST',
      data: {
        code: code,
        userInfo: {
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl
        }
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 0) {
          const { token, user } = res.data.data;
          // 1. 存储基础 token 和用户信息
          wx.setStorageSync('token', token);
          app.globalData.isLogin = true;

          // ========== 核心修复：拉取最新用户信息（解决头像复原问题） ==========
          wx.showLoading({ title: '加载用户信息...' });
          wx.request({
            url: `${app.globalData.baseUrl}/api/user/get_latest_info`,
            method: 'GET',
            header: { 'Authorization': 'Bearer ' + token },
            success: (userRes) => {
              wx.hideLoading();
              if (userRes.data.code === 0) {
                // 2. 兜底处理空字段，避免显示异常
                const latestUserInfo = userRes.data.data;
                latestUserInfo.nickname = latestUserInfo.nickname || userInfo.nickName || '微信用户';
                latestUserInfo.avatar = latestUserInfo.avatar || userInfo.avatarUrl || '/images/default-avatar.png';
                latestUserInfo.bio = latestUserInfo.bio || '';
                latestUserInfo.status = latestUserInfo.status || 'unverified';

                // 3. 存储最新用户信息到缓存和全局变量
                wx.setStorageSync('userInfo', latestUserInfo);
                app.globalData.userInfo = latestUserInfo;

                // 4. 根据用户状态跳转（沿用原有逻辑）
                if (latestUserInfo.status === 'unverified') {
                  wx.redirectTo({ url: '/pages/auth/auth' });
                } else if (latestUserInfo.status === 'verified') {
                  wx.switchTab({ url: '/pages/home/home' });
                } else {
                  wx.showModal({
                    title: '提示',
                    content: latestUserInfo.status === 'banned' ? '您的账号已被封禁，仅可浏览内容' : '您的账号已注销，仅可浏览内容',
                    showCancel: false,
                    success: () => {
                      wx.switchTab({ url: '/pages/home/home' });
                    }
                  });
                }
              } else {
                // 拉取最新信息失败时，使用原有返回的 user 兜底
                const fallbackUser = user || {};
                fallbackUser.nickname = fallbackUser.nickname || userInfo.nickName || '微信用户';
                fallbackUser.avatar = fallbackUser.avatar || userInfo.avatarUrl || '/images/default-avatar.png';
                fallbackUser.bio = fallbackUser.bio || '';
                fallbackUser.status = fallbackUser.status || 'unverified';

                wx.setStorageSync('userInfo', fallbackUser);
                app.globalData.userInfo = fallbackUser;
                
                wx.showToast({ title: '用户信息加载失败，使用基础信息登录', icon: 'none' });
                // 继续跳转
                if (fallbackUser.status === 'unverified') {
                  wx.redirectTo({ url: '/pages/auth/auth' });
                } else {
                  wx.switchTab({ url: '/pages/home/home' });
                }
              }
            },
            fail: (err) => {
              wx.hideLoading();
              // 网络失败时，使用原有 user 兜底
              const fallbackUser = user || {};
              fallbackUser.nickname = fallbackUser.nickname || userInfo.nickName || '微信用户';
              fallbackUser.avatar = fallbackUser.avatar || userInfo.avatarUrl || '/images/default-avatar.png';
              fallbackUser.bio = fallbackUser.bio || '';
              fallbackUser.status = fallbackUser.status || 'unverified';

              wx.setStorageSync('userInfo', fallbackUser);
              app.globalData.userInfo = fallbackUser;
              
              wx.showToast({ title: '网络异常，使用基础信息登录', icon: 'none' });
              // 继续跳转
              if (fallbackUser.status === 'unverified') {
                wx.redirectTo({ url: '/pages/auth/auth' });
              } else {
                wx.switchTab({ url: '/pages/home/home' });
              }
              console.error('拉取最新用户信息失败：', err);
            }
          });
        } else {
          wx.showToast({ title: res.data.message || '登录失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  // 打开用户协议（保留原有逻辑）
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
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // 打开隐私政策（保留原有逻辑）
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