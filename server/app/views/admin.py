from datetime import datetime, timedelta
from flask import Blueprint, render_template, request, jsonify, session
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.security import check_password_hash, generate_password_hash
from app.extensions import db
from app.models import Announcement  # 或者 from app.models.announcement import Announcement
from app.models.admin import Admin
from app.models.admin_log import AdminLog
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.post import Post
from app.models.category import Category
from app.models.report import Report
from app.models.appeal import Appeal
from app.models.banner import Banner
from app.models.feedback import Feedback
from app.models.notification import Notification
from app.models.credit_log import CreditLog
from app.models.reward_point_log import RewardPointLog
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.transaction_record import TransactionRecord
from app.views.favorite import cancel_favorites_for_post
from app.utils.reward import add_reward_points

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')
import datetime
from datetime import datetime, timedelta


def restore_credit_score(user_id, related_id, reason_prefix):
    """
    通用信誉分恢复函数：根据关联ID查找扣分记录并恢复
    :param user_id: 要恢复的用户ID
    :param related_id: 关联ID（举报ID/帖子ID/申诉ID等）
    :param reason_prefix: 日志备注前缀
    """
    # 查找该用户因相关事件被扣的所有记录
    deduct_logs = CreditLog.query.filter(
        CreditLog.user_id == user_id,
        CreditLog.change < 0,
        CreditLog.related_id == related_id
    ).all()

    if not deduct_logs:
        return False, "未找到可恢复的扣分记录"

    for log in deduct_logs:
        restore_points = -log.change  # 要恢复的分数（扣多少补多少）
        user = User.query.get(user_id)
        if not user:
            continue

        # 恢复分数（上限100）
        old_score = user.credit_score
        user.credit_score = min(100, old_score + restore_points)
        actual_restore = user.credit_score - old_score

        # 记录恢复日志
        if actual_restore > 0:
            restore_log = CreditLog(
                user_id=user_id,
                change=actual_restore,
                reason=f"{reason_prefix}（恢复扣分ID:{log.id}）",
                related_id=related_id
            )
            db.session.add(restore_log)

    return True, "信誉分恢复成功"


# ---------- 登录与权限 ----------
@admin_bp.route('/login', methods=['GET'])
def login_page():
    return render_template('admin/login.html')


@admin_bp.route('/api/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'code': 400, 'message': '请输入用户名和密码'}), 400

    admin = Admin.query.filter_by(username=username).first()
    if not admin or not check_password_hash(admin.password_hash, password):
        # 记录登录失败次数（使用 session，但生产环境建议用 Redis）
        fail_key = f'login_fail_{username}'
        session[fail_key] = session.get(fail_key, 0) + 1
        if session[fail_key] >= 5:
            # 锁定30分钟
            session[f'locked_{username}'] = (datetime.now() + timedelta(minutes=30)).timestamp()
            return jsonify({'code': 429, 'message': '账号已锁定，请30分钟后再试'}), 429
        return jsonify({'code': 401, 'message': '账号或密码错误'}), 401

    # 检查是否被锁定
    if session.get(f'locked_{username}', 0) > datetime.now().timestamp():
        return jsonify({'code': 429, 'message': '账号已锁定，请30分钟后再试'}), 429

    # 清除失败记录
    session.pop(f'login_fail_{username}', None)
    session.pop(f'locked_{username}', None)

    # 生成 JWT token，有效期7天
    access_token = create_access_token(identity=str(admin.id), expires_delta=timedelta(days=7))
    # 更新最后登录信息
    admin.last_login_time = datetime.now()
    admin.last_login_ip = request.remote_addr
    db.session.commit()

    # 记录操作日志
    log = AdminLog(
        admin_id=admin.id,
        action='login',
        details={'ip': request.remote_addr}
    )
    db.session.add(log)
    db.session.commit()

    # 判断是否需要修改密码
    if admin.must_change_password:
        return jsonify({'code': 1001, 'message': '首次登录或密码需修改，请设置新密码', 'data': {'token': access_token}})
    else:
        return jsonify({
            'code': 0,
            'message': '登录成功',
            'data': {
                'token': access_token,
                'admin': {
                    'id': admin.id,
                    'username': admin.username,
                    'real_name': admin.real_name
                }
            }
        })


@admin_bp.route('/change-password', methods=['GET'])
def change_password_page():
    return render_template('admin/change_password.html')


@admin_bp.route('/api/change-password', methods=['POST'])
@jwt_required()
def change_password():
    admin_id = get_jwt_identity()
    data = request.get_json()
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    confirm_password = data.get('confirm_password')

    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 404, 'message': '管理员不存在'}), 404

    if not check_password_hash(admin.password_hash, old_password):
        return jsonify({'code': 401, 'message': '原密码错误'}), 401

    if new_password != confirm_password:
        return jsonify({'code': 400, 'message': '两次输入密码不一致'}), 400

    # 密码复杂度检查：字母+数字，长度≥8
    if len(new_password) < 8 or not any(c.isalpha() for c in new_password) or not any(
            c.isdigit() for c in new_password):
        return jsonify({'code': 400, 'message': '密码必须包含字母和数字，长度至少8位'}), 400

    admin.password_hash = generate_password_hash(new_password)
    admin.must_change_password = False
    db.session.commit()

    return jsonify({'code': 0, 'message': '密码修改成功'})


@admin_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    return jsonify({'code': 0, 'message': '已退出'})


@admin_bp.route('/api/check-auth', methods=['GET'])
@jwt_required()
def check_auth():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '管理员不存在'}), 401
    if admin.must_change_password:
        return jsonify({'code': 1001, 'message': '需要修改密码'})
    return jsonify({'code': 0, 'admin': {'id': admin.id, 'username': admin.username, 'real_name': admin.real_name}})


