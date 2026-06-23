from app.extensions import db

class Appeal(db.Model):
    __tablename__ = 'appeal'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    appellant_id = db.Column(db.BigInteger, db.ForeignKey('user.id'), nullable=False)
    appeal_type = db.Column(db.Enum('post_reject', 'post_off', 'credit_deduct', 'claim_dispute'), nullable=False)
    target_type = db.Column(db.Enum('post', 'credit_log', 'transaction_record'), nullable=False)
    target_id = db.Column(db.BigInteger, nullable=False)
    reason = db.Column(db.String(500), nullable=False)
    evidence_images = db.Column(db.JSON)
    status = db.Column(db.Enum('pending', 'approved', 'rejected'), nullable=False, default='pending')
    result = db.Column(db.String(255))
    audit_time = db.Column(db.DateTime)
    auditor_id = db.Column(db.BigInteger, db.ForeignKey('admin.id'))
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())