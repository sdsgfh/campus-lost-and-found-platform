import json
import random

# ---------- 数据池 ----------
first_names = ["张", "王", "李", "刘", "陈", "杨", "赵", "黄", "周", "吴", "徐", "孙", "马", "朱", "胡", "郭", "何", "高", "林", "郑"]
last_names = ["伟", "强", "丽", "敏", "静", "涛", "军", "勇", "杰", "鑫", "婷", "丹", "磊", "洋", "娜", "超", "华", "平", "刚", "玲"]

colleges_majors = {
    "信息科学与技术学院": ["计算机科学与技术", "软件工程", "电子信息工程", "通信工程", "物联网工程"],
    "经济管理学院": ["经济学", "金融学", "会计学", "工商管理", "市场营销"],
    "人文学院": ["汉语言文学", "新闻学", "广告学", "历史学", "哲学"],
    "理学院": ["数学与应用数学", "物理学", "化学", "应用统计学", "信息与计算科学"],
    "外国语学院": ["英语", "日语", "德语", "法语", "翻译"],
    "法学院": ["法学", "知识产权", "社会工作"],
    "艺术学院": ["视觉传达设计", "环境设计", "产品设计", "音乐表演"]
}

# 班级号范围
class_numbers = [1, 2, 3, 4, 5]
# 年级范围（入学年份）
grades = list(range(2020, 2026))  # 2020-2025

# ---------- 生成数据 ----------
used_student_ids = set()
students = []

while len(students) < 2000:
    # 随机选择年级
    grade = random.choice(grades)
    year_suffix = str(grade)[-2:]  # 取后两位，如 "22"
    # 生成后7位随机数字（保证唯一）
    while True:
        suffix = str(random.randint(1000000, 9999999))  # 7位
        student_id = year_suffix + suffix  # 拼接为9位
        if student_id not in used_student_ids:
            used_student_ids.add(student_id)
            break

    name = random.choice(first_names) + random.choice(last_names)
    college = random.choice(list(colleges_majors.keys()))
    major = random.choice(colleges_majors[college])

    # 班级名：专业 + 年级后两位 + 班级号 + "班"
    class_no = random.choice(class_numbers)
    class_name = f"{major}{year_suffix}{class_no:02d}班"

    # ===== 修改状态逻辑 =====
    if grade >= 2022:
        status = "enrolled"
    else:
        status = "graduated"
    # =======================

    students.append({
        "student_id": student_id,
        "name": name,
        "grade": grade,
        "college": college,
        "major": major,
        "class": class_name,
        "status": status
    })

# 保存到 data/students.json（确保 data 文件夹存在）
with open("data/students.json", "w", encoding="utf-8") as f:
    json.dump(students, f, ensure_ascii=False, indent=2)

print(f"已生成 {len(students)} 条学生信息，保存到 students.json")