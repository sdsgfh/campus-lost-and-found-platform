// pages/favorites/favorites.js
const app = getApp();

Page({
  data: {
    favoriteList: [],
    page: 1,
    limit: 10,
    hasMore: true,
    loading: false,
    loadingMore: false,
    keyword: '',
    currentType: '',
    currentTypeText: '全部',
    showFilter: false
  },

  // 页面显示时自动刷新数据
  onShow() {
    console.log('页面显示，刷新收藏数据');
    this.loadData(true); // 强制刷新
  },

  onLoad() {
    this.loadData(true);
  },

  // 加载数据
  loadData(refresh = false) {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    if (refresh) {
      this.setData({ page: 1, favoriteList: [], hasMore: true });
    }
    if (!this.data.hasMore) return;

    this.setData({ loading: refresh ? true : false, loadingMore: !refresh ? true : false });

    const params = { page: this.data.page, limit: this.data.limit };
    if (this.data.currentType) {
      params.type = this.data.currentType;
    }
    if (this.data.keyword) {
      params.keyword = this.data.keyword;
    }
    wx.request({
      url: `${app.globalData.baseUrl}/api/favorite/list`,
      data: params,
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        if (res.data.code === 0) {
          const list = res.data.data.list || [];
          const total = res.data.data.total || 0;
          const hasMore = this.data.page * this.data.limit < total;
          this.setData({
            favoriteList: refresh ? list : this.data.favoriteList.concat(list),
            hasMore,
            page: this.data.page + 1
          });
        } else {
          wx.showToast({ title: res.data.message || '加载失败', icon: 'none' });
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

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
  },
  doSearch() {
    this.loadData(true);
  },

  showFilter() {
    this.setData({ showFilter: true });
  },
  hideFilter() {
    this.setData({ showFilter: false });
  },
  selectType(e) {
    const type = e.currentTarget.dataset.type;
    let text = '全部';
    if (type) {
      const map = { 'lost': '寻物', 'found': '招领', 'sale': '出售', 'wanted': '求购' };
      text = map[type];
    }
    this.setData({
      currentType: type,
      currentTypeText: text,
      showFilter: false
    });
    this.loadData(true);
  },

  loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.loadData();
  },

  goBack() {
    wx.navigateBack();
  },

  // 点击卡片主体跳转详情页
  goToDetail(e) {
    const postId = e.currentTarget.dataset.postId;
    wx.navigateTo({ url: `/pages/detail/detail?id=${postId}` });
  },

  // 点击收藏图标取消收藏（核心：无需 stopPropagation，catchtap 已移除）
  removeSingle(e) {
    const favoriteId = e.currentTarget.dataset.id;
    if (!favoriteId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认取消收藏',
      content: '您确定要取消收藏该内容吗？',
      confirmText: '取消收藏',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.removeFavoriteBatch([favoriteId]);
        }
      }
    });
  },

  // 取消收藏（适配后端批量接口）
  removeFavoriteBatch(favoriteIds) {
    wx.showLoading({ title: '操作中...' });
    wx.request({
      url: `${app.globalData.baseUrl}/api/favorite/remove_batch`,
      method: 'POST',
      header: { 
        'Authorization': 'Bearer ' + wx.getStorageSync('token'),
        'Content-Type': 'application/json'
      },
      data: { favorite_ids: favoriteIds }, // 与后端参数名一致
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 0) {
          wx.showToast({ 
            title: `已取消${favoriteIds.length}项收藏`, 
            icon: 'success', 
            duration: 1500 
          });
          // 即时移除列表项
          const newList = this.data.favoriteList.filter(item => !favoriteIds.includes(item.favorite_id));
          this.setData({ favoriteList: newList });
          if (newList.length === 0) {
            this.loadData(true);
          }
        } else {
          wx.showToast({ title: res.data.message || '取消收藏失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常，操作失败', icon: 'none' });
      }
    });
  }
});