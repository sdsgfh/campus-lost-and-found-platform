import os
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()

class Config:
    WX_APPID = os.getenv('WX_APPID')
    WX_SECRET = os.getenv('WX_SECRET')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    ZHIPU_API_KEY = os.getenv('ZHIPU_API_KEY')
    SQLALCHEMY_DATABASE_URI = os.getenv('SQLALCHEMY_DATABASE_URI')
    REDIS_URL = os.getenv('REDIS_URL')
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'hard-to-guess-string'
    SQLALCHEMY_TRACK_MODIFICATIONS = False