# ---------- 用户管理 ----------
@admin_bp.route('/api/users', methods=['GET'])
@jwt_required()
def get_users():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    page = max(1, int(request.args.get('page', 1)))
    per_page = max(1, min(100, int(request.args.get('per_page', 10))))
    search = request.args.get('search', '')
    status = request.args.get('status', '')
    credit_min = request.args.get('credit_min')
    credit_max = request.args.get('credit_max')
    sort = request.args.get('sort', 'desc')

    query = User.query

    if search:
        query = query.filter(
            (User.id.like(f'%{search}%')) |
            (User.prefixed_id.like(f'%{search}%')) |
            (User.nickname.like(f'%{search}%')) |
            (User.real_name.like(f'%{search}%'))
        )
    if status:
        query = query.filter(User.status == status)
    if credit_min is not None and credit_min != '':
        query = query.filter(User.credit_score >= int(credit_min))
    if credit_max is not None and credit_max != '':
        query = query.filter(User.credit_score <= int(credit_max))

    if sort == 'asc':
        query = query.order_by(User.created_at.asc())
    else:
        query = query.order_by(User.created_at.desc())

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    users = paginated.items
    total = paginated.total

    data = [{
        'id': u.id,
        'nickname': u.nickname,
        'real_name': u.real_name,
        'prefixed_id': u.prefixed_id,
        'status': u.status,
        'credit_score': u.credit_score,
        'created_at': u.created_at.strftime('%Y-%m-%d %H:%M'),
        'last_login_at': u.last_login_at.strftime('%Y-%m-%d %H:%M') if u.last_login_at else ''
    } for u in users]

    return jsonify({'code': 0, 'data': data, 'total': total, 'page': page, 'per_page': per_page})


