from app.extensions import db

class Favorite(db.Model):
    __tablename__ = 'favorite'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('user.id'), nullable=False)
    post_id = db.Column(db.BigInteger, db.ForeignKey('post.id'), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())
    __table_args__ = (db.UniqueConstraint('user_id', 'post_id', name='uk_user_post'),)