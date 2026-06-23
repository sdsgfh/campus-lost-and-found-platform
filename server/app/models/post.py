from app.extensions import db


class Post(db.Model):
    __tablename__ = 'post'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # 用户关系（只保留一个）
    user_id = db.Column(db.BigInteger, db.ForeignKey('user.id'), nullable=False)
    user = db.relationship('User', foreign_keys=[user_id], backref='posts')
    type = db.Column(db.Enum('lost', 'found', 'sale', 'wanted'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'))
    title = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(500), nullable=False)
    images = db.Column(db.JSON)

    # 增加 'rejected' 状态
    # app/models/post.py
    status = db.Column(db.Enum('pending', 'active', 'pending_confirm', 'completed', 'expired', 'off', 'rejected'),
                       nullable=False, default='pending')

    # 新增驳回原因字段
    reject_reason = db.Column(db.String(255), nullable=True)

    location = db.Column(db.String(100))
    lost_time = db.Column(db.DateTime)
    expiry_days = db.Column(db.Integer)
    expiry_time = db.Column(db.DateTime)
    price = db.Column(db.Numeric(10, 2))
    expected_price = db.Column(db.Numeric(10, 2))
    condition = db.Column(db.Enum('new', 'almost_new', 'good', 'fair', 'poor'))
    expected_condition = db.Column(db.Enum('new', 'almost_new', 'good', 'fair', 'poor'))
    view_count = db.Column(db.Integer, nullable=False, default=0)
    favorite_count = db.Column(db.Integer, nullable=False, default=0)
    published_at = db.Column(db.DateTime)
    protection_end_time = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, onupdate=db.func.current_timestamp())
    claimer_id = db.Column(db.BigInteger, db.ForeignKey('user.id'), nullable=True)