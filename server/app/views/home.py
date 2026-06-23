from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.banner import Banner
from app.models.announcement import Announcement
from app.models.post import Post
from app.models.user import User
from app.models.user_behavior import UserBehavior
from sqlalchemy import func, desc, case
from datetime import datetime, timedelta
import random

home_bp = Blueprint('home', __name__, url_prefix='/api/home')

@home_bp.route('/announcements', methods=['GET'])
def get_announcements():
    """获取最新公告"""
    limit = request.args.get('limit', default=3, type=int)
    announcements = Announcement.query.filter_by(status='published')\
        .order_by(Announcement.publish_time.desc()).limit(limit).all()
    data = [{
        'id': a.id,
        'title': a.title,
        'publish_time': a.publish_time.strftime('%Y-%m-%d')
    } for a in announcements]
    return jsonify({'code': 0, 'data': data})

@home_bp.route('/lostfound', methods=['GET'])
def get_lostfound():
    """获取失物招领精选"""
    type_ = request.args.get('type', 'lost')
    limit = request.args.get('limit', default=12, type=int)

    query = Post.query.filter(
        Post.type == type_,
        Post.status.in_(['active', 'pending_confirm'])
    )
    if type_ == 'found':
        now = datetime.now()
        query = query.order_by(
            case(
                (Post.protection_end_time > now, 0),
                else_=1
            ),
            Post.created_at.desc()
        )
    else:
        query = query.order_by(Post.created_at.desc())

    posts = query.limit(limit).all()
    data = []
    for p in posts:
        is_protected = False
        if type_ == 'found' and p.protection_end_time and p.protection_end_time > datetime.now():
            is_protected = True
        data.append({
            'id': p.id,
            'images': p.images if p.images else [],
            'is_protected': is_protected
        })
    return jsonify({'code': 0, 'data': data})

@home_bp.route('/trade', methods=['GET'])
def get_trade():
    """获取二手交易精选"""
    type_ = request.args.get('type', 'sale')
    limit = request.args.get('limit', default=12, type=int)

    posts = Post.query.filter_by(type=type_, status='active')\
        .order_by((Post.view_count + Post.favorite_count*2).desc(), Post.created_at.desc())\
        .limit(limit).all()

    data = []
    for p in posts:
        price = str(p.price) if p.price else ''
        if type_ == 'wanted' and p.expected_price:
            price = str(p.expected_price)
        data.append({
            'id': p.id,
            'title': p.title,
            'images': p.images if p.images else [],
            'price': price
        })
    return jsonify({'code': 0, 'data': data})

@home_bp.route('/recommend', methods=['GET'])
@jwt_required(optional=True)
def get_recommend():
    user_id = get_jwt_identity()
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    since = datetime.now() - timedelta(days=30)
    offset = (page - 1) * limit
    interest_categories = []
    if user_id:
        behavior_stats = db.session.query(
            Post.category_id,
            func.sum(
                case(
                    (UserBehavior.behavior_type == 'view', 1),
                    (UserBehavior.behavior_type == 'favorite', 3),
                    (UserBehavior.behavior_type == 'share', 2),
                    else_=0
                )
            ).label('score')
        ).join(Post, UserBehavior.target_id == Post.id)\
         .filter(
             UserBehavior.user_id == user_id,
             UserBehavior.target_type == 'post',
             UserBehavior.created_at >= since,
             Post.category_id.isnot(None)
         ).group_by(Post.category_id)\
         .order_by(desc('score'))\
         .limit(3).all()
        post_stats = db.session.query(
            Post.category_id,
            func.count().label('score')
        ).filter(
            Post.user_id == user_id,
            Post.category_id.isnot(None)
        ).group_by(Post.category_id)\
         .order_by(desc('score'))\
         .limit(3).all()
        category_score = {}
        for cat_id, score in behavior_stats:
            category_score[cat_id] = category_score.get(cat_id, 0) + score
        for cat_id, score in post_stats:
            category_score[cat_id] = category_score.get(cat_id, 0) + score * 2
        sorted_cats = sorted(category_score.items(), key=lambda x: x[1], reverse=True)
        interest_categories = [cat_id for cat_id, _ in sorted_cats[:3]]
    base_query = None
    if interest_categories:
        base_query = Post.query.filter(
            Post.category_id.in_(interest_categories),
            Post.status == 'active'
        ).order_by((Post.view_count + Post.favorite_count * 2).desc())
    else:
        base_query = Post.query.filter_by(status='active')\
            .order_by((Post.view_count + Post.favorite_count * 2).desc())

    # 获取总数（用于分页）
    total = base_query.count()
    # 分页获取当前页数据
    posts = base_query.offset(offset).limit(limit).all()

    # 随机打乱（可选，保持多样性）
    random.shuffle(posts)

    data = []
    for post in posts:
        item = {
            'id': post.id,
            'title': post.title,
            'images': post.images if post.images else [],
            'created_at': post.created_at.strftime('%Y-%m-%d %H:%M'),
            'type': post.type,
            'time': post.created_at.strftime('%Y-%m-%d')
        }
        if post.type in ('sale', 'wanted'):
            item['price'] = str(post.price) if post.price else (str(post.expected_price) if post.expected_price else '')
        else:
            item['price'] = ''
        data.append(item)

    return jsonify({
        'code': 0,
        'data': {
            'list': data,
            'total': total,
            'page': page,
            'limit': limit,
            'has_more': offset + limit < total
        }
    })