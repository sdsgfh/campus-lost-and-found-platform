// const app = getApp();

// Page({
//   data: {
//     sessionId: null,
//     myId: null,
//     otherUser: {},
//     postTitle: '',
//     messageList: [],
//     inputText: '',
//     page: 1,
//     limit: 20,
//     hasMore: true,
//     loading: false,
//     statusBarHeight: 0
//   },

//   onLoad(options) {
//     // 适配状态栏高度
//     try {
//       const systemInfo = wx.getSystemInfoSync();
//       this.setData({
//         statusBarHeight: systemInfo.statusBarHeight || 20
//       });
//     } catch (e) {
//       this.setData({ statusBarHeight: 20 });
//     }
  
//     // 接收页面跳转参数（示例：从聊天列表页传递 sessionId 和 receiverId）
//     const sessionId = Number(options.session_id) || Number(options.sessionId);
//     const receiverId = Number(options.receiver_id) || Number(options.receiverId); // 新增：获取接收方ID
    
//     if (!sessionId || isNaN(sessionId)) {
//       wx.showToast({ title: '参数错误：缺少会话ID', icon: 'none' });
//       setTimeout(() => wx.navigateBack(), 1500);
//       return;
//     }
//     if (!receiverId || isNaN(receiverId)) {
//       wx.showToast({ title: '参数错误：缺少接收方ID', icon: 'none' });
//       setTimeout(() => wx.navigateBack(), 1500);
//       return;
//     }
  
//     const userInfo = wx.getStorageSync('userInfo');
//     const myId = userInfo?.id ? Number(userInfo.id) : null;
//     if (!myId) {
//       wx.showToast({ title: '用户未登录', icon: 'none' });
//       setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 1500);
//       return;
//     }
  
//     // 存储核心参数
//     this.setData({ 
//       sessionId: sessionId,
//       receiverId: receiverId, // 新增：存储接收方ID
//       myId: myId 
//     });
  
//     // 加载消息
//     this.loadMessages(true, true);
//   },

//   onShow() {
//     if (this.data.sessionId) {
//       this.markSessionRead();
//     }
//   },

//   markSessionRead() {
//     wx.request({
//       url: `${app.globalData.baseUrl}/api/chat/mark_session_read`,
//       method: 'POST',
//       header: { 
//         'Authorization': 'Bearer ' + wx.getStorageSync('token'),
//         'Content-Type': 'application/json'
//       },
//       data: { session_id: this.data.sessionId },
//       success: (res) => {
//         if (res.data.code === 0) {
//           app.event.emit('updateSessionUnread', {
//             session_id: this.data.sessionId,
//             unread_count: 0
//           });
//         } else {
//           wx.showToast({ title: res.data.message || '标记已读失败', icon: 'none' });
//         }
//       },
//       fail: () => {
//         console.error('标记会话已读失败（网络异常）');
//         wx.showToast({ title: '网络异常，标记已读失败', icon: 'none' });
//       }
//     });
//   },

//   loadMessages(refresh = false, shouldScrollToBottom = refresh) {
//     if (refresh) {
//       this.setData({ page: 1, messageList: [], hasMore: true });
//     }
//     if (!this.data.hasMore || this.data.loading) return;

//     this.setData({ loading: true });

//     wx.request({
//       url: `${app.globalData.baseUrl}/api/chat/messages`,
//       data: { 
//         session_id: this.data.sessionId, 
//         page: this.data.page, 
//         limit: this.data.limit 
//       },
//       header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
//       success: (res) => {
//         if (res.data.code === 0) {
//           const data = res.data.data;
//           const messages = data.messages || [];
//           const total = data.total || 0;
//           const hasMore = this.data.page * this.data.limit < total;
//           if (data.other_user) {
//             this.setData({ otherUser: data.other_user });
//           }
//           // 修复：加载更多时追加到列表末尾
//           const newList = refresh ? messages : [...this.data.messageList, ...messages];
//           this.setData({
//             messageList: newList,
//             hasMore,
//             page: this.data.page + 1,
//             loading: false
//           });

//           // 确保滚动到底部
//           if (shouldScrollToBottom) {
//             setTimeout(() => {
//               const query = wx.createSelectorQuery().in(this);
//               query.select('#lastMessage').boundingClientRect(rect => {
//                 wx.pageScrollTo({
//                   scrollTop: rect ? rect.bottom : 0,
//                   duration: 100
//                 });
//               }).exec();
//             }, 100);
//           }
//         } else {
//           wx.showToast({ title: res.data.message || '加载失败', icon: 'none' });
//           this.setData({ loading: false });
//         }
//       },
//       fail: () => {
//         wx.showToast({ title: '网络异常', icon: 'none' });
//         this.setData({ loading: false });
//       }
//     });
//   },

