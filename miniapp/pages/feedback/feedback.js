const app = getApp();

Page({
  data: {
    content: '',
    imageList: [],
    maxImages: 3,
    submitting: false
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  chooseImage() {
    const maxCount = this.data.maxImages - this.data.imageList.length;
    if (maxCount <= 0) return;

    wx.chooseMedia({
      count: maxCount,
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

  submitFeedback() {
    if (!this.data.content.trim()) {
      wx.showToast({ title: '请输入反馈内容', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    wx.request({
      url: `${app.globalData.baseUrl}/api/feedback/create`,
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      data: {
        content: this.data.content,
        images: this.data.imageList
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 0) {
          wx.showModal({
            title: '提交成功',
            content: '感谢您的反馈，我们会尽快处理',
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
  }
});