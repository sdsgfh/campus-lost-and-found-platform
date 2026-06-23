const app = getApp();

Page({
  data: {
    userInfo: {},
    statusText: '',
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    let userInfo = wx.getStorageSync('userInfo') || {};
    // 核心：兜底处理所有空字段
    userInfo.nickname = userInfo.nickname || '微信用户';
    userInfo.avatar = userInfo.avatar || '/images/default-avatar.png';
    userInfo.bio = userInfo.bio || '';
    userInfo.status = userInfo.status || 'unverified';
    
    // 脱敏处理（保留原有逻辑）
    if (userInfo.prefixed_id) {
      const id = userInfo.prefixed_id;
      const prefix = id.startsWith('S_') ? 'S_' : id.startsWith('T_') ? 'T_' : '';
      const realId = id.replace(prefix, '');
      if (realId.length > 4) {
        userInfo.maskedId = prefix + '****' + realId.slice(-4);
      } else {
        userInfo.maskedId = prefix + '****';
      }
    }
    
    // 状态文本映射
    const statusMap = {
      'unverified': '未认证',
      'verified': '已认证',
      'cancelled': '已注销',
      'banned': '已封禁'
    };
    
    this.setData({
      userInfo,
      statusText: statusMap[userInfo.status] || '未认证'
    });
  },

  // 保留原有其他方法（changeAvatar/editNickname等），无需修改
  changeAvatar() {
    wx.navigateTo({ url: '/pages/profile/edit' });
  },

  editNickname() {
    wx.navigateTo({ url: '/pages/profile/edit' });
  },

  editBio() {
    wx.navigateTo({ url: '/pages/profile/edit' });
  },

  goToEdit() {
    wx.navigateTo({ url: '/pages/profile/edit' });
  },

  goToPage(e) {
    const url = e.currentTarget.dataset.url;
    wx.navigateTo({ url });
  },

  goToAuth() {
    wx.navigateTo({ url: '/pages/auth/auth' });
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定退出当前账号吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          app.globalData.userInfo = null;
          app.globalData.isLogin = false;
          wx.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  },

  goBack() {
    wx.navigateBack();
  }
});