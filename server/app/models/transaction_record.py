from app.extensions import db

class TransactionRecord(db.Model):
    __tablename__ = 'transaction_record'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    post_id = db.Column(db.BigInteger, db.ForeignKey('post.id'), nullable=False)
    publisher_id = db.Column(db.BigInteger, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.BigInteger, db.ForeignKey('user.id'), nullable=False)
    type = db.Column(db.Enum('claim', 'return', 'purchase', 'sale'), nullable=False)
    completed_at = db.Column(db.DateTime, nullable=False)
    protection_end_time = db.Column(db.DateTime)
    status = db.Column(db.Enum('normal', 'disputed', 'invalid'), nullable=False, default='normal')
    dispute_appeal_id = db.Column(db.BigInteger, db.ForeignKey('appeal.id'))
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())