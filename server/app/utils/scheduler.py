from app.models.post import Post
from app.models.notification import Notification
from app.extensions import db
from app.views.favorite import cancel_favorites_for_post
from datetime import datetime, timedelta

def check_expired_posts():
    """检查已过期的帖子（原有函数）"""
    now = datetime.now()
    # 即将过期提醒（24小时内）
    soon_expire = Post.query.filter(
        Post.status == 'active',
        Post.expiry_time <= now + timedelta(hours=24),
        Post.expiry_time > now
    ).all()
    for post in soon_expire:
        notif = Notification(
            user_id=post.user_id,
            type='expire_remind',
            title='发布即将过期',
            content=f'你的发布【{post.title}】将在24小时后过期，请及时处理',
            data={'post_id': post.id}
        )
        db.session.add(notif)

    # 已过期
    expired = Post.query.filter(Post.status == 'active', Post.expiry_time <= now).all()
    for post in expired:
        post.status = 'expired'
        cancel_favorites_for_post(post.id)
        notif = Notification(
            user_id=post.user_id,
            type='post_expired',
            title='发布已过期',
            content=f'你的发布【{post.title}】已过期，可以重新发布',
            data={'post_id': post.id}
        )
        db.session.add(notif)
    db.session.commit()


def check_protection_expired():
    """每小时检查保护期已过的招领帖子，自动完成交易"""
    now = datetime.now()
    posts = Post.query.filter(
        Post.status == 'pending_confirm',
        Post.protection_end_time <= now,
        Post.type == 'found'
    ).all()
    for post in posts:
        claimer_id = post.claimer_id
        if not claimer_id:
            print(f"帖子 {post.id} 保护期结束但无认领人，跳过")
            continue

        # 将帖子状态改为 completed
        post.status = 'completed'

        # 取消收藏
        cancel_favorites_for_post(post.id)

        # 创建交易记录
        from app.models.transaction_record import TransactionRecord
        record_publisher = TransactionRecord(
            post_id=post.id,
            publisher_id=post.user_id,
            receiver_id=claimer_id,
            type='return',           # 发布者（捡到者）为归还
            completed_at=now
        )
        record_receiver = TransactionRecord(
            post_id=post.id,
            publisher_id=post.user_id,
            receiver_id=claimer_id,
            type='claim',            # 接收者（失主）为认领
            completed_at=now
        )
        db.session.add_all([record_publisher, record_receiver])

        # 发放奖励积分给归还者（发布者）
        from app.utils.reward import add_reward_points
        add_reward_points(post.user_id, 10, f'成功归还物品: {post.title}', related_id=post.id)

        # 可选：发送通知给双方（可自行添加）
        # 给发布者（归还者）发送通知
        notif_pub = Notification(
            user_id=post.user_id,
            type='transaction_complete',
            title='交易完成',
            content=f'您发布的【{post.title}】已成功归还，获得10积分奖励',
            data={'post_id': post.id}
        )
        db.session.add(notif_pub)
        # 给认领者（失主）发送通知
        notif_claimer = Notification(
            user_id=claimer_id,
            type='transaction_complete',
            title='交易完成',
            content=f'您认领的【{post.title}】已完成，感谢使用',
            data={'post_id': post.id}
        )
        db.session.add(notif_claimer)

    db.session.commit()