from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.announcement import Announcement

announcement_bp = Blueprint('announcement', __name__, url_prefix='/api/announcement')

@announcement_bp.route('/list', methods=['GET'])
def get_announcement_list():
    """获取公告列表，支持分页，按发布时间倒序"""
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    offset = (page - 1) * limit

    query = Announcement.query.filter_by(status='published').order_by(Announcement.publish_time.desc())
    total = query.count()
    announcements = query.offset(offset).limit(limit).all()

    data = [{
        'id': a.id,
        'title': a.title,
        'content': a.content,
        'publish_time': a.publish_time.strftime('%Y-%m-%d %H:%M'),
        'created_at': a.created_at.strftime('%Y-%m-%d %H:%M')
    } for a in announcements]

    return jsonify({
        'code': 0,
        'data': {
            'list': data,
            'total': total,
            'page': page,
            'limit': limit
        }
    })

@announcement_bp.route('/detail', methods=['GET'])
def get_announcement_detail():
    """获取单条公告详情"""
    announcement_id = request.args.get('id', type=int)
    if not announcement_id:
        return jsonify({'code': 400, 'message': '缺少参数 id'}), 400
    announcement = Announcement.query.get(announcement_id)
    if not announcement:
        return jsonify({'code': 404, 'message': '公告不存在'}), 404
    data = {
        'id': announcement.id,
        'title': announcement.title,
        'content': announcement.content,
        'publish_time': announcement.publish_time.strftime('%Y-%m-%d %H:%M'),
        'created_at': announcement.created_at.strftime('%Y-%m-%d %H:%M')
    }
    return jsonify({'code': 0, 'data': data})