import sys
sys.path.insert(0, '/app')

from database import SessionLocal
from models import User
from routers.auth import build_user_status_response
from sqlalchemy import text
import time

db = SessionLocal()
now = int(time.time())

# 测试3: pro_max + active trial => effective_plan = pro_max
print("=== Test 3: pro_max + active trial ===")
user3 = db.query(User).filter(User.plan == "free").offset(1).first()
if user3:
    original_plan = user3.plan
    user3.plan = "pro_max"
    db.commit()
    print(f"Temporarily changed plan from {original_plan} to pro_max")

    # 确保有 trial
    end = now + 86400
    db.execute(text("INSERT INTO trials (username, start_ts, end_ts) VALUES (:u, :s, :e) ON DUPLICATE KEY UPDATE start_ts=:s, end_ts=:e"), {"u": user3.id, "s": now, "e": end})
    db.commit()

    result3 = build_user_status_response(user3, db)
    print(f"Returned plan: {result3.plan}")
    print(f"Trial is_active: {result3.trial.is_active if result3.trial else None}")
    if result3.plan == "pro_max":
        print("PASS: pro_max user correctly shows pro_max, not trial")
    else:
        print(f"FAIL: expected pro_max, got {result3.plan}")

    # 恢复
    user3.plan = original_plan
    db.commit()
else:
    print("No free user found for test 3")

print()

# 测试4: no plan + no trial => effective_plan = free
print("=== Test 4: no plan + no trial ===")
user4 = db.query(User).filter(User.plan == "free").offset(2).first()
if user4:
    print(f"User plan in DB: {user4.plan}")
    # 删除 trial 记录
    db.execute(text("DELETE FROM trials WHERE username = :u"), {"u": user4.id})
    db.commit()
    print("Deleted any trial record")

    result4 = build_user_status_response(user4, db)
    print(f"Returned plan: {result4.plan}")
    if result4.plan == "free":
        print("PASS: free user without trial shows free")
    else:
        print(f"FAIL: expected free, got {result4.plan}")
else:
    print("No free user found for test 4")

print()

# 测试5: pro + active trial => effective_plan = pro
print("=== Test 5: pro + active trial ===")
user5 = db.query(User).filter(User.plan == "free").offset(3).first()
if user5:
    original_plan = user5.plan
    user5.plan = "pro"
    db.commit()
    print(f"Temporarily changed plan from {original_plan} to pro")

    # 确保有 trial
    end = now + 86400
    db.execute(text("INSERT INTO trials (username, start_ts, end_ts) VALUES (:u, :s, :e) ON DUPLICATE KEY UPDATE start_ts=:s, end_ts=:e"), {"u": user5.id, "s": now, "e": end})
    db.commit()

    result5 = build_user_status_response(user5, db)
    print(f"Returned plan: {result5.plan}")
    print(f"Trial is_active: {result5.trial.is_active if result5.trial else None}")
    if result5.plan == "pro":
        print("PASS: pro user correctly shows pro, not trial")
    else:
        print(f"FAIL: expected pro, got {result5.plan}")

    # 恢复
    user5.plan = original_plan
    db.commit()
else:
    print("No free user found for test 5")
