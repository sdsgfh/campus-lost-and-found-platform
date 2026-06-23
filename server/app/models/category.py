from app.extensions import db

class Category(db.Model):
    __tablename__ = 'category'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    sort_order = db.Column(db.Integer)  # TINYINT UNSIGNED
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())