//   loadMore() {
//     if (this.data.loading || !this.data.hasMore) return;
//     this.loadMessages(false, false);
//   },

//   sendMessage() {
//     const content = this.data.inputText.trim();
//     if (!content) {
//       wx.showToast({ title: '文本消息不能为空', icon: 'none' });
//       return;
//     }
  
//     const sendData = {
//       session_id: this.data.sessionId,
//       receiver_id: this.data.receiverId,
//       msg_type: 'text',
//       content: content
//     };
  
//     wx.request({
//       url: `${app.globalData.baseUrl}/api/chat/send`,
//       method: 'POST',
//       header: { 
//         'Authorization': 'Bearer ' + wx.getStorageSync('token'),
//         'Content-Type': 'application/json'
//       },
//       data: sendData,
//       success: (res) => {
//         if (res.data.code === 0) {
//           // 核心优化：判断替换后的内容是否和原始内容一致
//           const originalContent = this.data.inputText.trim();
//           const replacedContent = res.data.data?.content || '';
          
//           // 调试：打印原始内容和替换后的内容
//           console.log('📝 原始内容：', originalContent);
//           console.log('🔄 替换后内容：', replacedContent);
          
//           if (originalContent !== replacedContent) {
//             wx.showToast({ 
//               title: '部分敏感词已自动替换', 
//               icon: 'none', 
//               duration: 2000 
//             });
//           }
//           this.setData({ inputText: '' });
//           this.loadMessages(true, true);
//         } else {
//           wx.showToast({ 
//             title: res.data.message || '发送失败', 
//             icon: 'none', 
//             duration: 3000 
//           });
//         }
//       },
//       fail: (err) => {
//         console.error('请求失败：', err);
//         wx.showToast({ title: '网络异常，发送失败', icon: 'none' });
//       }
//     });
//   },
//   mapStatus(status) {
//     const map = {
//       'pending': '待审核',
//       'active': '进行中',
//       'pending_confirm': '待失主确认',
//       'completed': '已完成',
//       'expired': '已过期',
//       'off': '已下架',
//       'rejected': '已驳回'
//     };
//     return map[status] || status;
//   },

//   claimAsOwner() {
//     const token = wx.getStorageSync('token');
//     if (!token) {
//       wx.navigateTo({ url: '/pages/login/login' });
//       return;
//     }
//     wx.navigateTo({
//       url: `/pages/appeal/create?appealType=claim_dispute&targetType=post&targetId=${this.data.postId}`
//     });
//   },

//   chooseImage() {
//     wx.chooseMedia({
//       count: 9,
//       mediaType: ['image'],
//       sourceType: ['album', 'camera'],
//       success: (res) => {
//         const tempFiles = res.tempFiles;
//         for (let file of tempFiles) {
//           if (file.size > 2 * 1024 * 1024) {
//             wx.showToast({ title: '图片不能超过2MB', icon: 'none' });
//             return;
//           }
//           const ext = file.tempFilePath.split('.').pop().toLowerCase();
//           if (!['jpg', 'jpeg', 'png'].includes(ext)) {
//             wx.showToast({ title: '仅支持jpg/png格式', icon: 'none' });
//             return;
//           }
//         }
//         this.uploadImages(tempFiles);
//       }
//     });
//   },

//   uploadImages(tempFiles) {
//     wx.showLoading({ title: '上传中...' });
//     const uploadTasks = tempFiles.map(file => {
//       return new Promise((resolve, reject) => {
//         wx.uploadFile({
//           url: `${app.globalData.baseUrl}/api/chat/upload-image`,
//           filePath: file.tempFilePath,
//           name: 'file',
//           header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
//           success: (res) => {
//             try {
//               const data = JSON.parse(res.data);
//               console.log('📤 上传返回结果：', data); // 新增：打印返回的URL
//               if (data.code === 0 && data.url) {
//                 resolve(data.url);
//               } else {
//                 reject(data.message || '图片上传失败');
//               }
//             } catch (e) {
//               reject('解析上传结果失败');
//             }
//           },
//           fail: (err) => reject(`上传失败：${err.errMsg}`)
//         });
//       });
//     });
  
