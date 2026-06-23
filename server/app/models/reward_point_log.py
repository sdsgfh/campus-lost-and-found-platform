from app.extensions import db

class RewardPointLog(db.Model):
    __tablename__ = 'reward_point_log'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('user.id'), nullable=False)
    change = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(255), nullable=False)
    related_id = db.Column(db.BigInteger)
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())