from app.extensions import db

class AuditLog(db.Model):
    __tablename__ = 'audit_log'

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    # 建议只保留 'report' 和 'appeal' 两种类型
    audit_type = db.Column(db.Enum('report', 'appeal'), nullable=False)
    target_id = db.Column(db.BigInteger, nullable=False)          # 被审核对象的ID（举报ID或申诉ID）
    auditor_id = db.Column(db.BigInteger, db.ForeignKey('admin.id'))  # 审核管理员ID
    audit_result = db.Column(db.String(50), nullable=False)       # 审核结果（如 'approved', 'rejected'）
    reason = db.Column(db.String(255))                             # 驳回/不成立原因
    auto_check_result = db.Column(db.String(50))                   # 自动审核结果（可能用于参考，可保留）
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())

    # 索引
    __table_args__ = (
        db.Index('idx_target', 'audit_type', 'target_id'),
    )