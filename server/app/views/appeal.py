from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.models.report import Report
from app.models.transaction_record import TransactionRecord

appeal_bp = Blueprint('appeal', __name__, url_prefix='/api/appeal')

@appeal_bp.route('/create', methods=['POST'])
@jwt_required()
def create_appeal():
    user_id = get_jwt_identity()
    data = request.get_json()
    required_fields = ['appeal_type', 'target_type', 'target_id', 'reason']
    for f in required_fields:
        if f not in data:
            return jsonify({'code': 400, 'message': f'缺少参数 {f}'}), 400

    # 验证申诉人是否被封禁？申诉人封禁则自动驳回，但提交时先检查？我们可以在提交时检查，如果被封禁则拒绝。
    user = User.query.get(user_id)
    if user.status == 'banned':
        return jsonify({'code': 400, 'message': '账号被封禁，无法申诉'}), 400

    appeal = Appeal(
        appellant_id=user_id,
        appeal_type=data['appeal_type'],
        target_type=data['target_type'],
        target_id=data['target_id'],
        reason=data['reason'],
        evidence_images=data.get('evidence_images', []),
        status='pending'
    )
    db.session.add(appeal)
    db.session.commit()

    return jsonify({'code': 0, 'message': '申诉提交成功，等待审核', 'data': {'id': appeal.id}})

@appeal_bp.route('/mylist', methods=['GET'])
@jwt_required()
def get_my_appeals():
    user_id = get_jwt_identity()
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    status = request.args.get('status')
    sort = request.args.get('sort', 'time')

    query = Appeal.query.filter_by(appellant_id=user_id)

    if status:
        query = query.filter_by(status=status)

    if sort == 'status':
        from sqlalchemy import case
        status_order = case(
            (Appeal.status == 'pending', 1),
            (Appeal.status == 'approved', 2),
            (Appeal.status == 'rejected', 3),
            else_=4
        )
        query = query.order_by(status_order, Appeal.created_at.desc())
    else:
        query = query.order_by(Appeal.created_at.desc())

    total = query.count()
    appeals = query.offset((page-1)*limit).limit(limit).all()

    data = []
    for a in appeals:
        # 获取申诉对象信息，用于显示
        target_info = {}
        if a.target_type == 'report':
            report = Report.query.get(a.target_id)
            if report:
                target_info = {'id': report.id, 'type': '举报'}
        elif a.target_type == 'transaction_record':
            tr = TransactionRecord.query.get(a.target_id)
            if tr:
                target_info = {'id': tr.id, 'type': '交易记录'}
        # 其他...

        data.append({
            'id': a.id,
            'appeal_type': a.appeal_type,
            'target_type': a.target_type,
            'target_id': a.target_id,
            'target_info': target_info,
            'reason': a.reason,
            'evidence_images': a.evidence_images,
            'status': a.status,
            'result': a.result,
            'created_at': a.created_at.strftime('%Y-%m-%d %H:%M')
        })

    return jsonify({'code': 0, 'data': {'list': data, 'total': total, 'page': page, 'limit': limit}})

@appeal_bp.route('/detail', methods=['GET'])
@jwt_required()
def get_appeal_detail():
    appeal_id = request.args.get('id', type=int)
    if not appeal_id:
        return jsonify({'code': 400, 'message': '缺少参数 id'}), 400
    appeal = Appeal.query.get(appeal_id)
    if not appeal:
        return jsonify({'code': 404, 'message': '申诉不存在'}), 404
    if appeal.appellant_id != get_jwt_identity():
        return jsonify({'code': 403, 'message': '无权查看'}), 403

    target_info = {}
    if appeal.target_type == 'report':
        report = Report.query.get(appeal.target_id)
        if report:
            target_info = {'id': report.id, 'type': '举报'}
    # 类似处理其他

    data = {
        'id': appeal.id,
        'appeal_type': appeal.appeal_type,
        'target_type': appeal.target_type,
        'target_id': appeal.target_id,
        'target_info': target_info,
        'reason': appeal.reason,
        'evidence_images': appeal.evidence_images,
        'status': appeal.status,
        'result': appeal.result,
        'created_at': appeal.created_at.strftime('%Y-%m-%d %H:%M')
    }
    return jsonify({'code': 0, 'data': data})

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.appeal import Appeal
from sqlalchemy import case

@appeal_bp.route('/mylist', methods=['GET'])
@jwt_required()
def my_appeal_list():
    user_id = get_jwt_identity()
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    sort = request.args.get('sort', 'time')

    query = Appeal.query.filter_by(appellant_id=user_id)

    if sort == 'status':
        query = query.order_by(
            case(
                (Appeal.status == 'pending', 0),
                (Appeal.status == 'approved', 1),
                (Appeal.status == 'rejected', 2)
            ),
            Appeal.created_at.desc()
        )
    else:
        query = query.order_by(Appeal.created_at.desc())

    total = query.count()
    appeals = query.offset((page-1)*limit).limit(limit).all()

    data = [{
        'id': a.id,
        'appeal_type': a.appeal_type,
        'target_type': a.target_type,
        'target_id': a.target_id,
        'status': a.status,
        'reason': a.reason,
        'evidence_images': a.evidence_images,
        'result': a.result,
        'created_at': a.created_at.strftime('%Y-%m-%d %H:%M')
    } for a in appeals]

    return jsonify({
        'code': 0,
        'data': {
            'list': data,
            'total': total,
            'page': page,
            'limit': limit
        }
    })