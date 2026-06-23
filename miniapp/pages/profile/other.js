// pages/profile/other.js
const app = getApp();

Page({
  data: {
    userInfo: {}, // 目标用户信息
    agreed: false // 移除无用的agreed（原登录页残留）
  },

  onLoad(options) {
    // 获取跳转传参的用户ID
    const userId = options.user_id;
    if (!userId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      wx.navigateBack();
      return;
    }
    // 加载目标用户信息
    this.loadUserInfo(userId);
  },

  // 加载目标用户信息
  loadUserInfo(userId) {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }

    wx.showLoading({ title: '加载中...' });
    wx.request({
      url: `${app.globalData.baseUrl}/api/user/other`, // 替换为你的「获取他人信息」接口
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      data: { user_id: userId },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 0) {
          const userInfo = res.data.data;
          // 映射信誉等级（和detail页面逻辑一致）
          userInfo.creditLevel = this.mapCreditLevel(userInfo.credit_score);
          this.setData({ userInfo });
        } else {
          wx.showToast({ title: res.data.message || '加载失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  // 映射信誉等级（复用detail页面逻辑）
  mapCreditLevel(score) {
    if (!score && score !== 0) return '暂无等级';
    if (score >= 90) return '信誉优秀';
    if (score >= 70) return '信誉良好';
    if (score >= 60) return '信誉一般';
    if (score >= 0) return '信誉较差';
    return '已封禁';
  },

  // 自定义导航返回按钮
  goBack() {
    wx.navigateBack();
  },

  // 举报用户
  reportUser() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({
      url: `/pages/report/create?targetType=user&targetId=${this.data.userInfo.id}`
    });
  },

  // 移除原登录页无用的方法（handleAgreeChange/handleWechatLogin等）
});