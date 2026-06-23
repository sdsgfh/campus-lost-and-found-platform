# 校园失物招领与二手物品交易平台

> 基于微信小程序与 Flask 后端，为校园提供集失物招领、二手交易、实名认证与信誉评分为一体的互助服务平台。

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.0+-green.svg)](https://flask.palletsprojects.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0+-orange.svg)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-6.0+-red.svg)](https://redis.io/)
[![WeChat](https://img.shields.io/badge/微信小程序-原生开发-brightgreen.svg)](https://developers.weixin.qq.com/miniprogram/dev/framework/)
[![JWT](https://img.shields.io/badge/JWT-认证-blueviolet.svg)](https://jwt.io/)
[![OCR](https://img.shields.io/badge/OCR-智谱AI-ff69b4.svg)](https://open.bigmodel.cn/)

---

## 📖 项目简介

本项目是一个基于微信小程序的校园失物招领与二手物品交易平台，旨在解决校园内失物信息分散、二手交易身份难核验、信息真实性难以保障等问题。

平台采用前后端分离架构，前端以微信小程序为用户入口，管理端采用 Web 页面；后端基于 Flask 框架，使用 MySQL 持久化存储核心数据，Redis 缓存临时信息，并通过 JWT 实现用户认证。

**核心亮点**：
- 🔐 微信一键登录 + 校园实名认证（OCR 证件识别），保障用户身份真实有效
- 🤖 基于内容的推荐算法，实现个性化内容推送
- 🔒 HMAC 签名二维码，保障线下交易安全
- ⭐ 动态信誉评分体系，约束用户行为，提升平台可信度
- 🛡️ Trie 树敏感词过滤，实时拦截违规内容
- 🛠️ Web 后台管理，支持用户管理、举报审核、数据统计等运营操作

---

## ✨ 功能列表

### 👤 用户端（微信小程序）

| 模块 | 功能 |
|------|------|
| 登录认证 | 微信一键登录、校园实名认证（OCR 识别证件信息） |
| 信息发布 | 寻物 / 招领 / 出售 / 求购四类发布，支持图片上传 |
| 快速认领 | 证件类物品（校园卡等）自动识别学号并通知失主 |
| 浏览搜索 | 首页精选、个性化推荐、分类筛选、关键词搜索 |
| 私聊沟通 | 文本/图片消息发送，敏感词自动过滤 |
| 线下交易 | 生成 HMAC 签名二维码，扫码确认完成交易 |
| 招领保护期 | 招领交易自动进入 24 小时保护期，防止冒领 |
| 举报申诉 | 违规内容举报、处罚结果申诉 |
| 个人中心 | 编辑资料、管理发布/收藏、查看信誉积分、账号注销 |

### 🛠️ 管理端（Web 后台）

| 模块 | 功能 |
|------|------|
| 仪表盘 | 核心数据卡片、待审核数量、趋势图表 |
| 用户管理 | 用户列表查询、详情查看、封禁违规用户 |
| 内容管理 | 帖子列表、详情查看、下架违规帖子 |
| 举报管理 | 举报列表、详情查看、审核（成立/不成立/恶意标记） |
| 申诉管理 | 申诉列表、详情查看、审核（成立/不成立） |
| 交易记录 | 查看所有交易记录 |
| 轮播图管理 | 增删改查、排序权重调整 |
| 反馈管理 | 查看用户反馈并回复 |
| 公告管理 | 增删改查、发布/草稿状态切换 |
| 通知发送 | 向全体或指定用户推送系统通知 |
| 审核日志 | 查看所有审核操作记录 |
| 数据统计 | 认证分布、帖子类型分布、趋势折线图 |

---

## 🧱 技术架构

<img width="972" height="579" alt="图片1" src="https://github.com/user-attachments/assets/88dcfa61-fae6-444d-aa1e-80c98e7062c6" />


**技术栈详情**：

- **前端**：微信小程序原生框架（WXML + WXSS + JavaScript）、HTML/CSS/JS + Bootstrap 5（管理端）、ECharts（数据可视化）
- **后端**：Flask 2.0.1、Flask-JWT-Extended、Flask-SQLAlchemy、Flask-Migrate、Flask-CORS、APScheduler（定时任务）
- **数据库**：MySQL 8.0.25（持久化存储）、Redis 6.2.4（缓存）
- **第三方服务**：微信登录接口、智谱 AI 多模态模型（OCR 实名认证）
- **核心工具**：qrcode + HMAC-SHA256（二维码签名）、Trie 树（敏感词过滤）
- **部署**：Gunicorn + Nginx

---

## ⚙️ 核心处理机制

### 1. 基于内容的推荐算法

用于首页“为您推荐”模块。根据用户近 30 天的浏览（1 分）、收藏（3 分）行为，按帖子分类统计加权得分，并叠加用户自己发布过的分类得分（每个分类 +2 分），取分数最高的 3 个分类作为兴趣分类，从这些分类中按热度推荐帖子。无行为数据时推荐全平台热门帖子。

### 2. 二手交易排序模型

综合排序综合考虑三个因素：
- **时间得分**：帖子创建时间越新，得分越高
- **热度得分**：浏览量×0.4 + 收藏量×0.6，归一化到 0-100 分
- **信誉得分**：根据发布者信誉分映射（≥90 分得 100 分，70-89 得 80 分，60-69 得 60 分，其余 20 分）

最终得分 = 时间×0.25 + 热度×0.5 + 信誉×0.25。

### 3. 内容审核（Trie 树敏感词过滤）

- 从本地敏感词文件加载词库，构建 Trie 树
- **发布帖子**：严格模式，命中敏感词直接拒绝发布
- **聊天消息**：宽松模式，敏感词自动替换为“*”，不拦截消息

### 4. 信誉评分机制

- 初始 100 分，范围 0-100 分
- **加分**：举报成立（+3，每日限 2 次）、连续 14 天无违规（+5）、连续 30 天无违规（+10）
- **扣分**：被举报查实（-15）、冒领物品（-20）、恶意举报（-10）
- 信誉分降至 0 分自动封禁
- 定时任务每日凌晨 2 点检查连续无违规奖励

---

## 📱 界面截图

> 建议插入小程序和后台管理界面的核心页面截图。

| 用户端 | 管理端 |
|--------|--------|
| ![首页](screenshots/home.png) | ![仪表盘](screenshots/admin-dashboard.png) |
| ![发布](screenshots/publish.png) | ![举报审核](screenshots/report-audit.png) |
| ![交易二维码](screenshots/qrcode.png) | ![数据统计](screenshots/statistics.png) |
<img width="813" height="822" alt="屏幕截图_20260513_173014" src="https://github.com/user-attachments/assets/292d8df2-503c-421d-8581-8eb5eb66964a" />
<img width="1612" height="812" alt="屏幕截图_20260513_173157" src="https://github.com/user-attachments/assets/6e826b89-52c4-4ce0-ba18-0b7903104ca5" />
<img width="1210" height="797" alt="屏幕截图_20260513_173439" src="https://github.com/user-attachments/assets/c19ce4b0-13c1-49ef-88f4-7bd760f3ee0f" />
<img width="801" height="547" alt="屏幕截图_20260513_174305" src="https://github.com/user-attachments/assets/b3395adb-8894-4e42-972f-66d72edcccdb" />
<img width="798" height="819" alt="屏幕截图_20260513_174707" src="https://github.com/user-attachments/assets/909d8db3-df8b-4787-b35d-9add653e66a7" />
<img width="1625" height="631" alt="屏幕截图_20260513_175853" src="https://github.com/user-attachments/assets/db9419ae-8617-418d-b7f4-aee1a62ba911" />
<img width="1217" height="648" alt="屏幕截图_20260513_180131" src="https://github.com/user-attachments/assets/866735c0-1f61-40d1-adf0-bef379706300" />
<img width="1219" height="551" alt="屏幕截图_20260513_180313" src="https://github.com/user-attachments/assets/430c43b9-458a-4885-b902-dc7399c4bdbd" />




---

## 🚀 本地运行步骤

### 1. 克隆项目

```bash
git clone https://github.com/你的用户名/仓库名.git
cd 仓库名
```

### 2. 后端环境配置

```bash
# 创建并激活虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
cd server
pip install -r requirements.txt
```

### 3. 配置环境变量

在 `server/` 目录下创建 `.env` 文件：

```env
WX_APPID=你的微信小程序AppID
WX_SECRET=你的微信小程序AppSecret
JWT_SECRET_KEY=你的自定义密钥
ZHIPU_API_KEY=你的智谱AI API Key
SQLALCHEMY_DATABASE_URI=mysql+pymysql://root:密码@localhost:3306/xiaomi_db
REDIS_URL=redis://localhost:6379/0
```

### 4. 初始化数据库

```bash
# 方式一：使用 Flask-Migrate（推荐）
flask db upgrade

# 方式二：导入 SQL 文件
mysql -u root -p xiaomi_db < database.sql
```

### 5. 启动 Redis

```bash
redis-server
```

### 6. 启动后端

```bash
python run.py
# 访问 http://127.0.0.1:5000/admin 进入后台管理
```

### 7. 运行微信小程序

- 使用微信开发者工具打开 `miniapp/` 目录
- 修改 `app.js` 中的 `baseUrl` 为后端地址（如 `http://127.0.0.1:5000`）
- 点击“预览”即可在手机上测试

### 8. 创建管理员账号
管理员账号不提供 Web 端注册功能，需通过命令行创建：

```bash
flask create-admin
# 按提示输入用户名和真实姓名
# 初始密码为 123456，首次登录后台须强制修改
```
---

## 📊 数据初始化（可选）

用于开发测试环境快速生成模拟数据，非生产环境使用。

系统提供了数据初始化工具，其中 create_students.py 和 create_staff.py 分别生成学生和教职工的备案信息，通过 sync-students 和 sync-staff 命令同步到 sync_school 表；generate_users.py 和 generate_posts.py 则基于备案信息生成用户和帖子的模拟数据，方便系统功能演示与测试。

```bash
# 1. 生成备案信息 JSON 文件
python scripts/create_students.py
python scripts/create_staff.py

# 2. 同步到数据库
flask sync-students
flask sync-staff

# 3. 生成用户和帖子（基于已有数据）
python scripts/generate_users.py
python scripts/generate_posts.py
```

---

## 📁 项目目录结构

```
campus-platform/
├── server/                     # 后端 Flask 项目
│   ├── app/
│   │   ├── views/              # 路由（auth, post, chat, admin...）
│   │   ├── models/             # 数据库模型（20 张表）
│   │   ├── utils/              # 工具函数（audit, credit, reward）
│   │   ├── templates/          # 管理端 HTML
│   │   ├── static/             # 管理端 CSS/JS
│   │   ├── __init__.py
│   │   └── config.py
│   ├── uploads/                # 用户头像等上传文件
│   ├── chat_uploads/           # 聊天图片
│   ├── run.py                  # 启动文件
│   ├── xiaomi_db.sql        # 数据库建表脚本
│   └── .env                    # 环境变量
├── miniapp/                    # 微信小程序代码
│   ├── pages/
│   ├── images/
│   ├── app.js
│   ├── app.json
│   └── project.config.json
├── README.md
└── .gitignore
```

---

## 📜 License

本项目仅供学习交流使用，未经授权不得用于商业用途。
