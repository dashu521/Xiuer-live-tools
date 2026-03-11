import re

with open("/opt/auth-api/routers/auth.py", "r") as f:
    content = f.read()

# 修改第一处: db is not None 分支
old_pattern1 = '''            if is_active:
                plan = "trial"'''
new_pattern1 = '''            # 计算 effective_plan：正式套餐优先级高于 trial
            paid_plans = ("pro", "pro_max", "ultra")
            if plan not in paid_plans and is_active:
                plan = "trial"'''

content = content.replace(old_pattern1, new_pattern1)

# 修改第二处: else 分支 (db is None)
old_pattern2 = '''        if is_active:
            plan = "trial"'''
new_pattern2 = '''        # 计算 effective_plan：正式套餐优先级高于 trial
        paid_plans = ("pro", "pro_max", "ultra")
        if plan not in paid_plans and is_active:
            plan = "trial"'''

content = content.replace(old_pattern2, new_pattern2)

# 更新函数文档字符串
old_doc = '''"""拼装 /auth/status 返回结构（含 plan、trial）。trial 优先从 trials 表读取（与 /auth/trial/* 一致）。"""'''
new_doc = '''"""拼装 /auth/status 返回结构（含 plan、trial）。

    订阅优先级: ultra > pro_max > pro > trial > free
    - base_plan: 用户原始正式套餐 (users.plan)
    - effective_plan: 最终生效套餐（给前端显示和权限判断）
    """'''

content = content.replace(old_doc, new_doc)

with open("/opt/auth-api/routers/auth.py", "w") as f:
    f.write(content)

print("File updated successfully")
