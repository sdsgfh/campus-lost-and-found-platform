// D:\xiaomi\pages\post\post.js
const app = getApp();

Page({
  data: {
    type: '',
    pageTitle: '',
    warningText: '',
    categoryList: [],
    selectedCategory: null,
    title: '',
    description: '',
    timeDate: '',
    timeTime: '',
    location: '',
    selectedLocation: '',
    locationOptions: ['教学区', '图书馆', '宿舍区', '餐厅', '操场', '校门口', '其他'],
    selectedCondition: '',
    price: '',
    selectedExpiry: '',
    imageList: [],
    maxImages: 5,
    conditionOptions: ['全新', '9成新', '8成新', '7成新', '6成新及以下'],
    expiryOptions: [],
    showTime: true,
    showLocation: true,
    showCondition: false,
    showPrice: false,
    timeLabel: '丢失时间',
    locationLabel: '丢失地点',
    conditionLabel: '新旧成色',
    priceLabel: '价格',
    imageLabel: '上传图片',
    // 快速认领相关
    quickClaimKeywords: ['校园卡', '学生证', '准考证'],
    showQuickClaimDialog: false,   // 控制弹窗显示
    tempQuickClaimStudentId: '',   // 弹窗中输入的学号
    // 提交状态
    submitting: false,
    // 敏感词审核失败提示
    showAuditFailDialog: false,
    auditFailReason: '',
    // 占位符优化
    descPlaceholder: '请详细描述物品特征、丢失/捡到经过等信息'
  },

  // 检测内容是否包含证件关键词（用于提交时判断）
  containsIdCardKeywords() {
    if (this.data.type !== 'found') return false;
    const text = (this.data.title + this.data.description).toLowerCase();
    return this.data.quickClaimKeywords.some(keyword => text.includes(keyword));
  },

  onLoad(options) {
    const type = options.type || 'lost';
    this.setData({ type });
    this.initPageByType(type);
    this.fetchCategories();
    this.checkUserStatus();
  },

  // 根据类型初始化页面
  initPageByType(type) {
    const config = {
      lost: {
        title: '发布寻物',
        warning: '发布违规信息将扣除信誉分',
        showTime: true,
        showLocation: true,
        showCondition: false,
        showPrice: false,
        timeLabel: '丢失时间',
        locationLabel: '丢失地点',
        expiryOptions: ['7天', '14天'],
        defaultExpiry: '14天',
        maxImages: 5,
        imageLabel: '上传图片',
        descPlaceholder: '请详细描述丢失物品特征、丢失时间、地点及联系方式等'
      },
      found: {
        title: '发布招领',
        warning: '请上传物品清晰照片，隐藏关键细节可防止冒领',
        showTime: true,
        showLocation: true,
        showCondition: false,
        showPrice: false,
        timeLabel: '捡到时间',
        locationLabel: '捡到地点',
        expiryOptions: ['7天', '14天'],
        defaultExpiry: '14天',
        maxImages: 5,
        imageLabel: '上传图片',
        descPlaceholder: '请详细描述捡到物品特征、捡到时间、地点及联系方式等'
      },
      sale: {
        title: '发布出售',
        warning: '发布违规信息将扣除信誉分',
        showTime: false,
        showLocation: false,
        showCondition: true,
        showPrice: true,
        conditionLabel: '新旧成色',
        priceLabel: '出售价格',
        expiryOptions: ['7天', '15天', '30天'],
        defaultExpiry: '30天',
        maxImages: 5,
        imageLabel: '上传图片',
        descPlaceholder: '请详细描述出售物品的品牌、型号、使用情况、交易方式等'
      },
      wanted: {
        title: '发布求购',
        warning: '',
        showTime: false,
        showLocation: false,
        showCondition: true,
        showPrice: true,
        conditionLabel: '期望成色',
        priceLabel: '期望价格',
        expiryOptions: ['7天', '15天', '30天'],
        defaultExpiry: '30天',
        maxImages: 3,
        imageLabel: '参考图片（可选）',
        descPlaceholder: '请详细描述求购物品的品牌、型号、期望成色、预算等'
      }
    };

    const cfg = config[type];
    if (!cfg) return;

    this.setData({
      pageTitle: cfg.title,
      warningText: cfg.warning,
      showTime: cfg.showTime,
      showLocation: cfg.showLocation,
      showCondition: cfg.showCondition,
      showPrice: cfg.showPrice,
      timeLabel: cfg.timeLabel,
      locationLabel: cfg.locationLabel,
      conditionLabel: cfg.conditionLabel,
      priceLabel: cfg.priceLabel,
      expiryOptions: cfg.expiryOptions,
      selectedExpiry: cfg.defaultExpiry,
      maxImages: cfg.maxImages,
      imageLabel: cfg.imageLabel,
      descPlaceholder: cfg.descPlaceholder
    });
  },

  // 获取分类列表
  fetchCategories() {
    wx.request({
      url: `${app.globalData.baseUrl}/api/category/list`,
      success: (res) => {
        if (res.data.code === 0) {
          this.setData({ categoryList: res.data.data });
        }
      }
    });
  },

  // 检查用户状态
  checkUserStatus() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const status = userInfo.status;

    if (status === 'unverified') {
      wx.showModal({
        title: '提示',
        content: '请先完成实名认证',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/auth/auth' });
          } else {
            wx.navigateBack();
          }
        }
      });
    } else if (status === 'cancelled') {
      wx.showModal({
        title: '提示',
        content: '您的账号已注销，请重新认证',
        showCancel: false,
        success: () => {
          wx.navigateTo({ url: '/pages/auth/auth' });
        }
      });
    } else if (status === 'banned') {
      wx.showModal({
        title: '提示',
        content: '您的账号已被封禁，无法发布',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  // 表单输入
  onTitleInput(e) {
    this.setData({ title: e.detail.value });
    this.checkIfIdCard();
  },
  onDescInput(e) {
    this.setData({ description: e.detail.value });
    this.checkIfIdCard();
  },
  onCategoryChange(e) {
    const index = e.detail.value;
    this.setData({ selectedCategory: this.data.categoryList[index] });
  },
  onTimeDateChange(e) { this.setData({ timeDate: e.detail.value }); },
  onTimeTimeChange(e) { this.setData({ timeTime: e.detail.value }); },
  onLocationChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedLocation: this.data.locationOptions[index],
      location: this.data.locationOptions[index] // 实际存储地点
    });
  },
  onConditionChange(e) {
    const index = e.detail.value;
    this.setData({ selectedCondition: this.data.conditionOptions[index] });
  },
  onPriceInput(e) { this.setData({ price: e.detail.value }); },
  onExpiryChange(e) {
    const index = e.detail.value;
    this.setData({ selectedExpiry: this.data.expiryOptions[index] });
  },

  // 快速认领
  checkIfIdCard() {
    if (this.data.type !== 'found') return;
    const text = (this.data.title + this.data.description).toLowerCase();
    const hasKeyword = this.data.quickClaimKeywords.some(keyword => text.includes(keyword));
    this.setData({ showQuickClaim: hasKeyword });
  },
  onQuickClaimChange(e) {
    this.setData({ quickClaimEnabled: e.detail.value });
    if (!e.detail.value) {
      this.setData({ quickClaimStudentId: '' });
    }
  },
  onQuickClaimIdInput(e) {
    this.setData({ tempQuickClaimStudentId: e.detail.value });
  },

  // 图片上传
  chooseImage() {
    const maxCount = this.data.maxImages - this.data.imageList.length;
    if (maxCount <= 0) return;

    wx.chooseMedia({
      count: maxCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFiles = res.tempFiles;
        for (let file of tempFiles) {
          if (file.size > 2 * 1024 * 1024) {
            wx.showToast({ title: '图片不能超过2MB', icon: 'none' });
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

  // 校验表单
  validateForm() {
    if (!this.data.title) {
      wx.showToast({ title: '请输入物品名称', icon: 'none' });
      return false;
    }
    if (!this.data.selectedCategory) {
      wx.showToast({ title: '请选择物品分类', icon: 'none' });
      return false;
    }
    if (!this.data.description) {
      wx.showToast({ title: '请输入详细描述', icon: 'none' });
      return false;
    }
    if (this.data.showTime && (!this.data.timeDate || !this.data.timeTime)) {
      wx.showToast({ title: '请填写完整时间', icon: 'none' });
      return false;
    }
    if (this.data.showLocation && !this.data.location) {
      wx.showToast({ title: '请选择地点', icon: 'none' });
      return false;
    }
    if (this.data.showCondition && !this.data.selectedCondition) {
      wx.showToast({ title: '请选择成色', icon: 'none' });
      return false;
    }
    if (this.data.showPrice && !this.data.price) {
      wx.showToast({ title: '请输入价格', icon: 'none' });
      return false;
    }
    // 求购图片可选
    if (this.data.type !== 'wanted' && this.data.imageList.length === 0) {
      wx.showToast({ title: '请上传图片', icon: 'none' });
      return false;
    }
    // 快速认领学号校验
    if (this.data.quickClaimEnabled && !this.data.quickClaimStudentId) {
      wx.showToast({ title: '请输入学号', icon: 'none' });
      return false;
    }
    return true;
  },

  // 提交
  submitPost() {
    if (!this.validateForm()) return;

    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }

    // 如果是招领且包含证件关键词，则弹出快速认领对话框
    if (this.containsIdCardKeywords()) {
      this.setData({
        showQuickClaimDialog: true,
        tempQuickClaimStudentId: ''  // 清空之前输入
      });
      return; // 暂不提交，等待用户弹窗操作
    }

    // 否则直接提交
    this.doSubmit();
  },

  // 实际执行提交
  doSubmit() {
    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    // 构建提交数据（逻辑不变）
    let lostTime = null;
    if (this.data.showTime && this.data.timeDate && this.data.timeTime) {
      lostTime = `${this.data.timeDate} ${this.data.timeTime}:00`;
    }
    const expiryMap = { '7天': 7, '14天': 14, '15天': 15, '30天': 30 };
    const expiryDays = expiryMap[this.data.selectedExpiry];
    let price = null;
    if (this.data.showPrice && this.data.price) {
      price = parseFloat(this.data.price);
      if (isNaN(price)) {
        wx.showToast({ title: '价格格式不正确', icon: 'none' });
        this.setData({ submitting: false });
        wx.hideLoading();
        return;
      }
    }

    if (!this.data.selectedCategory || !this.data.selectedCategory.id) {
      wx.showToast({ title: '请选择有效的物品分类', icon: 'none' });
      this.setData({ submitting: false });
      wx.hideLoading();
      return;
    }

    const postData = {
      type: this.data.type,
      category_id: this.data.selectedCategory.id,
      title: this.data.title.trim(),
      description: this.data.description.trim(),
      images: this.data.imageList,
      location: this.data.location || null,
      lost_time: lostTime,
      expiry_days: expiryDays,
      condition: this.data.type === 'sale' ? this.mapCondition(this.data.selectedCondition) : null,
      expected_condition: this.data.type === 'wanted' ? this.mapCondition(this.data.selectedCondition) : null,
      price: this.data.type === 'sale' ? price : null,
      expected_price: this.data.type === 'wanted' ? price : null,
      quick_claim_student_id: this.data.tempQuickClaimStudentId ? this.data.tempQuickClaimStudentId.trim() : null
    };

    wx.request({
      url: `${app.globalData.baseUrl}/api/post/create`,
      method: 'POST',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token'),
        'Content-Type': 'application/json; charset=utf-8'
      },
      data: postData,
      success: (res) => {
        wx.hideLoading();
        this.setData({ submitting: false });
        
        // ======== 核心修改：根据业务码处理不同场景 ========
        const resData = res.data || {};
        // 业务码 0：提交成功
        if (resData.code === 0) {
          wx.showToast({ title: '发布成功！', icon: 'success' });
          // 跳转到帖子列表/详情页
          setTimeout(() => {
            wx.navigateBack({ delta: 1 });
          }, 1500);
        }
        // 业务码 1001：敏感词拦截（友好提示）
        else if (resData.code === 1001) {
          wx.showModal({
            title: '内容审核提示',
            content: resData.message || '您的内容包含敏感词汇，请修改后重新提交',
            showCancel: false, // 只有确定按钮
            confirmText: '我知道了'
          });
        }
        // 其他业务码：真正的错误（如参数错误、用户不存在）
        else {
          wx.showToast({ title: resData.message || '提交失败，请稍后再试', icon: 'none' });
        }
      },
      fail: (err) => {
        // 只有网络错误/请求超时才会走到这里
        wx.hideLoading();
        this.setData({ submitting: false });
        wx.showToast({ title: '网络异常，请检查网络后重试', icon: 'none' });
        console.error('请求失败：', err);
      }
    });
  },

  // 快速认领弹窗确认
  onQuickClaimConfirm() {
    const studentId = this.data.tempQuickClaimStudentId;
    if (!studentId) {
      wx.showToast({ title: '请输入学号', icon: 'none' });
      return;
    }
    this.setData({ showQuickClaimDialog: false });
    this.doSubmit();  // 提交，tempQuickClaimStudentId 已包含学号
  },

  // 快速认领弹窗取消
  onQuickClaimCancel() {
    this.setData({
      showQuickClaimDialog: false,
      tempQuickClaimStudentId: ''  // 清空，表示不启用
    });
    this.doSubmit();  // 继续提交，不携带学号
  },

  // 弹窗中学号输入
  onQuickClaimIdInput(e) {
    this.setData({ tempQuickClaimStudentId: e.detail.value });
  },

  // 敏感词审核失败弹窗关闭（核心优化：仅关闭弹窗，不跳转）
  closeAuditFailDialog() {
    this.setData({
      showAuditFailDialog: false,
      auditFailReason: ''
    });
    // 聚焦到描述输入框，方便用户修改
    wx.pageScrollTo({
      selector: '.textarea',
      duration: 300
    });
  },

  // 将中文成色映射为枚举值
  mapCondition(chinese) {
    const map = {
      '全新': 'new',
      '9成新': 'almost_new',
      '8成新': 'good',
      '7成新': 'fair',
      '6成新及以下': 'poor'
    };
    return map[chinese] || null;
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
});