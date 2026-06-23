from flask import Flask
from flask_cors import CORS
from app.extensions import db, migrate, jwt
from flask_apscheduler import APScheduler
import redis
from app.extensions import db, migrate, jwt, redis_client
scheduler = APScheduler()
from app.extensions import redis_client
def create_app():
    app = Flask(__name__)
    app.config.from_object('app.config.Config')

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app)
    # 初始化 Redis
    global redis_client
    redis_client = redis.StrictRedis.from_url(app.config['REDIS_URL'])
    # 注册蓝图（必须放在 return app 之前）
    from app.views.category import category_bp
    app.register_blueprint(category_bp)

    from app.views.myposts import myposts_bp
    app.register_blueprint(myposts_bp)

    from app.views.admin import admin_bp
    app.register_blueprint(admin_bp)

    from app.views.favorite import favorite_bp
    app.register_blueprint(favorite_bp)

    from app.views.credit import credit_bp
    app.register_blueprint(credit_bp)

    from app.views.trade import trade_bp
    app.register_blueprint(trade_bp)

    from app.views.auth import auth_bp
    app.register_blueprint(auth_bp)

    from app.views.banner import banner_bp
    app.register_blueprint(banner_bp)

    from app.views.search import search_bp
    app.register_blueprint(search_bp)

    from app.views.feedback import feedback_bp
    app.register_blueprint(feedback_bp)

    from app.views.announcement import announcement_bp
    app.register_blueprint(announcement_bp)

    from app.views.lostfound import lostfound_bp
    app.register_blueprint(lostfound_bp)

    from app.views.report import report_bp
    from app.views.appeal import appeal_bp
    app.register_blueprint(report_bp)
    app.register_blueprint(appeal_bp)

    from app.views.reward import reward_bp
    app.register_blueprint(reward_bp)

    from app.views.post import post_bp
    app.register_blueprint(post_bp, url_prefix='/api/post')

    from app.views.home import home_bp
    app.register_blueprint(home_bp)

    from app.views.transaction import transaction_bp
    app.register_blueprint(transaction_bp)
    from app.views.user import user_bp
    app.register_blueprint(user_bp)
    from app.views.user_behavior import user_behavior_bp
    app.register_blueprint(user_behavior_bp)
    from app.views.notification import notification_bp
    from app.views.chat import chat_bp

    app.register_blueprint(notification_bp)
    app.register_blueprint(chat_bp)
    # CLI 命令
    from app.cli import register_commands
    register_commands(app)

    # 静态文件服务
    import os
    from flask import send_from_directory
    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        return send_from_directory(os.path.join(app.root_path, '../uploads'), filename)

    # 初始化调度器（必须在注册蓝图之后）
    scheduler.init_app(app)
    scheduler.start()

    # ---------- 唯一且必要的定时任务 ----------

    # 1. 每日凌晨2点：检查用户连续无违规奖励（只保留一个）
    @scheduler.task('cron', id='check_continuous_no_violation', hour=2, minute=0)
    def check_continuous_no_violation_job():
        with app.app_context():
            from app.utils.credit import check_and_award_continuous_no_violation
            check_and_award_continuous_no_violation()

    # 2. 每日凌晨1点：检查过期帖子（只保留一个）
    @scheduler.task('cron', id='check_expired_posts', hour=1, minute=0)
    def check_expired_posts_job():
        with app.app_context():
            from app.utils.scheduler import check_expired_posts
            check_expired_posts()

    # 3. 每小时检查保护期结束的帖子（必须保留）
    @scheduler.task('cron', id='check_protection_expired', hour='*', minute=0)
    def check_protection_expired_job():
        with app.app_context():
            from app.utils.scheduler import check_protection_expired
            check_protection_expired()
    return app

