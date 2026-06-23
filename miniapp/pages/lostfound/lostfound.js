// pages/lostfound/lostfound.js
const app = getApp();

Page({
  data: {
    activeTab: 0,
    cardList: [],
    loading: false, // 首次/刷新加载中
    loadingMore: false, // 加载更多中
    hasMore: true,
    currentPage: 1,
    pageSize: 10,
    loadFailed: false,
    showFilter: false,
    filter: { category: '', location: '', timeRange: '' },
    selectedCategory: '全部',
    selectedLocation: '全部',
    selectedTime: '',
    categoryList: [],
    indicatorStyle: 'width: 50%; left: 0%;',
    statusBarHeight: 0
  },

  onLoad(options) {
    // 只做一次性初始化
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    this.setData({ statusBarHeight });
    this.fetchCategories();
    this.loadData(true);
  },

  onShow() {
    const globalTab = app.globalData.lostFoundTab;
    if (globalTab) {
      const targetTab = globalTab === 'lost' ? 0 : 1;
      if (this.data.activeTab !== targetTab) {
        // 同时更新 activeTab 和 indicatorStyle
        this.setData({
          activeTab: targetTab,
          indicatorStyle: `width: 50%; left: ${targetTab * 50}%;`
        });
        this.loadData(true);
      }
      app.globalData.lostFoundTab = null;
    } else {
      if (!this.data.loading && !this.data.loadingMore) {
        this.loadData(true);
      }
    }
  },

  /**
   * 优化：页面隐藏时清空加载状态（防止返回后加载状态异常）
   */
  onHide() {
    this.setData({
      loading: false,
      loadingMore: false
    });
  },

  fetchCategories() {
    wx.request({
      url: `${app.globalData.baseUrl}/api/category/list`,
      success: (res) => {
        if (res.data.code === 0) {
          this.setData({ categoryList: res.data.data });
        }
      },
      fail: () => {
        wx.showToast({ title: '分类数据加载失败', icon: 'none' });
      }
    });
  },

  /**
   * 优化加载逻辑：增加防抖，防止重复请求
   */
  loadData(isRefresh = false) {
    // 防抖：加载中时直接返回，避免重复请求
    if (this.data.loading || (this.data.loadingMore && !isRefresh)) return;

    const that = this;
    // 刷新时重置分页和列表
    if (isRefresh) {
      this.setData({ 
        currentPage: 1, 
        cardList: [], 
        hasMore: true, 
        loadFailed: false,
        loading: true // 刷新时标记loading
      });
    } else {
      // 加载更多时标记loadingMore
      this.setData({ loadingMore: true });
    }

    // 构造请求参数
    const params = {
      type: this.data.activeTab === 0 ? 'lost' : 'found',
      page: this.data.currentPage,
      limit: this.data.pageSize
    };
    if (this.data.filter.category) params.category_id = this.data.filter.category;
    if (this.data.filter.location && this.data.filter.location !== '全部') params.location = this.data.filter.location;
    if (this.data.filter.timeRange) params.time_range = this.data.filter.timeRange;

    wx.request({
      url: `${app.globalData.baseUrl}/api/lostfound/list`,
      data: params,
      success: (res) => {
        if (res.data.code === 0) {
          const list = res.data.data.list || [];
          const total = res.data.data.total || 0;
          const hasMore = that.data.currentPage * that.data.pageSize < total;

          that.setData({
            cardList: isRefresh ? list : that.data.cardList.concat(list),
            hasMore: hasMore,
            currentPage: that.data.currentPage + 1
          });
        } else {
          wx.showToast({ title: res.data.message || '加载失败', icon: 'none' });
          // 刷新失败时标记loadFailed
          if (isRefresh) that.setData({ loadFailed: true });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
        // 刷新失败时标记loadFailed
        if (isRefresh) that.setData({ loadFailed: true });
      },
      complete: () => {
        // 无论成功失败，结束加载状态
        that.setData({ 
          loading: false, 
          loadingMore: false 
        });
      }
    });
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    this.setData({
      activeTab: index,
      indicatorStyle: `width: 50%; left: ${index * 50}%;`
    });
    // 切换Tab刷新最新数据
    this.loadData(true);
  },

  loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.loadData();
  },

  reloadData() {
    // 手动刷新按钮触发，强制加载最新数据
    this.loadData(true);
  },

  openFilter() { 
    this.setData({ showFilter: true }); 
  },

  closeFilter() { 
    this.setData({ showFilter: false }); 
  },

  selectOption(e) {
    const { group, value } = e.currentTarget.dataset;
    this.setData({ [`selected${group.charAt(0).toUpperCase() + group.slice(1)}`]: value });

    if (group === 'category') {
      if (value === '全部') this.data.filter.category = '';
      else {
        const cat = this.data.categoryList.find(c => c.name === value);
        this.data.filter.category = cat ? cat.id : '';
      }
    } else if (group === 'location') {
      this.data.filter.location = value === '全部' ? '' : value;
    } else if (group === 'time') {
      const map = { '24小时内': '24h', '3天内': '3d', '7天内': '7d', '14天内': '14d' };
      this.data.filter.timeRange = map[value] || '';
    }
  },

  resetFilter() {
    this.setData({
      selectedCategory: '全部',
      selectedLocation: '全部',
      selectedTime: '',
      filter: { category: '', location: '', timeRange: '' }
    });
  },

  confirmFilter() {
    this.setData({ showFilter: false });
    // 筛选后刷新最新数据
    this.loadData(true);
  },

  goToSearch() { 
    wx.navigateTo({ url: '/pages/search/search' }); 
  },

  goToDetail(e) { 
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` }); 
  },

  goToPublish() { 
    const type = this.data.activeTab === 0 ? 'lost' : 'found';
    wx.navigateTo({ url: `/pages/post/post?type=${type}` });
  }
});