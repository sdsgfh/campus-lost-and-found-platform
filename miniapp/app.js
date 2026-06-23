// app.js
App({
  globalData: {
    // 后端服务地址（请根据实际IP和端口修改）
    baseUrl: 'http://127.0.0.1:5000',
    // 是否使用模拟数据（开发阶段可先设为true，联调时改为false）
    useMock: false,
    // 用户信息（登录后存储）
    userInfo: null,
    // 是否已登录
    isLogin: false
  },
  event: {
    events: {},
    on(eventName, callback) {
      if (!this.events[eventName]) {
        this.events[eventName] = [];
      }
      this.events[eventName].push(callback);
    },
    emit(eventName, data) {
      if (this.events[eventName]) {
        this.events[eventName].forEach(callback => callback(data));
      }
    }
  },
  onLaunch() {
    // 小程序启动时执行
    console.log('小程序启动');
    
    // 检查本地是否有 token 或用户信息（可选）
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    if (token && userInfo) {
      this.globalData.isLogin = true;
      this.globalData.userInfo = userInfo;
    }
  }
});