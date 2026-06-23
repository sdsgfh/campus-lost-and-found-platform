from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.user import User
from app.models.post import Post
from app.utils.audit import audit_content  # 使用统一审核函数
import os
import uuid
import time
from werkzeug.utils import secure_filename

chat_bp = Blueprint('chat', __name__, url_prefix='/api/chat')

# ========== 强制指定绝对路径（避免任何路径计算错误） ==========
# 直接写死根目录（Windows下注意转义）
CHAT_UPLOAD_FOLDER = r"D:\Python Projects\xiaomi\chat_uploads"
print(f"📁 聊天图片保存路径（强制）：{CHAT_UPLOAD_FOLDER}")

# 确保目录存在
if not os.path.exists(CHAT_UPLOAD_FOLDER):
    os.makedirs(CHAT_UPLOAD_FOLDER, exist_ok=True)
    print(f"✅ 创建目录：{CHAT_UPLOAD_FOLDER}")

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ========== 重写上传接口（彻底解决文件名问题） ==========
@chat_bp.route('/upload-image', methods=['POST'])
@jwt_required()
def upload_chat_image():
    try:
        if 'file' not in request.files:
            return jsonify({'code': 400, 'message': '未选择图片文件'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'code': 400, 'message': '文件名为空'}), 400

        if not allowed_file(file.filename):
            return jsonify({'code': 400, 'message': '仅支持png/jpg/jpeg/gif格式'}), 400

        # 1. 提取文件后缀
        ext = file.filename.rsplit('.', 1)[1].lower()
        # 2. 用UUID生成绝对唯一的文件名（彻底避免冲突）
        unique_filename = f"{uuid.uuid4()}.{ext}"
        # 3. 拼接完整保存路径
        save_path = os.path.join(CHAT_UPLOAD_FOLDER, unique_filename)

        # 4. 保存文件并校验
        file.save(save_path)
        if not os.path.exists(save_path):
            return jsonify({'code': 500, 'message': '文件保存失败'}), 500

        # 5. 生成绝对正确的访问URL（强制使用127.0.0.1:5000，避免request.host_url异常）
        file_url = f"http://127.0.0.1:5000/api/chat/chat-uploads/{unique_filename}"

        # 调试打印（关键：对比保存的文件名和返回的URL）
        print(f"🖼️ 保存成功：{save_path}")
        print(f"🔗 访问URL：{file_url}")

        return jsonify({
            'code': 0,
            'message': '图片上传成功',
            'url': file_url
        })
    except Exception as e:
        print(f"❌ 上传失败：{str(e)}")
        return jsonify({'code': 500, 'message': f'上传失败：{str(e)}'}), 500


# ========== 重写静态访问接口（增加容错） ==========
@chat_bp.route('/chat-uploads/<filename>')
def serve_chat_image(filename):
    try:
        # 强制清理文件名（避免特殊字符）
        filename = secure_filename(filename)
        file_path = os.path.join(CHAT_UPLOAD_FOLDER, filename)

        # 调试打印（关键：查看实际请求的文件）
        print(f"🔍 请求图片：{file_path}")

        if not os.path.exists(file_path):
            print(f"❌ 文件不存在")
            return jsonify({'code': 404, 'message': '图片不存在'}), 404

        # 禁用缓存 + 强制返回图片类型
        response = send_from_directory(CHAT_UPLOAD_FOLDER, filename)
        response.headers['Cache-Control'] = 'no-cache'
        response.headers['Content-Type'] = f'image/{filename.rsplit(".", 1)[1].lower()}'
        return response
    except Exception as e:
        print(f"❌ 访问失败：{str(e)}")
        return jsonify({'code': 500, 'message': '访问失败'}), 500


