const app = getApp();

Page({
  data: {
    postId: null,
    userId: null,
    qrcodeData: '',
    countdown: 0,
    timer: null
  },

  onLoad(options) {
    const postId = options.postId;
    const userId = options.userId;
    if (!postId || !userId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ postId, userId });
    this.generateQRCode();
  },

  goToTransactionList() {
    wx.navigateTo({ url: '/pages/transaction/list' });
  },

  generateQRCode() {
    console.log('发送数据:', { post_id: this.data.postId, user_id: this.data.userId });
    wx.request({
      url: `${app.globalData.baseUrl}/api/transaction/generate_qrcode`,
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      data: { post_id: this.data.postId, user_id: this.data.userId },
      success: (res) => {
        if (res.data.code === 0) {
          this.setData({ qrcodeData: res.data.data.qrcode });
          this.startCountdown(600); // 10分钟
        } else {
          wx.showToast({ title: res.data.message, icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常，生成失败', icon: 'none' });
      }
    });
  },

  startCountdown(seconds) {
    this.setData({ countdown: seconds });
    // 清除旧定时器（避免重复）
    if (this.data.timer) clearInterval(this.data.timer);
    
    this.data.timer = setInterval(() => {
      let left = this.data.countdown - 1;
      if (left <= 0) {
        clearInterval(this.data.timer);
        this.setData({ countdown: 0 });
      } else {
        this.setData({ countdown: left });
      }
    }, 1000);
  },

  regenerate() {
    wx.showLoading({ title: '重新生成中...' });
    clearInterval(this.data.timer);
    this.generateQRCode();
    wx.hideLoading();
  },

  onUnload() {
    clearInterval(this.data.timer);
  },

  goBack() {
    wx.navigateBack();
  }
});