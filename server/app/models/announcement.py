from app.extensions import db

class Announcement(db.Model):
    __tablename__ = 'announcement'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    title = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text, nullable=False)
    publisher_id = db.Column(db.BigInteger, db.ForeignKey('admin.id'), nullable=False)
    status = db.Column(db.Enum('published', 'draft'), nullable=False, default='published')
    publish_time = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())