from app.models.favorite import Favorite
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.post import Post
from app.models.user import User
from app.models.notification import Notification  # 确保已导入
from app.utils.audit import strict_audit_post_content
from datetime import datetime, timedelta
from app.views.favorite import cancel_favorites_for_post

post_bp = Blueprint('post', __name__, url_prefix='/api/post')

@post_bp.route('/create', methods=['POST'])
@jwt_required()
def create_post():
    global datetime
    user_id_str = get_jwt_identity()
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        # 真正的请求错误仍返回 400
        return jsonify({
            'code': 400,
            'message': '用户ID格式错误'
        }), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({
            'code': 404,
            'message': '用户不存在'
        }), 404

    data = request.get_json()
    required_fields = ['type', 'category_id', 'title', 'description', 'expiry_days']
    for field in required_fields:
        if field not in data:
            # 真正的参数错误仍返回 400
            return jsonify({
                'code': 400,
                'message': f'缺少字段 {field}'
            }), 400

    # ======== 核心修改：敏感词拦截返回 200 HTTP 状态码 ========
    audit_result = strict_audit_post_content({
        'title': data['title'],
        'description': data['description']
    })
    if not audit_result['passed']:
        # HTTP 状态码改为 200，业务码用 1001 标识敏感词拦截
        return jsonify({
            'code': 1001,  # 自定义业务码：敏感词拦截
            'message': audit_result['reason']
        }), 200  # 关键：HTTP 状态码改为 200

    # 以下正常创建帖子的逻辑不变...
    images = data.get('images', [])
    if not isinstance(images, list):
        return jsonify({
            'code': 400,
            'message': 'images 必须为数组'
        }), 400

    lost_time = None
    if data.get('lost_time'):
        try:
            from datetime import datetime
            lost_time = datetime.strptime(data['lost_time'], '%Y-%m-%d %H:%M:%S')
        except:
            return jsonify({
                'code': 400,
                'message': '时间格式错误'
            }), 400

    price = None
    if data.get('price'):
        try:
            price = float(data['price'])
        except:
            return jsonify({
                'code': 400,
                'message': '价格格式错误'
            }), 400

    post = Post(
        user_id=user_id,
        type=data['type'],
        category_id=data['category_id'],
        title=data['title'],
        description=data['description'],
        images=images,
        location=data.get('location'),
        lost_time=lost_time,
        expiry_days=data['expiry_days'],
        price=price,
        condition=data.get('condition'),
        expected_condition=data.get('expected_condition'),
        status='active'
    )

    db.session.add(post)
    db.session.flush()

    post.published_at = datetime.now()
    post.expiry_time = datetime.now() + timedelta(days=data['expiry_days'])

    quick_claim_result = None
    if data['type'] == 'found' and data.get('quick_claim_student_id'):
        student_id = data['quick_claim_student_id'].strip()
        if student_id:
            prefixed_id = f"S_{student_id}"
            target_user = User.query.filter_by(prefixed_id=prefixed_id, status='verified').first()
            if target_user:
                notification = Notification(
                    user_id=target_user.id,
                    type='quick_claim',
                    title='证件招领提醒',
                    content='有人捡到了你的证件，请点击查看',
                    data={'post_id': post.id}
                )
                db.session.add(notification)
                quick_claim_result = {'found': True, 'message': '已通知失主'}
            else:
                quick_claim_result = {'found': False, 'message': '未找到对应用户或用户状态异常'}

    db.session.commit()

    # 正常提交返回业务码 0
    return jsonify({
        'code': 0,
        'message': '发布成功，审核通过',
        'data': {
            'id': post.id,
            'status': post.status,
            'quick_claim_result': quick_claim_result
        }
    }), 200
