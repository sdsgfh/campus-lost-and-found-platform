import qrcode
import io
import base64
import hashlib
import hmac
import time
import json
import redis
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.post import Post
from app.models.user import User
from app.models.chat_session import ChatSession
from app.models.transaction_record import TransactionRecord
from app.views.favorite import cancel_favorites_for_post
from datetime import datetime, timedelta
from app.utils.reward import add_reward_points
transaction_bp = Blueprint('transaction', __name__, url_prefix='/api/transaction')

def get_redis():
    """从应用配置创建 Redis 连接"""
    try:
        return redis.StrictRedis.from_url(current_app.config['REDIS_URL'])
    except Exception as e:
        current_app.logger.error(f"Redis connection error: {e}")
        return None

@transaction_bp.route('/candidates', methods=['GET'])
@jwt_required()
def get_candidates():
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except:
        return jsonify({'code': 400, 'message': '无效的用户身份'}), 400

    post_id = request.args.get('post_id', type=int)
    if not post_id:
        return jsonify({'code': 400, 'message': '缺少参数 post_id'}), 400

    post = Post.query.get(post_id)
    if not post or post.user_id != user_id:
        return jsonify({'code': 403, 'message': '无权访问'}), 403

    sessions = ChatSession.query.filter_by(post_id=post_id).all()
    user_ids = set()
    for s in sessions:
        if s.initiator_id != user_id:
            user_ids.add(s.initiator_id)
        if s.receiver_id != user_id:
            user_ids.add(s.receiver_id)

    users = []
    for uid in user_ids:
        u = User.query.get(uid)
        if u and u.status == 'verified':
            last_msg_time = None
            session = ChatSession.query.filter(
                ((ChatSession.initiator_id == user_id) & (ChatSession.receiver_id == uid) & (ChatSession.post_id == post_id)) |
                ((ChatSession.initiator_id == uid) & (ChatSession.receiver_id == user_id) & (ChatSession.post_id == post_id))
            ).first()
            if session:
                last_msg_time = session.last_message_time
            users.append({
                'user_id': u.id,
                'nickname': u.nickname,
                'avatar': u.avatar,
                'last_message_time': last_msg_time.strftime('%Y-%m-%d %H:%M') if last_msg_time else ''
            })
    users.sort(key=lambda x: x['last_message_time'] or '', reverse=True)
    return jsonify({'code': 0, 'data': users})

@transaction_bp.route('/generate_qrcode', methods=['POST'])
@jwt_required()
def generate_qrcode():
    user_id = get_jwt_identity()
    print(f"原始 user_id: {user_id}, 类型: {type(user_id)}")
    try:
        user_id = int(user_id)
    except:
        return jsonify({'code': 400, 'message': '无效的用户身份'}), 400
    print(f"转换后 user_id: {user_id}, 类型: {type(user_id)}")

    data = request.get_json()
    post_id = data.get('post_id')
    target_user_id = data.get('user_id')
    print(f"前端传参 post_id: {post_id}, target_user_id: {target_user_id}")

    if not post_id or not target_user_id:
        return jsonify({'code': 400, 'message': '缺少参数'}), 400
    try:
        post_id = int(post_id)
        target_user_id = int(target_user_id)
    except:
        return jsonify({'code': 400, 'message': '参数类型错误'}), 400
    print(f"转换后 post_id: {post_id}, target_user_id: {target_user_id}")

    post = Post.query.get(post_id)
    if not post:
        return jsonify({'code': 400, 'message': '帖子不存在'}), 400
    print(f"帖子发布者 user_id: {post.user_id}")

    if post.user_id != user_id:
        return jsonify({'code': 403, 'message': '无权操作'}), 403

    if post.status != 'active':
        return jsonify({'code': 400, 'message': '发布状态异常'}), 400

    target_user = User.query.get(target_user_id)
    if not target_user or target_user.status != 'verified':
        return jsonify({'code': 400, 'message': '对接者账号异常'}), 400
    # 获取 Redis 客户端
    redis_client = get_redis()
    if redis_client is None:
        return jsonify({'code': 500, 'message': '缓存服务不可用'}), 500

    # 检查每分钟生成限制
    gen_key = f"qrcode_gen:{post_id}:{target_user_id}"
    last_gen = redis_client.get(gen_key)
    if last_gen and int(time.time()) - int(last_gen) < 60:
        return jsonify({'code': 400, 'message': '每分钟只能生成一次二维码'}), 400

    timestamp = int(time.time())
    secret_key = current_app.config['JWT_SECRET_KEY'].encode()
    message = f"{post_id}:{target_user_id}:{timestamp}".encode()
    signature = hmac.new(secret_key, message, hashlib.sha256).hexdigest()

    # 存储签名到 Redis
    qr_key = f"qrcode:{post_id}:{target_user_id}"
    redis_client.setex(qr_key, 600, json.dumps({
        'signature': signature,
        'timestamp': timestamp
    }))
    redis_client.setex(gen_key, 60, str(timestamp))

    # 生成二维码内容：原始格式（用冒号分隔）
    content = f"{post_id}:{target_user_id}:{timestamp}:{signature}"
    qr = qrcode.QRCode(box_size=10, border=4)
    qr.add_data(content)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    data_url = f"data:image/png;base64,{img_str}"

    return jsonify({'code': 0, 'data': {'qrcode': data_url}})
