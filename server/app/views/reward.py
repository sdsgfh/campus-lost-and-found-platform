from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.reward_point_log import RewardPointLog
from datetime import date

reward_bp = Blueprint('reward', __name__, url_prefix='/api/reward')

@reward_bp.route('/info', methods=['GET'])
@jwt_required()
def get_reward_info():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'code': 404, 'message': '用户不存在'}), 404

    # 今日已获积分
    today = date.today()
    if user.last_reward_date == today:
        today_points = user.daily_reward_points
    else:
        today_points = 0

    # 当前称号
    honor = user.honor if hasattr(user, 'honor') else None

    # 下一个称号所需积分
    next_honor = None
    next_points = None
    if user.credit_score >= 60:
        if user.reward_points < 10:
            next_honor = '拾光者'
            next_points = 10
        elif user.reward_points < 60:
            next_honor = '暖心达人'
            next_points = 60
        elif user.reward_points < 150:
            next_honor = '校园雷锋'
            next_points = 150
        elif user.reward_points < 200:
            next_honor = '公益之星'
            next_points = 200
        else:
            next_honor = '已满级'
    else:
        next_honor = '信誉分不足'
        next_points = None

    return jsonify({
        'code': 0,
        'data': {
            'points': user.reward_points,
            'honor': honor,
            'today_points': today_points,
            'max_daily': 20,
            'next_honor': next_honor,
            'next_points': next_points,
            'credit_score': user.credit_score
        }
    })

@reward_bp.route('/logs', methods=['GET'])
@jwt_required()
def get_reward_logs():
    user_id = get_jwt_identity()
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))

    query = RewardPointLog.query.filter_by(user_id=user_id).order_by(RewardPointLog.created_at.desc())
    total = query.count()
    logs = query.offset((page-1)*limit).limit(limit).all()

    data = [{
        'id': log.id,
        'change': log.change,
        'reason': log.reason,
        'related_id': log.related_id,
        'created_at': log.created_at.strftime('%Y-%m-%d %H:%M')
    } for log in logs]

    return jsonify({
        'code': 0,
        'data': {
            'list': data,
            'total': total,
            'page': page,
            'limit': limit
        }
    })