@post_bp.route('/detail', methods=['GET'])
@jwt_required(optional=True)
def get_post_detail():

    """获取帖子详情（允许未登录访问）"""
    # 先获取原始字符串
    id_str = request.args.get('id')
    print(f"Raw id param: {request.args.get('id')}")
    if not id_str:
        return jsonify({'code': 400, 'message': '缺少参数 id'}), 400
    try:
        post_id = int(id_str)
    except ValueError:
        return jsonify({'code': 400, 'message': 'id 必须是整数'}), 400

    post = Post.query.get(post_id)
    if not post:
        return jsonify({'code': 404, 'message': '帖子不存在'}), 404

    # 获取当前用户ID（可能为None）
    current_user_id = get_jwt_identity()
    is_favorited = False
    if current_user_id:
        favorite = Favorite.query.filter_by(user_id=current_user_id, post_id=post_id).first()
        is_favorited = favorite is not None

    # 发布者信息
    user = post.user
    if not user:
        user_info = None
    else:
        credit_score = user.credit_score
        if credit_score >= 90:
            credit_level = '优秀'
        elif credit_score >= 70:
            credit_level = '良好'
        elif credit_score >= 60:
            credit_level = '一般'
        else:
            credit_level = '较差'

        # 荣誉称号（根据奖励积分）
        reward_points = user.reward_points
        if reward_points >= 200:
            honor = '公益之星'
        elif reward_points >= 150:
            honor = '校园雷锋'
        elif reward_points >= 60:
            honor = '暖心达人'
        elif reward_points >= 10:
            honor = '拾光者'
        else:
            honor = None

        user_info = {
            'id': user.id,
            'nickname': user.nickname,
            'avatar': user.avatar,
            'credit_score': credit_score,
            'credit_level': credit_level,
            'honor': honor
        }

    # 构造返回数据
    data = {
        'id': post.id,
        'type': post.type,
        'title': post.title,
        'description': post.description,
        'images': post.images if post.images else [],
        'status': post.status,
        'location': post.location,
        'lost_time': post.lost_time.strftime('%Y-%m-%d %H:%M') if post.lost_time else None,
        'expiry_days': post.expiry_days,
        'created_at': post.created_at.strftime('%Y-%m-%d %H:%M'),
        'price': str(post.price) if post.price else None,
        'expected_price': str(post.expected_price) if post.expected_price else None,
        'condition': post.condition,
        'expected_condition': post.expected_condition,
        'protection_end_time': post.protection_end_time.strftime('%Y-%m-%d %H:%M') if post.protection_end_time else None,
        'user': user_info,
        'is_favorited': is_favorited
    }
    return jsonify({'code': 0, 'data': data})
@post_bp.route('/off', methods=['POST'])
@jwt_required()
def off_post():
    """下架帖子（仅发布者本人，且状态为进行中）"""
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except ValueError:
        return jsonify({'code': 400, 'message': '无效的用户身份'}), 400

    data = request.get_json()
    post_id = data.get('post_id')
    if not post_id:
        return jsonify({'code': 400, 'message': '缺少参数 post_id'}), 400

    post = Post.query.get(post_id)
    if not post:
        return jsonify({'code': 404, 'message': '帖子不存在'}), 404
    if post.user_id != user_id:
        return jsonify({'code': 403, 'message': '无权限操作'}), 403
    if post.status != 'active':
        return jsonify({'code': 400, 'message': '只有进行中的帖子可以下架'}), 400

    post.status = 'off'
    db.session.commit()
    cancel_favorites_for_post(post.id)
    return jsonify({'code': 0, 'message': '已下架'})
@post_bp.route('/delete', methods=['POST'])
@jwt_required()
def delete_post():
    """删除帖子（仅发布者本人，且状态为 completed/expired/off）"""
    user_id = get_jwt_identity()
    data = request.get_json()
    post_id = data.get('post_id')
    if not post_id:
        return jsonify({'code': 400, 'message': '缺少参数 post_id'}), 400

    post = Post.query.get(post_id)
    if not post:
        return jsonify({'code': 404, 'message': '帖子不存在'}), 404
    if post.user_id != user_id:
        return jsonify({'code': 403, 'message': '无权限操作'}), 403
    if post.status not in ['completed', 'expired', 'off']:
        return jsonify({'code': 400, 'message': '当前状态不允许删除'}), 400

    cancel_favorites_for_post(post.id)   # 先取消收藏
    db.session.delete(post)
    db.session.commit()
    return jsonify({'code': 0, 'message': '删除成功'})
@post_bp.route('/repost', methods=['POST'])
@jwt_required()
def repost():
    """重新发布（仅发布者本人，且状态为 expired）"""
    user_id = get_jwt_identity()
    data = request.get_json()
    post_id = data.get('post_id')
    if not post_id:
        return jsonify({'code': 400, 'message': '缺少参数 post_id'}), 400

    post = Post.query.get(post_id)
    if not post:
        return jsonify({'code': 404, 'message': '帖子不存在'}), 404
    if post.user_id != user_id:
        return jsonify({'code': 403, 'message': '无权限操作'}), 403
    if post.status != 'expired':
        return jsonify({'code': 400, 'message': '只有已过期的帖子可以重新发布'}), 400

    post.status = 'active'
    post.published_at = datetime.now()
    post.expiry_time = post.published_at + timedelta(days=post.expiry_days)
    db.session.commit()
    return jsonify({'code': 0, 'message': '已重新发布', 'data': {'id': post.id, 'status': post.status}})
