from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.credit_log import CreditLog
from app.utils.credit import get_credit_level

credit_bp = Blueprint('credit', __name__, url_prefix='/api/credit')
def get_credit_level(score):
    """根据信誉分返回等级和描述"""
    if score >= 90:
        return '优秀', '发布上限提升（每日10条）'
    elif score >= 70:
        return '良好', '正常平台权限（发布上限每日6条）'
    elif score >= 60:
        return '一般', '发布上限降低（每日最多3条）'
    elif score > 0:
        return '较差', '限制发布权限（每日最多1条）'
    else:
        return '已封禁', '无发布权限'
@credit_bp.route('/info', methods=['GET'])
@jwt_required()
def get_credit_info():
    """获取当前用户的信誉分、等级、权益说明"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'code': 404, 'message': '用户不存在'}), 404

    level, description = get_credit_level(user.credit_score)

    return jsonify({
        'code': 0,
        'data': {
            'credit_score': user.credit_score,
            'level': level,
            'description': description,
            'daily_post_limit': get_daily_post_limit(user.credit_score)  # 计算每日发布上限
        }
    })

def get_daily_post_limit(score):
    if score >= 90:
        return 10
    elif score >= 70:
        return 6
    elif score >= 60:
        return 3
    elif score > 0:
        return 1
    else:
        return 0
@credit_bp.route('/logs', methods=['GET'])
@jwt_required()
def get_credit_logs():
    user_id = get_jwt_identity()
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    type_filter = request.args.get('type', 'all')  # all, add, deduct

    query = CreditLog.query.filter_by(user_id=user_id)
    if type_filter == 'add':
        query = query.filter(CreditLog.change > 0)
    elif type_filter == 'deduct':
        query = query.filter(CreditLog.change < 0)

    total = query.count()
    logs = query.order_by(CreditLog.created_at.desc()).offset((page-1)*limit).limit(limit).all()

    data = []
    for log in logs:
        data.append({
            'id': log.id,
            'change': log.change,
            'reason': log.reason,
            'created_at': log.created_at.strftime('%Y-%m-%d %H:%M'),
            'type': 'add' if log.change > 0 else 'deduct'
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

@credit_bp.route('/rules', methods=['GET'])
def get_rules():
    # 返回静态规则文本，或从数据库读取
    rules = {
        'add': [
            {'reason': '举报违规内容/用户，审核成立', 'score': 2, 'limit': '每日最多2次，同一用户24小时内仅一次'},
            {'reason': '连续14天无违规行为', 'score': 5},
            {'reason': '连续30天无违规行为', 'score': 10}
        ],
        'deduct': [
            {'reason': '发布虚假信息', 'score': 15},
            {'reason': '冒领他人物品（申诉成立）', 'score': 20},
            {'reason': '诈骗、卖假货（投诉审核成立）', 'score': 15},
            {'reason': '恶意举报', 'score': 10},
            {'reason': '聊天中发送违规内容、联系方式', 'score': 5}
        ]
    }
    return jsonify({'code': 0, 'data': rules})

from app.extensions import db
from app.models.user import User
from app.models.credit_log import CreditLog
from datetime import datetime

def add_credit(user_id, change, reason, related_id=None):
    """
    增加信誉分，确保不超过100分
    """
    user = User.query.get(user_id)
    if not user:
        return False
    # 加分不超过100
    new_score = min(user.credit_score + change, 100)
    actual_change = new_score - user.credit_score
    if actual_change <= 0:
        return True  # 无变动
    user.credit_score = new_score
    log = CreditLog(user_id=user_id, change=actual_change, reason=reason, related_id=related_id)
    db.session.add(log)
    db.session.commit()
    return True

def deduct_credit(user_id, change, reason, related_id=None):
    """
    扣除信誉分，若扣至0分则封禁用户
    """
    user = User.query.get(user_id)
    if not user:
        return False
    new_score = user.credit_score + change  # change为负数
    if new_score <= 0:
        user.credit_score = 0
        user.status = 'banned'
        # 记录扣分
        log = CreditLog(user_id=user_id, change=-user.credit_score, reason=reason, related_id=related_id)
        db.session.add(log)
        db.session.commit()
        # 这里可以触发封禁通知等
        return True
    else:
        user.credit_score = new_score
        log = CreditLog(user_id=user_id, change=change, reason=reason, related_id=related_id)
        db.session.add(log)
        db.session.commit()
        return True
# app/utils/credit.py
from app.extensions import db
from app.models.user import User
from app.models.credit_log import CreditLog
from app.models.reward_point_log import RewardPointLog
from datetime import datetime, timedelta, date

def check_and_award_continuous_no_violation():
    """
    定时任务：检查所有用户最近是否有扣分记录，根据连续无违规天数给予加分。
    每天凌晨2点执行。
    """
    today = date.today()
    # 计算14天和30天前的日期
    date_14_days_ago = today - timedelta(days=14)
    date_30_days_ago = today - timedelta(days=30)

    # 获取所有状态正常的用户（未封禁）
    users = User.query.filter(User.status != 'banned').all()

    for user in users:
        # 查询14天内是否有扣分记录（change < 0）
        has_14d_violation = CreditLog.query.filter(
            CreditLog.user_id == user.id,
            CreditLog.change < 0,
            CreditLog.created_at >= date_14_days_ago
        ).count() > 0

        if not has_14d_violation and user.credit_score < 100:
            # 加5分（不超过100）
            points = 5
            if user.credit_score + points > 100:
                points = 100 - user.credit_score
            if points > 0:
                user.credit_score += points
                log = CreditLog(
                    user_id=user.id,
                    change=points,
                    reason='连续14天无违规奖励',
                    related_id=None
                )
                db.session.add(log)

        # 查询30天内是否有扣分记录
        has_30d_violation = CreditLog.query.filter(
            CreditLog.user_id == user.id,
            CreditLog.change < 0,
            CreditLog.created_at >= date_30_days_ago
        ).count() > 0

        if not has_30d_violation and user.credit_score < 100:
            points = 10
            if user.credit_score + points > 100:
                points = 100 - user.credit_score
            if points > 0:
                user.credit_score += points
                log = CreditLog(
                    user_id=user.id,
                    change=points,
                    reason='连续30天无违规奖励',
                    related_id=None
                )
                db.session.add(log)

    db.session.commit()
