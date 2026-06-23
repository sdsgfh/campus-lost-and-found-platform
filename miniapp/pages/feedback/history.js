const app = getApp();

Page({
  data: {
    list: [],
    page: 1,
    limit: 10,
    hasMore: true,
    loading: false,
    loadingMore: false,
    showModal: false,    
    currentItem: {}      
  },

  onShow() {
    this.loadData(true);
  },

  loadData(refresh = false) {
    if (refresh) {
      this.setData({ page: 1, list: [], hasMore: true });
    }
    if (!this.data.hasMore) return;

    this.setData({ loading: refresh, loadingMore: !refresh });

    wx.request({
      url: `${app.globalData.baseUrl}/api/feedback/list`,
      data: { page: this.data.page, limit: this.data.limit },
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        if (res.data.code === 0) {
          const list = res.data.data.list || [];
          const total = res.data.data.total || 0;
          const hasMore = this.data.page * this.data.limit < total;
          this.setData({
            list: refresh ? list : this.data.list.concat(list),
            hasMore,
            page: this.data.page + 1
          });
        } else {
          wx.showToast({ title: res.data.message, icon: 'none' });
        }
      },
      complete: () => {
        this.setData({ loading: false, loadingMore: false });
      }
    });
  },

  loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.loadData();
  },

  // 修复：替换错误的 wx.setPageScrollTo 为 wx.pageScrollTo
  showDetailModal(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      currentItem: item,
      showModal: true
    });
    // 正确的API写法（去掉set）
    wx.pageScrollTo({ scrollTop: 0 });
  },

  hideDetailModal() {
    this.setData({
      showModal: false,
      currentItem: {}
    });
  },

  previewImage(e) {
    const urls = e.currentTarget.dataset.urls;
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      urls: urls,
      current: urls[index]
    });
  },

  goBack() {
    wx.navigateBack();
  }
});