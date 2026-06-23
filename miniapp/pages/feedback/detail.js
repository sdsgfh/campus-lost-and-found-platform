const app = getApp();

Page({
  data: {
    detail: {}
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.loadDetail(id);
  },

  loadDetail(id) {
    wx.request({
      url: `${app.globalData.baseUrl}/api/feedback/detail`,
      data: { id },
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        if (res.data.code === 0) {
          this.setData({ detail: res.data.data });
        } else {
          wx.showToast({ title: res.data.message, icon: 'none' });
          setTimeout(() => wx.navigateBack(), 1500);
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
      }
    });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({ urls: [url] });
  },

  goBack() {
    wx.navigateBack();
  }
});