//     Promise.all(uploadTasks)
//       .then(urls => {
//         wx.hideLoading();
//         console.log('🔗 最终发送的图片URL：', urls); // 新增：打印要发送的URL
//         urls.forEach(url => this.sendImageMessage(url));
//       })
//       .catch(err => {
//         wx.hideLoading();
//         wx.showToast({ title: err || '上传失败', icon: 'none' });
//       });
//   },
//   sendImageMessage(url) {
//     // 1. 本地预渲染图片消息（优化临时ID，避免冲突）
//     const tempMsgId = `temp_${Date.now()}`;
//     const tempMsg = {
//       id: tempMsgId,
//       sender_id: this.data.myId,
//       msg_type: 'image',
//       image_url: url,
//       is_read: true,
//       created_at: new Date().toLocaleTimeString()
//     };
//     this.setData({
//       messageList: [...this.data.messageList, tempMsg]
//     }, () => {
//       // 滚动到底部
//       const query = wx.createSelectorQuery().in(this);
//       query.select('#lastMessage').boundingClientRect(rect => {
//         wx.pageScrollTo({
//           scrollTop: rect ? rect.bottom : 0,
//           duration: 50
//         });
//       }).exec();
//     });
  
//     // 2. 发送图片消息到后端（参数和后端统一）
//     const sendData = {
//       session_id: this.data.sessionId,
//       receiver_id: this.data.receiverId, // 必须传接收方ID
//       msg_type: 'image', // 明确指定图片类型
//       content: url // 图片URL作为content传递
//     };
  
//     // 调试：打印参数
//     console.log('发送图片消息参数：', sendData);
  
//     wx.request({
//       url: `${app.globalData.baseUrl}/api/chat/send`,
//       method: 'POST',
//       header: { 
//         'Authorization': 'Bearer ' + wx.getStorageSync('token'),
//         'Content-Type': 'application/json'
//       },
//       data: sendData,
//       success: (res) => {
//         if (res.data.code !== 0) {
//           // 接口失败：移除本地临时消息
//           const newList = this.data.messageList.filter(item => item.id !== tempMsgId);
//           this.setData({ messageList: newList });
//           wx.showToast({ title: res.data.message || '图片发送失败', icon: 'none' });
//         } else {
//           // 接口成功：刷新列表
//           setTimeout(() => this.loadMessages(true, false), 300);
//         }
//       },
//       fail: (err) => {
//         console.error('图片消息发送失败：', err);
//         // 网络失败：移除临时消息
//         const newList = this.data.messageList.filter(item => item.id !== tempMsgId);
//         this.setData({ messageList: newList });
//         wx.showToast({ title: '网络异常，图片发送失败', icon: 'none' });
//       }
//     });
//   },

//   // 修复：图片预览方法（兼容微信小程序的URL校验）
//   previewImage(e) {
//     let url = e.currentTarget?.dataset?.url;
//     if (!url) {
//       const msgId = e.currentTarget?.dataset?.msgId;
//       const msg = this.data.messageList.find(item => item.id === msgId);
//       url = msg?.image_url;
//     }
//     // 修复：小程序URL校验（补充http/https判断）
//     if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
//       wx.showToast({ title: '图片URL无效', icon: 'none' });
//       return;
//     }
//     // 小程序预览图片需要确保域名在白名单，本地调试需开启不校验域名
//     wx.previewImage({ 
//       urls: [url],
//       fail: (err) => {
//         console.error('预览图片失败：', err);
//         wx.showToast({ title: '预览失败，请检查图片链接', icon: 'none' });
//       }
//     });
//   },

//   goToUserProfile() {
//     if (this.data.otherUser.status === 'banned' || this.data.otherUser.status === 'cancelled') {
//       wx.showModal({ title: '提示', content: '对方账号异常，无法查看个人中心', showCancel: false });
//     } else {
//       wx.navigateTo({ url: `/pages/profile/other?user_id=${this.data.otherUser.id}` });
//     }
//   },

//   report() {
//     const token = wx.getStorageSync('token');
//     if (!token) {
//       wx.navigateTo({ url: '/pages/login/login' });
//       return;
//     }
//     wx.navigateTo({
//       url: `/pages/report/create?targetType=post&targetId=${this.data.postId}`
//     });
//   },

//   onInput(e) {
//     this.setData({ inputText: e.detail.value });
//   },

