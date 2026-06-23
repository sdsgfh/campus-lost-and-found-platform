// pages/search/search.js
const app = getApp();

Page({
  data: {
    keyword: '',                 // 当前输入关键词
    showResult: false,           // 是否显示搜索结果页
    historyList: [],             // 搜索历史（本地存储）
    hotList: [],                 // 热门搜索（后端获取）
    // 搜索结果相关
    resultList: [],
    currentType: 'all',          // 筛选类型
    resultPage: 1,
    resultLimit: 10,
    resultHasMore: true,
    resultLoading: false,
    resultLoadingMore: false,
    resultError: false,
    // 搜索频率限制
    searchTimestamps: []         // 最近搜索时间戳（毫秒）
  },

  onLoad() {
    // 初始化状态栏高度变量
    const systemInfo = wx.getSystemInfoSync();
    wx.setStorageSync('statusBarHeight', systemInfo.statusBarHeight || 20);
    wx.setNavigationBarColor({
      frontColor: '#000000',
      backgroundColor: '#A5CFA9'
    });

    this.loadHistory();
    this.loadHotKeywords();
  },

  // 加载搜索历史
  loadHistory() {
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({ historyList: history.slice(0, 10) });
  },

  // 保存搜索历史
  saveHistory(keyword) {
    if (!keyword.trim()) return;
    let history = wx.getStorageSync('searchHistory') || [];
    history = [keyword, ...history.filter(item => item !== keyword)];
    if (history.length > 10) history = history.slice(0, 10);
    wx.setStorageSync('searchHistory', history);
    this.setData({ historyList: history });
  },

  // 清空历史
  clearHistory() {
    wx.showModal({
      title: '提示',
      content: '确定清空所有搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('searchHistory');
          this.setData({ historyList: [] });
        }
      }
    });
  },

  // 长按删除单条历史
  deleteHistory(e) {
    const keyword = e.currentTarget.dataset.keyword;
    wx.showModal({
      title: '提示',
      content: `删除“${keyword}”？`,
      success: (res) => {
        if (res.confirm) {
          let history = wx.getStorageSync('searchHistory') || [];
          history = history.filter(item => item !== keyword);
          wx.setStorageSync('searchHistory', history);
          this.setData({ historyList: history });
        }
      }
    });
  },

  // 加载热门搜索
  loadHotKeywords() {
    wx.request({
      url: `${app.globalData.baseUrl}/api/search/hot`,
      success: (res) => {
        if (res.data.code === 0) {
          this.setData({ hotList: res.data.data || [] });
        }
      }
    });
  },

  // 输入框绑定（核心：实时检查是否为空）
  onInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    
    // 清空关键词时，自动回到初始页面
    if (!keyword.trim() && this.data.showResult) {
      this.setData({
        showResult: false,
        resultList: [],
        resultPage: 1,
        resultHasMore: true,
        resultError: false
      });
    }
  },

  // 失去焦点时检查关键词（兜底）
  checkEmptyKeyword() {
    if (!this.data.keyword.trim() && this.data.showResult) {
      this.setData({
        showResult: false,
        resultList: [],
        resultPage: 1,
        resultHasMore: true,
        resultError: false
      });
    }
  },

  // 检查搜索频率
  checkRateLimit() {
    const now = Date.now();
    let timestamps = this.data.searchTimestamps.filter(t => now - t < 60 * 1000);
    if (timestamps.length >= 3) {
      wx.showToast({ title: '搜索过于频繁，请稍后再试', icon: 'none' });
      return false;
    }
    timestamps.push(now);
    this.setData({ searchTimestamps: timestamps });
    return true;
  },

  // 执行搜索
  performSearch(keyword) {
    if (!keyword.trim()) {
      wx.showToast({ title: '请输入关键词', icon: 'none' });
      return;
    }
    if (keyword.length > 20) {
      wx.showToast({ title: '关键词过长，请输入20字以内的关键词', icon: 'none' });
      return;
    }
    if (!this.checkRateLimit()) return;

    this.setData({
      showResult: true,
      keyword: keyword,
      resultPage: 1,
      resultList: [],
      resultHasMore: true,
      resultError: false,
      resultLoading: true
    });

    // 保存到历史
    this.saveHistory(keyword);

    this.searchRequest(1);
  },

  // 搜索请求
  searchRequest(page) {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }

    this.setData({ resultLoading: page === 1, resultLoadingMore: page > 1 });
    wx.request({
      url: `${app.globalData.baseUrl}/api/search`,
      header: {
        'Authorization': 'Bearer ' + token
      },
      data: {
        keyword: this.data.keyword,
        type: this.data.currentType === 'all' ? '' : this.data.currentType,
        page: page,
        limit: this.data.resultLimit
      },
      success: (res) => {
        if (res.data.code === 0) {
          const list = res.data.data.list || [];
          const total = res.data.data.total || 0;
          const hasMore = page * this.data.resultLimit < total;

          this.setData({
            resultList: page === 1 ? list : this.data.resultList.concat(list),
            resultHasMore: hasMore,
            resultPage: page,
            resultError: false
          });
        } else {
          this.setData({
            resultError: true
          });
          wx.showToast({ title: res.data.message || '搜索失败', icon: 'none' });
        }
      },
      fail: () => {
        this.setData({
          resultError: true
        });
        wx.showToast({ title: '网络异常', icon: 'none' });
      },
      complete: () => {
        this.setData({
          resultLoading: false,
          resultLoadingMore: false
        });
      }
    });
  },

  // 点击搜索按钮或键盘确认
  onSearch() {
    this.performSearch(this.data.keyword);
  },

  // 点击历史关键词
  onHistoryTap(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({ keyword });
    this.performSearch(keyword);
  },

  // 点击热门关键词
  onHotTap(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({ keyword });
    this.performSearch(keyword);
  },

  // 切换类型筛选
  switchType(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.currentType) return;
    this.setData({
      currentType: type,
      resultPage: 1,
      resultList: [],
      resultHasMore: true
    });
    this.searchRequest(1);
  },

  // 加载更多
  loadMore() {
    if (this.data.resultLoadingMore || !this.data.resultHasMore || this.data.resultError) return;
    const nextPage = this.data.resultPage + 1;
    this.searchRequest(nextPage);
  },

  // 重试
  retrySearch() {
    this.setData({ resultError: false });
    this.searchRequest(1);
  },

  // 跳转到详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
});