@admin_bp.route('/api/users/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user_detail(user_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({'code': 404, 'message': '用户不存在'}), 404

    # 发布记录
    posts = Post.query.filter_by(user_id=user_id).order_by(Post.created_at.desc()).all()
    post_list = [{
        'id': p.id,
        'title': p.title,
        'type': p.type,
        'status': p.status,
        'created_at': p.created_at.strftime('%Y-%m-%d %H:%M')
    } for p in posts]

    # 违规记录（所有扣分记录）
    violations = CreditLog.query.filter_by(user_id=user_id).filter(CreditLog.change < 0).order_by(
        CreditLog.created_at.desc()).all()
    violation_list = [{
        'id': v.id,
        'change': v.change,
        'reason': v.reason,
        'created_at': v.created_at.strftime('%Y-%m-%d %H:%M')
    } for v in violations]

    return jsonify({
        'code': 0,
        'data': {
            'user': {
                'id': user.id,
                'nickname': user.nickname,
                'real_name': user.real_name,
                'prefixed_id': user.prefixed_id,
                'status': user.status,
                'credit_score': user.credit_score,
                'created_at': user.created_at.strftime('%Y-%m-%d %H:%M')
            },
            'posts': post_list,
            'violations': violation_list
        }
    })


@admin_bp.route('/api/users/<int:user_id>/ban', methods=['POST'])
@jwt_required()
def ban_user(user_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    data = request.get_json()
    reason = data.get('reason', '')

    user = User.query.get(user_id)
    if not user:
        return jsonify({'code': 404, 'message': '用户不存在'}), 404

    user.status = 'banned'
    db.session.commit()

    # 记录操作日志
    log = AdminLog(
        admin_id=admin.id,
        action='ban_user',
        target_type='user',
        target_id=user_id,
        details={'reason': reason}
    )
    db.session.add(log)

    # 发送通知给用户
    notification = Notification(
        user_id=user_id,
        type='account_banned',
        title='账号封禁通知',
        content=f'您的账号已被封禁，原因：{reason}',
        data={}
    )
    db.session.add(notification)
    db.session.commit()

    return jsonify({'code': 0, 'message': '用户已封禁'})


# ---------- 内容管理 ----------
@admin_bp.route('/api/posts', methods=['GET'])
@jwt_required()
def get_posts():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    search = request.args.get('search', '')
    status = request.args.get('status', '')
    type_ = request.args.get('type', '')
    sort = request.args.get('sort', 'desc')

    query = Post.query

    if search:
        query = query.filter(
            (Post.id.like(f'%{search}%')) |
            (Post.title.like(f'%{search}%'))
        )
    if status:
        query = query.filter(Post.status == status)
    if type_:
        query = query.filter(Post.type == type_)

    if sort == 'asc':
        query = query.order_by(Post.created_at.asc())
    else:
        query = query.order_by(Post.created_at.desc())

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    posts = paginated.items
    total = paginated.total

    data = [{
        'id': p.id,
        'title': p.title,
        'type': p.type,
        'category_id': p.category_id,
        'user_nickname': p.user.nickname if p.user else '',
        'status': p.status,
        'created_at': p.created_at.strftime('%Y-%m-%d %H:%M')
    } for p in posts]

    return jsonify({'code': 0, 'data': data, 'total': total, 'page': page, 'per_page': per_page})


@admin_bp.route('/api/posts/<int:post_id>', methods=['GET'])
@jwt_required()
def get_post_detail(post_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    post = Post.query.get(post_id)
    if not post:
        return jsonify({'code': 404, 'message': '帖子不存在'}), 404

    # 获取举报记录（与该帖子相关的举报）
    reports = Report.query.filter_by(target_type='post', target_id=post_id).all()
    report_list = [{'id': r.id, 'reason': r.reason, 'status': r.status} for r in reports]

    data = {
        'id': post.id,
        'title': post.title,
        'description': post.description,
        'images': post.images,
        'type': post.type,
        'status': post.status,
        'location': post.location,
        'lost_time': post.lost_time.strftime('%Y-%m-%d %H:%M') if post.lost_time else None,
        'expiry_days': post.expiry_days,
        'expiry_time': post.expiry_time.strftime('%Y-%m-%d %H:%M') if post.expiry_time else None,
        'price': str(post.price) if post.price else None,
        'condition': post.condition,
        'view_count': post.view_count,
        'favorite_count': post.favorite_count,
        'published_at': post.published_at.strftime('%Y-%m-%d %H:%M') if post.published_at else None,
        'user': {
            'id': post.user.id,
            'nickname': post.user.nickname,
            'credit_score': post.user.credit_score
        },
        'reports': report_list
    }
    return jsonify({'code': 0, 'data': data})


@admin_bp.route('/api/posts/<int:post_id>/off', methods=['POST'])
@jwt_required()
def off_post(post_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    data = request.get_json()
    reason = data.get('reason', '')
    deduct_credit = data.get('deduct_credit', 0)  # 根据规则扣除信誉分

    post = Post.query.get(post_id)
    if not post:
        return jsonify({'code': 404, 'message': '帖子不存在'}), 404

    if post.status != 'active':
        return jsonify({'code': 400, 'message': '帖子不是进行中状态'}), 400

    post.status = 'off'
    # 扣除信誉分
    if deduct_credit > 0:
        user = post.user
        user.credit_score = max(0, user.credit_score - deduct_credit)
        log = CreditLog(
            user_id=user.id,
            change=-deduct_credit,
            reason=f'管理员下架帖子: {post.title}，原因：{reason}',
            related_id=post.id
        )
        db.session.add(log)
    db.session.commit()

    # 记录操作日志
    log = AdminLog(
        admin_id=admin.id,
        action='off_post',
        target_type='post',
        target_id=post_id,
        details={'reason': reason, 'deduct_credit': deduct_credit}
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({'code': 0, 'message': '帖子已下架'})


@admin_bp.route('/api/posts/<int:post_id>/restore', methods=['POST'])
@jwt_required()
def restore_post(post_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    data = request.get_json()
    restore_credit = data.get('restore_credit', 0)  # 若申诉成立，恢复信誉分

    post = Post.query.get(post_id)
    if not post:
        return jsonify({'code': 404, 'message': '帖子不存在'}), 404

    if post.status != 'off':
        return jsonify({'code': 400, 'message': '只有已下架帖子才能恢复'}), 400

    post.status = 'active'
    post.published_at = datetime.now()
    post.expiry_time = post.published_at + timedelta(days=post.expiry_days)
    # 恢复信誉分
    if restore_credit > 0:
        user = post.user
        user.credit_score += restore_credit
        log = CreditLog(
            user_id=user.id,
            change=restore_credit,
            reason=f'申诉成立，恢复帖子: {post.title}',
            related_id=post.id
        )
        db.session.add(log)
    db.session.commit()

    # 记录操作日志
    log = AdminLog(
        admin_id=admin.id,
        action='restore_post',
        target_type='post',
        target_id=post_id,
        details={'restore_credit': restore_credit}
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({'code': 0, 'message': '帖子已恢复'})


# ---------- 举报管理 ----------
@admin_bp.route('/api/reports', methods=['GET'])
@jwt_required()
def get_reports():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    status = request.args.get('status', '')
    search = request.args.get('search', '')

    query = Report.query

    if status:
        query = query.filter(Report.status == status)
    if search:
        query = query.filter(Report.reporter_id.like(f'%{search}%'))

    query = query.order_by(Report.created_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    reports = paginated.items
    total = paginated.total

    data = [{
        'id': r.id,
        'report_type': r.report_type,
        'sub_type': r.sub_type,
        'reporter_id': r.reporter_id,
        'target_type': r.target_type,
        'target_id': r.target_id,
        'status': r.status,
        'created_at': r.created_at.strftime('%Y-%m-%d %H:%M')
    } for r in reports]

    return jsonify({'code': 0, 'data': data, 'total': total, 'page': page, 'per_page': per_page})


@admin_bp.route('/api/reports/<int:report_id>', methods=['GET'])
@jwt_required()
def get_report_detail(report_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    report = Report.query.get(report_id)
    if not report:
        return jsonify({'code': 404, 'message': '举报不存在'}), 404

    # 获取举报对象详情
    target_info = None
    if report.target_type == 'post':
        post = Post.query.get(report.target_id)
        if post:
            target_info = {
                'title': post.title,
                'user_id': post.user_id,
                'status': post.status
            }
    elif report.target_type == 'user':
        user = User.query.get(report.target_id)
        if user:
            target_info = {
                'nickname': user.nickname,
                'status': user.status
            }

    # 获取举报人信息
    reporter = User.query.get(report.reporter_id)

    data = {
        'id': report.id,
        'report_type': report.report_type,
        'sub_type': report.sub_type,
        'reason': report.reason,
        'evidence_images': report.evidence_images,
        'reporter': {
            'id': reporter.id,
            'nickname': reporter.nickname,
            'credit_score': reporter.credit_score
        } if reporter else None,
        'target_type': report.target_type,
        'target_id': report.target_id,
        'target_info': target_info,
        'status': report.status,
        'created_at': report.created_at.strftime('%Y-%m-%d %H:%M')
    }
    return jsonify({'code': 0, 'data': data})


def award_report_credit(reporter_id, target_user_id, report_id):
    """
    给举报人加3信誉分，并检查每日上限和同一用户24小时内限制
    """
    # 检查今日加分次数（最多2次）
    today_start = datetime.now().date()
    today = datetime.combine(today_start, datetime.min.time())
    today_count = CreditLog.query.filter(
        CreditLog.user_id == reporter_id,
        CreditLog.change > 0,
        CreditLog.reason.like('举报审核成立奖励%'),
        CreditLog.created_at >= today
    ).count()
    if today_count >= 2:
        return False, "今日举报加分已达上限"

    # 检查24小时内对同一目标是否已加分
    day_ago = datetime.now() - timedelta(hours=24)
    same_target = CreditLog.query.filter(
        CreditLog.user_id == reporter_id,
        CreditLog.change > 0,
        CreditLog.reason.like('举报审核成立奖励%'),
        CreditLog.created_at >= day_ago,
        CreditLog.target_user_id == target_user_id
    ).count()
    if same_target > 0:
        return False, "24小时内已对同一用户举报加分"

    # 加分
    reporter = User.query.get(reporter_id)
    if not reporter:
        return False, "举报人不存在"
    reporter.credit_score = min(100, reporter.credit_score + 3)
    log = CreditLog(
        user_id=reporter.id,
        change=3,
        reason=f'举报审核成立奖励，举报ID:{report_id}',
        related_id=report_id,
        target_user_id=target_user_id  # 传入目标用户ID
    )
    db.session.add(log)
    return True, None


@admin_bp.route('/api/reports/<int:report_id>/audit', methods=['POST'])
@jwt_required()
def audit_report(report_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    data = request.get_json()
    result = data.get('result')  # 'approved' 或 'rejected'
    reason = data.get('reason', '')
    is_malicious = data.get('is_malicious', False)

    report = Report.query.get(report_id)
    if not report:
        return jsonify({'code': 404, 'message': '举报不存在'}), 404

    # 初始化被举报用户ID
    target_user_id = None

    # ===== 处理信誉分变动及帖子状态 =====
    if result == 'approved':
        if report.target_type == 'post':
            post = Post.query.get(report.target_id)
            if post and post.user:
                target_user_id = post.user.id
                # 将帖子下架
                if post.status == 'active':
                    post.status = 'off'
                # 扣除信誉分
                post.user.credit_score = max(0, post.user.credit_score - 15)
                log = CreditLog(
                    user_id=post.user.id,
                    change=-15,
                    reason=f'因举报成立，帖子下架（举报ID:{report_id}）',
                    related_id=report_id
                )
                db.session.add(log)
        elif report.target_type == 'user':
            user = User.query.get(report.target_id)
            if user:
                target_user_id = user.id
                deduct = 10 if report.sub_type == '言语骚扰' else 15
                user.credit_score = max(0, user.credit_score - deduct)
                log = CreditLog(
                    user_id=user.id,
                    change=-deduct,
                    reason=f'举报成立处罚（举报ID:{report_id}）',
                    related_id=report_id
                )
                db.session.add(log)

        # 给举报人加分
        if target_user_id:
            success, msg = award_report_credit(report.reporter_id, target_user_id, report_id)
            if not success:
                print(msg)  # 加分失败记录日志

    elif result == 'rejected' and is_malicious:
        # 恶意举报，扣举报人10分
        reporter = User.query.get(report.reporter_id)
        if reporter:
            reporter.credit_score = max(0, reporter.credit_score - 10)
            log = CreditLog(
                user_id=reporter.id,
                change=-10,
                reason=f'恶意举报扣分（举报ID:{report_id}）',
                related_id=report_id
            )
            db.session.add(log)

    # ===== 发送通知 =====
    if result == 'approved':
        # 给举报人发送通知
        notif_reporter = Notification(
            user_id=report.reporter_id,
            type='report_result',
            title='举报处理结果',
            content='您的举报已审核成立，感谢您的贡献。',
            data={'report_id': report.id}
        )
        db.session.add(notif_reporter)

        # 给被举报人发送通知（即使 target_user_id 不存在，也可能需要通知？如果用户已注销则无法通知）
        if target_user_id:
            notif_target = Notification(
                user_id=target_user_id,
                type='punishment',
                title='账号处罚通知',
                content='您因举报核实违规，已被扣除信誉分。如有异议，请在24小时内通过“我的-申诉记录”提交申诉。',
                data={'report_id': report.id, 'appeal_type': 'report', 'target_id': report.id}
            )
            db.session.add(notif_target)

    elif result == 'rejected' and is_malicious:
        # 给举报人发送恶意举报结果通知
        notif_reporter = Notification(
            user_id=report.reporter_id,
            type='report_result',
            title='举报处理结果',
            content='您的举报被认定为恶意举报，已扣除信誉分。',
            data={'report_id': report.id}
        )
        db.session.add(notif_reporter)

    # ===== 更新举报记录状态 =====
    report.status = result
    report.result = reason
    report.audit_time = datetime.now()
    report.auditor_id = admin.id

    # ===== 记录审核日志 =====
    audit_log = AuditLog(
        audit_type='report',
        target_id=report_id,
        auditor_id=admin.id,
        audit_result=result,
        reason=reason,
        auto_check_result=None
    )
    db.session.add(audit_log)

    db.session.commit()
    return jsonify({'code': 0, 'message': '处理成功'})


@admin_bp.route('/api/appeals/<int:appeal_id>/audit', methods=['POST'])
@jwt_required()
def audit_appeal(appeal_id):
    """
    申诉审核接口（适配现有AuditLog模型 + 恶意申诉扣分）
    :param appeal_id: 申诉ID
    :return: JSON响应
    """
    try:
        # 1. 获取管理员ID和请求参数
        admin_id = get_jwt_identity()  # 管理员ID（关联admin表的id）
        data = request.get_json()
        result = data.get('result')  # approved/rejected
        audit_remark = data.get('reason', '')  # 适配现有模型的reason字段
        # 恶意申诉相关参数
        is_malicious = data.get('is_malicious', False)
        deduct_points = int(data.get('deduct_points', 5))

        # 2. 校验参数
        if result not in ['approved', 'rejected']:
            return jsonify({'code': 400, 'message': '审核结果只能是approved/rejected'}), 400
        if is_malicious and (deduct_points <= 0 or deduct_points > 20):
            return jsonify({'code': 400, 'message': '恶意申诉扣分分数需为1-20之间的整数'}), 400

        # 3. 查询申诉记录
        appeal = Appeal.query.get(appeal_id)
        if not appeal:
            return jsonify({'code': 404, 'message': '申诉记录不存在'}), 404
        if appeal.status != 'pending':
            return jsonify({'code': 400, 'message': '该申诉已审核，无需重复操作'}), 400

        # 4. 更新申诉状态
        appeal.status = result
        appeal.auditor_id = admin_id
        appeal.audit_time = datetime.now()
        appeal.audit_remark = audit_remark

        # 5. 处理审核结果
        restore_msg = ""
        if result == 'approved':
            # 5.1 申诉成立：发送通知 + 恢复数据/分数
            notif_appellant = Notification(
                user_id=appeal.appellant_id,
                type='appeal_result',
                title='申诉处理结果',
                content='您的申诉已审核成立，相关处罚已撤销，被扣信誉分已恢复。',
                data={'appeal_id': appeal.id, 'restore_score': True},
                created_at=datetime.now()
            )
            db.session.add(notif_appellant)

            # 5.2 按申诉类型恢复对应数据
            if appeal.appeal_type == 'post_off':
                post = Post.query.get(appeal.target_id)
                if post and post.status == 'off':
                    post.status = 'active'
                    post.updated_at = datetime.now()
                    success, msg = restore_credit_score(
                        user_id=appeal.appellant_id,
                        related_id=post.id,
                        reason_prefix=f'申诉成立（恢复帖子：{post.title[:20]}）'
                    )
                    restore_msg = msg

            elif appeal.appeal_type == 'credit_deduct':
                success, msg = restore_credit_score(
                    user_id=appeal.appellant_id,
                    related_id=appeal.target_id,
                    reason_prefix='申诉成立：恢复违规扣分'
                )
                restore_msg = msg

            elif appeal.appeal_type == 'claim_dispute':
                record = TransactionRecord.query.get(appeal.target_id)
                if record:
                    record.status = 'normal'
                    record.updated_at = datetime.now()
                    success, msg = restore_credit_score(
                        user_id=appeal.appellant_id,
                        related_id=record.id,
                        reason_prefix='申诉成立：恢复冒领纠纷扣分'
                    )
                    restore_msg = msg

            elif appeal.appeal_type == 'report_punish':
                success, msg = restore_credit_score(
                    user_id=appeal.appellant_id,
                    related_id=appeal.target_id,
                    reason_prefix='申诉成立：撤销举报违规处罚'
                )
                restore_msg = msg

        else:  # result == 'rejected'
            # 5.3 申诉不成立：发送通知 + 恶意申诉扣分
            base_content = f'您的申诉已审核不通过，原因：{audit_remark}'
            if is_malicious:
                # 恶意申诉：扣除申诉人信誉分
                appellant = User.query.get(appeal.appellant_id)
                if appellant and appellant.credit_score > 0:
                    old_score = appellant.credit_score
                    new_score = max(0, old_score - deduct_points)
                    actual_deduct = old_score - new_score

                    if actual_deduct > 0:
                        appellant.credit_score = new_score
                        appellant.updated_at = datetime.now()

                        # 生成恶意申诉扣分日志
                        deduct_log = CreditLog(
                            user_id=appeal.appellant_id,
                            change=-actual_deduct,
                            reason=f'恶意申诉处罚：申诉ID{appeal.id}审核不成立，判定为恶意申诉',
                            related_id=appeal.id,
                            created_at=datetime.now()
                        )
                        db.session.add(deduct_log)
                        base_content += f' 该申诉被判定为恶意申诉，扣除您{actual_deduct}分信誉分，当前分数：{new_score}。'

            # 发送申诉不成立通知
            notif_appellant = Notification(
                user_id=appeal.appellant_id,
                type='appeal_result',
                title='申诉处理结果',
                content=base_content,
                data={'appeal_id': appeal.id, 'restore_score': False, 'is_malicious': is_malicious},
                created_at=datetime.now()
            )
            db.session.add(notif_appellant)
            restore_msg = "申诉不成立" + ("，判定为恶意申诉并扣分" if is_malicious else "，无需恢复分数")

        # 6. 核心：记录审核日志（适配现有AuditLog模型）
        audit_log = AuditLog(
            audit_type='appeal',  # 固定为appeal（申诉审核）
            target_id=appeal_id,  # 申诉ID（被审核对象ID）
            auditor_id=admin_id,  # 审核管理员ID（关联admin表）
            audit_result=result,  # 审核结果：approved/rejected
            reason=audit_remark,  # 审核备注/驳回原因（适配现有模型的reason字段）
            auto_check_result=None,  # 申诉无自动审核，设为None
            created_at=datetime.now()
        )
        db.session.add(audit_log)

        # 7. 提交数据库变更
        db.session.commit()
        return jsonify({
            'code': 0,
            'message': f'申诉审核成功，{restore_msg}',
            'data': {
                'appeal_id': appeal_id,
                'status': result,
                'is_malicious': is_malicious,
                'deduct_points': deduct_points if is_malicious else 0
            }
        }), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'code': 500, 'message': f'数据库错误：{str(e)}'}), 500
    except Exception as e:
        return jsonify({'code': 500, 'message': f'系统错误：{str(e)}'}), 500


@admin_bp.route('/api/appeals', methods=['GET'])
@jwt_required()
def get_appeals():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    status = request.args.get('status', '')
    search = request.args.get('search', '')

    query = Appeal.query

    if status:
        query = query.filter(Appeal.status == status)
    if search:
        # 可按申诉人ID模糊搜索，可根据需要扩展
        query = query.filter(Appeal.appellant_id.like(f'%{search}%'))

    query = query.order_by(Appeal.created_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    appeals = paginated.items
    total = paginated.total

    data = [{
        'id': a.id,
        'appeal_type': a.appeal_type,
        'appellant_id': a.appellant_id,
        'target_type': a.target_type,
        'target_id': a.target_id,
        'status': a.status,
        'created_at': a.created_at.strftime('%Y-%m-%d %H:%M')
    } for a in appeals]

    return jsonify({'code': 0, 'data': data, 'total': total, 'page': page, 'per_page': per_page})


@admin_bp.route('/api/appeals/<int:appeal_id>', methods=['GET'])
@jwt_required()
def get_appeal_detail(appeal_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    appeal = Appeal.query.get(appeal_id)
    if not appeal:
        return jsonify({'code': 404, 'message': '申诉不存在'}), 404

    # 获取申诉人信息
    appellant = User.query.get(appeal.appellant_id)

    data = {
        'id': appeal.id,
        'appeal_type': appeal.appeal_type,
        'reason': appeal.reason,
        'evidence_images': appeal.evidence_images,
        'appellant': {
            'id': appellant.id,
            'nickname': appellant.nickname,
            'credit_score': appellant.credit_score
        } if appellant else None,
        'target_type': appeal.target_type,
        'target_id': appeal.target_id,
        'status': appeal.status,
        'created_at': appeal.created_at.strftime('%Y-%m-%d %H:%M')
    }
    return jsonify({'code': 0, 'data': data})


# ---------- 交易与认领管理 ----------
@admin_bp.route('/api/transactions', methods=['GET'])
@jwt_required()
def get_transactions():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    type_ = request.args.get('type', '')
    search = request.args.get('search', '')

    query = TransactionRecord.query

    if type_:
        query = query.filter(TransactionRecord.type == type_)
    if search:
        query = query.filter(
            (TransactionRecord.publisher_id.like(f'%{search}%')) |
            (TransactionRecord.receiver_id.like(f'%{search}%'))
        )

    query = query.order_by(TransactionRecord.completed_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    records = paginated.items
    total = paginated.total

    data = [{
        'id': r.id,
        'post_id': r.post_id,
        'type': r.type,
        'publisher_id': r.publisher_id,
        'receiver_id': r.receiver_id,
        'completed_at': r.completed_at.strftime('%Y-%m-%d %H:%M'),
        'protection_end_time': r.protection_end_time.strftime('%Y-%m-%d %H:%M') if r.protection_end_time else None
    } for r in records]

    return jsonify({'code': 0, 'data': data, 'total': total, 'page': page, 'per_page': per_page})


@admin_bp.route('/api/transactions/<int:record_id>', methods=['GET'])
@jwt_required()
def get_transaction_detail(record_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    record = TransactionRecord.query.get(record_id)
    if not record:
        return jsonify({'code': 404, 'message': '记录不存在'}), 404

    post = Post.query.get(record.post_id)
    publisher = User.query.get(record.publisher_id)
    receiver = User.query.get(record.receiver_id)

    data = {
        'id': record.id,
        'post': {
            'id': post.id,
            'title': post.title,
            'type': post.type,
            'description': post.description,
            'images': post.images
        } if post else None,
        'publisher': {
            'id': publisher.id,
            'nickname': publisher.nickname,
            'credit_score': publisher.credit_score
        } if publisher else None,
        'receiver': {
            'id': receiver.id,
            'nickname': receiver.nickname,
            'credit_score': receiver.credit_score
        } if receiver else None,
        'type': record.type,
        'completed_at': record.completed_at.strftime('%Y-%m-%d %H:%M'),
        'protection_end_time': record.protection_end_time.strftime(
            '%Y-%m-%d %H:%M') if record.protection_end_time else None
    }
    return jsonify({'code': 0, 'data': data})


# ---------- 轮播图管理 ----------
@admin_bp.route('/api/banners', methods=['GET'])
@jwt_required()
def get_banners_list():
    admin = Admin.query.get(get_jwt_identity())
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    banners = Banner.query.order_by(Banner.sort_order).all()
    data = [{
        'id': b.id,
        'title': b.title,
        'image_url': b.image_url,
        'link_type': b.link_type,
        'link_value': b.link_value,
        'sort_order': b.sort_order,
        'status': b.status
    } for b in banners]
    return jsonify({'code': 0, 'data': data})


@admin_bp.route('/api/banners/<int:banner_id>', methods=['GET'])
@jwt_required()
def get_banner(banner_id):
    admin = Admin.query.get(get_jwt_identity())
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401
    banner = Banner.query.get(banner_id)
    if not banner:
        return jsonify({'code': 404, 'message': '轮播图不存在'}), 404
    data = {
        'id': banner.id,
        'title': banner.title,
        'image_url': banner.image_url,
        'link_type': banner.link_type,
        'link_value': banner.link_value,
        'sort_order': banner.sort_order,
        'status': banner.status
    }
    return jsonify({'code': 0, 'data': data})


@admin_bp.route('/api/banners', methods=['POST'])
@jwt_required()
def create_banner():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    data = request.get_json()
    banner = Banner(
        title=data.get('title'),
        image_url=data['image_url'],
        link_type=data.get('link_type', 'none'),
        link_value=data.get('link_value'),
        sort_order=data.get('sort_order', 0),
        status=data.get('status', 'active')
    )
    db.session.add(banner)
    db.session.commit()
    return jsonify({'code': 0, 'message': '创建成功', 'data': {'id': banner.id}})


@admin_bp.route('/api/banners/<int:banner_id>', methods=['PUT'])
@jwt_required()
def update_banner(banner_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    banner = Banner.query.get(banner_id)
    if not banner:
        return jsonify({'code': 404, 'message': '轮播图不存在'}), 404

    data = request.get_json()
    for key, value in data.items():
        if hasattr(banner, key):
            setattr(banner, key, value)
    db.session.commit()
    return jsonify({'code': 0, 'message': '更新成功'})


@admin_bp.route('/api/banners/<int:banner_id>', methods=['DELETE'])
@jwt_required()
def delete_banner(banner_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    banner = Banner.query.get(banner_id)
    if not banner:
        return jsonify({'code': 404, 'message': '轮播图不存在'}), 404
    db.session.delete(banner)
    db.session.commit()
    return jsonify({'code': 0, 'message': '删除成功'})


# ---------- 反馈管理 ----------
@admin_bp.route('/api/feedbacks', methods=['GET'])
@jwt_required()
def get_feedbacks():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    status = request.args.get('status', '')

    query = Feedback.query
    if status:
        query = query.filter(Feedback.status == status)
    query = query.order_by(Feedback.created_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    feedbacks = paginated.items
    total = paginated.total

    data = [{
        'id': f.id,
        'user_id': f.user_id,
        'content': f.content,
        'images': f.images,
        'status': f.status,
        'created_at': f.created_at.strftime('%Y-%m-%d %H:%M')
    } for f in feedbacks]

    return jsonify({'code': 0, 'data': data, 'total': total, 'page': page, 'per_page': per_page})


@admin_bp.route('/api/feedbacks/<int:feedback_id>', methods=['GET'])
@jwt_required()
def get_feedback_detail(feedback_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    feedback = Feedback.query.get(feedback_id)
    if not feedback:
        return jsonify({'code': 404, 'message': '反馈不存在'}), 404

    data = {
        'id': feedback.id,
        'user_id': feedback.user_id,
        'content': feedback.content,
        'images': feedback.images,
        'status': feedback.status,
        'reply_content': feedback.reply_content,
        'reply_time': feedback.reply_time.strftime('%Y-%m-%d %H:%M') if feedback.reply_time else None,
        'created_at': feedback.created_at.strftime('%Y-%m-%d %H:%M')
    }
    return jsonify({'code': 0, 'data': data})


@admin_bp.route('/api/feedbacks/<int:feedback_id>/reply', methods=['POST'])
@jwt_required()
def reply_feedback(feedback_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    data = request.get_json()
    reply_content = data.get('reply_content')

    feedback = Feedback.query.get(feedback_id)
    if not feedback:
        return jsonify({'code': 404, 'message': '反馈不存在'}), 404

    feedback.reply_content = reply_content
    feedback.reply_time = datetime.now()
    feedback.status = 'replied'
    db.session.commit()

    return jsonify({'code': 0, 'message': '回复成功'})


# ---------- 审核总览 ----------
@admin_bp.route('/api/audit/overview', methods=['GET'])
@jwt_required()
def audit_overview():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    pending_reports = Report.query.filter_by(status='pending').count()
    pending_appeals = Appeal.query.filter_by(status='pending').count()

    return jsonify({
        'code': 0,
        'data': {
            'reports': pending_reports,
            'appeals': pending_appeals
        }
    })


# ---------- 审核日志 ----------
@admin_bp.route('/api/audit/logs', methods=['GET'])
@jwt_required()
def get_audit_logs():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    audit_type = request.args.get('type', '')
    result = request.args.get('result', '')

    query = AuditLog.query
    if audit_type:
        query = query.filter(AuditLog.audit_type == audit_type)
    if result:
        query = query.filter(AuditLog.audit_result == result)
    query = query.order_by(AuditLog.created_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    logs = paginated.items
    total = paginated.total

    data = [{
        'id': l.id,
        'audit_type': l.audit_type,
        'target_id': l.target_id,
        'auditor_id': l.auditor_id,
        'audit_result': l.audit_result,
        'reason': l.reason,
        'auto_check_result': l.auto_check_result,
        'created_at': l.created_at.strftime('%Y-%m-%d %H:%M')
    } for l in logs]

    return jsonify({'code': 0, 'data': data, 'total': total, 'page': page, 'per_page': per_page})


# ---------- 数据统计 ----------
@admin_bp.route('/api/statistics/dashboard', methods=['GET'])
@jwt_required()
def dashboard_stats():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    today = datetime.now().date()
    tomorrow = today + timedelta(days=1)
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(tomorrow, datetime.min.time())

    new_users_today = User.query.filter(User.created_at >= today_start).count()
    new_verified_today = User.query.filter(User.created_at >= today_start, User.status == 'verified').count()
    new_posts_today = Post.query.filter(Post.created_at >= today_start).count()
    new_transactions_today = TransactionRecord.query.filter(TransactionRecord.completed_at >= today_start).count()/2

    # 昨日数据
    yesterday_start = today_start - timedelta(days=1)
    yesterday_end = today_start
    reports_yesterday = Report.query.filter(Report.created_at.between(yesterday_start, yesterday_end)).count()
    # 本周累计
    week_start = today_start - timedelta(days=today.weekday())
    reports_week = Report.query.filter(Report.created_at >= week_start).count()
    total_users = User.query.count()
    total_verified = User.query.filter_by(status='verified').count()
    total_banned = User.query.filter_by(status='banned').count()
    total_posts = Post.query.count()
    total_transactions = TransactionRecord.query.count()
    total_reports = Report.query.count()
    total_appeals = Appeal.query.count()
    # 待审核数量
    pending_posts = Post.query.filter_by(status='pending').count()
    pending_reports = Report.query.filter_by(status='pending').count()
    pending_appeals = Appeal.query.filter_by(status='pending').count()

    return jsonify({
        'code': 0,
        'data': {
            'new_users_today': new_users_today,
            'new_verified_today': new_verified_today,
            'new_posts_today': new_posts_today,
            'new_transactions_today': new_transactions_today,
            'pending_reports': pending_reports,
            'pending_appeals': pending_appeals,
            'reports_yesterday': reports_yesterday,
            'reports_week': reports_week,
            'total_users': total_users,
            'total_verified': total_verified,
            'total_banned': total_banned,
            'total_posts': total_posts,
            'total_transactions': total_transactions,
            'total_reports': total_reports,
            'total_appeals': total_appeals,
            'pending_posts': pending_posts
        }
    })


@admin_bp.route('/api/statistics/auth-distribution', methods=['GET'])
@jwt_required()
def auth_distribution():
    # 按状态统计用户数
    status_counts = db.session.query(User.status, db.func.count()).group_by(User.status).all()
    data = [{'status': s, 'count': c} for s, c in status_counts]
    return jsonify({'code': 0, 'data': data})


@admin_bp.route('/api/statistics/post-type-distribution', methods=['GET'])
@jwt_required()
def post_type_distribution():
    # 按类型统计发布数
    type_counts = db.session.query(Post.type, db.func.count()).group_by(Post.type).all()
    data = [{'type': t, 'count': c} for t, c in type_counts]
    return jsonify({'code': 0, 'data': data})


from sqlalchemy import func, cast, Date


@admin_bp.route('/api/statistics/trends', methods=['GET'])
@jwt_required()
def get_trends():
    days = request.args.get('days', default=7, type=int)
    admin = Admin.query.get(get_jwt_identity())
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    # 计算起始日期
    start_date = datetime.now().date() - timedelta(days=days - 1)
    start_datetime = datetime.combine(start_date, datetime.min.time())

    # 按天统计新增用户
    user_counts = db.session.query(
        cast(User.created_at, Date).label('date'),
        func.count().label('count')
    ).filter(User.created_at >= start_datetime).group_by('date').all()

    # 按天统计新增帖子
    post_counts = db.session.query(
        cast(Post.created_at, Date).label('date'),
        func.count().label('count')
    ).filter(Post.created_at >= start_datetime).group_by('date').all()

    # ========== 核心修改：按 post_id 去重统计交易记录 ==========
    # 子查询：从 transaction_record 中筛选完成时间在起始日期之后的记录，按 post_id 去重
    subquery = db.session.query(
        TransactionRecord.post_id,
        cast(TransactionRecord.completed_at, Date).label('date')
    ).filter(
        TransactionRecord.completed_at >= start_datetime
    ).distinct().subquery()

    # 按日期分组统计去重后的交易数量
    trans_counts = db.session.query(
        subquery.c.date,
        func.count().label('count')
    ).group_by(subquery.c.date).all()

    # 转换为字典便于合并
    user_dict = {str(row.date): row.count for row in user_counts}
    post_dict = {str(row.date): row.count for row in post_counts}
    trans_dict = {str(row.date): row.count for row in trans_counts}

    # 生成日期列表
    data = []
    for i in range(days):
        date = start_date + timedelta(days=i)
        date_str = date.strftime('%Y-%m-%d')
        data.append({
            'date': date_str,
            'new_users': user_dict.get(date_str, 0),
            'new_posts': post_dict.get(date_str, 0),
            'new_transactions': trans_dict.get(date_str, 0)
        })
    return jsonify({'code': 0, 'data': data})


@admin_bp.route('/api/notifications/send', methods=['POST'])
@jwt_required()
def send_notification():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    data = request.get_json()
    user_ids = data.get('user_ids', [])  # 数组，为空表示发送给所有用户
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()
    notif_type = data.get('type', 'admin_notification')

    if not title or not content:
        return jsonify({'code': 400, 'message': '标题和内容不能为空'}), 400

    # 确定接收者
    if user_ids and len(user_ids) > 0:
        users = User.query.filter(User.id.in_(user_ids)).all()
    else:
        users = User.query.all()  # 所有用户（包括未认证？可根据需要调整）

    if not users:
        return jsonify({'code': 404, 'message': '没有符合条件的用户'}), 404

    # 为每个用户创建通知
    notifications = []
    for user in users:
        notif = Notification(
            user_id=user.id,
            type=notif_type,
            title=title,
            content=content,
            data={'sender': admin.username}
        )
        notifications.append(notif)

    db.session.bulk_save_objects(notifications)  # 批量插入提高性能
    db.session.commit()

    return jsonify({'code': 0, 'message': f'已向 {len(notifications)} 位用户发送通知'})


# ---------- 公告管理 ----------
@admin_bp.route('/api/announcements', methods=['GET'])
@jwt_required()
def get_announcements():
    admin_id = get_jwt_identity()
    print(f"Admin ID from token: {admin_id}, type: {type(admin_id)}")
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    status = request.args.get('status', '')
    search = request.args.get('search', '')

    query = Announcement.query
    if status:
        query = query.filter(Announcement.status == status)
    if search:
        query = query.filter(Announcement.title.like(f'%{search}%'))
    query = query.order_by(Announcement.publish_time.desc())

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    announcements = paginated.items
    total = paginated.total

    data = [{
        'id': a.id,
        'title': a.title,
        'content': a.content[:100] + '...' if len(a.content) > 100 else a.content,
        'status': a.status,
        'publish_time': a.publish_time.strftime('%Y-%m-%d %H:%M'),
        'created_at': a.created_at.strftime('%Y-%m-%d %H:%M')
    } for a in announcements]

    return jsonify({'code': 0, 'data': data, 'total': total, 'page': page, 'per_page': per_page})


@admin_bp.route('/api/announcements', methods=['POST'])
@jwt_required()
def create_announcement():
    print("=== create_announcement ===")
    admin_id = get_jwt_identity()
    print(f"admin_id: {admin_id}")
    data = request.get_json()
    print(f"data: {data}")
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401
    title = data.get('title')
    content = data.get('content')
    status = data.get('status', 'published')
    publish_time_str = data.get('publish_time')

    if not title or not content:
        return jsonify({'code': 400, 'message': '标题和内容不能为空'}), 400

    if publish_time_str:
        try:
            publish_time = datetime.strptime(publish_time_str, '%Y-%m-%d %H:%M')
        except:
            return jsonify({'code': 400, 'message': '发布时间格式错误'}), 400
    else:
        publish_time = datetime.now()

    announcement = Announcement(
        title=title,
        content=content,
        publisher_id=admin.id,
        status=status,
        publish_time=publish_time
    )
    db.session.add(announcement)
    db.session.commit()

    # 可选：发布时给所有用户发送通知
    if status == 'published':
        users = User.query.all()
        notifications = []
        for user in users:
            notif = Notification(
                user_id=user.id,
                type='announcement',
                title='新公告：' + title,
                content=content[:100] + ('...' if len(content) > 100 else ''),
                data={'announcement_id': announcement.id}
            )
            notifications.append(notif)
        db.session.bulk_save_objects(notifications)
        db.session.commit()

    return jsonify({'code': 0, 'message': '创建成功', 'data': {'id': announcement.id}})


@admin_bp.route('/api/announcements/<int:announcement_id>', methods=['PUT'])
@jwt_required()
def update_announcement(announcement_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    announcement = Announcement.query.get(announcement_id)
    if not announcement:
        return jsonify({'code': 404, 'message': '公告不存在'}), 404

    data = request.get_json()
    if 'title' in data:
        announcement.title = data['title']
    if 'content' in data:
        announcement.content = data['content']
    if 'status' in data:
        announcement.status = data['status']
    if 'publish_time' in data:
        try:
            announcement.publish_time = datetime.strptime(data['publish_time'], '%Y-%m-%d %H:%M')
        except:
            return jsonify({'code': 400, 'message': '发布时间格式错误'}), 400

    db.session.commit()
    return jsonify({'code': 0, 'message': '更新成功'})


@admin_bp.route('/api/announcements/<int:announcement_id>', methods=['DELETE'])
@jwt_required()
def delete_announcement(announcement_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    announcement = Announcement.query.get(announcement_id)
    if not announcement:
        return jsonify({'code': 404, 'message': '公告不存在'}), 404

    db.session.delete(announcement)
    db.session.commit()
    return jsonify({'code': 0, 'message': '删除成功'})


@admin_bp.route('/api/announcements/<int:announcement_id>/toggle', methods=['POST'])
@jwt_required()
def toggle_announcement_status(announcement_id):
    admin_id = get_jwt_identity()
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401

    announcement = Announcement.query.get(announcement_id)
    if not announcement:
        return jsonify({'code': 404, 'message': '公告不存在'}), 404

    announcement.status = 'draft' if announcement.status == 'published' else 'published'
    # 如果从草稿发布，可再次发送通知
    if announcement.status == 'published':
        # 发送通知逻辑...
        pass
    db.session.commit()
    return jsonify({'code': 0, 'message': '状态已切换'})


@admin_bp.route('/api/announcements/<int:announcement_id>', methods=['GET'])
@jwt_required()
def get_announcement(announcement_id):
    admin = Admin.query.get(get_jwt_identity())
    if not admin:
        return jsonify({'code': 401, 'message': '未授权'}), 401
    announcement = Announcement.query.get(announcement_id)
    if not announcement:
        return jsonify({'code': 404, 'message': '公告不存在'}), 404
    data = {
        'id': announcement.id,
        'title': announcement.title,
        'content': announcement.content,
        'status': announcement.status,
        'publish_time': announcement.publish_time.strftime('%Y-%m-%d %H:%M'),
        'created_at': announcement.created_at.strftime('%Y-%m-%d %H:%M')
    }
    return jsonify({'code': 0, 'data': data})


@admin_bp.route('/dashboard')
def dashboard():
    return render_template('admin/dashboard.html', active='dashboard')


@admin_bp.route('/users')
def users():
    return render_template('admin/users.html', active='users')


@admin_bp.route('/posts')
def posts():
    return render_template('admin/posts.html', active='posts')


@admin_bp.route('/reports')
def reports():
    return render_template('admin/reports.html', active='reports')


@admin_bp.route('/appeals')
def appeals():
    return render_template('admin/appeals.html', active='appeals')


@admin_bp.route('/transactions')
def transactions():
    return render_template('admin/transactions.html', active='transactions')


@admin_bp.route('/banners')
def banners():
    return render_template('admin/banners.html', active='banners')


@admin_bp.route('/feedbacks')
def feedbacks():
    return render_template('admin/feedbacks.html', active='feedbacks')


@admin_bp.route('/audit-logs')
def audit_logs():
    return render_template('admin/audit_logs.html', active='audit_logs')


@admin_bp.route('/statistics')
def statistics():
    return render_template('admin/statistics.html', active='statistics')


@admin_bp.route('/announcements')
def announcements_page():
    return render_template('admin/announcements.html', active='announcements')


@admin_bp.route('/notifications')
def notifications_page():
    return render_template('admin/notifications.html', active='notifications')
