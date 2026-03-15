#!/usr/bin/env python3
"""
礼品卡兑换历史数据迁移脚本

迁移目标：
1. 清理 subscriptions 中旧的 free 记录（会覆盖礼品卡权益）
2. 为缺失 subscriptions 的礼品卡用户回填记录
3. 修正 subscriptions 过期但 trials 未过期的不一致
4. 修正 users.plan 与最终有效套餐不一致

执行顺序：
1. 备份数据库
2. 只读核查（统计异常数据）
3. 执行迁移
4. 验证结果

安全原则：
- 所有写操作前必须备份
- 仅处理有礼品卡兑换记录的用户
- 不影响直接购买正式订阅的用户
"""

import argparse
import os
import shutil
import sys
from datetime import datetime
from typing import List, Tuple

# 添加父目录到路径，以便导入 models
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


def get_db_path():
    """获取数据库路径"""
    # 优先从环境变量读取
    db_path = os.getenv("DB_PATH", "/data/users.db")
    if os.path.exists(db_path):
        return db_path
    
    # 尝试相对路径
    alt_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "users.db")
    if os.path.exists(alt_path):
        return alt_path
    
    # 尝试当前目录
    curr_path = "./users.db"
    if os.path.exists(curr_path):
        return curr_path
    
    raise FileNotFoundError(f"找不到数据库文件。已尝试: {db_path}, {alt_path}, {curr_path}")


