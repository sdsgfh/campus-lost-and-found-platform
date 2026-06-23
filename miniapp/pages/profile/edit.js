// pages/profile/edit.js
const app = getApp();

Page({
  data: {
    avatar: '',
    nickname: '',
    bio: '',
    submitting: false
  },

  onLoad() {
    // 初始化用户信息
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({
      avatar: userInfo.avatar || '/images/default-avatar.png',
      nickname: userInfo.nickname || '',
      bio: userInfo.bio || ''
    });
  },

  // 更换头像
  changeAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.uploadAvatar(res.tempFiles[0].tempFilePath);
      },
      fail: () => {
        wx.showToast({ title: '取消选择图片', icon: 'none' });
      }
    });
  },

  // 上传头像
  uploadAvatar(tempPath) {
    wx.showLoading({ title: '上传中...' });
    wx.uploadFile({
      url: `${app.globalData.baseUrl}/api/user/update_avatar`,
      filePath: tempPath,
      name: 'avatar',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        wx.hideLoading();
        try {
          const data = JSON.parse(res.data);
          if (data.code === 0) {
            const avatarUrl = data.data.avatar;
            this.setData({ avatar: avatarUrl });
            
            // 更新缓存+全局变量
            let userInfo = wx.getStorageSync('userInfo') || {};
            userInfo.avatar = avatarUrl;
            wx.setStorageSync('userInfo', userInfo);
            app.globalData.userInfo = userInfo;

            wx.showToast({ title: '头像更新成功', icon: 'success' });
          } else {
            wx.showToast({ title: data.message, icon: 'none', duration: 2000 });
          }
        } catch (e) {
          wx.showToast({ title: '数据解析失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: `上传失败：${err.errMsg}`, icon: 'none' });
        console.error('头像上传失败：', err);
      }
    });
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  // 简介输入
  onBioInput(e) {
    this.setData({ bio: e.detail.value });
  },

  // 保存信息
  submit() {
    const nickname = this.data.nickname.trim();
    const bio = this.data.bio.trim();

    // 前端校验
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    if (nickname.length > 50) {
      wx.showToast({ title: '昵称不能超过50字', icon: 'none' });
      return;
    }
    if (bio.length > 100) {
      wx.showToast({ title: '简介不能超过100字', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '保存中...' });

    // 提交修改
    wx.request({
      url: `${app.globalData.baseUrl}/api/user/update_info`,
      method: 'POST',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token'),
        'Content-Type': 'application/json'
      },
      data: { nickname, bio },
      success: (res) => {
        wx.hideLoading();
        this.setData({ submitting: false });
        
        if (res.data.code === 0) {
          // 更新缓存
          let userInfo = wx.getStorageSync('userInfo') || {};
          userInfo.nickname = nickname;
          userInfo.bio = bio;
          wx.setStorageSync('userInfo', userInfo);
          app.globalData.userInfo = userInfo;

          wx.showToast({ title: '保存成功', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1500);
        } else {
          wx.showToast({ title: res.data.message, icon: 'none', duration: 3000 });
          console.log('保存失败详情：', res.data);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        this.setData({ submitting: false });
        wx.showToast({ title: `请求失败：${err.errMsg}`, icon: 'none' });
        console.error('保存请求失败：', err);
      }
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
});