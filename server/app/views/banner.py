from flask import Blueprint, jsonify
from app.extensions import db
from app.models.banner import Banner

banner_bp = Blueprint('banner', __name__, url_prefix='/api/banner')

@banner_bp.route('/list', methods=['GET'])
def get_banner_list():
    """获取首页轮播图列表（只返回启用的）"""
    banners = Banner.query.filter_by(status='active').order_by(Banner.sort_order).all()
    data = [{
        'id': b.id,
        'title': b.title,
        'image_url': b.image_url,
        'link_type': b.link_type,
        'link_value': b.link_value
    } for b in banners]
    return jsonify({'code': 0, 'data': data})