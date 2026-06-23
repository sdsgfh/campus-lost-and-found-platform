// pages/myposts/myposts.js
const app = getApp();

Page({
  data: {
    currentStatusTab: 'all',
    currentType: '',
    currentTypeText: '全部类型',
    sort: 'time',
    postList: [],
    page: 1,
    limit: 10,
    hasMore: true,
    loading: false,
    loadingMore: false,
    showTypePicker: false,
  },

  onLoad() {
    this.loadData(true);
  },

  loadData(refresh = false) {
    if (refresh) {
      this.setData({ page: 1, postList: [], hasMore: true });
    }
    if (!this.data.hasMore) return;

    this.setData({ loading: refresh, loadingMore: !refresh });

    const params = {
      page: this.data.page,
      limit: this.data.limit,
      sort: this.data.sort
    };
    if (this.data.currentStatusTab !== 'all') {
      params.status = this.data.currentStatusTab;
    }
    if (this.data.currentType) {
      params.type = this.data.currentType;
    }

    wx.request({
      url: `${app.globalData.baseUrl}/api/myposts/list`,
      data: params,
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        if (res.data.code === 0) {
          const list = res.data.data.list || [];
          const total = res.data.data.total || 0;
          const hasMore = this.data.page * this.data.limit < total;
          
          // 处理状态文本汉化（新增pending_confirm）
          list.forEach(item => {
            // 状态文本映射
            item.status_text = {
              'active': '进行中',
              'completed': '已完成',
              'expired': '已过期',
              'off': '已下架',
              'pending': '待审核',
              'rejected': '已驳回',
              'pending_confirm': '待确认' // 新增pending_confirm汉化
            }[item.status] || item.status;
            
            // 类型文本映射（兜底）
            item.type_text = {
              'lost': '寻物',
              'found': '招领',
              'sale': '出售',
              'wanted': '求购'
            }[item.type] || item.type;
          });

          this.setData({
            postList: refresh ? list : this.data.postList.concat(list),
            hasMore: hasMore,
            page: this.data.page + 1
          });
        } else {
          wx.showToast({ title: res.data.message || '加载失败', icon: 'none', duration: 2000 });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none', duration: 2000 });
      },
      complete: () => {
        this.setData({ loading: false, loadingMore: false });
      }
    });
  },

  switchStatusTab(e) {
    const status = e.currentTarget.dataset.status;
    if (status === this.data.currentStatusTab) return;
    this.setData({ currentStatusTab: status });
    this.loadData(true);
  },

  // 新增：设置排序（替换原toggleSort）
  setSort(e) {
    const sort = e.currentTarget.dataset.sort;
    if (sort === this.data.sort) return;
    this.setData({ sort });
    this.loadData(true);
  },

  showTypePicker() {
    this.setData({ showTypePicker: true });
  },

  hideTypePicker() {
    this.setData({ showTypePicker: false });
  },

  selectType(e) {
    const type = e.currentTarget.dataset.type;
    let text = '全部类型';
    if (type) {
      const map = { 'lost': '寻物', 'found': '招领', 'sale': '出售', 'wanted': '求购' };
      text = map[type] || type;
    }
    this.setData({
      currentType: type,
      currentTypeText: text,
      showTypePicker: false
    });
    this.loadData(true);
  },

  loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.loadData();
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  }
});