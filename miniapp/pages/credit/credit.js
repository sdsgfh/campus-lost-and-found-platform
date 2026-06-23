// pages/credit/credit.js
const app = getApp();

Page({
  data: {
    creditInfo: {
      credit_score: 0,
      level: '暂无等级',
      daily_limit: 0,
      status: '',
      description: '',
      daily_post_limit: 0
    },
    logList: [],
    logType: 'all', // all, add, deduct
    page: 1,
    limit: 20,
    hasMore: true,
    loading: false,
    loadingMore: false,
    showRules: false,
    rules: {
      add: [],
      deduct: []
    }
  },

  onLoad() {
    this.loadCreditInfo();
    this.loadRules();
    this.loadLogs(true);
  },

  loadCreditInfo() {
    wx.request({
      url: `${app.globalData.baseUrl}/api/credit/info`,
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        if (res.data.code === 0) {
          const creditInfo = res.data.data;
          // 统一字段格式，兜底空值
          creditInfo.level = creditInfo.level || '暂无等级';
          creditInfo.credit_score = creditInfo.credit_score || 0;
          creditInfo.daily_post_limit = creditInfo.daily_post_limit || 0;
          // 兼容后端返回的字段名
          creditInfo.daily_limit = creditInfo.daily_post_limit || creditInfo.daily_limit || 0;
          this.setData({ creditInfo });
        } else {
          wx.showToast({ title: res.data.message, icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  loadRules() {
    wx.request({
      url: `${app.globalData.baseUrl}/api/credit/rules`,
      success: (res) => {
        if (res.data.code === 0) {
          this.setData({ rules: res.data.data });
        }
      }
    });
  },

  loadLogs(refresh = false) {
    if (refresh) {
      this.setData({ page: 1, logList: [], hasMore: true });
    }
    if (!this.data.hasMore) return;

    this.setData({ loading: refresh ? true : false, loadingMore: !refresh ? true : false });

    wx.request({
      url: `${app.globalData.baseUrl}/api/credit/logs`,
      data: {
        page: this.data.page,
        limit: this.data.limit,
        type: this.data.logType
      },
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
        } else {
          wx.showToast({ title: res.data.message, icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
      },
      complete: () => {
        this.setData({ loading: false, loadingMore: false });
      }
    });
  },

  switchTab(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.logType) return;
    this.setData({ logType: type });
    this.loadLogs(true);
  },

  loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.loadLogs();
  },

  goBack() {
    wx.navigateBack();
  },

  showRules() {
    this.setData({ showRules: true });
  },
  hideRules() {
    this.setData({ showRules: false });
  }
});