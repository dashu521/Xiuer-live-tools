import sys
sys.path.insert(0, '/opt/auth-api')

from database import SessionLocal
from models import User
from routers.auth import build_user_status_response
from sqlalchemy import text
import time

# 测试1: ultra + active trial => effective_plan = ultra
print("=== Test 1: ultra + active trial ===")
db = SessionLocal()
user = db.query(User).filter(User.id == "12477dfe-8dbb-4002-9a61-c4b3e267b211").first()
if user:
    print(f"User plan in DB: {user.plan}")
    result = build_user_status_response(user, db)
    print(f"Returned plan: {result.plan}")
    print(f"Trial is_active: {result.trial.is_active if result.trial else None}")
    if result.plan == "ultra":
        print("PASS: ultra user correctly shows ultra, not trial")
    else:
        print(f"FAIL: expected ultra, got {result.plan}")
else:
    print("User not found")

print()

# 测试2: free + active trial => effective_plan = trial
print("=== Test 2: free + active trial ===")
user2 = db.query(User).filter(User.plan == "free").first()
if user2:
    print(f"User plan in DB: {user2.plan}")
    # 为这个用户创建一个 trial 记录
    now = int(time.time())
    end = now + 86400  # 1天后过期
    db.execute(text("INSERT INTO trials (username, start_ts, end_ts) VALUES (:u, :s, :e) ON DUPLICATE KEY UPDATE start_ts=:s, end_ts=:e"), {"u": user2.id, "s": now, "e": end})
    db.commit()
    print(f"Created trial: start={now}, end={end}")
    
    result2 = build_user_status_response(user2, db)
    print(f"Returned plan: {result2.plan}")
    print(f"Trial is_active: {result2.trial.is_active if result2.trial else None}")
    if result2.plan == "trial":
        print("PASS: free user with active trial shows trial")
    else:
        print(f"FAIL: expected trial, got {result2.plan}")
else:
    print("No free user found")

print()

# 测试3: pro_max + active trial => effective_plan = pro_max
print("=== Test 3: pro_max + active trial ===")
# 找一个 free 用户，临时改为 pro_max 测试
user3 = db.query(User).filter(User.plan == "free").offset(1).first()
if user3:
    original_plan = user3.plan
    user3.plan = "pro_max"
    db.commit()
    print(f"Temporarily changed plan from {original_plan} to pro_max")
    
    # 确保有 trial
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
