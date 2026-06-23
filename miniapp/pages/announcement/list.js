// pages/announcement/list.js
const app = getApp();

Page({
  data: {
    list: [],
    page: 1,
    limit: 15,
    hasMore: true,
    loading: false,
    loadingMore: false,
    loadLock: false,
    statusBarHeight: 0, // 存储刘海屏状态栏高度
    scrollHeight: '' // 新增：动态计算的滚动高度
  },

  onLoad() {
    // 1. 获取状态栏高度并计算滚动高度
    this.calcScrollHeight();
    // 2. 加载列表数据
    this.loadData(true);
  },

  // 新增：计算滚动容器高度（核心修复）
  calcScrollHeight() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      const statusBarHeight = systemInfo.statusBarHeight || 20;
      // 计算高度：calc(100vh - 44px - 状态栏高度)，注意运算符两侧加空格
      const scrollHeight = `calc(100vh - 44px - ${statusBarHeight}px)`;
      this.setData({
        statusBarHeight,
        scrollHeight // 存入data供WXML绑定
      });
      console.log('滚动高度计算完成', scrollHeight);
    } catch (e) {
      console.error('同步获取系统信息失败', e);
      // 兜底默认值
      this.setData({
        statusBarHeight: 20,
        scrollHeight: 'calc(100vh - 64px)' // 44+20=64
      });
    }
  },

  loadData(refresh = false) {
    if (this.data.loadLock) return;
    this.setData({ loadLock: true });

    if (refresh) {
      this.setData({ page: 1, list: [], hasMore: true });
    }
    if (!this.data.hasMore) {
      this.setData({ loadLock: false });
      return;
    }

    this.setData({
      loading: refresh,
      loadingMore: !refresh
    })

    wx.request({
      url: `${app.globalData.baseUrl}/api/announcement/list`,
      data: { page: this.data.page, limit: this.data.limit },
      enableCache: true,
      timeout: 5000,
      success: (res) => {
        if (res.data.code === 0) {
          const list = res.data.data.list || [];
          const total = res.data.data.total || 0;
          const hasMore = this.data.page * this.data.limit < total;
          this.setData({
            list: refresh ? list : this.data.list.concat(list),
            hasMore,
            page: this.data.page + 1
          })
        }
      },
      complete: () => {
        this.setData({ loading: false, loadingMore: false, loadLock: false });
      }
    })
  },

  loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.loadData();
  },

  goBack() {
    wx.navigateBack()
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/announcement/detail?id=${id}` })
  }
})