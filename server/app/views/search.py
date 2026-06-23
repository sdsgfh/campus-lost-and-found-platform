from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.post import Post
from app.models.search_history import SearchHistory
from sqlalchemy import or_, case, func
from datetime import datetime, timedelta

search_bp = Blueprint('search', __name__, url_prefix='/api/search')
@search_bp.route('', methods=['GET'])
@jwt_required()
def search():
    user_id = get_jwt_identity()
    keyword = request.args.get('keyword', '').strip()
    if not keyword:
        return jsonify({'code': 400, 'message': '关键词不能为空'}), 400
    if len(keyword) > 20:
        return jsonify({'code': 400, 'message': '关键词过长'}), 400

    type_ = request.args.get('type')  # 可为空，表示所有类型
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    offset = (page - 1) * limit

    # 构建基础查询（只搜索已发布的帖子）
    query = Post.query.filter(Post.status == 'active')

    # 类型过滤
    if type_:
        query = query.filter(Post.type == type_)

    # 关键词匹配：标题包含或描述包含
    keyword_like = f'%{keyword}%'
    query = query.filter(
        or_(
            Post.title.ilike(keyword_like),
            Post.description.ilike(keyword_like)
        )
    )

    # 按匹配度排序
    order_case = case(
        (Post.title == keyword, 3),           # 完全匹配
        (Post.title.ilike(keyword_like), 2),  # 标题包含
        else_=1                                # 描述包含
    ).desc()

    # 先按匹配度，再按发布时间倒序
    query = query.order_by(order_case, Post.created_at.desc())

    # 分页
    total = query.count()
    posts = query.offset(offset).limit(limit).all()

    data = []
    for p in posts:
        type_text = {
            'lost': '寻物',
            'found': '招领',
            'sale': '出售',
            'wanted': '求购'
        }.get(p.type, '')
        data.append({
            'id': p.id,
            'title': p.title,
            'images': p.images if p.images else [],
            'type': p.type,
            'typeText': type_text,
            'created_at': p.created_at.strftime('%Y-%m-%d %H:%M')
        })

    # 记录搜索历史（即使失败也不影响搜索结果）
    try:
        history = SearchHistory(keyword=keyword, user_id=user_id)
        db.session.add(history)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        # 可添加日志记录错误，但不影响返回
        print(f"记录搜索历史失败: {e}")

    return jsonify({
        'code': 0,
        'data': {
            'list': data,
            'total': total,
            'page': page,
            'limit': limit
        }
    })

@search_bp.route('/hot', methods=['GET'])
def hot_keywords():
    """获取热门搜索关键词（最近7天频率最高的前10个）"""
    since = datetime.now() - timedelta(days=7)
    results = db.session.query(
        SearchHistory.keyword,
        func.count().label('cnt')
    ).filter(
        SearchHistory.created_at >= since
    ).group_by(
        SearchHistory.keyword
    ).order_by(
        func.count().desc()
    ).limit(10).all()
    keywords = [r.keyword for r in results]
    return jsonify({'code': 0, 'data': keywords})