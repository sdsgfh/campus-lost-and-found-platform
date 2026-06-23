# app/extensions.py
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
import redis
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
redis_client =  None