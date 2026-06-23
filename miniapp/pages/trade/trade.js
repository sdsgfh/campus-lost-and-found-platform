// pages/trade/trade.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,                // 状态栏高度
    activeTab: 0,                     // 0:出售(sale) 1:求购(wanted)
    cardList: [],                      // 卡片列表
    loading: false,                    // 首次加载状态
    loadingMore: false,                 // 加载更多状态
    hasMore: true,                      // 是否还有更多
    noMore: false,                      // 是否已无更多（用于提示）
    currentPage: 1,
    pageSize: 10,
    indicatorStyle: 'width: 50%; left: 0%;',
    loadFailed: false,                  // 首次加载失败
    showFilter: false,                   // 筛选面板
    activeSort: 'comprehensive',          // 默认排序
    // 筛选条件（实际传给后端的值）
    filter: {
      category: '',
      condition: '',
      priceMin: '',
      priceMax: ''
    },
    // 筛选显示值（用于UI）
    selectedCategory: '全部',
    selectedQuality: '全部',
    selectedPrice: '全部',
    // 分类列表（用于筛选）
    categoryList: []
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    this.setData({ statusBarHeight });
    this.fetchCategories();
    this.loadData(true);
  },

  onShow() {
    const globalTab = app.globalData.tradeTab;
    if (globalTab) {
      const targetTab = globalTab === 'sale' ? 0 : 1;
      if (this.data.activeTab !== targetTab) {
        this.setData({
          activeTab: targetTab,
          indicatorStyle: `width: 50%; left: ${targetTab * 50}%;`
        });
        this.loadData(true);
      }
      app.globalData.tradeTab = null;
    } else {
      if (!this.data.loading && !this.data.loadingMore) {
        this.loadData(true);
      }
    }
  },

  /**
   * 页面隐藏时重置加载状态，避免返回后加载异常
   */
  onHide() {
    this.setData({
      loading: false,
      loadingMore: false
    });
  },

  // 获取分类列表
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

  // 加载数据
  loadData(isRefresh = false) {
    // 防抖：加载中时直接返回
    if (this.data.loading || (this.data.loadingMore && !isRefresh)) return;

    if (isRefresh) {
      this.setData({
        currentPage: 1,
        cardList: [],
        hasMore: true,
        noMore: false,
        loadFailed: false
      });
    }
    if (!this.data.hasMore) return;

    this.setData({
      loading: isRefresh ? true : false,
      loadingMore: !isRefresh ? true : false
    });

    const params = {
      type: this.data.activeTab === 0 ? 'sale' : 'wanted',
      page: this.data.currentPage,
      limit: this.data.pageSize,
      sort: this.data.activeSort
    };
    // 添加筛选参数
    if (this.data.filter.category) params.category_id = this.data.filter.category;
    if (this.data.filter.condition) params.condition = this.data.filter.condition;
    if (this.data.filter.priceMin) params.price_min = this.data.filter.priceMin;
    if (this.data.filter.priceMax) params.price_max = this.data.filter.priceMax;

    wx.request({
      url: `${app.globalData.baseUrl}/api/trade/list`,
      data: params,
      success: (res) => {
        if (res.data.code === 0) {
          const list = res.data.data.list || [];
          const total = res.data.data.total || 0;
          const hasMore = this.data.currentPage * this.data.pageSize < total;

          this.setData({
            cardList: isRefresh ? list : this.data.cardList.concat(list),
            hasMore: hasMore,
            noMore: !hasMore && list.length > 0,
            currentPage: this.data.currentPage + 1
          });
        } else {
          wx.showToast({ title: res.data.message || '加载失败', icon: 'none' });
          if (isRefresh) this.setData({ loadFailed: true });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
        if (isRefresh) this.setData({ loadFailed: true });
      },
      complete: () => {
        this.setData({ loading: false, loadingMore: false });
      }
    });
  },

  // 切换Tab
  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    this.setData({ 
      activeTab: index,
      indicatorStyle: `width: 50%; left: ${index * 50}%;`
    });
    this.loadData(true);
  },

  // 滚动加载更多
  loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.loadData();
  },

  // 重新加载（刷新）
  reloadData() {
    this.loadData(true);
  },

  // 打开筛选面板
  openFilter() {
    this.setData({ showFilter: true });
  },

  // 关闭筛选面板
  closeFilter() {
    this.setData({ showFilter: false });
  },

  // 选择筛选选项
  selectOption(e) {
    const { group, value } = e.currentTarget.dataset;
    this.setData({
      [`selected${group.charAt(0).toUpperCase() + group.slice(1)}`]: value
    });
    // 转换为实际筛选值
    if (group === 'category') {
      if (value === '全部') {
        this.data.filter.category = '';
      } else {
        const cat = this.data.categoryList.find(c => c.name === value);
        this.data.filter.category = cat ? cat.id : '';
      }
    } else if (group === 'quality') {
      const qualityMap = {
        '全部': '',
        '全新': 'new',
        '9成新': 'almost_new',
        '8成新': 'good',
        '7成新': 'fair',
        '6成新及以下': 'poor'
      };
      this.data.filter.condition = qualityMap[value] || '';
    } else if (group === 'price') {
      if (value === '全部') {
        this.data.filter.priceMin = '';
        this.data.filter.priceMax = '';
      } else {
        const parts = value.split('-');
        this.data.filter.priceMin = parts[0];
        this.data.filter.priceMax = parts[1] === '+' ? '' : parts[1];
      }
    }
  },

  // 重置筛选
  resetFilter() {
    this.setData({
      selectedCategory: '全部',
      selectedQuality: '全部',
      selectedPrice: '全部',
      filter: { category: '', condition: '', priceMin: '', priceMax: '' }
    });
  },

  // 确认筛选
  confirmFilter() {
    this.setData({ showFilter: false });
    this.loadData(true);
  },

  // 选择排序方式
  selectSort(e) {
    const sortType = e.currentTarget.dataset.value;
    if (sortType === this.data.activeSort) return;
    this.setData({ activeSort: sortType });
    this.loadData(true);
  },

  // 跳转到搜索页
  goToSearch() {
    wx.navigateTo({ url: '/pages/search/search' });
  },

  // 跳转到详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  // 跳转到发布页
  goToPublish() {
    const type = this.data.activeTab === 0 ? 'sale' : 'wanted';
    wx.navigateTo({ url: `/pages/post/post?type=${type}` });
  }
});