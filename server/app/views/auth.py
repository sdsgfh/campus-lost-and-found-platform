from flask import Blueprint, request, jsonify, current_app
from app.extensions import db
from app.models.user import User
import requests
from flask_jwt_extended import create_access_token
from datetime import timedelta
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.sync_school import SyncSchool
import json

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    code = data.get('code')
    user_info = data.get('userInfo')  # 包含 nickName, avatarUrl
    if not code or not user_info:
        return jsonify({'code': 400, 'message': '缺少参数'}), 400

    # 调用微信接口获取 openid
    wx_appid = current_app.config['WX_APPID']
    wx_secret = current_app.config['WX_SECRET']
    wx_url = f'https://api.weixin.qq.com/sns/jscode2session?appid={wx_appid}&secret={wx_secret}&js_code={code}&grant_type=authorization_code'

    try:
        wx_resp = requests.get(wx_url)
        wx_data = wx_resp.json()
    except Exception as e:
        return jsonify({'code': 500, 'message': '微信服务调用失败'}), 500

    if 'openid' not in wx_data:
        return jsonify({'code': 401, 'message': '微信登录失败', 'error': wx_data.get('errmsg')}), 401

    openid = wx_data['openid']

    # 查找或创建用户
    user = User.query.filter_by(openid=openid).first()
    is_new_user = False
    if not user:
        # 新用户：用微信信息初始化（合理）
        user = User(
            openid=openid,
            nickname=user_info.get('nickName'),
            avatar=user_info.get('avatarUrl')
        )
        db.session.add(user)
        db.session.commit()
        is_new_user = True
    else:
        # ========== 核心修复：只更新登录时间，不覆盖昵称/头像 ==========
        user.last_login_at = db.func.current_timestamp()
        # 注释掉下面两行，避免覆盖手动修改的昵称/头像
        # user.nickname = user_info.get('nickName')
        # user.avatar = user_info.get('avatarUrl')
        db.session.commit()

    # 生成 JWT token，有效期7天
    access_token = create_access_token(identity=str(user.id), expires_delta=timedelta(days=7))

    return jsonify({
        'code': 0,
        'message': 'success',
        'data': {
            'token': access_token,
            'user': user.to_dict()
        }
    })
import base64
import requests
import json
from flask import jsonify, request
from app.extensions import db

# 智谱 API 配置
ZHIPU_API_KEY = current_app.config['ZHIPU_API_KEY']
ZHIPU_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

def extract_text_from_image(image_data):
    """
    调用智谱多模态接口，从图片中提取文字
    :param image_data: 图片的二进制数据
    :return: 识别出的纯文本，失败返回 None
    """
    # 将图片转为 base64 并构建数据 URL
    img_base64 = base64.b64encode(image_data).decode('utf-8')
    data_url = f"data:image/jpeg;base64,{img_base64}"

    headers = {
        "Authorization": f"Bearer {ZHIPU_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "glm-4.6v",  # 您指定的多模态模型
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": data_url}
                    },
                    {
                        "type": "text",
                        "text": "请识别这张图片中所有文字，并直接返回识别结果，不要包含任何其他解释。"
                    }
                ]
            }
        ],
        "stream": False
    }

    try:
        response = requests.post(ZHIPU_URL, headers=headers, json=payload, timeout=15)
        if response.status_code == 200:
            result = response.json()
            # 从返回结果中提取助手回复的文本内容
            text = result.get('choices', [{}])[0].get('message', {}).get('content', '')
            return text.strip()
        else:
            print(f"智谱 API 错误: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"调用智谱 API 异常: {str(e)}")
        return None
# 在您的认证接口中使用该函数
@auth_bp.route('/verify', methods=['POST'])
@jwt_required()
def verify():
    user_id = get_jwt_identity()
    identity_type = request.form.get('identity_type')
    student_id = request.form.get('student_id')
    name = request.form.get('name')
    file = request.files.get('file')  # 获取上传的图片文件

    if not all([identity_type, student_id, name, file]):
        return jsonify({'code': 400, 'message': '缺少必要参数或文件'}), 400

    img_data = file.read()
    ocr_text = extract_text_from_image(img_data)

    if not ocr_text:
        return jsonify({'code': 410, 'message': 'OCR识别失败，请重新上传清晰图片'}), 200

    # 简单校验：用户填写的姓名和学号是否都出现在识别文本中
    if name not in ocr_text or student_id not in ocr_text:
        return jsonify({'code': 410, 'message': '证件信息与填写内容不一致，请重新上传'}), 200
    # 生成带前缀的ID
    prefix = 'S_' if identity_type == 'student' else 'T_'
    prefixed_id = prefix + student_id

    # 查询 sync_school 表
    school_record = SyncSchool.query.filter_by(prefixed_id=prefixed_id, name=name).first()
    if not school_record:
        return jsonify({'code': 404, 'message': '身份信息不在本学期备案名单'}), 404

    # 更新用户表
    user = User.query.get(user_id)
    if not user:
        return jsonify({'code': 404, 'message': '用户不存在'}), 404

    user.status = 'verified'
    user.identity_type = identity_type
    user.prefixed_id = prefixed_id
    user.real_name = name
    db.session.commit()

    return jsonify({
        'code': 0,
        'message': '认证成功',
        'data': {
            'user': user.to_dict()
        }
    })
import os
from werkzeug.utils import secure_filename

@auth_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_image():
    """上传图片，返回URL（临时开发用）"""
    if 'file' not in request.files:
        return jsonify({'code': 400, 'message': '没有文件'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'code': 400, 'message': '文件名为空'}), 400

    # 保存到本地 uploads 文件夹（需提前创建）
    filename = secure_filename(file.filename)
    save_path = os.path.join('uploads', filename)
    file.save(save_path)
    # 返回可访问的URL（开发环境可用 http://127.0.0.1:5000/uploads/xxx）
    file_url = request.host_url + 'uploads/' + filename
    return jsonify({'code': 0, 'url': file_url})