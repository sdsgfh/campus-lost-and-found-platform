from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.post import Post
from app.models.user import User
from datetime import datetime, timedelta

trade_bp = Blueprint('trade', __name__, url_prefix='/api/trade')

def calculate_time_score(created_at):
    now = datetime.now()
    delta = now - created_at
    if delta < timedelta(hours=1):
        return 70
    elif delta < timedelta(hours=24):
        return 60
    elif delta < timedelta(days=7):
        return 50
    elif delta < timedelta(days=15):
        return 40
    else:
        return 30

@trade_bp.route('/list', methods=['GET'])
def get_trade_list():
    try:
        # 获取参数
        type_ = request.args.get('type', 'sale')
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        sort = request.args.get('sort', 'comprehensive')
        category_id = request.args.get('category_id')
        condition = request.args.get('condition')
        price_min = request.args.get('price_min')
        price_max = request.args.get('price_max')

        # 有效排序
        valid_sorts = ['comprehensive', 'hot', 'time']
        if sort not in valid_sorts:
            sort = 'comprehensive'

        # 基础查询（不加载用户关系，后续手动获取用户）
        query = Post.query.filter_by(type=type_, status='active')

        if category_id:
            query = query.filter_by(category_id=category_id)
        if condition:
            if type_ == 'sale':
                query = query.filter_by(condition=condition)
            else:
                query = query.filter_by(expected_condition=condition)

        price_field = Post.price if type_ == 'sale' else Post.expected_price
        if price_min:
            query = query.filter(price_field >= float(price_min))
        if price_max:
            query = query.filter(price_field <= float(price_max))

        all_posts = query.all()
        total = len(all_posts)

        # 按时间排序
        if sort == 'time':
            sorted_posts = sorted(all_posts, key=lambda p: p.created_at, reverse=True)

        # 按热度排序
        elif sort == 'hot':
            sorted_posts = sorted(all_posts, key=lambda p: (p.view_count * 0.4 + p.favorite_count * 0.6), reverse=True)

        # 综合排序
        else:
            # 计算时间得分
            time_scores = [calculate_time_score(p.created_at) for p in all_posts]

            # 计算热度值
            hot_values = [p.view_count * 0.4 + p.favorite_count * 0.6 for p in all_posts]
            max_hot = max(hot_values) if hot_values else 1  # 避免除零

            # 信誉等级映射
            def get_credit_level(score):
                if score >= 90: return 100
                elif score >= 70: return 80
                elif score >= 60: return 60
                else: return 20

            scored = []
            for p, ts, hv in zip(all_posts, time_scores, hot_values):
                hot_score = (hv / max_hot) * 100

                # 手动查询用户（避免使用 p.user，因为可能未加载）
                user = db.session.get(User, p.user_id)
                credit = user.credit_score if user else 80  # 默认80分
                credit_level = get_credit_level(credit)

                composite = ts * 0.25 + hot_score * 0.5 + credit_level * 0.25
                scored.append((composite, p))

            scored.sort(key=lambda x: x[0], reverse=True)
            sorted_posts = [p for _, p in scored]

        # 分页
        start = (page - 1) * limit
        end = start + limit
        paginated_posts = sorted_posts[start:end]

        # 构建返回数据
        data = []
        for post in paginated_posts:
            item = {
                'id': post.id,
                'title': post.title,
                'images': post.images if post.images else [],
                'created_at': post.created_at.strftime('%Y-%m-%d %H:%M'),
                'type': post.type,
                'view_count': post.view_count,
                'favorite_count': post.favorite_count
            }
            if post.type == 'sale':
                item['price'] = str(post.price) if post.price else ''
            elif post.type == 'wanted':
                item['expected_price'] = str(post.expected_price) if post.expected_price else ''
            data.append(item)

        return jsonify({
            'code': 0,
            'data': {
                'list': data,
                'total': total,
                'page': page,
                'limit': limit
            }
        })

    except Exception as e:
        print(f"[Trade Error] {e}")
        return jsonify({'code': 500, 'message': '服务器内部错误'}), 500