def backup_database(db_path: str) -> str:
    """备份数据库，返回备份文件路径"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{db_path}.backup_{timestamp}"
    
    if os.path.exists(db_path):
        shutil.copy2(db_path, backup_path)
        print(f"✅ 数据库已备份到: {backup_path}")
        return backup_path
    else:
        raise FileNotFoundError(f"数据库文件不存在: {db_path}")


def check_anomalies(engine) -> dict:
    """
    核查四类异常数据
    返回: {
        "free_with_giftcard": [(user_id, plan, redeemed_plan), ...],
        "missing_subscription": [(user_id, new_plan, new_expiry_ts), ...],
        "expired_sub_active_trial": [(user_id, sub_end, trial_end), ...],
        "plan_mismatch": [(user_id, user_plan, sub_plan, gift_plan), ...],
    }
    """
    result = {
        "free_with_giftcard": [],
        "missing_subscription": [],
        "expired_sub_active_trial": [],
        "plan_mismatch": [],
    }
    
    with engine.connect() as conn:
        # A. subscriptions 旧 free 记录（会覆盖礼品卡权益）
        print("\n🔍 核查 A: subscriptions 旧 free 记录...")
        rows = conn.execute(text("""
            SELECT DISTINCT s.user_id, s.plan, gr.new_plan
            FROM subscriptions s
            INNER JOIN gift_card_redemptions gr ON s.user_id = gr.user_id
            WHERE s.plan = 'free'
            ORDER BY gr.redeemed_at DESC
        """)).fetchall()
        result["free_with_giftcard"] = [(r[0], r[1], r[2]) for r in rows]
        print(f"   发现 {len(rows)} 个用户有 free 记录但已兑换礼品卡")
        
        # B. 礼品卡已兑换但 subscriptions 缺失
        print("\n🔍 核查 B: 礼品卡已兑换但 subscriptions 缺失...")
        rows = conn.execute(text("""
            SELECT DISTINCT gr.user_id, gr.new_plan, gr.new_expiry_ts
            FROM gift_card_redemptions gr
            LEFT JOIN subscriptions s ON gr.user_id = s.user_id
            WHERE s.user_id IS NULL
            ORDER BY gr.redeemed_at DESC
        """)).fetchall()
        result["missing_subscription"] = [(r[0], r[1], r[2]) for r in rows]
        print(f"   发现 {len(rows)} 个用户兑换了礼品卡但无 subscriptions 记录")
        
        # C. subscriptions 已过期但 trials 未过期
        print("\n🔍 核查 C: subscriptions 已过期但 trials 未过期...")
        now_ts = int(datetime.now().timestamp())
        rows = conn.execute(text("""
            SELECT s.user_id, s.current_period_end, t.end_ts
            FROM subscriptions s
            INNER JOIN trials t ON s.user_id = t.username
            WHERE s.current_period_end IS NOT NULL
              AND (julianday(s.current_period_end) - 2440587.5) * 86400 < :now_ts
              AND t.end_ts > :now_ts
        """), {"now_ts": now_ts}).fetchall()
        result["expired_sub_active_trial"] = [(r[0], r[1], r[2]) for r in rows]
        print(f"   发现 {len(rows)} 个用户 subscriptions 已过期但 trials 未过期")
        
        # D. plan 字段不一致
        print("\n🔍 核查 D: plan 字段不一致...")
        rows = conn.execute(text("""
            SELECT u.id, u.plan, s.plan, gr.new_plan
            FROM users u
            INNER JOIN gift_card_redemptions gr ON u.id = gr.user_id
            LEFT JOIN subscriptions s ON u.id = s.user_id
            WHERE u.plan != COALESCE(s.plan, u.plan)
               OR u.plan != gr.new_plan
            ORDER BY gr.redeemed_at DESC
        """)).fetchall()
        result["plan_mismatch"] = [(r[0], r[1], r[2], r[3]) for r in rows]
        print(f"   发现 {len(rows)} 个用户 plan 字段不一致")
    
    return result


def migrate_free_records(engine, dry_run: bool = True) -> int:
    """
    清理/修正会覆盖礼品卡权益的旧 free 记录
    策略：将 free 更新为礼品卡对应的套餐
    """
    print("\n📝 迁移 A: 清理/修正旧 free 记录...")
    
    with engine.connect() as conn:
        # 先查询要处理的记录
        rows = conn.execute(text("""
            SELECT s.user_id, gr.new_plan, gr.new_expiry_ts
            FROM subscriptions s
            INNER JOIN (
                SELECT user_id, new_plan, new_expiry_ts,
                       ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY redeemed_at DESC) as rn
                FROM gift_card_redemptions
            ) gr ON s.user_id = gr.user_id AND gr.rn = 1
            WHERE s.plan = 'free'
        """)).fetchall()
        
        if dry_run:
            print(f"   [DRY RUN] 将更新 {len(rows)} 条 free 记录")
            for r in rows[:5]:  # 只显示前5个
                print(f"      user_id={r[0]}, plan='free' -> '{r[1]}'")
            if len(rows) > 5:
                print(f"      ... 还有 {len(rows) - 5} 条")
            return len(rows)
        
        # 实际执行更新
        count = 0
        for user_id, new_plan, new_expiry_ts in rows:
            current_period_end = datetime.utcfromtimestamp(new_expiry_ts) if new_expiry_ts else None
            result = conn.execute(text("""
                UPDATE subscriptions
                SET plan = :plan,
                    current_period_end = :end_date,
                    status = 'active',
                    updated_at = :now
                WHERE user_id = :user_id
            """), {
                "plan": new_plan,
                "end_date": current_period_end,
                "now": datetime.utcnow(),
                "user_id": user_id,
            })
            count += result.rowcount
        
        conn.commit()
        print(f"   ✅ 已更新 {count} 条 free 记录")
        return count


def migrate_missing_subscriptions(engine, dry_run: bool = True) -> int:
    """
    为缺失 subscriptions 的礼品卡用户回填记录
    """
    print("\n📝 迁移 B: 回填缺失的 subscriptions...")
    
    with engine.connect() as conn:
        # 查询需要回填的用户（取最新的兑换记录）
        rows = conn.execute(text("""
            SELECT gr.user_id, gr.new_plan, gr.new_expiry_ts
            FROM (
                SELECT user_id, new_plan, new_expiry_ts,
                       ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY redeemed_at DESC) as rn
                FROM gift_card_redemptions
            ) gr
            LEFT JOIN subscriptions s ON gr.user_id = s.user_id
            WHERE gr.rn = 1 AND s.user_id IS NULL
        """)).fetchall()
        
        if dry_run:
            print(f"   [DRY RUN] 将插入 {len(rows)} 条 subscriptions 记录")
            for r in rows[:5]:
                print(f"      user_id={r[0]}, plan='{r[1]}'")
            if len(rows) > 5:
                print(f"      ... 还有 {len(rows) - 5} 条")
            return len(rows)
        
        # 实际执行插入
        count = 0
        for user_id, new_plan, new_expiry_ts in rows:
            import uuid
            current_period_end = datetime.utcfromtimestamp(new_expiry_ts) if new_expiry_ts else None
            result = conn.execute(text("""
                INSERT INTO subscriptions (id, user_id, plan, status, current_period_end)
                VALUES (:id, :user_id, :plan, 'active', :end_date)
            """), {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "plan": new_plan,
                "end_date": current_period_end,
            })
            count += 1
        
        conn.commit()
        print(f"   ✅ 已插入 {count} 条 subscriptions 记录")
        return count


def migrate_expired_subscriptions(engine, dry_run: bool = True) -> int:
    """
    修正 subscriptions 过期但 trials 未过期的不一致
    策略：将 subscriptions 的到期时间延长到与 trials 一致
    """
    print("\n📝 迁移 C: 修正过期 subscriptions...")
    
    with engine.connect() as conn:
        now_ts = int(datetime.now().timestamp())
        rows = conn.execute(text("""
            SELECT s.user_id, t.end_ts
            FROM subscriptions s
            INNER JOIN trials t ON s.user_id = t.username
            WHERE s.current_period_end IS NOT NULL
              AND (julianday(s.current_period_end) - 2440587.5) * 86400 < :now_ts
              AND t.end_ts > :now_ts
        """), {"now_ts": now_ts}).fetchall()
        
        if dry_run:
            print(f"   [DRY RUN] 将更新 {len(rows)} 条过期 subscriptions")
            for r in rows[:5]:
                print(f"      user_id={r[0]}, 延长到 {datetime.utcfromtimestamp(r[1])}")
            if len(rows) > 5:
                print(f"      ... 还有 {len(rows) - 5} 条")
            return len(rows)
        
        # 实际执行更新
        count = 0
        for user_id, end_ts in rows:
            current_period_end = datetime.utcfromtimestamp(end_ts)
            result = conn.execute(text("""
                UPDATE subscriptions
                SET current_period_end = :end_date,
                    status = 'active',
                    updated_at = :now
                WHERE user_id = :user_id
            """), {
                "end_date": current_period_end,
                "now": datetime.utcnow(),
                "user_id": user_id,
            })
            count += result.rowcount
        
        conn.commit()
        print(f"   ✅ 已更新 {count} 条过期 subscriptions")
        return count


def migrate_plan_mismatch(engine, dry_run: bool = True) -> int:
    """
    修正 users.plan 与最终有效套餐不一致
    策略：以 gift_card_redemptions 最新的 new_plan 为准
    """
    print("\n📝 迁移 D: 修正 users.plan 不一致...")
    
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT u.id, gr.new_plan
            FROM users u
            INNER JOIN (
                SELECT user_id, new_plan,
                       ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY redeemed_at DESC) as rn
                FROM gift_card_redemptions
            ) gr ON u.id = gr.user_id
            WHERE gr.rn = 1 AND u.plan != gr.new_plan
        """)).fetchall()
        
        if dry_run:
            print(f"   [DRY RUN] 将更新 {len(rows)} 条 users.plan")
            for r in rows[:5]:
                print(f"      user_id={r[0]}, plan 将更新为 '{r[1]}'")
            if len(rows) > 5:
                print(f"      ... 还有 {len(rows) - 5} 条")
            return len(rows)
        
        # 实际执行更新
        count = 0
        for user_id, new_plan in rows:
            result = conn.execute(text("""
                UPDATE users
                SET plan = :plan,
                    updated_at = :now
                WHERE id = :user_id
            """), {
                "plan": new_plan,
                "now": datetime.utcnow(),
                "user_id": user_id,
            })
            count += result.rowcount
        
        conn.commit()
        print(f"   ✅ 已更新 {count} 条 users.plan")
        return count


