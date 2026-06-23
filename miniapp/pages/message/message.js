const app = getApp();

Page({
  data: {
    activeTab: 'notification',
    notificationList: [],
    editing: false, 
    selectedNotifIds: [],
    notifSelectAll: false,
    selectedSessionIds: [],
    selectAll: false,
    sessionList: [],
    notifPage: 1,
    notifLimit: 20,
    notifHasMore: true,
    sessionPage: 1,
    sessionLimit: 20,
    sessionHasMore: true,
    loading: false,
    loadingMore: false,
    showDetailModal: false,
    currentNotification: {}
  },

  onLoad() {
    // 替换废弃接口，避免警告
    try {
      const windowInfo = wx.getWindowInfo();
      wx.setStorageSync('statusBarHeight', windowInfo.statusBarHeight || 20);
    } catch (e) {
      wx.setStorageSync('statusBarHeight', 20);
    }
    
    wx.setNavigationBarColor({
      frontColor: '#000000',
      backgroundColor: '#A5CFA9'
    });
    
    this.loadNotifications(true);
    this.loadSessions(true);
    
    // 监听全局事件
    app.event.on('updateSessionUnread', (data) => {
      this.updateSessionUnread(data.session_id, data.unread_count);
    });
  },

  onShow() {
    // 只有当前标签是「私信」且非编辑态时，才刷新列表
    if (this.data.activeTab === 'chat' && !this.data.editing) {
      this.loadSessions(true); 
    }
  },

  updateSessionUnread(sessionId, unreadCount) {
    const newSessionList = this.data.sessionList.map(item => {
      if (item.session_id === sessionId) {
        return { ...item, unread_count: unreadCount };
      }
      return item;
    });
    this.setData({ sessionList: newSessionList });
  },

  // 通知长按事件
  onNotificationLongPress(e) {
    const item = e.currentTarget.dataset.item;
    wx.showActionSheet({
      itemList: ['删除该通知'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.deleteSingleNotification(item.id);
        } else if (res.tapIndex === 1) {
          this.setData({
            notifBatchDelete: true,
            notificationList: this.data.notificationList.map(item => ({ ...item, isChecked: false })),
            selectedNotifIds: [],
            notifSelectAll: false
          });
        }
      }
    });
  },

  // 删除单条通知
  deleteSingleNotification(notificationId) {
    wx.showModal({
      title: '提示',
      content: '确定删除该通知吗？',
      success: (res) => {
        if (res.confirm) {
          wx.request({
            url: `${app.globalData.baseUrl}/api/notification/delete`,
            method: 'POST',
            header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
            data: { ids: [notificationId] },
            success: () => {
              wx.showToast({ title: '删除成功', icon: 'success' });
              this.setData({
                notificationList: this.data.notificationList.filter(n => n.id !== notificationId)
              });
            },
            fail: () => {
              wx.showToast({ title: '删除失败，请重试', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 私信长按事件
  onSessionLongPress(e) {
    const id = e.currentTarget.dataset.id;
    wx.showActionSheet({
      itemList: ['删除该会话', '进入批量删除模式'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.deleteSessions([id]);
        } else if (res.tapIndex === 1) {
          this.toggleSessionEdit();
        }
      }
    });
  },

  // 私信单选框点击事件
  handleSessionCheckboxTap(e) {
    const id = e.currentTarget.dataset.id;
    const newList = this.data.sessionList.map(item => {
      if (item.session_id === id) {
        return { ...item, isChecked: !item.isChecked };
      }
      return item;
    });
    const selectedSessionIds = newList.filter(item => item.isChecked).map(item => item.session_id);
    const selectAll = selectedSessionIds.length === newList.length && newList.length > 0;
    this.setData({
      sessionList: newList,
      selectedSessionIds,
      selectAll
    });
  },

  // 私信全选逻辑
  selectAllSessions() {
    const newState = !this.data.selectAll;
    const newList = this.data.sessionList.map(item => ({ ...item, isChecked: newState }));
    const selectedSessionIds = newState ? newList.map(item => item.session_id) : [];
    this.setData({
      sessionList: newList,
      selectedSessionIds,
      selectAll: newState
    });
  },
  
  // 私信批量删除
  deleteSelectedSessions() {
    if (this.data.selectedSessionIds.length === 0) return;
    wx.showModal({
      title: '提示',
      content: `确定删除这${this.data.selectedSessionIds.length}个会话吗？`,
      success: (res) => {
        if (res.confirm) {
          this.deleteSessions(this.data.selectedSessionIds);
        }
      }
    });
  },
  
  // 私信删除
  deleteSessions(ids) {
    wx.showLoading({ title: '删除中...' });
    wx.request({
      url: `${app.globalData.baseUrl}/api/chat/delete_session`,
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      data: { session_ids: ids },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 0) {
          wx.showToast({ title: '删除成功', icon: 'success' });
          this.setData({
            sessionList: this.data.sessionList.filter(item => !ids.includes(item.session_id)),
            editing: false,
            selectedSessionIds: [],
            selectAll: false
          });
        } else {
          wx.showToast({ title: res.data.message, icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },
  
  // 私信编辑态切换
  toggleSessionEdit() {
    const newState = !this.data.editing;
    const newList = this.data.sessionList.map(item => ({ ...item, isChecked: false }));
    this.setData({
      editing: newState,
      sessionList: newList,
      selectedSessionIds: [],
      selectAll: false
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ 
      activeTab: tab,
      editing: false,
      selectedSessionIds: [],
      selectAll: false
    });
    
    if (tab === 'chat') {
      this.loadSessions(true);
    }
  },

  // 通知加载
  loadNotifications(refresh = false) {
    if (refresh) {
      this.setData({ notifPage: 1, notificationList: [], notifHasMore: true });
    }
    if (!this.data.notifHasMore) return;
    this.setData({ loading: refresh, loadingMore: !refresh });

    wx.request({
      url: `${app.globalData.baseUrl}/api/notification/list`,
      data: { page: this.data.notifPage, limit: this.data.notifLimit },
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        if (res.data.code === 0) {
          const list = res.data.data.list || [];
          const total = res.data.data.total || 0;
          const hasMore = this.data.notifPage * this.data.notifLimit < total;
          this.setData({
            notificationList: refresh ? list : [...this.data.notificationList, ...list],
            notifHasMore: hasMore,
            notifPage: this.data.notifPage + 1
          });
        }
      },
      complete: () => {
        this.setData({ loading: false, loadingMore: false });
      }
    });
  },

  loadMoreNotifications() {
    if (this.data.loadingMore || !this.data.notifHasMore) return;
    this.loadNotifications();
  },

  // 通知详情弹窗（核心修改：兼容所有举报类通知）
  showNotificationDetail(e) {
    const item = e.currentTarget.dataset.item;
    const notificationId = item.id;
    
    // 新增：打印完整数据，快速定位字段不匹配问题
    console.log('当前通知完整数据：', item);
    
    // 1. 标记已读逻辑（保持不变）
    const newNotificationList = this.data.notificationList.map(notif => {
      if (notif.id === notificationId) {
        return { ...notif, is_read: true };
      }
      return notif;
    });
    
    // 关键修复：确保 currentNotification 有默认的 data 空对象，避免后续判断报错
    const currentNotification = {
      ...item,
      data: item.data || {} // 兜底：如果 data 不存在，赋值为空对象
    };
    
    this.setData({
      notificationList: newNotificationList,
      currentNotification: currentNotification, // 存储处理后的完整数据
      showDetailModal: true
    });
  
    // 2. 调用接口标记已读（保持不变）
    wx.request({
      url: `${app.globalData.baseUrl}/api/notification/mark_read`,
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      data: { notification_id: notificationId },
      fail: (err) => {
        console.error('标记已读失败', err);
        wx.showToast({ title: '标记已读失败，请重试', icon: 'none' });
        const revertList = this.data.notificationList.map(notif => {
          if (notif.id === notificationId) {
            return { ...notif, is_read: false };
          }
          return notif;
        });
        this.setData({ notificationList: revertList });
      }
    });
  },

  hideDetailModal() {
    this.setData({
      showDetailModal: false,
      currentNotification: {}
    });
  },

  // 证件招领详情跳转
  goToCertificateDetail() {
    const { data } = this.data.currentNotification;
    if (data && data.certificate_id) {
      wx.navigateTo({
        url: `/pages/certificate/detail?id=${data.certificate_id}`
      });
      this.hideDetailModal();
    } else {
      wx.showToast({ title: '暂无证件招领详情', icon: 'none' });
    }
  },

  // 核心修改：所有举报类通知都支持申诉，且参数合法
  goToAppeal() {
    const { type, data = {} } = this.data.currentNotification;
    let appealType = '';
    let targetType = '';
    let targetId = '';
  
    // 1. 可申诉类型列表（保留）
    const appealableTypes = [
      'report_notify', 'post_reported', 'account_reported',
      'certificate_reported', 'post_off', 'credit_deduct', 'claim_dispute',
      'punishment'  // 处罚通知类型
    ];
  
    if (!appealableTypes.includes(type)) {
      wx.showToast({ title: '当前通知不支持申诉', icon: 'none' });
      return;
    }
  
    // 2. 关键修改：把 punishment 映射到 create.js 支持的 credit_deduct
    switch (type) {
      case 'post_reported':
      case 'post_off':
        appealType = 'post_off';       // 帖子下架（create.js 支持）
        targetType = 'post';           // 目标类型（create.js 支持）
        targetId = data.post_id || data.postId;
        break;
      case 'account_reported':
      case 'credit_deduct':
      case 'punishment':  // 处罚通知（扣信誉分）→ 映射到 credit_deduct
        appealType = 'credit_deduct';  // 积分扣除（create.js 支持）
        targetType = 'credit_log';     // 目标类型（create.js 支持）
        targetId = data.report_id || data.target_id || data.user_id; // 取可用的ID
        break;
      case 'certificate_reported':
      case 'claim_dispute':
        appealType = 'claim_dispute';  // 冒领申诉（create.js 支持）
        targetType = 'transaction_record'; // 目标类型（create.js 支持）
        targetId = data.certificate_id || data.certificateId;
        break;
      case 'report_notify':
        // 举报通知→优先映射到 post_off（如果有帖子ID），否则映射到 credit_deduct
        appealType = data.post_id ? 'post_off' : 'credit_deduct';
        targetType = data.post_id ? 'post' : 'credit_log';
        targetId = data.report_id || data.post_id || data.target_id;
        break;
      default:
        appealType = 'credit_deduct'; // 兜底到积分扣除
        targetType = 'credit_log';
        targetId = data.report_id || data.target_id || '';
    }
  
    // 3. 容错（确保ID不为空）
    if (!targetId) {
      wx.showToast({ title: '申诉参数缺失，请联系客服', icon: 'none' });
      return;
    }
  
    // 4. 跳转（传递 create.js 支持的参数）
    wx.navigateTo({
      url: `/pages/appeal/create?appealType=${appealType}&targetType=${targetType}&targetId=${targetId}`
    });
    this.hideDetailModal();
  },

  // 私信加载
  loadSessions(refresh = false) {
    if (refresh) {
      this.setData({ sessionPage: 1, sessionList: [], sessionHasMore: true });
    }
    if (!this.data.sessionHasMore) return;
    this.setData({ loading: refresh, loadingMore: !refresh });

    wx.request({
      url: `${app.globalData.baseUrl}/api/chat/sessions`,
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (res) => {
        if (res.data.code === 0) {
          const list = res.data.data || [];
          this.setData({
            sessionList: refresh ? list : [...this.data.sessionList, ...list],
            sessionHasMore: list.length === this.data.sessionLimit
          });
        }
      },
      complete: () => {
        this.setData({ loading: false, loadingMore: false });
      }
    });
  },

  loadMoreSessions() {
    if (this.data.loadingMore || !this.data.sessionHasMore) return;
    this.loadSessions();
  },

  goToChat(e) {
    const sessionId = e.currentTarget.dataset.sessionId;
    const otherStatus = e.currentTarget.dataset.otherStatus;
    
    // 新增：从事件源获取接收方ID（先从dataset取，取不到则从sessionList中匹配）
    const receiverId = e.currentTarget.dataset.receiverId || 
                      this.data.sessionList.find(item => item.session_id === sessionId)?.other_user?.id;

    // 1. 校验对方状态
    if (otherStatus === 'banned' || otherStatus === 'cancelled') {
      wx.showModal({ title: '提示', content: '对方账号异常，无法进行沟通', showCancel: false });
      return;
    }

    // 2. 校验核心参数
    if (!sessionId) {
      wx.showToast({ title: '会话ID缺失，无法进入聊天', icon: 'none' });
      return;
    }
    if (!receiverId) {
      wx.showToast({ title: '接收方信息缺失，无法进入聊天', icon: 'none' });
      return;
    }

    // 3. 跳转时携带 receiver_id 参数
    wx.navigateTo({ 
      url: `/pages/chat/detail?session_id=${sessionId}&receiver_id=${receiverId}` 
    });
  },

  goToPost(e) {
    const postId = e.currentTarget.dataset.postId;
    wx.navigateTo({ url: `/pages/detail/detail?id=${postId}` });
  },

  goBack() {
    wx.navigateBack();
  },

  stopPropagation(e) {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    } else if (e && e.stopPropagation) {
      e.stopPropagation();
    } else {
      console.warn('stopPropagation called without event object');
    }
  },
  
  // 新增：查看发布信息详情（证件招领关联的帖子）
  goToPostDetail() {
    const { data = {} } = this.data.currentNotification;
    const postId = data.post_id || data.postId; // 兼容两种字段命名
    if (postId) {
      wx.navigateTo({
        url: `/pages/detail/detail?id=${postId}`
      });
      this.hideDetailModal();
    } else {
      wx.showToast({ title: '暂无发布详情', icon: 'none' });
    }
  }
});