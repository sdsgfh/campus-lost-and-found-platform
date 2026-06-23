from app.extensions import db

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    openid = db.Column(db.String(64), unique=True, nullable=False)
    nickname = db.Column(db.String(50))
    avatar = db.Column(db.String(255))
    bio = db.Column(db.String(100))
    status = db.Column(db.Enum('unverified', 'verified', 'cancelled', 'banned'), nullable=False, default='unverified')
    identity_type = db.Column(db.Enum('student', 'teacher'))
    prefixed_id = db.Column(db.String(50))
    real_name = db.Column(db.String(50))
    credit_score = db.Column(db.Integer, nullable=False, default=100)
    reward_points = db.Column(db.Integer, nullable=False, default=0)

    # 举报相关字段（用于每日次数限制）
    last_report_date = db.Column(db.Date)           # 最后一次举报日期
    daily_report_count = db.Column(db.Integer, default=0)  # 当日举报次数

    # 积分相关字段
    last_reward_date = db.Column(db.Date)           # 最后一次获得积分日期
    daily_reward_points = db.Column(db.Integer, default=0)  # 当日已获积分
    honor = db.Column(db.String(50), nullable=True) # 当前荣誉称号

    # 个人信息修改次数限制
    last_update_date = db.Column(db.Date)           # 最后一次修改个人信息日期
    nickname_update_count = db.Column(db.Integer, default=0)  # 当日昵称修改次数
    bio_update_count = db.Column(db.Integer, default=0)       # 当日简介修改次数
    avatar_update_count = db.Column(db.Integer, default=0)     # 当日头像修改次数

    last_login_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, onupdate=db.func.current_timestamp())

    def to_dict(self):
        """将用户对象转换为字典，便于返回 JSON"""
        return {
            'id': self.id,
            'openid': self.openid,
            'nickname': self.nickname,
            'avatar': self.avatar,
            'status': self.status,
            'credit_score': self.credit_score,
            'reward_points': self.reward_points,
            'honor': self.honor,        # 可用于前端展示
        }