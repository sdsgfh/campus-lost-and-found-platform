const app = getApp();

Page({
  data: {
    appeal: {}
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
      url: `${app.globalData.baseUrl}/api/appeal/detail`,
      data: { id },
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        if (res.data.code === 0) {
          const appeal = res.data.data;
          // 补充显示文本
          appeal.statusText = {
            'pending': '待审核',
            'approved': '申诉成立',
            'rejected': '申诉不成立'
          }[appeal.status] || appeal.status;
          appeal.appealTypeText = {
            'post_reject': '发布驳回申诉',
            'post_off': '下架申诉',
            'credit_deduct': '信誉分扣除申诉',
            'claim_dispute': '冒领申诉'
          }[appeal.appeal_type] || appeal.appeal_type;
          this.setData({ appeal });
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