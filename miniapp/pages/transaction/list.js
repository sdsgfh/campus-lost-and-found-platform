const app = getApp();

Page({
  data: {
    recordList: [],       // 交易记录列表
    page: 1,              // 当前页码
    limit: 10,            // 每页条数
    hasMore: true,        // 是否有更多数据
    loading: false,       // 首次加载状态
    loadingMore: false,   // 加载更多状态
    // 弹窗相关
    showDetail: false,
    currentRecord: {}
  },

  onLoad(options) {
    // 初始化加载全部交易记录（无筛选）
    this.loadData(true);
  },

  /**
   * 加载交易记录数据（仅加载全部，无筛选）
   * @param {Boolean} refresh - 是否刷新（重置页码）
   */
  loadData(refresh = false) {
    // 防止重复请求
    if (this.data.loading || this.data.loadingMore) return;

    // 刷新时重置状态
    if (refresh) {
      this.setData({ 
        loading: true,
        hasMore: true 
      });
    } else {
      this.setData({ loadingMore: true });
    }

    // 构造请求参数（仅分页，无type筛选）
    const params = {
      page: this.data.page,
      limit: this.data.limit
    };

    // 调用后端接口
    wx.request({
      url: `${app.globalData.baseUrl}/api/transaction/list`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}` // JWT token
      },
      data: params,
      success: (res) => {
        if (res.data.code === 0) {
          const { list, total, page } = res.data.data;
          // 合并数据（刷新则覆盖，加载更多则追加）
          const newList = refresh ? list : [...this.data.recordList, ...list];
          // 判断是否还有更多数据
          const hasMore = page * this.data.limit < total;

          this.setData({
            recordList: newList,
            hasMore,
            page: page + 1 // 页码+1，准备下一页加载
          });
        } else {
          wx.showToast({
            title: res.data.message || '加载失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: '网络错误，加载失败',
          icon: 'none',
          duration: 2000
        });
      },
      complete: () => {
        // 重置加载状态
        this.setData({
          loading: false,
          loadingMore: false
        });
      }
    });
  },

  /**
   * 加载更多（滚动到底部触发）
   */
  loadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.loadData(false);
  },

  /**
   * 显示详情弹窗
   * @param {Object} e - 事件对象
   */
  showDetailModal(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      currentRecord: item,
      showDetail: true
    });
    // 滚动到顶部（兼容所有小程序版本）
    wx.pageScrollTo({ 
      scrollTop: 0,
      duration: 0 
    });
  },

  /**
   * 隐藏详情弹窗
   */
  hideDetailModal() {
    this.setData({ showDetail: false });
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  }
});