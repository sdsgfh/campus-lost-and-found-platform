import pymysql
import random
from datetime import datetime, timedelta

# ================== 数据库配置 ==================
DB_HOST = 'localhost'
DB_USER = 'root'
DB_PASSWORD = '123456'  # 替换为您的密码
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

# 从 sync_school 读取所有记录
cursor.execute("SELECT prefixed_id, name FROM sync_school")
rows = cursor.fetchall()
print(f"从 sync_school 读取到 {len(rows)} 条记录")

# 准备插入 user 表的数据
insert_data = []
openid_set = set()  # 用于检查 openid 唯一性

# 随机生成函数
def random_status():
    # 权重：verified 90%, unverified 5%, banned 3%, cancelled 2%
    return random.choices(
        ['verified', 'unverified', 'banned', 'cancelled'],
        weights=[90, 5, 3, 2]
    )[0]

def random_credit_score():
    return random.randint(80, 100)

def random_reward_points():
    return random.randint(0, 20)

def random_last_login():
    days_ago = random.randint(0, 30)
    return datetime.now() - timedelta(days=days_ago)

def random_created_at():
    days_ago = random.randint(365, 730)  # 1~2年前
    return datetime.now() - timedelta(days=days_ago)

# 使用公共占位图
DEFAULT_AVATAR = 'https://via.placeholder.com/150'
# 生成每条记录
for idx, (prefixed_id, name) in enumerate(rows):
    # 生成唯一 openid（mock_openid_1, mock_openid_2, ...）
    openid = f"mock_openid_{idx+1}"
    while openid in openid_set:
        idx += 1
        openid = f"mock_openid_{idx+1}"
    openid_set.add(openid)

    # 昵称：从姓名中取，或加随机后缀
    nickname = name + random.choice(['', '同学', '老师', str(random.randint(1, 99))])

    # 头像
    avatar = DEFAULT_AVATAR

    # 简介（可选）
    bio = random.choice(['', '喜欢帮助别人', '失物招领志愿者', '二手交易达人', '萌新一枚'])

    # 状态
    status = random_status()

    # 身份类型：从 prefixed_id 前缀判断
    identity_type = 'student' if prefixed_id.startswith('S_') else 'teacher'

    # 真实姓名直接用 name
    real_name = name

    # 信誉分和积分
    credit_score = random_credit_score()
    reward_points = random_reward_points()

    # 时间
    last_login_at = random_last_login()
    created_at = random_created_at()

    insert_data.append((
        openid, nickname, avatar, bio, status,
        identity_type, prefixed_id, real_name,
        credit_score, reward_points,
        last_login_at, created_at
    ))

# 批量插入（使用 INSERT IGNORE 避免重复，但 openid 唯一，一般不会冲突）
sql = """
INSERT IGNORE INTO user (
    openid, nickname, avatar, bio, status,
    identity_type, prefixed_id, real_name,
    credit_score, reward_points,
    last_login_at, created_at
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

try:
    cursor.executemany(sql, insert_data)
    conn.commit()
    print(f"成功插入 {cursor.rowcount} 条记录到 user 表")
except Exception as e:
    conn.rollback()
    print(f"插入失败: {e}")
finally:
    cursor.close()
    conn.close()