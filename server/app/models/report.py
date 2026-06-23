from app.extensions import db

class Report(db.Model):
    __tablename__ = 'report'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    reporter_id = db.Column(db.BigInteger, db.ForeignKey('user.id'), nullable=False)
    report_type = db.Column(db.Enum('content','user','message'), nullable=False)  # 一级类型
    sub_type = db.Column(db.String(50))  # 二级类型，如 'false_info', 'fraud', 'fake_goods', 'harassment', 'malicious_report', 'illegal_post'
    target_type = db.Column(db.Enum('post','user','chat_message'), nullable=False)
    target_id = db.Column(db.BigInteger, nullable=False)
    reason = db.Column(db.String(500), nullable=False)
    evidence_images = db.Column(db.JSON)
    status = db.Column(db.Enum('pending','approved','rejected'), nullable=False, default='pending')
    result = db.Column(db.String(255))  # 处理结果说明
    audit_time = db.Column(db.DateTime)
    auditor_id = db.Column(db.BigInteger, db.ForeignKey('admin.id'))
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())