import json
import random

first_names = ["张", "王", "李", "刘", "陈", "杨", "赵", "黄", "周", "吴", "徐", "孙", "马", "朱", "胡", "郭", "何", "高", "林", "郑"]
last_names = ["伟", "强", "丽", "敏", "静", "涛", "军", "勇", "杰", "鑫", "婷", "丹", "磊", "洋", "娜", "超", "华", "平", "刚", "玲"]

departments = [
    "信息科学与技术学院", "经济管理学院", "人文学院", "理学院", "外国语学院", "法学院", "艺术学院",
    "教务处", "学生工作部", "后勤管理处", "图书馆", "体育部", "人事处", "财务处", "党委办公室"
]

titles = [
    "教授", "副教授", "讲师", "助教",
    "研究员", "副研究员", "工程师", "实验师",
    "馆员", "副研究馆员", "高级工程师", "助理工程师"
]

used_staff_ids = set()
staff_list = []

while len(staff_list) < 300:
    staff_id = str(random.randint(100000000, 999999999))
    if staff_id in used_staff_ids:
        continue
    used_staff_ids.add(staff_id)

    name = random.choice(first_names) + random.choice(last_names)
    department = random.choice(departments)
    title = random.choice(titles)

    staff_list.append({
        "staff_id": staff_id,
        "name": name,
        "department": department,
        "title": title
    })

with open("data/staff.json", "w", encoding="utf-8") as f:
    json.dump(staff_list, f, ensure_ascii=False, indent=2)

print(f"已生成 {len(staff_list)} 条教职工信息，保存到 staff.json")