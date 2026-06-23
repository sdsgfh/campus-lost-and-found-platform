const app = getApp();

Page({
  data: {
    targetType: '',       // 'post' 或 'user'
    targetId: null,
    targetName: '',       // 显示的名称（如帖子标题或用户昵称）
    reportType: '',       // 前端选择的举报类型（如 '虚假信息'）
    reason: '',
    imageList: [],
    maxImages: 5,
    submitting: false,
    typeOptions: []       // 根据 targetType 动态生成
  },

  onLoad(options) {
    // 从传入参数获取目标类型和ID
    const { targetType, targetId } = options;
    if (!targetType || !targetId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ targetType, targetId });

    // 获取目标名称（需要请求后端）
    this.fetchTargetInfo();

    // 根据目标类型设置举报类型选项
    this.setTypeOptions();
  },

  // 获取被举报对象名称
  fetchTargetInfo() {
    const { targetType, targetId } = this.data;
    let url = '';
    if (targetType === 'post') {
      url = `${app.globalData.baseUrl}/api/post/detail?id=${targetId}`;
    } else if (targetType === 'user') {
      url = `${app.globalData.baseUrl}/api/user/info?user_id=${targetId}`;
    } else {
      return;
    }
    wx.request({
      url,
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        if (res.data.code === 0) {
          const name = targetType === 'post' ? res.data.data.title : res.data.data.nickname;
          this.setData({ targetName: name });
        }
      }
    });
  },

  // 设置举报类型选项
  setTypeOptions() {
    const { targetType } = this.data;
    let options = [];
    if (targetType === 'post') {
      options = [
        { label: '虚假信息', value: '虚假信息' },
        { label: '诈骗', value: '诈骗' },
        { label: '卖假货', value: '卖假货' }
      ];
    } else if (targetType === 'user') {
      options = [
        { label: '言语骚扰', value: '言语骚扰' },
        { label: '恶意举报', value: '恶意举报' },
        { label: '违规发布', value: '违规发布' }
      ];
    }
    this.setData({ typeOptions: options, reportType: '' });
  },

  selectType(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ reportType: value });
  },

  onReasonInput(e) {
    this.setData({ reason: e.detail.value });
  },

  // 图片上传（复用之前的逻辑）
  chooseImage() {
    wx.chooseMedia({
      count: this.data.maxImages - this.data.imageList.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFiles = res.tempFiles;
        for (let file of tempFiles) {
          if (file.size > 5 * 1024 * 1024) {
            wx.showToast({ title: '图片不能超过5MB', icon: 'none' });
            return;
          }
          if (!/\.(jpg|jpeg|png)$/i.test(file.tempFilePath)) {
            wx.showToast({ title: '仅支持jpg/png格式', icon: 'none' });
            return;
          }
        }
        this.uploadImages(tempFiles);
      }
    });
  },

  uploadImages(tempFiles) {
    wx.showLoading({ title: '上传中...' });
    const uploadTasks = tempFiles.map(file => {
      return new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${app.globalData.baseUrl}/api/auth/upload`,
          filePath: file.tempFilePath,
          name: 'file',
          header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
          success: (res) => {
            const data = JSON.parse(res.data);
            if (data.code === 0) {
              resolve(data.url);
            } else {
              reject(data.message);
            }
          },
          fail: reject
        });
      });
    });

    Promise.all(uploadTasks)
      .then(urls => {
        this.setData({ imageList: this.data.imageList.concat(urls) });
        wx.hideLoading();
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: err || '上传失败', icon: 'none' });
      });
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const list = this.data.imageList;
    list.splice(index, 1);
    this.setData({ imageList: list });
  },

  // 提交举报
  submitReport() {
    if (!this.data.reportType) {
      wx.showToast({ title: '请选择举报类型', icon: 'none' });
      return;
    }
    if (!this.data.reason.trim()) {
      wx.showToast({ title: '请输入举报理由', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    wx.request({
      url: `${app.globalData.baseUrl}/api/report/create`,
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      data: {
        target_type: this.data.targetType,
        target_id: this.data.targetId,
        report_type: this.data.targetType === 'post' ? 'content' : 'user', // 后端需要的枚举
        sub_type: this.data.reportType,
        reason: this.data.reason,
        evidence_images: this.data.imageList
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 0) {
          wx.showModal({
            title: '提交成功',
            content: '举报已提交，等待管理员审核',
            showCancel: false,
            success: () => wx.navigateBack()
          });
        } else {
          wx.showToast({ title: res.data.message || '提交失败', icon: 'none' });
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
  },

  // 计算目标类型显示文本
  get targetTypeText() {
    const map = { 'post': '发布内容', 'user': '用户' };
    return map[this.data.targetType] || '';
  }
});