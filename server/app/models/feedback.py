from app.extensions import db

class Feedback(db.Model):
    __tablename__ = 'feedback'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.String(300), nullable=False)
    images = db.Column(db.JSON)                 # 图片URL数组，最多3张
    status = db.Column(db.Enum('pending', 'replied'), nullable=False, default='pending')
    reply_content = db.Column(db.String(500))   # 管理员回复内容
    reply_time = db.Column(db.DateTime)          # 回复时间
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())

    user = db.relationship('User', backref='feedbacks')