def verify_migration(engine, sample_size: int = 5):
    """迁移后验证"""
    print("\n✅ 迁移后验证...")
    
    with engine.connect() as conn:
        # 验证有礼品卡兑换记录的用户，其 subscriptions.plan 正确
        rows = conn.execute(text("""
            SELECT gr.user_id, s.plan, gr.new_plan
            FROM (
                SELECT user_id, new_plan,
                       ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY redeemed_at DESC) as rn
                FROM gift_card_redemptions
            ) gr
            LEFT JOIN subscriptions s ON gr.user_id = s.user_id
            WHERE gr.rn = 1
            LIMIT :limit
        """), {"limit": sample_size}).fetchall()
        
        print(f"\n   样本用户验证 (前 {len(rows)} 个):")
        for user_id, sub_plan, gift_plan in rows:
            match = "✅" if sub_plan == gift_plan else "❌"
            print(f"      {match} user_id={user_id}, subscriptions.plan='{sub_plan}', gift_card.plan='{gift_plan}'")
        
        # 统计是否还有异常
        anomalies = check_anomalies(engine)
        total_anomalies = sum(len(v) for v in anomalies.values())
        print(f"\n   剩余异常数据: {total_anomalies} 条")
        
        return total_anomalies == 0


def main():
    parser = argparse.ArgumentParser(description="礼品卡兑换历史数据迁移")
    parser.add_argument("--db-path", help="数据库文件路径")
    parser.add_argument("--dry-run", action="store_true", help="只读核查，不执行写操作")
    parser.add_argument("--skip-backup", action="store_true", help="跳过备份（不推荐）")
    parser.add_argument("--verify-only", action="store_true", help="仅验证，不执行迁移")
    args = parser.parse_args()
    
    # 获取数据库路径
    if args.db_path:
        db_path = args.db_path
    else:
        db_path = get_db_path()
    
    print(f"📁 数据库路径: {db_path}")
    
    # 创建引擎
    engine = create_engine(f"sqlite:///{db_path}")
    
    # 仅验证模式
    if args.verify_only:
        print("\n🔍 仅验证模式...")
        verify_migration(engine)
        return
    
    # 备份
    if not args.skip_backup and not args.dry_run:
        backup_path = backup_database(db_path)
        print(f"   如需回滚，使用: cp {backup_path} {db_path}")
    elif args.dry_run:
        print("\n⚠️  DRY RUN 模式，不执行备份")
    else:
        print("\n⚠️  跳过备份（不推荐）")
    
    # 迁移前核查
    print("\n" + "="*60)
    print("📊 迁移前核查")
    print("="*60)
    anomalies = check_anomalies(engine)
    
    total_anomalies = sum(len(v) for v in anomalies.values())
    if total_anomalies == 0:
        print("\n✅ 未发现异常数据，无需迁移")
        return
    
    print(f"\n📋 发现 {total_anomalies} 条异常数据，需要迁移")
    
    # 执行迁移
    print("\n" + "="*60)
    print("🚀 执行迁移")
    print("="*60)
    
    count_a = migrate_free_records(engine, dry_run=args.dry_run)
    count_b = migrate_missing_subscriptions(engine, dry_run=args.dry_run)
    count_c = migrate_expired_subscriptions(engine, dry_run=args.dry_run)
    count_d = migrate_plan_mismatch(engine, dry_run=args.dry_run)
    
    total_migrated = count_a + count_b + count_c + count_d
    
    print("\n" + "="*60)
    print("📈 迁移结果")
    print("="*60)
    print(f"   A. 修正 free 记录: {count_a} 条")
    print(f"   B. 回填 subscriptions: {count_b} 条")
    print(f"   C. 修正过期 subscriptions: {count_c} 条")
    print(f"   D. 修正 users.plan: {count_d} 条")
    print(f"   总计: {total_migrated} 条")
    
    if args.dry_run:
        print("\n⚠️  这是 DRY RUN，未实际执行写操作")
        print("   如需实际执行，去掉 --dry-run 参数")
    else:
        # 迁移后验证
        print("\n" + "="*60)
        print("🔍 迁移后验证")
        print("="*60)
        success = verify_migration(engine)
        
        if success:
            print("\n✅ 迁移完成，所有异常数据已处理")
        else:
            print("\n⚠️  仍有异常数据，可能需要人工核查")


if __name__ == "__main__":
    main()
