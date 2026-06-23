from app.extensions import db

class ChatSession(db.Model):
    __tablename__ = 'chat_session'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    post_id = db.Column(db.BigInteger, db.ForeignKey('post.id'))
    initiator_id = db.Column(db.BigInteger, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.BigInteger, db.ForeignKey('user.id'), nullable=False)
    last_message = db.Column(db.String(500))
    last_message_time = db.Column(db.DateTime)
    unread_count_initiator = db.Column(db.Integer, default=0)
    unread_count_receiver = db.Column(db.Integer, default=0)
    status = db.Column(db.Enum('active', 'blocked', 'deleted'), default='active')
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, onupdate=db.func.current_timestamp())

    # 添加关系
    post = db.relationship('Post')
    initiator = db.relationship('User', foreign_keys=[initiator_id])
    receiver = db.relationship('User', foreign_keys=[receiver_id])

    __table_args__ = (db.UniqueConstraint('initiator_id', 'receiver_id', 'post_id', name='uk_init_receiver_post'),)