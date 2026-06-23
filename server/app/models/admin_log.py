from app.extensions import db

class AdminLog(db.Model):
    __tablename__ = 'admin_log'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    admin_id = db.Column(db.BigInteger, db.ForeignKey('admin.id'), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    target_type = db.Column(db.String(50))
    target_id = db.Column(db.BigInteger)
    details = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())