from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from datetime import date, datetime
import os
import uuid
import traceback

user_bp = Blueprint('user', __name__, url_prefix='/api/user')

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ========== 修复昵称/简介入库 ==========
@user_bp.route('/update_info', methods=['POST'])
@jwt_required()
def update_info():
    try:
        # 1. 基础校验
        user_id = get_jwt_identity()
        user_id = int(user_id)
        # 强制刷新数据库会话，避免缓存问题
        db.session.expire_all()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'code': 404, 'message': '用户不存在'}), 404

        # 2. 获取参数并严格校验
        data = request.get_json() or {}
        nickname = data.get('nickname', '').strip()
        bio = data.get('bio', '').strip()

        if not nickname:
            return jsonify({'code': 400, 'message': '昵称不能为空'}), 400
        if len(nickname) > 50:
            return jsonify({'code': 400, 'message': '昵称不能超过50字'}), 400
        if len(bio) > 100:
            return jsonify({'code': 400, 'message': '简介不能超过100字'}), 400

        # 3. 打印修改前数据（调试）
        print(f"修改前 - 用户ID:{user_id} 昵称:{user.nickname} 简介:{user.bio}")

        # 4. 强制更新字段
        user.nickname = nickname
        user.bio = bio
        user.updated_at = datetime.now()

        # 5. 强制提交（关键：增加 flush + commit + refresh）
        try:
            db.session.flush()  # 先刷入数据库，检测字段错误
            db.session.commit()  # 提交修改
            db.session.refresh(user)  # 刷新用户实例，获取最新数据
            print(f"修改后 - 用户ID:{user_id} 昵称:{user.nickname} 简介:{user.bio}")
        except Exception as commit_err:
            db.session.rollback()
            print(f"昵称/简介提交失败：{str(commit_err)}")
            return jsonify({'code': 400, 'message': f'保存失败：{str(commit_err)}'}), 400

        # 6. 返回结果
        return jsonify({
            'code': 0,
            'message': '更新成功',
            'data': {
                'nickname': user.nickname,
                'bio': user.bio,
                'avatar': user.avatar or '/images/default-avatar.png',
                'status': user.status
            }
        })

    except Exception as e:
        db.session.rollback()
        print(f"更新用户信息报错：{str(e)}")
        print(traceback.format_exc())
        return jsonify({'code': 400, 'message': f'更新失败：{str(e)}'}), 400

# ========== 修复头像入库 ==========
@user_bp.route('/update_avatar', methods=['POST'])
@jwt_required()
def update_avatar():
    try:
        # 1. 基础校验
        user_id = get_jwt_identity()
        user_id = int(user_id)
        db.session.expire_all()  # 刷新会话，避免缓存
        user = User.query.get(user_id)
        if not user:
            return jsonify({'code': 404, 'message': '用户不存在'}), 404

        # 2. 校验文件
        if 'avatar' not in request.files:
            return jsonify({'code': 400, 'message': '请选择上传的图片'}), 400
        file = request.files['avatar']
        if file.filename == '':
            return jsonify({'code': 400, 'message': '文件名不能为空'}), 400
        if not allowed_file(file.filename):
            return jsonify({'code': 400, 'message': '仅支持png/jpg/jpeg格式'}), 400

        # 3. 确保上传文件夹存在
        upload_folder = os.path.abspath(os.path.join(current_app.root_path, '../uploads'))
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder, exist_ok=True)
            if os.name == 'nt':
                import ctypes
                try:
                    ctypes.windll.kernel32.SetFileAttributesW(upload_folder, 0x80)
                except:
                    pass

        # 4. 生成文件名并保存
        ext = file.filename.rsplit('.', 1)[1].lower()
        new_filename = f"avatar_{user_id}_{uuid.uuid4().hex[:8]}.{ext}"
        save_path = os.path.join(upload_folder, new_filename)

        try:
            file.save(save_path)
            print(f"头像保存路径：{save_path}")
        except Exception as save_err:
            return jsonify({'code': 400, 'message': f'文件保存失败：{str(save_err)}'}), 400

        # 5. 拼接URL
        avatar_url = f"http://127.0.0.1:5000/uploads/{new_filename}"

        # 6. 打印修改前头像（调试）
        print(f"修改前 - 用户ID:{user_id} 头像:{user.avatar}")

        # 7. 强制更新头像 + 提交（核心修复）
        user.avatar = avatar_url
        user.updated_at = datetime.now()

        try:
            db.session.flush()
            db.session.commit()
            db.session.refresh(user)  # 刷新实例，确认修改
            print(f"修改后 - 用户ID:{user_id} 头像:{user.avatar}")
        except Exception as commit_err:
            db.session.rollback()
            print(f"头像提交失败：{str(commit_err)}")
            return jsonify({'code': 400, 'message': f'头像保存失败：{str(commit_err)}'}), 400

        # 8. 返回结果
        return jsonify({
            'code': 0,
            'message': '头像更新成功',
            'data': {'avatar': user.avatar}  # 返回数据库中实际的头像URL
        })

    except Exception as e:
        db.session.rollback()
        print(f"更新头像报错：{str(e)}")
        print(traceback.format_exc())
        return jsonify({'code': 400, 'message': f'头像更新失败：{str(e)}'}), 400

