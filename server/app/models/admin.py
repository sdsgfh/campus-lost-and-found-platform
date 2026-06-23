from app.extensions import db

class Admin(db.Model):
    __tablename__ = 'admin'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    real_name = db.Column(db.String(50))
    status = db.Column(db.Enum('active', 'locked'), nullable=False, default='active')
    must_change_password = db.Column(db.Boolean, nullable=False, default=True)  # 新增字段
    last_login_time = db.Column(db.DateTime)
    last_login_ip = db.Column(db.String(45))
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, onupdate=db.func.current_timestamp())