@transaction_bp.route('/scan', methods=['POST'])
@jwt_required()
def scan_qrcode():
    scanner_id = get_jwt_identity()
    print(f"scanner_id (原始): {scanner_id}, 类型: {type(scanner_id)}")
    try:
        scanner_id = int(scanner_id)
    except:
        return jsonify({'code': 400, 'message': '无效的用户身份'}), 400
    print(f"scanner_id (转换后): {scanner_id}")

    data = request.get_json()
    qr_content = data.get('content')
    print(f"收到扫码内容: {qr_content}")

    parts = qr_content.split(':')
    if len(parts) != 4:
        print(f"内容长度错误: {len(parts)}")
        return jsonify({'code': 400, 'message': '无效的二维码'}), 400

    post_id, target_user_id, timestamp, signature = parts
    print(f"解析结果: post_id={post_id}, target_user_id={target_user_id}, timestamp={timestamp}, signature={signature[:10]}...")

    try:
        post_id = int(post_id)
        target_user_id = int(target_user_id)
        timestamp = int(timestamp)
    except Exception as e:
        print(f"整数转换失败: {e}")
        return jsonify({'code': 400, 'message': '参数格式错误'}), 400

    # 获取 Redis 客户端
    redis_client = get_redis()
    if redis_client is None:
        return jsonify({'code': 500, 'message': '缓存服务不可用'}), 500

    # 验证签名
    secret_key = current_app.config['JWT_SECRET_KEY'].encode()
    message = f"{post_id}:{target_user_id}:{timestamp}".encode()
    expected_signature = hmac.new(secret_key, message, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        print("签名验证失败")
        return jsonify({'code': 400, 'message': '二维码签名无效'}), 400
    print("签名验证通过")

    # 验证时间戳
    now = int(time.time())
    if now - timestamp > 600:
        print(f"时间戳超时: now={now}, timestamp={timestamp}")
        return jsonify({'code': 400, 'message': '二维码已过期'}), 400
    print("时间戳验证通过")

    # 从 Redis 验证
    qr_key = f"qrcode:{post_id}:{target_user_id}"
    stored = redis_client.get(qr_key)
    if not stored:
        print(f"Redis中未找到 key: {qr_key}")
        return jsonify({'code': 400, 'message': '二维码已失效或不存在'}), 400
    stored_data = json.loads(stored)
    if stored_data['signature'] != signature:
        print("存储的签名不匹配")
        return jsonify({'code': 400, 'message': '二维码无效'}), 400
    redis_client.delete(qr_key)
    print("Redis验证通过")

    # 验证扫码者
    if scanner_id != target_user_id:
        print(f"扫码者身份不匹配: scanner_id={scanner_id}, target_user_id={target_user_id}")
        return jsonify({'code': 400, 'message': '扫码者身份不匹配'}), 400
    print("扫码者身份匹配")

    # 验证发布状态
    post = Post.query.get(post_id)
    if not post:
        print(f"帖子不存在: {post_id}")
        return jsonify({'code': 400, 'message': '发布状态异常'}), 400
    if post.status != 'active':
        print(f"帖子状态异常: {post.status}")
        return jsonify({'code': 400, 'message': '发布状态异常'}), 400
    print("帖子状态正常")

    # 验证对接者状态
    target_user = User.query.get(target_user_id)
    if not target_user or target_user.status != 'verified':
        print(f"对接者状态异常: {target_user.status if target_user else '不存在'}")
        return jsonify({'code': 400, 'message': '对接者账号异常'}), 400
    print("对接者状态正常")

    # ========== 核心逻辑：区分招领与其他类型 ==========
    if post.type == 'found':
        # 招领帖子：进入24小时保护期
        post.protection_end_time = datetime.now() + timedelta(hours=24)
        post.status = 'pending_confirm'
        post.claimer_id = target_user_id   # 记录扫码者（假失主）
        db.session.commit()

        # 可选：通知发布者有人扫码认领
        # 这里可以添加发送通知的代码（如 Notification 给 post.user_id）

        return jsonify({'code': 0, 'message': '确认成功，进入24小时保护期'})

    else:
        # 其他类型（lost, sale, wanted）直接完成交易
        post.status = 'completed'
        db.session.commit()
        cancel_favorites_for_post(post_id)

        # 创建交易记录
        type_mapping = {
            'lost': ('return', 'claim'),
            'found': ('claim', 'return'),
            'sale': ('sale', 'purchase'),
            'wanted': ('purchase', 'sale')
        }
        pub_type, rec_type = type_mapping[post.type]

        record_publisher = TransactionRecord(
            post_id=post_id,
            publisher_id=post.user_id,
            receiver_id=target_user_id,
            type=pub_type,
            completed_at=datetime.now()
        )
        record_receiver = TransactionRecord(
            post_id=post_id,
            publisher_id=post.user_id,
            receiver_id=target_user_id,
            type=rec_type,
            completed_at=datetime.now()
        )
        db.session.add_all([record_publisher, record_receiver])
        db.session.commit()

        # 添加奖励积分（仅限归还行为）
        if post.type == 'lost':
            add_reward_points(target_user_id, 10, f'成功归还物品: {post.title}', related_id=post.id)
        elif post.type == 'found':
            add_reward_points(post.user_id, 10, f'成功归还物品: {post.title}', related_id=post.id)

        return jsonify({'code': 0, 'message': '交易完成'})
@transaction_bp.route('/list', methods=['GET'])
@jwt_required()
def get_transaction_list():
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except:
        return jsonify({'code': 400, 'message': '无效的用户身份'}), 400
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    type_ = request.args.get('type')  # claim/return/purchase/sale（可选）

    query = TransactionRecord.query.filter(
        (TransactionRecord.publisher_id == user_id) | (TransactionRecord.receiver_id == user_id)
    )
    if type_:
        query = query.filter(TransactionRecord.type == type_)
    query = query.order_by(TransactionRecord.completed_at.desc())

    total = query.count()
    records = query.offset((page-1)*limit).limit(limit).all()

    seen_posts = set()  # 用于去重
    data = []
    for r in records:
        if r.post_id in seen_posts:
            continue
        seen_posts.add(r.post_id)

        post = Post.query.get(r.post_id)
        if not post:
            continue

        # 确定对方ID和名称
        if r.publisher_id == user_id:
            other_id = r.receiver_id
            # 用户是发布者，根据帖子类型确定显示类型
            if post.type == 'lost':
                type_text = '归还'
            elif post.type == 'found':
                type_text = '认领'
            elif post.type == 'sale':
                type_text = '出售'
            elif post.type == 'wanted':
                type_text = '购买'
            else:
                type_text = ''
        else:
            other_id = r.publisher_id
            # 用户是接收者
            if post.type == 'lost':
                type_text = '认领'
            elif post.type == 'found':
                type_text = '归还'
            elif post.type == 'sale':
                type_text = '购买'
            elif post.type == 'wanted':
                type_text = '出售'
            else:
                type_text = ''

        other = User.query.get(other_id)
        data.append({
            'id': r.id,  # 这里取的是第一条记录的ID，可根据需要调整
            'title': post.title,
            'type': r.type,
            'typeText': type_text,
            'other_name': other.nickname if other else '未知',
            'completed_at': r.completed_at.strftime('%Y-%m-%d %H:%M')
        })

    return jsonify({'code': 0, 'data': {'list': data, 'total': total, 'page': page, 'limit': limit}})
@transaction_bp.route('/detail', methods=['GET'])
@jwt_required()
def get_transaction_detail():
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except:
        return jsonify({'code': 400, 'message': '无效的用户身份'}), 400

    record_id = request.args.get('id', type=int)
    if not record_id:
        return jsonify({'code': 400, 'message': '缺少参数 id'}), 400
    record = TransactionRecord.query.get(record_id)
    if not record:
        return jsonify({'code': 404, 'message': '记录不存在'}), 404
    if user_id not in (record.publisher_id, record.receiver_id):
        return jsonify({'code': 403, 'message': '无权查看'}), 403

    post = Post.query.get(record.post_id)
    if not post:
        return jsonify({'code': 404, 'message': '关联帖子不存在'}), 404
    other_id = record.receiver_id if record.publisher_id == user_id else record.publisher_id
    other = User.query.get(other_id)
    data = {
        'id': record.id,
        'title': post.title,
        'type': record.type,
        'typeText': {'claim': '认领', 'return': '归还', 'purchase': '购买', 'sale': '出售'}.get(record.type, ''),
        'other_name': other.nickname if other else '未知',
        'completed_at': record.completed_at.strftime('%Y-%m-%d %H:%M')
    }
    return jsonify({'code': 0, 'data': data})