from flask import Blueprint, jsonify
from app.extensions import db
from app.models.category import Category

category_bp = Blueprint('category', __name__, url_prefix='/api/category')

@category_bp.route('/list', methods=['GET'])
def get_category_list():
    """获取所有物品分类"""
    categories = Category.query.order_by(Category.sort_order).all()
    data = [{'id': c.id, 'name': c.name} for c in categories]
    return jsonify({'code': 0, 'data': data})