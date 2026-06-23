from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.post import Post
from sqlalchemy import case

myposts_bp = Blueprint('myposts', __name__, url_prefix='/api/myposts')

# 状态优先级（用于状态排序）
status_priority = {
    'active': 1,
    'completed': 2,
    'expired': 3,
    'off': 4,
    'pending': 5,
    'rejected': 6
}

@myposts_bp.route('/list', methods=['GET'])
@jwt_required()
def get_myposts():
    user_id = get_jwt_identity()
    status = request.args.get('status')          # 单个状态过滤
    post_type = request.args.get('type')         # 单个类型过滤
    sort = request.args.get('sort', 'time')      # time 或 status
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    offset = (page - 1) * limit

    query = Post.query.filter_by(user_id=user_id)

    if status:
        query = query.filter(Post.status == status)
    if post_type:
        query = query.filter(Post.type == post_type)

    if sort == 'status':
        # 按状态优先级排序，相同状态下按发布时间倒序
        query = query.order_by(
            case(
                *[(Post.status == k, v) for k, v in status_priority.items()],
                else_=999
            ),
            Post.created_at.desc()
        )
    else:
        query = query.order_by(Post.created_at.desc())

    total = query.count()
    posts = query.offset(offset).limit(limit).all()

    data = []
    for p in posts:
        first_image = p.images[0] if p.images else None
        data.append({
            'id': p.id,
            'title': p.title,
            'first_image': first_image,
            'type': p.type,
            'type_text': {
                'lost': '寻物',
                'found': '招领',
                'sale': '出售',
                'wanted': '求购'
            }.get(p.type, ''),
            'status': p.status,
            'status_text': {
                'pending': '待审核',
                'active': '进行中',
                'completed': '已完成',
                'expired': '已过期',
                'off': '已下架',
                'rejected': '已驳回'
            }.get(p.status, p.status),
            'created_at': p.created_at.strftime('%Y-%m-%d %H:%M')
        })

    return jsonify({
        'code': 0,
        'data': {
            'list': data,
            'total': total,
            'page': page,
            'limit': limit
        }
    })