// pages/reward/reward.js
const app = getApp();

Page({
  data: {
    info: {
      points: 0,
      honor: '',
      today_points: 0,
      max_daily: 20,
      next_honor: '',
      next_points: null,
      credit_score: 0
    },
    logList: [],
    page: 1,
    limit: 20,
    hasMore: true,
    loading: false,
    loadingMore: false
  },

  onLoad() {
    this.loadInfo();
    this.loadLogs(true);
  },

  loadInfo() {
    wx.request({
      url: `${app.globalData.baseUrl}/api/reward/info`,
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        if (res.data.code === 0) {
          this.setData({ info: res.data.data });
        } else {
          wx.showToast({ title: res.data.message, icon: 'none' });
        }
      }
    });
  },

  loadLogs(refresh = false) {
    if (refresh) {
      this.setData({ page: 1, logList: [], hasMore: true });
    }
    if (!this.data.hasMore) return;

    this.setData({ loading: refresh, loadingMore: !refresh });

    wx.request({
      url: `${app.globalData.baseUrl}/api/reward/logs`,
      data: { page: this.data.page, limit: this.data.limit },
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        if (res.data.code === 0) {
          const list = res.data.data.list || [];
          const total = res.data.data.total || 0;
          const hasMore = this.data.page * this.data.limit < total;
          this.setData({
            logList: refresh ? list : this.data.logList.concat(list),
            hasMore,
            page: this.data.page + 1
          });
        }
      },
      complete: () => {
        this.setData({ loading: false, loadingMore: false });
      }
    });
  },

  loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.loadLogs();
  },

  goBack() {
    wx.navigateBack();
  }
});