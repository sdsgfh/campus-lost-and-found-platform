const app = getApp();

Page({
  data: {
    // 轮播图
    banners: [],
    // 公告列表
    notices: [],
    recommendList: [],      // 推荐列表
    recommendPage: 1,
    recommendHasMore: true,
    recommendLoading: false,
    lostTab: 'lost',
    lostList: [],
    tradeTab: 'sale',
    tradeList: [],
    // 网络状态
    networkError: false,
    isRefreshing: false, // 防止重复刷新的开关
  },

  onScrollToLower() {
    console.log('滚动容器触底，尝试加载更多推荐');
    this.fetchRecommend(true);
  },

  onLoad() {
    // 获取状态栏高度，适配刘海屏/灵动岛
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    });
    this.fetchAllData();
  },

  // 核心修复：返回首页必刷新，且解决finally报错
  onShow() {
    // 防止连续触发多次刷新
    if (this.data.isRefreshing) return;

    this.setData({
      isRefreshing: true,
    });

    // 调用返回Promise的fetchAllData，确保finally可用
    this.fetchAllData().then(() => {
      // 刷新成功后的逻辑（可选）
    }).catch((err) => {
      console.error('首页刷新失败', err);
    }).finally(() => {
      this.setData({ isRefreshing: false });
    });
  },

  // 扫一扫确认
  scanToConfirm() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode'],
      success: (res) => {
        const qrContent = res.result;
        wx.request({
          url: `${app.globalData.baseUrl}/api/transaction/scan`,
          method: 'POST',
          header: { 'Authorization': 'Bearer ' + token },
          data: { content: qrContent },
          success: (res) => {
            if (res.data.code === 0) {
              wx.showToast({ title: '确认成功', icon: 'success' });
            } else {
              wx.showToast({ title: res.data.message, icon: 'none' });
            }
          },
          fail: () => {
            wx.showToast({ title: '网络异常', icon: 'none' });
          }
        });
      },
      fail: (err) => {
        console.error('扫码失败', err);
        wx.showToast({ title: '扫码失败', icon: 'none' });
      }
    });
  },

  // 下拉刷新（如果开启）
  onPullDownRefresh() {
    this.fetchAllData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 核心修复：fetchAllData必须返回Promise
  fetchAllData() {
    // 清空旧数据，保证返回首页看到最新内容
    this.setData({
      banners: [],
      notices: [],
      lostList: [],
      tradeList: [],
      recommendList: [],
      recommendPage: 1,
      recommendHasMore: true,
      networkError: false
    });

    // 所有请求Promise数组
    const promises = [
      this.fetchBanners(),
      this.fetchNotices(),
      this.fetchLostFound(this.data.lostTab),
      this.fetchTrade(this.data.tradeTab),
      this.fetchRecommend() // 首次加载，不传参数
    ];

    // 关键：返回Promise，让onShow能调用finally
    return Promise.all(promises).catch(err => {
      console.error('数据加载失败', err);
      this.setData({ networkError: true });
    });
  },

  // 获取轮播图
  fetchBanners() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}/api/banner/list`,
        success: (res) => {
          if (res.data.code === 0) {
            this.setData({ banners: res.data.data || [] });
          }
          resolve();
        },
        fail: reject
      });
    });
  },

  // 获取公告
  fetchNotices() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}/api/announcement/list?limit=3`,
        success: (res) => {
          if (res.data.code === 0) {
            // 注意：接口返回的数据结构是 { code:0, data: { list: [...] } }
            const list = res.data.data.list || [];  // 正确获取数组
            // 格式化时间
            list.forEach(item => {
              item.publish_time = item.publish_time.slice(0, 10);
            });
            this.setData({ notices: list });
          }
          resolve();
        },
        fail: reject
      });
    });
  },

  // 获取失物招领精选
  fetchLostFound(type) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}/api/home/lostfound?type=${type}&limit=12`,
        success: (res) => {
          if (res.data.code === 0) {
            this.setData({ lostList: res.data.data || [] });
          }
          resolve();
        },
        fail: reject
      });
    });
  },

  // 获取二手交易精选
  fetchTrade(type) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}/api/home/trade?type=${type}&limit=12`,
        success: (res) => {
          if (res.data.code === 0) {
            this.setData({ tradeList: res.data.data || [] });
          }
          resolve();
        },
        fail: reject
      });
    });
  },

  // 获取推荐列表（支持分页）
  fetchRecommend(isLoadMore = false) {
    console.log('fetchRecommend called, isLoadMore=', isLoadMore);
    return new Promise((resolve, reject) => {
      // 如果正在加载或没有更多数据，则返回
      if (this.data.recommendLoading) {
        resolve();
        return;
      }
      if (isLoadMore && !this.data.recommendHasMore) {
        resolve();
        return;
      }

      this.setData({ recommendLoading: true });

      const header = {};
      const token = wx.getStorageSync('token');
      if (token) header['Authorization'] = 'Bearer ' + token;

      // 确定请求的页码
      const page = isLoadMore ? this.data.recommendPage + 1 : 1;

      wx.request({
        url: `${app.globalData.baseUrl}/api/home/recommend?page=${page}&limit=10000`,
        header: header,
        success: (res) => {
          console.log('推荐接口返回', res.data);
          if (res.data.code === 0) {
            const { list = [], has_more } = res.data.data;
            this.setData({
              recommendList: isLoadMore ? this.data.recommendList.concat(list) : list,
              recommendPage: page,
              recommendHasMore: has_more,
              recommendLoading: false
            });
          } else {
            wx.showToast({ title: '推荐加载失败', icon: 'none' });
            this.setData({ recommendLoading: false });
          }
          resolve();
        },
        fail: (err) => {
          console.error('推荐请求失败', err);
          this.setData({ recommendLoading: false });
          reject(err);
        }
      });
    });
  },

  // 切换失物招领tab
  switchLostTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.lostTab) return;
    this.setData({ lostTab: tab, lostList: [] });
    this.fetchLostFound(tab);
  },

  // 切换二手交易tab
  switchTradeTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.tradeTab) return;
    this.setData({ tradeTab: tab, tradeList: [] });
    this.fetchTrade(tab);
  },

  // 轮播图切换事件
  onSwipeChange(e) {
    console.log('轮播图索引', e.detail.current);
  },

  // 点击轮播图
  onBannerTap(e) {
    const item = e.currentTarget.dataset.item;
    // 根据link_type跳转
    if (item.link_type === 'post') {
      wx.navigateTo({ url: `/pages/detail/detail?id=${item.link_value}` });
    } else if (item.link_type === 'announcement') {
      wx.navigateTo({ url: `/pages/announcement/detail?id=${item.link_value}` });
    } else if (item.link_type === 'url' && item.link_value) {
      // 外部链接需要配置业务域名
      wx.navigateTo({ url: `/pages/webview/webview?url=${encodeURIComponent(item.link_value)}` });
    }
  },

  // 前往搜索页
  goToSearch() {
    wx.navigateTo({ url: '/pages/search/search' });
  },

  // 前往消息中心
  goToMessage() {
    wx.switchTab({ url: '/pages/message/message' });
  },

  // 前往公告详情
  goToAnnouncementDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/announcement/detail?id=${id}` });
  },

  // 前往公告列表
  goToAnnouncementList() {
    wx.navigateTo({ url: '/pages/announcement/list' });
  },

  goToLostFound(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    // 将 tab 存入全局变量
    app.globalData.lostFoundTab = tab;
    wx.switchTab({
      url: '/pages/lostfound/lostfound'
    });
  },
  
  goToTrade(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    app.globalData.tradeTab = tab;
    wx.switchTab({
      url: '/pages/trade/trade'
    });
  },

  // 前往详情页（发布内容）
  goToPostDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  // 手动刷新（当网络错误时）
  onRefresh() {
    this.setData({ networkError: false });
    this.fetchAllData();
  }
});