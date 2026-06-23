import json
import os
from datetime import datetime
from app.extensions import db
from app.models.sync_school import SyncSchool

def sync_students_from_file(file_path='data/students.json'):
    """
    从 students.json 同步学生数据到 sync_school 表。
    只处理 status='enrolled' 的学生，学号前加 'S_' 前缀。
    """
    print(f"[{datetime.now()}] 开始同步学生数据...")
    if not os.path.exists(file_path):
        print(f"文件不存在: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        students = json.load(f)

    # 过滤出在校学生
    enrolled = [s for s in students if s.get('status') == 'enrolled']
    print(f"共读取 {len(students)} 条学生记录，在校 {len(enrolled)} 条")

    # 删除所有以 'S_' 开头的旧数据
    deleted = SyncSchool.query.filter(SyncSchool.prefixed_id.startswith('S_')).delete()
    print(f"已删除 {deleted} 条旧学生记录")

    # 插入新数据
    new_records = []
    for s in enrolled:
        prefixed_id = f"S_{s['student_id']}"
        record = SyncSchool(
            prefixed_id=prefixed_id,
            name=s['name'],
            sync_time=datetime.now()
        )
        new_records.append(record)

    db.session.bulk_save_objects(new_records)
    db.session.commit()
    print(f"成功插入 {len(new_records)} 条学生记录")


def sync_staff_from_file(file_path='data/staff.json'):
    """
    从 staff.json 同步教职工数据到 sync_school 表。
    所有教职工工号前加 'T_' 前缀。
    """
    print(f"[{datetime.now()}] 开始同步教职工数据...")
    if not os.path.exists(file_path):
        print(f"文件不存在: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        staff_list = json.load(f)

    print(f"共读取 {len(staff_list)} 条教职工记录")

    # 删除所有以 'T_' 开头的旧数据
    deleted = SyncSchool.query.filter(SyncSchool.prefixed_id.startswith('T_')).delete()
    print(f"已删除 {deleted} 条旧教职工记录")

    # 插入新数据
    new_records = []
    for s in staff_list:
        prefixed_id = f"T_{s['staff_id']}"
        record = SyncSchool(
            prefixed_id=prefixed_id,
            name=s['name'],
            sync_time=datetime.now()
        )
        new_records.append(record)

    db.session.bulk_save_objects(new_records)
    db.session.commit()
    print(f"成功插入 {len(new_records)} 条教职工记录")