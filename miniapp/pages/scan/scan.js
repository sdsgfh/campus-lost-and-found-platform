// pages/scan/scan.js
const app = getApp();

Page({
  onLoad(options) {
    const { post_id, user_id, timestamp, signature } = options;
    if (!post_id || !user_id || !timestamp || !signature) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    // 构建原始内容（格式需与后端解析一致）
    const qrContent = `${post_id}:${user_id}:${timestamp}:${signature}`;
    this.confirm(qrContent);
  },

  confirm(qrContent) {
    console.log('扫码内容:', qrContent);
    wx.request({
      url: `${app.globalData.baseUrl}/api/transaction/scan`,
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      data: { content: qrContent },
      success: (res) => {
        if (res.data.code === 0) {
          wx.showToast({ title: '确认成功', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1500);
        } else {
          wx.showToast({ title: res.data.message, icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  }
});