const app = getApp();

Page({
  data: {
    appealType: '',         // 后端实际支持：'post_reject'/'post_off'/'credit_deduct'/'claim_dispute'
    targetType: '',         // 后端实际支持：'post'/'credit_log'/'transaction_record'
    targetId: null,
    pageTitle: '',          // 页面标题：帖子驳回申诉/帖子下架申诉等
    reasonPlaceholder: '',
    reason: '',
    imageList: [],          // 格式：[{url: '服务器地址', uploading: false}, ...]
    maxImages: 5,
    submitting: false,
    statusBarHeight: 0,
    canSubmit: false,       // 是否满足提交条件
    allImagesUploaded: true // 所有图片是否已上传到服务器
  },

  onLoad(options) {
    // 1. 适配刘海屏状态栏高度（原有代码）
    try {
      const windowInfo = wx.getWindowInfo();
      this.setData({
        statusBarHeight: windowInfo.statusBarHeight || 20,
        scrollHeight: `${windowInfo.windowHeight - windowInfo.statusBarHeight - 44}px`
      });
    } catch (e) {
      this.setData({ 
        statusBarHeight: 20,
        scrollHeight: '80vh'
      });
    }
  
    // 2. 接收并验证参数（原有代码）
    const { appealType, targetType, targetId } = options;
    const appealTypeNormalized = (appealType || '').trim().toLowerCase();
    const targetTypeNormalized = (targetType || '').trim().toLowerCase();
    const targetIdNormalized = (targetId || '').trim();
    
    const allowedAppealTypes = ['post_reject', 'post_off', 'credit_deduct', 'claim_dispute'];
    const allowedTargetTypes = ['post', 'credit_log', 'transaction_record'];
    
    if (!appealTypeNormalized || !allowedAppealTypes.includes(appealTypeNormalized)) {
      wx.showToast({ title: '非法的申诉类型', icon: 'none', duration: 2000 });
      setTimeout(() => wx.navigateBack(), 2000);
      return;
    }
    if (!targetTypeNormalized || !allowedTargetTypes.includes(targetTypeNormalized)) {
      wx.showToast({ title: '非法的目标类型', icon: 'none', duration: 2000 });
      setTimeout(() => wx.navigateBack(), 2000);
      return;
    }
    if (!targetIdNormalized) {
      wx.showToast({ title: '缺少目标ID', icon: 'none', duration: 2000 });
      setTimeout(() => wx.navigateBack(), 2000);
      return;
    }
  
    // ========== 新增：直接赋值申诉类型文本到 data ==========
    let appealTypeName = '';
    if (appealTypeNormalized === 'credit_deduct') {
      appealTypeName = '积分扣除申诉';
    } else if (appealTypeNormalized === 'post_off') {
      appealTypeName = '帖子下架申诉';
    } else if (appealTypeNormalized === 'post_reject') {
      appealTypeName = '帖子驳回申诉';
    } else if (appealTypeNormalized === 'claim_dispute') {
      appealTypeName = '冒领申诉';
    } else {
      appealTypeName = '未知申诉类型';
    }
  
    // 3. 设置 data（原有代码 + 新增 appealTypeName）
    this.setData({ 
      appealType: appealTypeNormalized, 
      targetType: targetTypeNormalized, 
      targetId: targetIdNormalized,
      appealTypeName: appealTypeName // 新增：直接存到 data 里
    });
  
    // 4. 设置页面标题和占位符（原有代码）
    this.setPageTitleAndPlaceholder(appealTypeNormalized);
  },

  // 设置页面标题和占位符（精简为后端实际支持的4种类型）
  setPageTitleAndPlaceholder(appealType) {
    const config = {
      'claim_dispute': {
        title: '冒领申诉',
        placeholder: '请说明你是真失主的理由，并上传证据（如购买记录、证件等）'
      },
      'post_reject': {
        title: '帖子驳回申诉',
        placeholder: '请说明帖子被驳回的申诉理由，并上传相关证据'
      },
      'post_off': {
        title: '帖子下架申诉',
        placeholder: '请说明帖子被下架的申诉理由，并上传相关证据'
      },
      'credit_deduct': {
        title: '积分扣除申诉',
        placeholder: '请说明积分扣除的申诉理由，并上传相关证据'
      },
      'default': {
        title: '提交申诉',
        placeholder: '请详细说明申诉理由（最多300字）'
      }
    };
    const { title, placeholder } = config[appealType] || config.default;
    this.setData({
      pageTitle: title,
      reasonPlaceholder: placeholder,
      canSubmit: !!this.data.reason.trim().length
    });
    wx.setNavigationBarTitle({ title });
  },

  // 监听理由输入
  onReasonInput(e) {
    const reason = e.detail.value || '';
    const reasonTrimmed = reason.trim();
    this.setData({ 
      reason: reason,
      canSubmit: reasonTrimmed.length > 0
    });
  },

  // 选择图片
  chooseImage() {
    const { imageList, maxImages } = this.data;
    if (imageList.length >= maxImages) {
      wx.showToast({ title: `最多只能上传${maxImages}张图片`, icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: maxImages - imageList.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const newImages = res.tempFiles.map(file => ({
          tempPath: file.tempFilePath,
          uploading: true
        }));
        this.setData({
          imageList: [...imageList, ...newImages],
          allImagesUploaded: false
        });
        this.uploadImages(newImages);
      },
      fail: (err) => {
        wx.showToast({ title: '选择图片失败：' + (err.errMsg || '未知错误'), icon: 'none' });
      }
    });
  },

  // 上传图片到服务器
  uploadImages(tempImages) {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      this.setData({ allImagesUploaded: true });
      return;
    }

    tempImages.forEach((img, imgIndex) => {
      wx.uploadFile({
        url: `${app.globalData.baseUrl}/api/upload/image`,
        filePath: img.tempPath,
        name: 'file',
        header: { 
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'multipart/form-data'
        },
        timeout: 30000,
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.code === 0 && data.data?.url) {
              const newImageList = this.data.imageList.map((item, index) => {
                if (index === this.data.imageList.length - tempImages.length + imgIndex) {
                  return {
                    url: data.data.url,
                    uploading: false
                  };
                }
                return item;
              });
              this.setData({ imageList: newImageList });
            } else {
              throw new Error(data.message || '图片上传失败');
            }
          } catch (e) {
            wx.showToast({ title: '图片解析失败：' + e.message, icon: 'none' });
            this.removeImageByTempPath(img.tempPath);
          }
        },
        fail: (err) => {
          wx.showToast({ title: '图片上传失败：' + err.errMsg, icon: 'none' });
          this.removeImageByTempPath(img.tempPath);
        },
        complete: () => {
          const newImageList = this.data.imageList.map((item, index) => {
            if (index === this.data.imageList.length - tempImages.length + imgIndex) {
              return { ...item, uploading: false };
            }
            return item;
          });
          this.setData({ imageList: newImageList });
          this.checkAllImagesUploaded();
        }
      });
    });
  },

  // 检查所有图片是否上传完成
  checkAllImagesUploaded() {
    const allUploaded = this.data.imageList.every(item => !item.uploading);
    this.setData({ allImagesUploaded: allUploaded });
  },

  // 根据临时路径移除图片
  removeImageByTempPath(tempPath) {
    const newImageList = this.data.imageList.filter(item => item.tempPath !== tempPath);
    this.setData({ imageList: newImageList });
    this.checkAllImagesUploaded();
  },

  // 移除图片（增加确认弹窗）
  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    wx.showModal({
      title: '确认删除',
      content: '是否删除这张图片？',
      success: (res) => {
        if (res.confirm) {
          const newImageList = this.data.imageList.filter((_, i) => i !== index);
          this.setData({ 
            imageList: newImageList,
            allImagesUploaded: newImageList.every(item => !item.uploading)
          });
        }
      }
    });
  },

  // 提交申诉
  submitAppeal() {
    const { reason, canSubmit, allImagesUploaded, appealType, targetType, targetId } = this.data;
    
    if (!canSubmit) {
      wx.showToast({ title: '请输入申诉理由', icon: 'none' });
      return;
    }
    if (!allImagesUploaded) {
      wx.showToast({ title: '图片还在上传中，请稍等', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交申诉中...', mask: true });

    // 整理参数
    const evidenceImages = this.data.imageList.map(item => item.url || '').filter(Boolean);
    
    wx.request({
      url: `${app.globalData.baseUrl}/api/appeal/create`,
      method: 'POST',
      header: { 
        'Authorization': 'Bearer ' + wx.getStorageSync('token'),
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      data: {
        appeal_type: appealType,       // 仅传递后端支持的4种类型
        target_type: targetType,       // 仅传递后端支持的3种类型
        target_id: targetId,
        reason: reason.trim(),
        evidence_images: evidenceImages
      },
      success: (res) => {
        if (res.data && res.data.code === 0) {
          wx.showModal({
            title: '提交成功',
            content: '申诉已提交，管理员将尽快审核，请耐心等待',
            showCancel: false,
            success: () => {
              this.goBack();
            }
          });
        } else {
          wx.showToast({ 
            title: res.data?.message || '提交失败，请稍后重试', 
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ 
          title: '服务器错误，请稍后重试', 
          icon: 'none',
          duration: 2000
        });
        console.error('申诉提交失败：', err);
      },
      complete: () => {
        wx.hideLoading();
        this.setData({ submitting: false });
      }
    });
  },

  // 返回上一页
  goBack() {
    try {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack({ delta: 1 });
      } else {
        wx.switchTab({ url: '/pages/home/home' });
      }
    } catch (e) {
      wx.redirectTo({ url: '/pages/home/home' });
    }
  },

  // 申诉类型文本映射（仅保留这一个，删掉 appealTypeTextByTitle）
  get appealTypeText() {
    const typeMap = { 
      'claim_dispute': '冒领申诉',
      'post_reject': '帖子驳回申诉',
      'post_off': '帖子下架申诉',
      'credit_deduct': '积分扣除申诉'
    };
    // 强制兜底，绝对不会为空
    return typeMap[this.data.appealType] || '未知申诉类型';
  }
});