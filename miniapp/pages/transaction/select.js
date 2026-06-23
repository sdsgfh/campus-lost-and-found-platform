const app = getApp();

Page({
  data: {
    postId: null,
    candidates: []
  },

  onLoad(options) {
    const postId = options.postId;
    if (!postId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ postId });
    this.loadCandidates();
  },

  loadCandidates() {
    wx.request({
      url: `${app.globalData.baseUrl}/api/transaction/candidates`,
      data: { post_id: this.data.postId },
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        if (res.data.code === 0) {
          this.setData({ candidates: res.data.data });
        } else {
          wx.showToast({ title: res.data.message, icon: 'none' });
        }
      }
    });
  },

  selectCandidate(e) {
    const user = e.currentTarget.dataset.user;
    wx.showModal({
      title: '提示',
      content: `您确定选择 ${user.nickname} 为对接者吗？选择后将生成二维码，确认不可更改`,
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: `/pages/transaction/qrcode?postId=${this.data.postId}&userId=${user.user_id}`
          });
        }
      }
    });
  },

  goBack() {
    wx.navigateBack();
  }
});