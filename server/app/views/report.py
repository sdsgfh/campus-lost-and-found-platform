from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.report import Report
from app.models.user import User
from app.models.post import Post
from app.models.notification import Notification
from datetime import date, datetime
import json

report_bp = Blueprint('report', __name__, url_prefix='/api/report')

@report_bp.route('/create', methods=['POST'])
@jwt_required()
def create_report():
    user_id = get_jwt_identity()
    data = request.get_json()
    # 参数验证
    required_fields = ['report_type', 'sub_type', 'target_type', 'target_id', 'reason']
    for f in required_fields:
        if f not in data:
            return jsonify({'code': 400, 'message': f'缺少参数 {f}'}), 400

    # 检查每日举报次数
    user = User.query.get(user_id)
    today = date.today()
    if user.last_report_date == today:
        if user.daily_report_count >= 3:
            return jsonify({'code': 400, 'message': '今日举报次数已用完，请明日再试'}), 400
        else:
            user.daily_report_count += 1
    else:
        user.last_report_date = today
        user.daily_report_count = 1
    db.session.add(user)

    # 创建举报记录
    report = Report(
        reporter_id=user_id,
        report_type=data['report_type'],
        sub_type=data['sub_type'],
        target_type=data['target_type'],
        target_id=data['target_id'],
        reason=data['reason'],
        evidence_images=data.get('evidence_images', []),  # 图片URL数组
        status='pending'
    )
    db.session.add(report)
    db.session.commit()

    return jsonify({'code': 0, 'message': '举报提交成功，等待审核', 'data': {'id': report.id}})

@report_bp.route('/mylist', methods=['GET'])
@jwt_required()
def get_my_reports():
    user_id = get_jwt_identity()
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    status = request.args.get('status')  # 可选筛选 pending/approved/rejected
    sort = request.args.get('sort', 'time')  # time 或 status

    query = Report.query.filter_by(reporter_id=user_id)

    if status:
        query = query.filter_by(status=status)

    if sort == 'status':
        # 按状态优先级排序：pending > approved > rejected
        from sqlalchemy import case
        status_order = case(
            (Report.status == 'pending', 1),
            (Report.status == 'approved', 2),
            (Report.status == 'rejected', 3),
            else_=4
        )
        query = query.order_by(status_order, Report.created_at.desc())
    else:
        query = query.order_by(Report.created_at.desc())

    total = query.count()
    reports = query.offset((page-1)*limit).limit(limit).all()

    data = []
    for r in reports:
        # 获取被举报对象信息
        target_info = {}
        if r.target_type == 'post':
            post = Post.query.get(r.target_id)
            if post:
                target_info = {'title': post.title, 'id': post.id}
        elif r.target_type == 'user':
            target_user = User.query.get(r.target_id)
            if target_user:
                target_info = {'nickname': target_user.nickname, 'id': target_user.id}
        # 其他类型暂不处理

        data.append({
            'id': r.id,
            'report_type': r.report_type,
            'sub_type': r.sub_type,
            'target_type': r.target_type,
            'target_id': r.target_id,
            'target_info': target_info,
            'reason': r.reason,
            'evidence_images': r.evidence_images,
            'status': r.status,
            'result': r.result,
            'created_at': r.created_at.strftime('%Y-%m-%d %H:%M')
        })

    return jsonify({
        'code': 0,
        'data': {
            'list': data,
            'total': total,
            'page': page,
            'limit': limit
        }
    })

@report_bp.route('/detail', methods=['GET'])
@jwt_required()
def get_report_detail():
    report_id = request.args.get('id', type=int)
    if not report_id:
        return jsonify({'code': 400, 'message': '缺少参数 id'}), 400

    report = Report.query.get(report_id)
    if not report:
        return jsonify({'code': 404, 'message': '举报不存在'}), 404

    # 将当前用户 ID 转为整数
    current_user_id = get_jwt_identity()
    try:
        current_user_id = int(current_user_id)
    except ValueError:
        return jsonify({'code': 400, 'message': '无效的用户身份'}), 400

    if report.reporter_id != current_user_id:
        return jsonify({'code': 403, 'message': '无权查看'}), 403

    # 后续获取 target_info 等代码保持不变...
    target_info = {}
    if report.target_type == 'post':
        post = Post.query.get(report.target_id)
        if post:
            target_info = {'title': post.title, 'id': post.id}
    elif report.target_type == 'user':
        target_user = User.query.get(report.target_id)
        if target_user:
            target_info = {'nickname': target_user.nickname, 'id': target_user.id}

    data = {
        'id': report.id,
        'report_type': report.report_type,
        'sub_type': report.sub_type,
        'target_type': report.target_type,
        'target_id': report.target_id,
        'target_info': target_info,
        'reason': report.reason,
        'evidence_images': report.evidence_images,
        'status': report.status,
        'result': report.result,
        'created_at': report.created_at.strftime('%Y-%m-%d %H:%M')
    }
    return jsonify({'code': 0, 'data': data})
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.report import Report
from app.models.post import Post
from app.models.user import User
from sqlalchemy import case

@report_bp.route('/mylist', methods=['GET'])
@jwt_required()
def my_report_list():
    try:
        user_id = get_jwt_identity()
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        sort = request.args.get('sort', 'time')

        query = Report.query.filter_by(reporter_id=user_id)

        if sort == 'status':
            query = query.order_by(
                case(
                    (Report.status == 'pending', 0),
                    (Report.status == 'approved', 1),
                    (Report.status == 'rejected', 2)
                ),
                Report.created_at.desc()
            )
        else:
            query = query.order_by(Report.created_at.desc())

        total = query.count()
        reports = query.offset((page-1)*limit).limit(limit).all()

        data = []
        for r in reports:
            # 获取被举报对象名称，若不存在则用占位符
            target_name = None
            if r.target_type == 'post':
                post = Post.query.get(r.target_id)
                target_name = post.title if post else '[已删除]'
            elif r.target_type == 'user':
                user = User.query.get(r.target_id)
                target_name = user.nickname if user else '[已注销]'
            else:
                target_name = '未知'

            data.append({
                'id': r.id,
                'target_type': r.target_type,
                'target_id': r.target_id,
                'target_name': target_name,
                'report_type': r.report_type,
                'sub_type': r.sub_type,
                'status': r.status,
                'reason': r.reason,
                'evidence_images': r.evidence_images,
                'result': r.result,
                'created_at': r.created_at.strftime('%Y-%m-%d %H:%M')
            })

        return jsonify({'code': 0, 'data': {'list': data, 'total': total, 'page': page, 'limit': limit}})
    except Exception as e:
        print(f"Error in my_report_list: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'code': 500, 'message': '服务器内部错误'}), 500