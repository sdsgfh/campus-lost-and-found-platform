// pages/announcement/detail.js
const app = getApp();

Page({
  data: {
    announcement: null,
    statusBarHeight: 0, // 刘海屏状态栏高度
    scrollHeight: '' // 新增：动态滚动高度
  },

  onLoad(options) {
    // 1. 计算滚动高度（核心修复）
    this.calcScrollHeight();

    // 2. 加载详情
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.loadDetail(id);
  },

  // 新增：计算滚动高度
  calcScrollHeight() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      const statusBarHeight = systemInfo.statusBarHeight || 20;
      const scrollHeight = `calc(100vh - 44px - ${statusBarHeight}px)`;
      this.setData({
        statusBarHeight,
        scrollHeight
      });
    } catch (e) {
      console.error('获取系统信息失败', e);
      this.setData({
        statusBarHeight: 20,
        scrollHeight: 'calc(100vh - 64px)'
      });
    }
  },

  loadDetail(id) {
    wx.request({
      url: `${app.globalData.baseUrl}/api/announcement/detail`,
      data: { id: id },
      success: (res) => {
        if (res.data.code === 0) {
          this.setData({ announcement: res.data.data });
        } else {
          wx.showToast({ title: res.data.message || '加载失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  goBack() {
    wx.navigateBack();
  }
});