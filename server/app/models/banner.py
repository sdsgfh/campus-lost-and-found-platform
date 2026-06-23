from app.extensions import db

class Banner(db.Model):
    __tablename__ = 'banner'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    title = db.Column(db.String(100))
    image_url = db.Column(db.String(255), nullable=False)
    link_type = db.Column(db.Enum('none', 'post', 'announcement', 'url'), default='none')
    link_value = db.Column(db.String(255))
    sort_order = db.Column(db.Integer, nullable=False, default=0)  # 排序数字越小越靠前
    status = db.Column(db.Enum('active', 'inactive'), nullable=False, default='active')
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, onupdate=db.func.current_timestamp())