@user_bp.route('/get_latest_info', methods=['GET'])
@jwt_required()
def get_latest_info():
    try:
        user_id = get_jwt_identity()
        user_id = int(user_id)
        db.session.expire_all()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'code': 404, 'message': '用户不存在'}), 404

        return jsonify({
            'code': 0,
            'data': {
                'id': user.id,
                'nickname': user.nickname or '微信用户',
                'avatar': user.avatar or '/images/default-avatar.png',
                'bio': user.bio or '',
                'status': user.status,
                'prefixed_id': user.prefixed_id,
                'real_name': user.real_name,
                'credit_score': user.credit_score,
                'honor': user.honor
            }
        })
    except Exception as e:
        print(f"获取用户信息报错：{str(e)}")
        return jsonify({'code': 400, 'message': f'获取信息失败：{str(e)}'}), 400


@user_bp.route('/cancel', methods=['POST'])
@jwt_required()
def cancel_account():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'code': 404, 'message': '用户不存在'}), 404

        data = request.get_json()
        student_id = data.get('student_id')
        name = data.get('name')

        if user.prefixed_id != student_id or user.real_name != name:
            return jsonify({'code': 400, 'message': '身份信息错误'}), 400

        user.status = 'cancelled'
        user.nickname = '已注销用户'
        user.bio = ''
        user.prefixed_id = None
        user.real_name = None
        user.updated_at = datetime.now()

        db.session.commit()
        return jsonify({'code': 0, 'message': '账号已注销'})
    except Exception as e:
        db.session.rollback()
        print(f"注销账号报错：{str(e)}")
        return jsonify({'code': 400, 'message': f'注销失败：{str(e)}'}), 400


@user_bp.route('/other', methods=['GET'])
@jwt_required()
def get_other_user():
    try:
        target_user_id = request.args.get('user_id', type=int)
        if not target_user_id:
            return jsonify({'code': 400, 'message': '缺少参数 user_id'}), 400

        user = User.query.get(target_user_id)
        if not user:
            return jsonify({'code': 404, 'message': '用户不存在'}), 404

        credit_score = user.credit_score
        if credit_score >= 90:
            credit_level = '优秀'
        elif credit_score >= 70:
            credit_level = '良好'
        elif credit_score >= 60:
            credit_level = '一般'
        else:
            credit_level = '较差'

        data = {
            'id': user.id,
            'nickname': user.nickname or '微信用户',
            'avatar': user.avatar or '/images/default-avatar.png',
            'credit_score': credit_score,
            'credit_level': credit_level,
            'honor': user.honor,
            'status': user.status
        }
        return jsonify({'code': 0, 'data': data})
    except Exception as e:
        return jsonify({'code': 400, 'message': f'获取用户信息失败：{str(e)}'}), 400


@user_bp.route('/info', methods=['GET'])
@jwt_required()
def get_user_info():
    try:
        target_user_id = request.args.get('user_id', type=int)
        if not target_user_id:
            return jsonify({'code': 400, 'message': '缺少参数 user_id'}), 400

        user = User.query.get(target_user_id)
        if not user:
            return jsonify({'code': 404, 'message': '用户不存在'}), 404

        credit_score = user.credit_score
        if credit_score >= 90:
            credit_level = '优秀'
        elif credit_score >= 70:
            credit_level = '良好'
        elif credit_score >= 60:
            credit_level = '一般'
        else:
            credit_level = '较差'

        data = {
            'id': user.id,
            'nickname': user.nickname or '微信用户',
            'avatar': user.avatar or '/images/default-avatar.png',
            'credit_score': credit_score,
            'credit_level': credit_level,
            'honor': user.honor,
            'status': user.status
        }
        return jsonify({'code': 0, 'data': data})
    except Exception as e:
        return jsonify({'code': 400, 'message': f'获取用户信息失败：{str(e)}'}), 400