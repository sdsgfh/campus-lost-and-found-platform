const app = getApp();

Page({
  data: {
    studentId: '',
    name: '',
    submitting: false
  },

  onStudentIdInput(e) {
    this.setData({ studentId: e.detail.value });
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  submitCancel() {
    if (!this.data.studentId || !this.data.name) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    wx.request({
      url: `${app.globalData.baseUrl}/api/user/cancel`,
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      data: {
        student_id: this.data.studentId,
        name: this.data.name
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 0) {
          wx.showModal({
            title: '提示',
            content: '账号已注销',
            showCancel: false,
            success: () => {
              wx.clearStorageSync();
              app.globalData.userInfo = null;
              app.globalData.isLogin = false;
              wx.reLaunch({ url: '/pages/login/login' });
            }
          });
        } else {
          wx.showToast({ title: res.data.message, icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常', icon: 'none' });
      },
      complete: () => {
        this.setData({ submitting: false });
      }
    });
  },

  goBack() {
    wx.navigateBack();
  }
});