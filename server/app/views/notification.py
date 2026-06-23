from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.notification import Notification

notification_bp = Blueprint('notification', __name__, url_prefix='/api/notification')

@notification_bp.route('/list', methods=['GET'])
@jwt_required()
def get_notifications():
    """获取当前用户的通知列表，支持分页和类型过滤"""
    user_id = get_jwt_identity()
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    type_ = request.args.get('type')  # 可选，如 'post_reject'

    query = Notification.query.filter_by(user_id=user_id)
    if type_:
        query = query.filter_by(type=type_)
    query = query.order_by(Notification.created_at.desc())

    total = query.count()
    notifications = query.offset((page-1)*limit).limit(limit).all()

    data = [{
        'id': n.id,
        'type': n.type,
        'title': n.title,
        'content': n.content,
        'data': n.data,
        'is_read': n.is_read,
        'created_at': n.created_at.strftime('%Y-%m-%d %H:%M')
    } for n in notifications]

    return jsonify({'code': 0, 'data': {'list': data, 'total': total, 'page': page, 'limit': limit}})

@notification_bp.route('/mark_read', methods=['POST'])
@jwt_required()
def mark_read():
    """标记通知为已读（单条或全部）"""
    user_id = get_jwt_identity()
    data = request.get_json()
    notification_id = data.get('notification_id')
    if notification_id:
        # 单条
        notification = Notification.query.filter_by(id=notification_id, user_id=user_id).first()
        if notification:
            notification.is_read = True
            db.session.commit()
        return jsonify({'code': 0})
    else:
        # 全部
        Notification.query.filter_by(user_id=user_id, is_read=False).update({'is_read': True})
        db.session.commit()
        return jsonify({'code': 0})

@notification_bp.route('/delete', methods=['POST'])
@jwt_required()
def delete_notification():
    """删除已读通知（支持批量）"""
    user_id = get_jwt_identity()
    data = request.get_json()
    ids = data.get('ids', [])
    if not ids:
        return jsonify({'code': 400, 'message': '缺少参数'}), 400
    Notification.query.filter(Notification.id.in_(ids), Notification.user_id == user_id, Notification.is_read == True).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({'code': 0})