from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.post import Post
from sqlalchemy import case, func
from datetime import datetime, timedelta

lostfound_bp = Blueprint('lostfound', __name__, url_prefix='/api/lostfound')

@lostfound_bp.route('/list', methods=['GET'])
def get_lostfound_list():
    # 获取参数
    type_ = request.args.get('type', 'lost')          # lost 或 found
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    category_id = request.args.get('category_id', type=int)
    location = request.args.get('location')
    time_range = request.args.get('time_range')       # 可选值：24h,3d,7d,14d

    # 基础查询：状态为 active，且类型匹配
    query = Post.query.filter(
        Post.type == type_,
        Post.status.in_(['active', 'pending_confirm'])
    )
    # 分类筛选
    if category_id:
        query = query.filter_by(category_id=category_id)

    # 地点筛选（模糊匹配或精确匹配，这里使用包含关系）
    if location and location != '全部':
        query = query.filter(Post.location.like(f'%{location}%'))

    # 时间范围筛选（基于 lost_time）
    if time_range:
        now = datetime.now()
        if time_range == '24h':
            time_limit = now - timedelta(hours=24)
        elif time_range == '3d':
            time_limit = now - timedelta(days=3)
        elif time_range == '7d':
            time_limit = now - timedelta(days=7)
        elif time_range == '14d':
            time_limit = now - timedelta(days=14)
        else:
            time_limit = None
        if time_limit:
            query = query.filter(Post.lost_time >= time_limit)

    # 排序
    now = datetime.now()
    if type_ == 'found':
        # 招领：保护期内的记录排前面（protection_end_time > now），然后按发布时间倒序
        query = query.order_by(
            case(
                (Post.protection_end_time > now, 0),
                else_=1
            ),
            Post.created_at.desc()
        )
    else:
        # 寻物：直接按发布时间倒序
        query = query.order_by(Post.created_at.desc())

    # 分页
    total = query.count()
    posts = query.offset((page-1)*limit).limit(limit).all()

    data = []
    for p in posts:
        # 判断是否在保护期（仅用于前端标记）
        is_protected = (type_ == 'found' and p.protection_end_time and p.protection_end_time > now)
        data.append({
            'id': p.id,
            'title': p.title,
            'images': p.images if p.images else [],
            'location': p.location,
            'lost_time': p.lost_time.strftime('%Y-%m-%d %H:%M') if p.lost_time else '',
            'created_at': p.created_at.strftime('%Y-%m-%d %H:%M'),
            'is_protected': is_protected
        })

    return jsonify({
        'code': 0,
        'data': {
            'list': data,
            'total': total,
            'page': page,
            'limit': limit,
            'has_more': (page * limit) < total
        }
    })