@chat_bp.route('/send', methods=['POST'])
@jwt_required()
def send_message():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()

        # 参数校验
        session_id = data.get('session_id')
        msg_type = data.get('msg_type', 'text')
        content = data.get('content')
        receiver_id = data.get('receiver_id')

        if not session_id or not receiver_id:
            return jsonify({'code': 400, 'message': '会话ID/接收方ID不能为空'}), 400

        # ========== 宽松模式：替换敏感词，不拦截 ==========
        original_content = content  # 保存原始内容（用于对比）
        if msg_type == 'text':
            audit_result = audit_content('chat', content)
            # 打印审核结果（调试关键）
            print(f"🔍 敏感词审核：原始={original_content}, 替换后={audit_result['content']}, 是否违规={not audit_result['passed']}")
            # 自动将敏感词替换为***，不返回400
            content = audit_result['content']  # 核心修改：仅替换，不拦截

        # 图片消息校验（不变）
        elif msg_type == 'image':
            if not content or not content.startswith(('http://', 'https://')):
                return jsonify({'code': 400, 'message': '图片URL格式无效'}), 400

        # 保存消息（后续逻辑不变）
        new_message = ChatMessage(
            session_id=int(session_id),
            sender_id=int(user_id),
            receiver_id=int(receiver_id),
            msg_type=msg_type,
            content=content if msg_type == 'text' else None,
            image_url=content if msg_type == 'image' else None,
            is_read=False
        )
        db.session.add(new_message)

        # 更新会话
        session = ChatSession.query.get(int(session_id))
        if session:
            session.last_message = content[:50] if msg_type == 'text' else '[图片]'
            session.last_message_time = db.func.current_timestamp()
            if session.initiator_id == int(user_id):
                session.unread_count_receiver += 1
            else:
                session.unread_count_initiator += 1

        db.session.commit()

        # ========== 核心修复：返回替换后的content ==========
        return jsonify({
            'code': 0,
            'message': '消息发送成功',
            'data': {
                'message_id': new_message.id,
                'created_at': new_message.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'content': content  # 新增：返回替换后的内容
            }
        })
    except Exception as e:
        db.session.rollback()
        print(f"❌ 发送失败：{str(e)}")
        return jsonify({'code': 500, 'message': f'发送失败：{str(e)}'}), 500
# ========== 其他接口保留（无需修改） ==========
@chat_bp.route('/sessions', methods=['GET'])
@jwt_required()
def get_sessions():
    """获取当前用户的会话列表"""
    user_id = int(get_jwt_identity())
    sessions = ChatSession.query.filter(
        (ChatSession.initiator_id == user_id) | (ChatSession.receiver_id == user_id),
        ChatSession.status == 'active'
    ).order_by(ChatSession.last_message_time.desc()).all()

    data = []
    for s in sessions:
        other_id = s.receiver_id if s.initiator_id == user_id else s.initiator_id
        other = User.query.get(other_id)
        if not other:
            continue
        unread = s.unread_count_receiver if s.receiver_id == user_id else s.unread_count_initiator
        last_msg = s.last_message or ''
        post_title = None
        if s.post_id:
            post = Post.query.get(s.post_id)
            post_title = post.title if post else None

        data.append({
            'session_id': s.id,
            'other_user': {
                'id': other.id,
                'nickname': other.nickname,
                'avatar': other.avatar,
                'status': other.status
            },
            'last_message': last_msg,
            'last_message_time': s.last_message_time.strftime('%Y-%m-%d %H:%M') if s.last_message_time else None,
            'unread_count': unread,
            'post_title': post_title,
            'post_id': s.post_id
        })

    return jsonify({'code': 0, 'data': data})


@chat_bp.route('/session/create', methods=['POST'])
@jwt_required()
def create_session():
    """创建或获取私聊会话"""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    other_id = data.get('other_id')
    post_id = data.get('post_id')

    if not other_id or other_id == user_id:
        return jsonify({'code': 400, 'message': '参数错误'}), 400

    other = User.query.get(other_id)
    if not other or other.status in ('banned', 'cancelled'):
        return jsonify({'code': 400, 'message': '对方账号异常，无法发起聊天'}), 400

    session = ChatSession.query.filter(
        ((ChatSession.initiator_id == user_id) & (ChatSession.receiver_id == other_id) & (
                    ChatSession.post_id == post_id)) |
        ((ChatSession.initiator_id == other_id) & (ChatSession.receiver_id == user_id) & (
                    ChatSession.post_id == post_id))
    ).first()

    if not session:
        session = ChatSession(
            initiator_id=user_id,
            receiver_id=other_id,
            post_id=post_id,
            last_message_time=None,
            status='active'
        )
        db.session.add(session)
        db.session.commit()

    return jsonify({'code': 0, 'data': {'session_id': session.id}})


