const app = getApp();

Page({
  data: {
    cacheSize: '计算中...'
  },

  onShow() {
    this.getCacheSize();
  },

  // 获取缓存大小（保留实用功能）
  getCacheSize() {
    wx.getStorageInfo({
      success: (res) => {
        const size = (res.currentSize / 1024).toFixed(2);
        this.setData({ cacheSize: size + ' MB' });
      },
      fail: () => {
        this.setData({ cacheSize: '获取失败' });
      }
    });
  },

  // 清理缓存（保留，提升用户体验）
  clearCache() {
    wx.showModal({
      title: '提示',
      content: '确定清理缓存吗？清理后不会删除您的账号数据',
      confirmText: '确认清理',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorage({
            success: () => {
              wx.showToast({ title: '缓存清理成功', icon: 'success', duration: 1500 });
              this.getCacheSize(); // 重新计算缓存大小
            },
            fail: () => {
              wx.showToast({ title: '清理失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 跳转页面
  goToPage(e) {
    const url = e.currentTarget.dataset.url;
    wx.navigateTo({ url });
  },

  // 退出登录
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

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
});