import click
from flask.cli import with_appcontext
from werkzeug.security import generate_password_hash
from app.extensions import db
from app.models.admin import Admin
from app.utils.sync import sync_students_from_file, sync_staff_from_file

@click.command('sync-students')
@with_appcontext
def sync_students_command():
    """手动同步学生数据"""
    sync_students_from_file()

@click.command('sync-staff')
@with_appcontext
def sync_staff_command():
    """手动同步教职工数据"""
    sync_staff_from_file()

@click.command('create-admin')
@click.option('--username', prompt=True, help='管理员用户名')
@click.option('--real-name', prompt=True, help='真实姓名')
@with_appcontext
def create_admin_command(username, real_name):
    """创建一个新的管理员账号，初始密码为123456，首次登录需修改"""
    if Admin.query.filter_by(username=username).first():
        click.echo('用户名已存在！')
        return
    admin = Admin(
        username=username,
        password_hash=generate_password_hash('123456'),  # 固定初始密码
        real_name=real_name,
        status='active',
        must_change_password=True
    )
    db.session.add(admin)
    db.session.commit()
    click.echo(f'管理员 {username} 创建成功，初始密码为123456，请首次登录后修改！')
def register_commands(app):
    app.cli.add_command(sync_students_command)
    app.cli.add_command(sync_staff_command)
    app.cli.add_command(create_admin_command)