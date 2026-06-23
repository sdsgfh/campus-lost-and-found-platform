// pages/auth/auth.js
const app = getApp();

Page({
  data: {
    role: 'student',
    name: '',
    idNo: '',
    frontImg: '',
    submitting: false
    // 移除多余的statusBarHeight，无需适配fixed导航栏
  },

  // 修复返回按钮：兼容页面栈
  goBack() {
    // 获取页面栈，判断是否能返回上一页
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      // 页面栈只有当前页时，跳转到首页（避免无响应）
      wx.switchTab({ url: '/pages/home/home' });
    }
  },

  onLoad() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        wx.navigateTo({ url: '/pages/login/login' });
      }, 1500);
      return;
    }
    // 检查是否已认证
    const userInfo = wx.getStorageSync('userInfo') || {};
    if (userInfo.status === 'verified') {
      wx.switchTab({ url: '/pages/home/home' });
    }
  },

  switchRole(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({ role, name: '', idNo: '', frontImg: '' });
  },

  setName(e) {
    this.setData({ name: e.detail.value });
  },

  setIdNo(e) {
    this.setData({ idNo: e.detail.value });
  },

  chooseFront() {
    const self = this;
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success(res) {
        const sourceType = res.tapIndex === 0 ? ['camera'] : ['album'];
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType,
          success: (res) => {
            self.setData({ frontImg: res.tempFiles[0].tempFilePath });
          }
        });
      }
    });
  },

  submitAuth() {
    const { name, idNo, role, frontImg } = this.data;
    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!idNo) {
      const text = role === 'student' ? '学号' : '工号';
      wx.showToast({ title: `请输入${text}`, icon: 'none' });
      return;
    }
    if (!frontImg) {
      wx.showToast({ title: '请上传证件照片', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });
  
    wx.uploadFile({
      url: `${app.globalData.baseUrl}/api/auth/verify`,
      filePath: frontImg,
      name: 'file',
      formData: {
        identity_type: role === 'staff' ? 'teacher' : role,
        student_id: idNo,
        name: name
      },
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token')
      },
      success: (res) => {
        wx.hideLoading();
        const data = JSON.parse(res.data);
        if (data.code === 0) {
          wx.showToast({ title: '认证成功', icon: 'success' });
          setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 1500);
        } else {
          wx.showModal({ title: '提示', content: data.message || '认证失败', showCancel: false });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常', icon: 'none' });
      },
      complete: () => {
        this.setData({ submitting: false });
      }
    });
  },

  skipAuth() {
    wx.switchTab({ url: '/pages/home/home' });
  }
});