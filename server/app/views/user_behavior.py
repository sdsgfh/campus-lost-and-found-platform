from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user_behavior import UserBehavior
from app.models.post import Post
user_behavior_bp = Blueprint('user_behavior', __name__, url_prefix='/api/behavior')

# app/views/user_behavior.py

@user_behavior_bp.route('/record', methods=['POST'])
@jwt_required()
def record_behavior():
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except:
        return jsonify({'code': 400, 'message': '无效的用户身份'}), 400

    data = request.get_json()
    behavior_type = data.get('behavior_type')
    target_id = data.get('target_id')
    target_type = data.get('target_type', 'post')

    if behavior_type not in ['view', 'favorite', 'share']:
        return jsonify({'code': 400, 'message': 'behavior_type 必须为 view/favorite/share'}), 400
    if not target_id:
        return jsonify({'code': 400, 'message': '缺少 target_id'}), 400
    try:
        target_id = int(target_id)
    except:
        return jsonify({'code': 400, 'message': 'target_id 必须是整数'}), 400
    if target_type != 'post':
        return jsonify({'code': 400, 'message': '目前仅支持 target_type=post'}), 400

    # 创建行为记录
    behavior = UserBehavior(
        user_id=user_id,
        behavior_type=behavior_type,
        target_type=target_type,
        target_id=target_id
    )
    db.session.add(behavior)

    # 如果是浏览行为，更新帖子的 view_count
    if behavior_type == 'view':
        post = Post.query.get(target_id)
        if post:
            post.view_count = (post.view_count or 0) + 1

    db.session.commit()
    return jsonify({'code': 0, 'message': '记录成功'})