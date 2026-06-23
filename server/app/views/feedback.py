from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.feedback import Feedback
from datetime import datetime

feedback_bp = Blueprint('feedback', __name__, url_prefix='/api/feedback')

@feedback_bp.route('/create', methods=['POST'])
@jwt_required()
def create_feedback():
    user_id = get_jwt_identity()
    data = request.get_json()
    content = data.get('content')
    images = data.get('images', [])

    if not content or len(content) > 300:
        return jsonify({'code': 400, 'message': '内容不能为空且不能超过300字'}), 400
    if len(images) > 3:
        return jsonify({'code': 400, 'message': '最多上传3张图片'}), 400

    feedback = Feedback(
        user_id=user_id,
        content=content,
        images=images,
        status='pending'
    )
    db.session.add(feedback)
    db.session.commit()

    return jsonify({'code': 0, 'message': '提交成功', 'data': {'id': feedback.id}})

@feedback_bp.route('/list', methods=['GET'])
@jwt_required()
def get_feedback_list():
    user_id = get_jwt_identity()
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))

    query = Feedback.query.filter_by(user_id=user_id).order_by(Feedback.created_at.desc())
    total = query.count()
    items = query.offset((page-1)*limit).limit(limit).all()

    data = []
    for f in items:
        data.append({
            'id': f.id,
            'content': f.content[:50] + ('...' if len(f.content) > 50 else ''),  # 摘要
            'images': f.images,
            'status': f.status,
            'status_text': '待处理' if f.status == 'pending' else '已回复',
            'reply_content': f.reply_content,
            'reply_time': f.reply_time.strftime('%Y-%m-%d %H:%M') if f.reply_time else None,
            'created_at': f.created_at.strftime('%Y-%m-%d %H:%M')
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

@feedback_bp.route('/detail', methods=['GET'])
@jwt_required()
def get_feedback_detail():
    user_id = get_jwt_identity()
    feedback_id = request.args.get('id', type=int)
    if not feedback_id:
        return jsonify({'code': 400, 'message': '缺少id'}), 400

    feedback = Feedback.query.filter_by(id=feedback_id, user_id=user_id).first()
    if not feedback:
        return jsonify({'code': 404, 'message': '反馈不存在'}), 404

    data = {
        'id': feedback.id,
        'content': feedback.content,
        'images': feedback.images,
        'status': feedback.status,
        'status_text': '待处理' if feedback.status == 'pending' else '已回复',
        'reply_content': feedback.reply_content,
        'reply_time': feedback.reply_time.strftime('%Y-%m-%d %H:%M') if feedback.reply_time else None,
        'created_at': feedback.created_at.strftime('%Y-%m-%d %H:%M')
    }
    return jsonify({'code': 0, 'data': data})