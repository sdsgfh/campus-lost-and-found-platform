from app.extensions import db

class UserBehavior(db.Model):
    __tablename__ = 'user_behavior'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('user.id'), nullable=False)
    behavior_type = db.Column(db.Enum('view', 'favorite', 'share'), nullable=False)
    target_type = db.Column(db.Enum('post'), nullable=False)
    target_id = db.Column(db.BigInteger, db.ForeignKey('post.id'), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())