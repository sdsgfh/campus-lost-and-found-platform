const app = getApp();

Page({
  data: {
    report: {}
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
      url: `${app.globalData.baseUrl}/api/report/detail`,
      data: { id },
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        if (res.data.code === 0) {
          const report = res.data.data;
          // 补充显示文本
          report.statusText = {
            'pending': '待审核',
            'approved': '审核成立',
            'rejected': '审核不成立'
          }[report.status] || report.status;
          report.reportTypeText = report.report_type === 'content' ? '内容举报' : '用户举报';
          this.setData({ report });
        } else {
          wx.showToast({ title: res.data.message || '加载失败', icon: 'none' });
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