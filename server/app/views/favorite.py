from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.favorite import Favorite
from app.models.post import Post
from app.models.notification import Notification

favorite_bp = Blueprint('favorite', __name__, url_prefix='/api/favorite')

@favorite_bp.route('/check', methods=['GET'])
@jwt_required()
def check_favorite():
    user_id = get_jwt_identity()
    post_id = request.args.get('post_id', type=int)
    if not post_id:
        return jsonify({'code': 400, 'message': '缺少参数 post_id'}), 400
    favorite = Favorite.query.filter_by(user_id=user_id, post_id=post_id).first()
    return jsonify({'code': 0, 'data': {'is_favorited': favorite is not None}})

# app/views/favorite.py

@favorite_bp.route('/add', methods=['POST'])
@jwt_required()
def add_favorite():
    user_id = get_jwt_identity()
    data = request.get_json()
    post_id = data.get('post_id')
    if not post_id:
        return jsonify({'code': 400, 'message': '缺少参数 post_id'}), 400
    post = Post.query.get(post_id)
    if not post:
        return jsonify({'code': 404, 'message': '帖子不存在'}), 404
    if Favorite.query.filter_by(user_id=user_id, post_id=post_id).first():
        return jsonify({'code': 400, 'message': '已经收藏过了'}), 400
    favorite = Favorite(user_id=user_id, post_id=post_id)
    db.session.add(favorite)
    # 增加帖子的收藏计数
    post.favorite_count = (post.favorite_count or 0) + 1
    db.session.commit()
    return jsonify({'code': 0, 'message': '收藏成功'})

@favorite_bp.route('/remove', methods=['POST'])
@jwt_required()
def remove_favorite():
    user_id = get_jwt_identity()
    data = request.get_json()
    post_id = data.get('post_id')
    if not post_id:
        return jsonify({'code': 400, 'message': '缺少参数 post_id'}), 400
    favorite = Favorite.query.filter_by(user_id=user_id, post_id=post_id).first()
    if not favorite:
        return jsonify({'code': 400, 'message': '未收藏'}), 400
    db.session.delete(favorite)
    # 减少帖子的收藏计数，避免负数
    post = Post.query.get(post_id)
    if post:
        post.favorite_count = max((post.favorite_count or 0) - 1, 0)
    db.session.commit()
    return jsonify({'code': 0, 'message': '取消收藏成功'})

@favorite_bp.route('/list', methods=['GET'])
@jwt_required()
def get_favorite_list():
    print("进入 /list 函数")
    user_id = get_jwt_identity()
    print(f"user_id from token: {user_id}, type: {type(user_id)}")
    try:
        user_id = int(user_id)
    except:
        return jsonify({'code': 400, 'message': '无效的用户身份'}), 400

    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    type_ = request.args.get('type')
    keyword = request.args.get('keyword')

    # 先获取用户的所有收藏，按时间倒序
    query = Favorite.query.filter_by(user_id=user_id).order_by(Favorite.created_at.desc())
    total = query.count()  # 总收藏数（包括帖子已删除的）

    # 分页获取收藏记录
    favorites = query.offset((page - 1) * limit).limit(limit).all()

    data = []
    for fav in favorites:
        post = Post.query.get(fav.post_id)
        if not post:
            # 帖子已删除，跳过这条收藏（或可显示为“已删除”）
            continue
        # 类型过滤（在内存中执行）
        if type_ and post.type != type_:
            continue
        # 关键词过滤（在内存中执行）
        if keyword and keyword.lower() not in post.title.lower():
            continue
        data.append({
            'favorite_id': fav.id,
            'post_id': post.id,
            'title': post.title,
            'first_image': post.images[0] if post.images else None,
            'type': post.type,
            'type_text': {'lost': '寻物', 'found': '招领', 'sale': '出售', 'wanted': '求購'}.get(post.type, ''),
            'created_at': fav.created_at.strftime('%Y-%m-%d %H:%M')
        })

    # 注意：分页基于总收藏数，但返回的列表可能少于 limit（因为过滤掉了已删除的帖子）
    # 为了分页准确，更复杂的方案需要将过滤条件应用到查询，但先确保有数据显示
    return jsonify({'code': 0, 'data': {'list': data, 'total': total, 'page': page, 'limit': limit}})
@favorite_bp.route('/remove_batch', methods=['POST'])
@jwt_required()
def remove_favorite_batch():
    user_id = get_jwt_identity()
    data = request.get_json()
    favorite_ids = data.get('favorite_ids')
    if not favorite_ids or not isinstance(favorite_ids, list):
        return jsonify({'code': 400, 'message': '参数错误'}), 400
    favorites = Favorite.query.filter(Favorite.id.in_(favorite_ids), Favorite.user_id == user_id).all()
    if not favorites:
        return jsonify({'code': 404, 'message': '未找到收藏'}), 404
    for fav in favorites:
        db.session.delete(fav)
    db.session.commit()
    return jsonify({'code': 0, 'message': '取消收藏成功'})

def cancel_favorites_for_post(post_id):
    try:
        favorites = Favorite.query.filter_by(post_id=post_id).all()
        if not favorites:
            return
        for fav in favorites:
            notification = Notification(
                user_id=fav.user_id,
                type='favorite_cancel',
                title='收藏内容已变更',
                content='您收藏的帖子状态已更新，已自动取消收藏',
                data={'post_id': post_id}
            )
            db.session.add(notification)
            db.session.delete(fav)
        db.session.commit()
        print(f"成功取消帖子 {post_id} 的 {len(favorites)} 条收藏")
    except Exception as e:
        db.session.rollback()
        print(f"取消收藏失败: {e}")