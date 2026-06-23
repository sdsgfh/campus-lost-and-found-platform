// pages/reports/reports.js
const app = getApp();

Page({
  data: {
    activeTab: 'report',
    sort: 'time',
    // 举报
    reportList: [],
    reportPage: 1,
    reportLimit: 10,
    reportHasMore: true,
    reportLoading: false,
    reportLoadingMore: false,
    // 申诉
    appealList: [],
    appealPage: 1,
    appealLimit: 10,
    appealHasMore: true,
    appealLoading: false,
    appealLoadingMore: false,

    // 弹窗控制
    showReportModal: false,
    currentReport: {},
    showAppealModal: false,
    currentAppeal: {}
  },

  onLoad() {
    this.loadReports(true);
    this.loadAppeals(true);
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  setSort(e) {
    const sort = e.currentTarget.dataset.sort;
    if (sort === this.data.sort) return;
    this.setData({ sort });
    this.data.activeTab === 'report' ? this.loadReports(true) : this.loadAppeals(true);
  },

  // ================== 加载举报列表 ==================
  loadReports(refresh = false) {
    if (refresh) this.setData({ reportPage: 1, reportList: [], reportHasMore: true });
    if (!this.data.reportHasMore) return;

    this.setData({ reportLoading: refresh, reportLoadingMore: !refresh });

    wx.request({
      url: `${app.globalData.baseUrl}/api/report/mylist`,
      data: { page: this.data.reportPage, limit: this.data.reportLimit, sort: this.data.sort },
      header: { Authorization: 'Bearer ' + wx.getStorageSync('token') },
      success: res => {
        if (res.data.code === 0) {
          const list = res.data.data.list || [];
          const total = res.data.data.total || 0;
          const hasMore = this.data.reportPage * this.data.reportLimit < total;

          list.forEach(item => {
            item.statusText = { pending: '待审核', approved: '审核成立', rejected: '审核不成立' }[item.status] || item.status;
            item.typeText = item.report_type === 'content' ? '内容举报' : '用户举报';
            item.targetName = item.target_name || '举报内容';
          });

          this.setData({
            reportList: refresh ? list : this.data.reportList.concat(list),
            reportHasMore: hasMore,
            reportPage: this.data.reportPage + 1
          });
        }
      },
      complete: () => {
        this.setData({ reportLoading: false, reportLoadingMore: false });
      }
    });
  },

  loadMoreReports() {
    if (this.data.reportLoadingMore || !this.data.reportHasMore) return;
    this.loadReports();
  },

  // ================== 加载申诉列表 ==================
  loadAppeals(refresh = false) {
    if (refresh) this.setData({ appealPage: 1, appealList: [], appealHasMore: true });
    if (!this.data.appealHasMore) return;

    this.setData({ appealLoading: refresh, appealLoadingMore: !refresh });

    wx.request({
      url: `${app.globalData.baseUrl}/api/appeal/mylist`,
      data: { page: this.data.appealPage, limit: this.data.appealLimit, sort: this.data.sort },
      header: { Authorization: 'Bearer ' + wx.getStorageSync('token') },
      success: res => {
        if (res.data.code === 0) {
          const list = res.data.data.list || [];
          const total = res.data.data.total || 0;
          const hasMore = this.data.appealPage * this.data.appealLimit < total;

          list.forEach(item => {
            item.statusText = { pending: '待审核', approved: '申诉成立', rejected: '申诉不成立' }[item.status] || item.status;
            item.appealTypeText = {
              post_reject: '发布驳回申诉',
              post_off: '下架申诉',
              credit_deduct: '信誉分扣除申诉',
              claim_dispute: '冒领申诉'
            }[item.appeal_type] || item.appeal_type;
            item.targetName = item.target_name || item.appealTypeText;
          });

          this.setData({
            appealList: refresh ? list : this.data.appealList.concat(list),
            appealHasMore: hasMore,
            appealPage: this.data.appealPage + 1
          });
        }
      },
      complete: () => {
        this.setData({ appealLoading: false, appealLoadingMore: false });
      }
    });
  },

  loadMoreAppeals() {
    if (this.data.appealLoadingMore || !this.data.appealHasMore) return;
    this.loadAppeals();
  },

  // ================== 弹窗显示/关闭 ==================
  showReportPopup(e) {
    this.setData({
      currentReport: e.currentTarget.dataset.item,
      showReportModal: true
    });
  },

  closeReportModal() {
    this.setData({ showReportModal: false, currentReport: {} });
  },

  showAppealPopup(e) {
    this.setData({
      currentAppeal: e.currentTarget.dataset.item,
      showAppealModal: true
    });
  },

  closeAppealModal() {
    this.setData({ showAppealModal: false, currentAppeal: {} });
  },

  stopPropagation() {},

  goBack() {
    wx.navigateBack({ delta: 1 });
  }
});