from app import db

class SyncSchool(db.Model):
    __tablename__ = 'sync_school'
    prefixed_id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    sync_time = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())

    def __repr__(self):
        return f'<SyncSchool {self.prefixed_id}>'