//   goBack() {
//     const pages = getCurrentPages();
//     if (pages.length > 1) {
//       wx.navigateBack({ delta: 1 });
//     } else {
//       wx.switchTab({ url: '/pages/index/index' });
//     }
//   },

//   showMore() {},

//   get canSend() {
//     return this.data.inputText.trim().length > 0;
//   }
// });
const app = getApp();

Page({
  data: {
    sessionId: null,
    myId: null,
    otherUser: {},
    postTitle: '',
    messageList: [],
    inputText: '',
    myAvatar: '',
    page: 1,
    limit: 20,
    hasMore: true,
    loading: false,
    statusBarHeight: 0,
    receiverId: null,
    postId: null
  },

  onLoad(options) {
    try {
      const windowInfo = wx.getWindowInfo();
      this.setData({
        statusBarHeight: windowInfo.statusBarHeight || 20
      });
    } catch (e) {
      this.setData({ statusBarHeight: 20 });
    }
  
    const sessionId = Number(options.session_id) || Number(options.sessionId);
    const receiverId = Number(options.receiver_id) || Number(options.receiverId);
    const postId = Number(options.post_id) || Number(options.postId);
  
    if (!sessionId || isNaN(sessionId)) {
      wx.showToast({ title: '缺少会话ID', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    if (!receiverId || isNaN(receiverId)) {
      wx.showToast({ title: '缺少接收方ID', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
  
    // 先获取用户信息，再判断 myId
    const userInfo = wx.getStorageSync('userInfo');
    const myId = userInfo?.id ? Number(userInfo.id) : null;
    if (!myId) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 1500);
      return;
    }
  
    this.setData({
      myAvatar: userInfo?.avatar || '',
      sessionId,
      receiverId,
      myId,
      postId
    });
  
    this.loadMessages(true, true);
  },

// pages/chat/detail.js 的 onShow 方法中添加
  onShow() {
    if (this.data.sessionId) {
      this.markSessionRead();
      // 刷新对方用户信息，确保头像最新
      this.refreshOtherUserInfo();
      this.refreshMyUserInfo();
    }
  },
  refreshMyUserInfo() {
    const token = wx.getStorageSync('token');
    if (!token) return;
    wx.request({
      url: `${app.globalData.baseUrl}/api/user/get_latest_info`,
      header: { 'Authorization': 'Bearer ' + token },
      success: (res) => {
        if (res.data.code === 0) {
          const userInfo = res.data.data;
          wx.setStorageSync('userInfo', userInfo);
          this.setData({ myAvatar: userInfo.avatar });  // 更新 myAvatar
        }
      }
    });
  },
  refreshOtherUserInfo() {
    const otherId = this.data.otherUser.id;
    if (!otherId) return;
    wx.request({
      url: `${app.globalData.baseUrl}/api/user/info`,
      data: { user_id: otherId },
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        if (res.data.code === 0) {
          const newInfo = res.data.data;
          this.setData({
            'otherUser.avatar': newInfo.avatar,
            'otherUser.nickname': newInfo.nickname
          });
        }
      }
    });
  },

  markSessionRead() {
    wx.request({
      url: `${app.globalData.baseUrl}/api/chat/mark_session_read`,
      method: 'POST',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token'),
        'Content-Type': 'application/json'
      },
      data: { session_id: this.data.sessionId },
      success: (res) => {
        if (res.data.code === 0) {
          app.event.emit('updateSessionUnread', {
            session_id: this.data.sessionId,
            unread_count: 0
          });
        }
      }
    });
  },

  loadMessages(refresh = false, shouldScrollToBottom = refresh) {
    if (refresh) {
      this.setData({ page: 1, messageList: [], hasMore: true });
    }
    if (!this.data.hasMore || this.data.loading) return;

    this.setData({ loading: true });

    wx.request({
      url: `${app.globalData.baseUrl}/api/chat/messages`,
      data: {
        session_id: this.data.sessionId,
        page: this.data.page,
        limit: this.data.limit
      },
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        if (res.data.code === 0) {
          const data = res.data.data;
          const messages = data.messages || [];
          const total = data.total || 0;
          const hasMore = this.data.page * this.data.limit < total;

          if (data.post_title) this.setData({ postTitle: data.post_title });
          if (data.other_user) this.setData({ otherUser: data.other_user });

          const newList = refresh ? messages : [...messages, ...this.data.messageList];

          this.setData({
            messageList: newList,
            hasMore,
            page: this.data.page + 1,
            loading: false
          });

          if (shouldScrollToBottom) {
            this.scrollToBottom();
          }
        } else {
          wx.showToast({ title: res.data.message || '加载失败', icon: 'none' });
          this.setData({ loading: false });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
        this.setData({ loading: false });
      }
    });
  },

  scrollToBottom() {
    setTimeout(() => {
      const query = wx.createSelectorQuery().in(this);
      query.select('#lastMessage').boundingClientRect(rect => {
        if (rect) {
          wx.pageScrollTo({ scrollTop: rect.top, duration: 100 });
        }
      }).exec();
    }, 100);
  },

  loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.loadMessages(false, false);
  },

  sendMessage() {
    const content = this.data.inputText.trim();
    if (!content) {
      wx.showToast({ title: '消息不能为空', icon: 'none' });
      return;
    }

    const sendData = {
      session_id: this.data.sessionId,
      receiver_id: this.data.receiverId,
      msg_type: 'text',
      content: content
    };

    wx.request({
      url: `${app.globalData.baseUrl}/api/chat/send`,
      method: 'POST',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token'),
        'Content-Type': 'application/json'
      },
      data: sendData,
      success: (res) => {
        if (res.data.code === 0) {
          const original = content;
          const replaced = res.data.data?.content || '';
          if (original !== replaced) {
            wx.showToast({ title: '含敏感词已自动替换', icon: 'none' });
          }
          this.setData({ inputText: '' });
          this.loadMessages(true, true);
        } else {
          wx.showToast({ title: res.data.message || '发送失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFiles = res.tempFiles;
        for (let f of tempFiles) {
          if (f.size > 2 * 1024 * 1024) {
            wx.showToast({ title: '图片不能大于2MB', icon: 'none' });
            return;
          }
        }
        this.uploadImages(tempFiles);
      }
    });
  },

  uploadImages(tempFiles) {
    wx.showLoading({ title: '上传中' });
    const tasks = tempFiles.map(file => {
      return new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${app.globalData.baseUrl}/api/chat/upload-image`,
          filePath: file.tempFilePath,
          name: 'file',
          header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
          success: (res) => {
            try {
              const data = JSON.parse(res.data);
              data.code === 0 ? resolve(data.url) : reject(data.message);
            } catch (e) {
              reject('解析失败');
            }
          },
          fail: reject
        });
      });
    });

    Promise.all(tasks).then(urls => {
      wx.hideLoading();
      urls.forEach(u => this.sendImageMessage(u));
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: err || '上传失败', icon: 'none' });
    });
  },

  sendImageMessage(url) {
    const tempMsgId = `temp_${Date.now()}`;
    const tempMsg = {
      id: tempMsgId,
      sender_id: this.data.myId,
      msg_type: 'image',
      image_url: url,
      created_at: new Date().toLocaleTimeString()
    };

    this.setData({
      messageList: [...this.data.messageList, tempMsg]
    }, () => this.scrollToBottom());

    const sendData = {
      session_id: this.data.sessionId,
      receiver_id: this.data.receiverId,
      msg_type: 'image',
      content: url
    };

    wx.request({
      url: `${app.globalData.baseUrl}/api/chat/send`,
      method: 'POST',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token'),
        'Content-Type': 'application/json'
      },
      data: sendData,
      success: (res) => {
        if (res.data.code !== 0) {
          const list = this.data.messageList.filter(m => m.id !== tempMsgId);
          this.setData({ messageList: list });
          wx.showToast({ title: '图片发送失败', icon: 'none' });
        } else {
          setTimeout(() => this.loadMessages(true), 300);
        }
      },
      fail: () => {
        const list = this.data.messageList.filter(m => m.id !== tempMsgId);
        this.setData({ messageList: list });
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url || !url.startsWith('http')) {
      wx.showToast({ title: '图片链接无效', icon: 'none' });
      return;
    }
    wx.previewImage({ urls: [url] });
  },

  goToUserProfile() {
    if (this.data.otherUser.status === 'banned' || this.data.otherUser.status === 'cancelled') {
      wx.showModal({ title: '提示', content: '对方账号异常', showCancel: false });
      return;
    }
    wx.navigateTo({ url: `/pages/profile/other?user_id=${this.data.otherUser.id}` });
  },

  report() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    if (!this.data.postId) {
      wx.showToast({ title: '未关联帖子', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/report/create?targetType=post&targetId=${this.data.postId}`
    });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  goBack() {
    wx.navigateBack();
  },

  showMore() { }
});