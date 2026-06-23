import pymysql
import random
import json
from datetime import datetime, timedelta

# ================== 数据库配置 ==================
DB_HOST = 'localhost'
DB_USER = 'root'
DB_PASSWORD = '123456'       # 替换为您的密码
DB_NAME = 'xiaomi_db'
# ==============================================

# 连接数据库
conn = pymysql.connect(
    host=DB_HOST,
    user=DB_USER,
    password=DB_PASSWORD,
    database=DB_NAME,
    charset='utf8mb4'
)
cursor = conn.cursor()

# 1. 获取所有用户 ID（取前 100 个）
cursor.execute("SELECT id FROM user LIMIT 100")
user_ids = [row[0] for row in cursor.fetchall()]
if not user_ids:
    raise Exception("user 表无数据，请先插入用户")

# 2. 获取所有分类 ID，如果没有则插入默认分类
cursor.execute("SELECT id FROM category")
category_ids = [row[0] for row in cursor.fetchall()]
if not category_ids:
    default_cats = [
        ('教材书籍', 1), ('数码电子', 2), ('服饰鞋包', 3),
        ('美妆护肤', 4), ('生活用品', 5), ('文具办公', 6),
        ('体育用品', 7), ('其他', 8)
    ]
    for name, sort in default_cats:
        cursor.execute("INSERT INTO category (name, sort_order) VALUES (%s, %s)", (name, sort))
    conn.commit()
    cursor.execute("SELECT id FROM category")
    category_ids = [row[0] for row in cursor.fetchall()]

# 3. 随机生成函数
def random_status():
    """80% active, 20% pending (暂不考虑 completed/expired)"""
    return random.choices(['active', 'pending'], weights=[8, 2])[0]

def random_images(count=1):
    return json.dumps(["/images/default.png" for _ in range(count)])

def random_title(ptype):
    items_lostfound = ['校园卡', '钥匙', '书包', '水杯', '雨伞', '笔记本', '手机', '耳机', '钱包', '眼镜']
    items_trade = ['高等数学', '考研英语', '自行车', '台灯', '篮球', '吉他', '计算器', '充电宝', '耳机', '键盘']
    if ptype in ['lost', 'found']:
        return f"{random.choice(items_lostfound)}（{ptype}）"
    else:
        return f"{random.choice(items_trade)}（{ptype}）"

def random_description():
    descs = [
        '成色很新，使用不到一年',
        '在食堂丢失，如有捡到请联系',
        '价格可小刀，欢迎私聊',
        '急需，谢谢大家',
        '物品完好，功能正常',
        '当面交易，仅限校内'
    ]
    return random.choice(descs)

def random_location():
    places = ['一食堂', '二教', '图书馆', '体育馆', '宿舍楼', '教学楼', '实验楼', '操场']
    return random.choice(places)

def random_price():
    return round(random.uniform(5.0, 500.0), 2)

def random_days_ago():
    return random.randint(0, 30)

def random_hours_ago():
    return random.randint(1, 168)  # 最多7天

# 枚举值
CONDITIONS = ['new', 'almost_new', 'good', 'fair', 'poor']

# 准备插入数据
insert_data = []

for i in range(500):
    user_id = random.choice(user_ids)
    category_id = random.choice(category_ids)
    ptype = random.choice(['lost', 'found', 'sale', 'wanted'])
    title = random_title(ptype)
    description = random_description()
    images = random_images(random.randint(1, 3))  # 1-3张图
    status = random_status()
    view_count = random.randint(0, 200)
    favorite_count = random.randint(0, 50)

    # 基础时间：created_at 在过去0-60天内随机
    created_at = datetime.now() - timedelta(days=random_days_ago())
    published_at = created_at if status == 'active' else None  # active 状态下发布时间等于创建时间（或稍晚）
    # 可调整为 published_at = created_at + timedelta(minutes=random.randint(0, 60))，但为简化保持相同

    # 特有字段默认值
    location = None
    lost_time = None
    price = None
    expected_price = None
    condition = None
    expected_condition = None
    expiry_days = None
    expiry_time = None
    protection_end_time = None

    if ptype in ['lost', 'found']:
        location = random_location()
        # lost_time 必须在 published_at 之前（如果有 published_at），否则在当前时间之前
        base_time = published_at if published_at else created_at
        # 随机在 base_time 之前 1 小时到 7 天之间
        lost_offset = timedelta(hours=random_hours_ago())
        lost_time = base_time - lost_offset
        # 确保 lost_time 不超过当前时间（但已经通过随机控制）
        # 招领可设置保护期
        if ptype == 'found' and random.random() < 0.3:
            protection_end_time = base_time + timedelta(hours=24)
    else:
        if ptype == 'sale':
            price = random_price()
            condition = random.choice(CONDITIONS)
        else:  # wanted
            expected_price = random_price()
            expected_condition = random.choice(CONDITIONS)

    # 有效期天数：随机7/14/30
    expiry_days = random.choice([7, 14, 30])
    if published_at:
        expiry_time = published_at + timedelta(days=expiry_days)
    else:
        expiry_time = None

    # 组装数据（与表字段顺序一致）
    insert_data.append((
        user_id, ptype, category_id, title, description, images,
        status, location, lost_time, expiry_days, expiry_time,
        price, expected_price, condition, expected_condition,
        view_count, favorite_count, published_at, protection_end_time, created_at
    ))

# 4. 批量插入
sql = """
INSERT INTO post (
    user_id, `type`, category_id, title, description, images,
    status, location, lost_time, expiry_days, expiry_time,
    price, expected_price, `condition`, `expected_condition`,
    view_count, favorite_count, published_at, protection_end_time, created_at
) VALUES (
    %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s,
    %s, %s, %s, %s,
    %s, %s, %s, %s, %s
)
"""

try:
    cursor.executemany(sql, insert_data)
    conn.commit()
    print(f"成功插入 {len(insert_data)} 条 post 记录")
except Exception as e:
    conn.rollback()
    print(f"插入失败: {e}")
finally:
    cursor.close()
    conn.close()