@chat_bp.route('/messages', methods=['GET'])
@jwt_required()
def get_messages():
    try:
        user_id = int(get_jwt_identity())
        session_id = request.args.get('session_id', type=int)
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))

        session = ChatSession.query.get(session_id)
        if not session:
            return jsonify({'code': 404, 'message': '会话不存在'}), 404
        if user_id not in (session.initiator_id, session.receiver_id):
            return jsonify({'code': 403, 'message': '无权查看'}), 403

        other_id = session.receiver_id if session.initiator_id == user_id else session.initiator_id
        other = User.query.get(other_id)
        if not other:
            return jsonify({'code': 404, 'message': '对方用户不存在'}), 404

        # 标记已读
        if session.receiver_id == user_id:
            session.unread_count_receiver = 0
        else:
            session.unread_count_initiator = 0
        ChatMessage.query.filter_by(session_id=session_id, receiver_id=user_id, is_read=False).update({'is_read': True})
        db.session.commit()

        # 分页获取消息
        query = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.created_at.asc())
        total = query.count()
        messages = query.offset((page - 1) * limit).limit(limit).all()

        msg_list = []
        for m in messages:
            msg_list.append({
                'id': m.id,
                'sender_id': m.sender_id,
                'msg_type': m.msg_type,
                'content': m.content,
                'image_url': m.image_url,
                'is_read': m.is_read,
                'created_at': m.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })

        post_title = session.post.title if session.post else None

        return jsonify({
            'code': 0,
            'data': {
                'session_id': session.id,
                'other_user': {
                    'id': other.id,
                    'nickname': other.nickname,
                    'avatar': other.avatar,
                    'status': other.status
                },
                'post_title': post_title,
                'messages': msg_list,
                'total': total,
                'page': page,
                'limit': limit
            }
        })
    except Exception as e:
        print(f"Error in get_messages: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'code': 500, 'message': '服务器内部错误'}), 500


@chat_bp.route('/delete_session', methods=['POST'])
@jwt_required()
def delete_session():
    """删除会话（支持批量）"""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    session_ids = data.get('session_ids', [])
    if not session_ids:
        return jsonify({'code': 400, 'message': '缺少参数'}), 400

    ChatSession.query.filter(
        ChatSession.id.in_(session_ids),
        (ChatSession.initiator_id == user_id) | (ChatSession.receiver_id == user_id)
    ).update({'status': 'deleted'}, synchronize_session=False)
    db.session.commit()
    return jsonify({'code': 0, 'message': '删除成功'})


@chat_bp.route('/mark_session_read', methods=['POST'])
@jwt_required()
def mark_session_read():
    """标记会话为已读"""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json()
        session_id = data.get('session_id')

        if not session_id:
            return jsonify({'code': 400, 'message': '缺少会话ID参数'}), 400

        session = ChatSession.query.get(session_id)
        if not session:
            return jsonify({'code': 404, 'message': '会话不存在'}), 404

        if user_id not in (session.initiator_id, session.receiver_id):
            return jsonify({'code': 403, 'message': '无权操作该会话'}), 403

        if session.initiator_id == user_id:
            session.unread_count_initiator = 0
        else:
            session.unread_count_receiver = 0

        ChatMessage.query.filter_by(
            session_id=session_id,
            receiver_id=user_id,
            is_read=False
        ).update({'is_read': True})

        db.session.commit()

        return jsonify({
            'code': 0,
            'message': '标记已读成功',
            'data': {'session_id': session_id}
        })
    except Exception as e:
        db.session.rollback()
        print(f"标记会话已读失败：{e}")
        import traceback
        traceback.print_exc()
        return jsonify({'code': 500, 'message': '服务器内部错误'}), 500