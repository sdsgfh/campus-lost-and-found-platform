from app.extensions import db

class ChatMessage(db.Model):
    __tablename__ = 'chat_message'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    session_id = db.Column(db.BigInteger, db.ForeignKey('chat_session.id'), nullable=False)
    sender_id = db.Column(db.BigInteger, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.BigInteger, db.ForeignKey('user.id'), nullable=False)
    msg_type = db.Column(db.Enum('text', 'image'), nullable=False, default='text')
    content = db.Column(db.Text)
    image_url = db.Column(db.String(255))
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())