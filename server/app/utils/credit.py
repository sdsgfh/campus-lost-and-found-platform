
def check_and_award_continuous_no_violation():
    """
    每日检查所有用户最近14天和30天内是否有违规（扣分记录），若无则分别加5分和10分信誉分。
    """
    today = datetime.now().date()
    date_14_days_ago = today - timedelta(days=14)
    date_30_days_ago = today - timedelta(days=30)

    # 获取所有状态正常的用户（未封禁）
    users = User.query.filter(User.status != 'banned').all()

    for user in users:
        # 14天内是否有扣分
        has_14d_violation = CreditLog.query.filter(
            CreditLog.user_id == user.id,
            CreditLog.change < 0,
            CreditLog.created_at >= date_14_days_ago
        ).count() > 0

        if not has_14d_violation and user.credit_score < 100:
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

        # 30天内是否有扣分
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
def add_credit(user_id, change, reason, related_id=None):
    """
    增加信誉分（change为正数）
    如果加分后超过100，则设为100；并记录日志
    """
    user = User.query.get(user_id)
    if not user:
        return False
    old = user.credit_score
    new = min(old + change, 100)
    if new == old:
        return True  # 未变化
    user.credit_score = new
    log = CreditLog(user_id=user_id, change=change, reason=reason, related_id=related_id)
    db.session.add(log)
    db.session.commit()
    return True

def deduct_credit(user_id, change, reason, related_id=None):
    """
    扣除信誉分（change为正数，实际扣除负值）
    如果扣到0分，将用户状态置为封禁
    """
    user = User.query.get(user_id)
    if not user:
        return False
    old = user.credit_score
    new = max(old - change, 0)
    if new == old:
        return True
    user.credit_score = new
    log = CreditLog(user_id=user_id, change=-change, reason=reason, related_id=related_id)
    db.session.add(log)
    if new == 0:
        user.status = 'banned'
    db.session.commit()
    return True

def check_and_ban(user_id):
    """检查用户信誉分是否0，若是则封禁（可在登录时调用）"""
    user = User.query.get(user_id)
    if user and user.credit_score == 0 and user.status != 'banned':
        user.status = 'banned'
        db.session.commit()
        return True
    return False

def get_credit_level(credit_score):
    if credit_score >= 90:
        return ('信誉优秀', 10)
    elif credit_score >= 70:
        return ('信誉良好', 6)
    elif credit_score >= 60:
        return ('信誉一般', 3)
    elif credit_score > 0:
        return ('信誉较差', 1)
    else:
        return ('已封禁', 0)

# app/utils/credit.py
from app.extensions import db
from app.models.user import User
from app.models.credit_log import CreditLog
from datetime import datetime, timedelta

def check_and_award_continuous_no_violation():
    """
    定时任务：检查用户连续无违规天数，并给予相应加分。
    每天凌晨2点执行。
    """
    # 计算14天和30天前的时间点
    now = datetime.now()
    date_14_days_ago = now - timedelta(days=14)
    date_30_days_ago = now - timedelta(days=30)

    # 获取所有活跃用户（未封禁）
    users = User.query.filter(User.status != 'banned').all()

    for user in users:
        # 检查最近是否有扣分记录
        recent_credit_logs = CreditLog.query.filter(
            CreditLog.user_id == user.id,
            CreditLog.change < 0,  # 扣分记录
            CreditLog.created_at >= date_14_days_ago  # 14天内的扣分
        ).count()

        if recent_credit_logs == 0:
            # 连续14天无违规
            if user.credit_score < 100:  # 只给低于100分的用户加分
                points = 5
                # 避免超过100
                if user.credit_score + points > 100:
                    points = 100 - user.credit_score
                if points > 0:
                    user.credit_score += points
                    log = CreditLog(
                        user_id=user.id,
                        change=points,
                        reason='连续14天无违规奖励'
                    )
                    db.session.add(log)

        # 检查30天无违规
        recent_credit_logs_30 = CreditLog.query.filter(
            CreditLog.user_id == user.id,
            CreditLog.change < 0,
            CreditLog.created_at >= date_30_days_ago
        ).count()

        if recent_credit_logs_30 == 0:
            if user.credit_score < 100:
                points = 10
                if user.credit_score + points > 100:
                    points = 100 - user.credit_score
                if points > 0:
                    user.credit_score += points
                    log = CreditLog(
                        user_id=user.id,
                        change=points,
                        reason='连续30天无违规奖励'
                    )
                    db.session.add(log)

        db.session.commit()