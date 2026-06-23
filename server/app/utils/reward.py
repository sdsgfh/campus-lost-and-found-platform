
from datetime import date
from app.extensions import db
from app.models.user import User
from app.models.reward_point_log import RewardPointLog
def add_reward_points(user_id, points, reason, related_id=None):
    """
    给用户增加奖励积分，检查每日上限，并更新用户总积分和称号。
    返回是否成功增加，若超过上限则返回 False。
    """
    user = User.query.get(user_id)
    if not user or user.status != 'verified':
        return False

    today = date.today()
    if user.last_reward_date != today:
        user.last_reward_date = today
        user.daily_reward_points = 0

    if user.daily_reward_points + points > 20:
        return False  # 超过每日上限

    user.reward_points += points
    user.daily_reward_points += points

    log = RewardPointLog(
        user_id=user_id,
        change=points,
        reason=reason,
        related_id=related_id
    )
    db.session.add(log)

    # 更新称号（根据积分）
    if user.reward_points >= 200:
        user.honor = '公益之星'
    elif user.reward_points >= 150:
        user.honor = '校园雷锋'
    elif user.reward_points >= 60:
        user.honor = '暖心达人'
    elif user.reward_points >= 10:
        user.honor = '拾光者'
    else:
        user.honor = None

    db.session.commit()
    return True

def update_honor(user):
    """
    根据用户积分和信誉分更新称号
    """
    points = user.reward_points
    credit = user.credit_score
    if credit < 60:
        user.honor = None
    elif points >= 200:
        user.honor = '公益之星'
    elif points >= 150:
        user.honor = '校园雷锋'
    elif points >= 60:
        user.honor = '暖心达人'
    elif points >= 10:
        user.honor = '拾光者'
    else:
        user.honor = None
