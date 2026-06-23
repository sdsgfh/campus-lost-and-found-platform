// pages/detail/detail.js
const app = getApp();

Page({
  data: {
    post: null,           // 帖子详情
    isOwner: false,       // 是否是发布者本人
    userStatus: '',       // 当前登录用户状态（用于未认证判断）
    isFavorited: false,   // 是否已收藏
    protectionRemaining: '' // 保护期剩余时间（若适用）
  },

  onLoad(options) {
    console.log('接收到的 id:', options.id);
    console.log('当前用户ID:', wx.getStorageSync('userInfo')?.id);
    if (!options.id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    // 修复：确保postId为数字类型（后端要求int）
    this.setData({ postId: Number(options.id) });
    this.loadDetail();
    this.recordBehavior('view');
  },

  // 记录用户行为
  recordBehavior(type) {
    const token = wx.getStorageSync('token');
    if (!token) return; // 未登录不记录
    wx.request({
      url: `${app.globalData.baseUrl}/api/behavior/record`,
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + token },
      data: {
        behavior_type: type,
        target_id: this.data.postId,
        target_type: 'post'
      }
    });
  },

  // 加载详情
  loadDetail() {
    const token = wx.getStorageSync('token');
    const header = token ? { 'Authorization': 'Bearer ' + token } : {};
    console.log('当前 token:', token);
    wx.request({
      url: `${app.globalData.baseUrl}/api/post/detail`,
      data: { id: this.data.postId },
      header: header,
      success: (res) => {
        console.log('详情接口返回：', res.data);
        if (res.data.code === 0) {
          const post = res.data.data;
          console.log('帖子数据：', post);
          
          // 核心修复：字段名+前缀对齐
          const creditScore = post.user.credit_score || 0;
          const levelText = this.mapCreditLevel(creditScore);
          post.user.creditLevel = levelText.includes('暂无') ? '暂无等级' : `信誉${levelText}`;
          
          // 处理保护期剩余时间
          if (post.type === 'found' && post.protection_end_time) {
            const remaining = this.calcProtectionRemaining(post.protection_end_time);
            post.inProtection = remaining > 0;
            post.protectionRemaining = this.formatRemaining(remaining);
          } else {
            post.inProtection = false;
          }
          // 映射成色文本
          post.conditionText = this.mapCondition(post.condition);
          post.expectedConditionText = this.mapCondition(post.expected_condition);
          post.statusText = this.mapStatus(post.status);
          // 获取当前用户信息
          const userInfo = wx.getStorageSync('userInfo') || {};
          const isOwner = Number(userInfo.id) === Number(post.user.id);
          this.setData({
            post,
            isOwner,
            userStatus: userInfo.status || 'unverified',
            isFavorited: post.is_favorited
          });
        } else if (res.data.code === 404) {
          this.setData({ post: null });
        } else {
          wx.showToast({ title: res.data.message || '加载失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  // 计算保护期剩余秒数
  calcProtectionRemaining(endTimeStr) {
    const end = new Date(endTimeStr).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((end - now) / 1000));
  },
  
  formatRemaining(seconds) {
    if (seconds <= 0) return '已结束';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${mins}分钟`;
  },

  // 映射成色
  mapCondition(cond) {
    const map = {
      'new': '全新',
      'almost_new': '9成新',
      'good': '8成新',
      'fair': '7成新',
      'poor': '6成新及以下'
    };
    return map[cond] || cond;
  },
  
  // 映射状态文本
  mapStatus(status) {
    const map = {
      'pending': '待审核',
      'active': '进行中',
      'pending_confirm': '待失主确认',
      'completed': '已完成',
      'expired': '已过期',
      'off': '已下架',
      'rejected': '已驳回'
    };
    return map[status] || status;
  },
  
  mapCreditLevel(score) {
    if (!score && score !== 0) return '暂无等级';
    if (score >= 90) return '信誉优秀';
    if (score >= 70) return '信誉良好';
    if (score >= 60) return '信誉一般';
    if (score >= 0) return '信誉较差';
    return '已封禁';
  },
  
  // 预览图片
  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.post.images[index],
      urls: this.data.post.images
    });
  },

  // 返回
  goBack() {
    wx.navigateBack();
  },

  // 返回列表（当内容不存在时）
  goBackToList() {
    wx.navigateBack();
  },

  // 分享
  onShare() {
    wx.showShareMenu();
  },
  
  onShareAppMessage() {
    const post = this.data.post;
    if (!post) return {};
    this.recordBehavior('share');
    return {
      title: post.title,
      imageUrl: post.images && post.images[0] || '/images/default.png',
      path: `/pages/detail/detail?id=${post.id}`
    };
  },

  // 跳转到发布者个人主页
  goToUserProfile(e) {
    const userId = e.currentTarget.dataset.userId;
    wx.navigateTo({ url: `/pages/profile/other?user_id=${userId}` });
  },

  // 实名认证
  goToAuth() {
    wx.navigateTo({ url: '/pages/auth/auth' });
  },

  // 收藏/取消收藏
  favorite() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    const isAdding = !this.data.isFavorited;
    const url = this.data.isFavorited ? '/api/favorite/remove' : '/api/favorite/add';
    wx.request({
      url: `${app.globalData.baseUrl}${url}`,
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      data: { post_id: this.data.postId },
      success: (res) => {
        if (res.data.code === 0) {
          this.setData({ isFavorited: !this.data.isFavorited });
          wx.showToast({ title: this.data.isFavorited ? '收藏成功' : '已取消收藏', icon: 'success' });
          if (isAdding) {
            this.recordBehavior('favorite');
          }
        } else {
          wx.showToast({ title: res.data.message, icon: 'none' });
        }
      }
    });
  },

  // ========== 核心修复：联系发布者方法 ==========
  // 详情页 detail.js 中的 contact 方法（完整修复版）
  contact() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }

    // 1. 获取并校验核心参数
    const post = this.data.post;
    const otherUserId = post?.user?.id ? Number(post.user.id) : null; // 发布者ID（接收方ID）
    const postId = this.data.postId;    // 帖子ID
    
    if (!otherUserId) {
      wx.showToast({ title: '发布者ID不存在', icon: 'none' });
      return;
    }
    if (!postId || isNaN(postId)) {
      wx.showToast({ title: '帖子ID无效', icon: 'none' });
      return;
    }
    // 禁止给自己发消息
    const currentUserId = wx.getStorageSync('userInfo')?.id ? Number(wx.getStorageSync('userInfo').id) : null;
    if (otherUserId === currentUserId) {
      wx.showToast({ title: '无法给自己发消息', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '进入聊天...' });
    wx.request({
      url: `${app.globalData.baseUrl}/api/chat/session/create`,
      method: 'POST',
      header: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      data: {
        other_id: otherUserId,
        post_id: postId
      },
      success: (res) => {
        wx.hideLoading();
        console.log('创建聊天会话返回：', res.data);
        if (res.data.code === 0) {
          const sessionId = res.data.data.session_id;
          if (!sessionId) {
            wx.showToast({ title: '会话创建失败', icon: 'none' });
            return;
          }
          // ========== 核心修复：跳转时传递 receiver_id 和 post_id ==========
          wx.navigateTo({ 
            url: `/pages/chat/detail?session_id=${sessionId}&receiver_id=${otherUserId}&post_id=${postId}` 
          });
        } else {
          wx.showModal({
            title: '提示',
            content: res.data.message || '无法创建聊天，请稍后再试'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('创建聊天会话失败：', err);
        wx.showToast({ title: '网络异常，无法连接聊天服务', icon: 'none' });
      }
    });
  },

  // 举报
  report() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({
      url: `/pages/report/create?targetType=post&targetId=${this.data.postId}`
    });
  },

  // 我是失主（申诉）
  claimAsOwner() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({
      url: `/pages/appeal/create?appealType=claim_dispute&targetType=post&targetId=${this.data.postId}`
    });
  },

  // 下架
  offShelf() {
    wx.showModal({
      title: '提示',
      content: '确定要将该内容下架吗？',
      success: (res) => {
        if (res.confirm) {
          wx.request({
            url: `${app.globalData.baseUrl}/api/post/off`,
            method: 'POST',
            header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
            data: { post_id: this.data.postId },
            success: (r) => {
              if (r.data.code === 0) {
                wx.showToast({ title: '已下架', icon: 'success' });
                setTimeout(() => wx.navigateBack(), 1500);
              } else {
                wx.showToast({ title: r.data.message, icon: 'none' });
              }
            }
          });
        }
      }
    });
  },

  // 确认完成（跳转到对接者选择页）
  confirmComplete() {
    wx.navigateTo({
      url: `/pages/transaction/select?postId=${this.data.postId}`
    });
  },

  // 删除
  deletePost() {
    wx.showModal({
      title: '提示',
      content: '确定要删除吗？删除后不可恢复。',
      success: (res) => {
        if (res.confirm) {
          wx.request({
            url: `${app.globalData.baseUrl}/api/post/delete`,
            method: 'POST',
            header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
            data: { post_id: this.data.postId },
            success: (r) => {
              if (r.data.code === 0) {
                wx.showToast({ title: '删除成功', icon: 'success' });
                setTimeout(() => wx.navigateBack(), 1500);
              } else {
                wx.showToast({ title: r.data.message, icon: 'none' });
              }
            }
          });
        }
      }
    });
  },

  // 重新发布
  repost() {
    wx.showModal({
      title: '提示',
      content: '重新发布后，内容将立即生效。',
      success: (res) => {
        if (res.confirm) {
          wx.request({
            url: `${app.globalData.baseUrl}/api/post/repost`,
            method: 'POST',
            header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
            data: { post_id: this.data.postId },
            success: (r) => {
              if (r.data.code === 0) {
                wx.showToast({ title: '已重新发布', icon: 'success' });
                this.loadDetail();
              } else {
                wx.showToast({ title: r.data.message, icon: 'none' });
              }
            }
          });
        }
      }
    });
  },

  // 修改（跳转到发布页，携带原内容）
  editPost() {
    wx.navigateTo({
      url: `/pages/post/post?type=${this.data.post.type}&id=${this.data.postId}`
    });
  }
});