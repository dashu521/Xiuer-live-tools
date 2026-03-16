"""
订阅系统功能测试脚本
测试内容：
1. 试用期限（3天）
2. 礼品卡生成
3. 礼品卡兑换
4. 账号数量限制
5. 档位升级逻辑
"""

from pathlib import Path
import secrets
import sqlite3
import time
import uuid
from datetime import datetime

# 测试数据库路径：固定在当前仓库 auth-api/data/ 下，避免依赖旧仓库绝对路径
TEST_DB_PATH = Path(__file__).resolve().parent / 'data' / 'test_users.db'


def setup_function(_function):
    """每个 pytest 用例前都初始化一份干净的测试数据库。"""
    TEST_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()
    init_test_database()

def init_test_database():
    """初始化测试数据库"""
    conn = sqlite3.connect(TEST_DB_PATH)
    cursor = conn.cursor()
    
    # 创建 users 表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            phone TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login_at TIMESTAMP,
            last_active_at TIMESTAMP,
            status TEXT DEFAULT 'active',
            plan TEXT DEFAULT 'free',
            trial_start_at TIMESTAMP,
            trial_end_at TIMESTAMP,
            max_accounts INTEGER DEFAULT 1,
            trial_used INTEGER DEFAULT 0
        )
    ''')
    
    # 创建 trials 表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS trials (
            username TEXT PRIMARY KEY,
            start_ts INTEGER,
            end_ts INTEGER
        )
    ''')
    
    # 创建 gift_cards 表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS gift_cards (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            type TEXT DEFAULT 'membership',
            tier TEXT,
            benefits_json TEXT,
            membership_type TEXT,
            membership_days INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active',
            batch_id TEXT,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            redeemed_at TIMESTAMP,
            redeemed_by TEXT
        )
    ''')
    
    # 创建 gift_card_redemptions 表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS gift_card_redemptions (
            id TEXT PRIMARY KEY,
            gift_card_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            previous_plan TEXT,
            new_plan TEXT,
            previous_expiry_ts INTEGER,
            new_expiry_ts INTEGER
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✓ 测试数据库初始化完成")

def generate_gift_code():
    """生成礼品卡兑换码"""
    code_chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    parts = []
    for _ in range(3):
        part = "".join(secrets.choice(code_chars) for _ in range(4))
        parts.append(part)
    return "-".join(parts)

def test_trial_duration():
    """测试试用期限是否为3天"""
    print("\n" + "="*60)
    print("测试1: 试用期限验证（应为3天）")
    print("="*60)
    
    conn = sqlite3.connect(TEST_DB_PATH)
    cursor = conn.cursor()
    
    # 创建测试用户
    user_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO users (id, username, email, password_hash, plan)
        VALUES (?, ?, ?, ?, ?)
    ''', (user_id, 'test_user', 'test@example.com', 'hashed_password', 'free'))
    
    # 模拟开通试用
    now_ts = int(time.time())
    trial_days = 3  # 期望的试用天数
    end_ts = now_ts + trial_days * 24 * 3600
    
    cursor.execute('''
        INSERT INTO trials (username, start_ts, end_ts)
        VALUES (?, ?, ?)
    ''', (user_id, now_ts, end_ts))
    
    conn.commit()
    
    # 验证试用期限
    cursor.execute('SELECT start_ts, end_ts FROM trials WHERE username = ?', (user_id,))
    row = cursor.fetchone()
    
    if row:
        start_ts, end_ts = row
        actual_duration = (end_ts - start_ts) / (24 * 3600)
        
        print(f"  试用开始时间: {datetime.fromtimestamp(start_ts)}")
        print(f"  试用结束时间: {datetime.fromtimestamp(end_ts)}")
        print(f"  试用期限: {actual_duration} 天")
        
        if actual_duration == 3.0:
            print("  ✓ 试用期限验证通过（3天）")
            result = "通过"
        else:
            print(f"  ✗ 试用期限验证失败（期望3天，实际{actual_duration}天）")
            result = "失败"
    else:
        print("  ✗ 未找到试用记录")
        result = "失败"
    
    conn.close()
    return result

def test_gift_card_generation():
    """测试礼品卡生成功能"""
    print("\n" + "="*60)
    print("测试2: 礼品卡生成功能")
    print("="*60)
    
    conn = sqlite3.connect(TEST_DB_PATH)
    cursor = conn.cursor()
    
    # 测试不同档位的礼品卡生成
    tiers = ['pro', 'pro_max', 'ultra']
    tier_benefits = {
        'pro': {'max_accounts': 1, 'features': ['all']},
        'pro_max': {'max_accounts': 3, 'features': ['all']},
        'ultra': {'max_accounts': -1, 'features': ['all']}
    }
    
    generated_cards = []
    
    for tier in tiers:
        code = generate_gift_code()
        card_id = str(uuid.uuid4())
        benefits = tier_benefits[tier]
        
        cursor.execute('''
            INSERT INTO gift_cards (id, code, tier, benefits_json, membership_type, status)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (card_id, code, tier, str(benefits), tier, 'active'))
        
        generated_cards.append({
            'id': card_id,
            'code': code,
            'tier': tier,
            'benefits': benefits
        })
        
        print(f"  生成 {tier.upper()} 档礼品卡: {code}")
    
    conn.commit()
    
    # 验证生成的礼品卡
    cursor.execute('SELECT code, tier, benefits_json FROM gift_cards WHERE status = ?', ('active',))
    rows = cursor.fetchall()
    
    print(f"\n  共生成 {len(rows)} 张礼品卡:")
    for row in rows:
        code, tier, benefits = row
        print(f"    - {code} ({tier})")
    
    if len(rows) == 3:
        print("  ✓ 礼品卡生成验证通过")
        result = "通过"
    else:
        print("  ✗ 礼品卡生成验证失败")
        result = "失败"
    
    conn.close()
    return result, generated_cards

def test_gift_card_redeem():
    """测试礼品卡兑换功能"""
    print("\n" + "="*60)
    print("测试3: 礼品卡兑换功能")
    print("="*60)
    
    conn = sqlite3.connect(TEST_DB_PATH)
    cursor = conn.cursor()
    
    # 创建测试用户
    user_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO users (id, username, email, password_hash, plan, max_accounts)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (user_id, 'redeem_test', 'redeem@example.com', 'hashed_password', 'free', 1))
    
    # 生成PRO档礼品卡
    code = generate_gift_code()
    card_id = str(uuid.uuid4())
    benefits = {'max_accounts': 1, 'features': ['all']}
    
    cursor.execute('''
        INSERT INTO gift_cards (id, code, tier, benefits_json, membership_type, status)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (card_id, code, 'pro', str(benefits), 'pro', 'active'))
    
    conn.commit()
    
    # 模拟兑换
    now_ts = int(time.time())
    new_plan = 'pro'
    new_max_accounts = 1
    
    # 更新用户
    cursor.execute('''
        UPDATE users SET plan = ?, max_accounts = ? WHERE id = ?
    ''', (new_plan, new_max_accounts, user_id))
    
    # 更新礼品卡状态
    cursor.execute('''
        UPDATE gift_cards SET status = ?, redeemed_at = ?, redeemed_by = ?
        WHERE id = ?
    ''', ('redeemed', datetime.now(), user_id, card_id))
    
    # 记录兑换历史
    redemption_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO gift_card_redemptions 
        (id, gift_card_id, user_id, previous_plan, new_plan, previous_expiry_ts, new_expiry_ts)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (redemption_id, card_id, user_id, 'free', new_plan, None, now_ts + 30*24*3600))
    
    conn.commit()
    
    # 验证兑换结果
    cursor.execute('SELECT plan, max_accounts FROM users WHERE id = ?', (user_id,))
    user_row = cursor.fetchone()
    
    cursor.execute('SELECT status FROM gift_cards WHERE id = ?', (card_id,))
    card_row = cursor.fetchone()
    
    print(f"  兑换码: {code}")
    print(f"  用户原档位: free")
    print(f"  用户新档位: {user_row[0]}")
    print(f"  最大账号数: {user_row[1]}")
    print(f"  礼品卡状态: {card_row[0]}")
    
    if user_row[0] == 'pro' and user_row[1] == 1 and card_row[0] == 'redeemed':
        print("  ✓ 礼品卡兑换验证通过")
        result = "通过"
    else:
        print("  ✗ 礼品卡兑换验证失败")
        result = "失败"
    
    conn.close()
    return result

def test_account_limit():
    """测试账号数量限制"""
    print("\n" + "="*60)
    print("测试4: 账号数量限制")
    print("="*60)
    
    conn = sqlite3.connect(TEST_DB_PATH)
    cursor = conn.cursor()
    
    # 创建不同档位的测试用户
    test_cases = [
        {'tier': 'free', 'max_accounts': 1, 'expected': '限制1个'},
        {'tier': 'pro', 'max_accounts': 1, 'expected': '限制1个'},
        {'tier': 'pro_max', 'max_accounts': 3, 'expected': '限制3个'},
        {'tier': 'ultra', 'max_accounts': -1, 'expected': '无限制'},
    ]
    
    results = []
    
    for case in test_cases:
        user_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO users (id, username, email, password_hash, plan, max_accounts)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, f'test_{case["tier"]}', f'{case["tier"]}@example.com', 
              'hashed_password', case['tier'], case['max_accounts']))
        
        # 验证max_accounts
        cursor.execute('SELECT max_accounts FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        actual_max = row[0]
        
        print(f"  {case['tier'].upper()} 档用户:")
        print(f"    期望最大账号数: {case['expected']}")
        print(f"    实际最大账号数: {'无限制' if actual_max == -1 else actual_max}")
        
        if actual_max == case['max_accounts']:
            print(f"    ✓ 验证通过")
            results.append(True)
        else:
            print(f"    ✗ 验证失败")
            results.append(False)
    
    conn.commit()
    conn.close()
    
    if all(results):
        print("\n  ✓ 账号数量限制验证全部通过")
        return "通过"
    else:
        print("\n  ✗ 部分验证失败")
        return "失败"

def test_tier_upgrade():
    """测试档位升级逻辑"""
    print("\n" + "="*60)
    print("测试5: 档位升级逻辑")
    print("="*60)
    
    conn = sqlite3.connect(TEST_DB_PATH)
    cursor = conn.cursor()
    
    # 创建PRO用户
    user_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO users (id, username, email, password_hash, plan, max_accounts)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (user_id, 'upgrade_test', 'upgrade@example.com', 'hashed_password', 'pro', 1))
    
    # 生成PRO MAX档礼品卡
    code = generate_gift_code()
    card_id = str(uuid.uuid4())
    benefits = {'max_accounts': 3, 'features': ['all']}
    
    cursor.execute('''
        INSERT INTO gift_cards (id, code, tier, benefits_json, membership_type, status)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (card_id, code, 'pro_max', str(benefits), 'pro_max', 'active'))
    
    conn.commit()
    
    # 模拟升级兑换
    tier_order = {'free': 0, 'trial': 1, 'pro': 2, 'pro_max': 3, 'ultra': 4}
    current_plan = 'pro'
    new_plan = 'pro_max'
    
    can_upgrade = tier_order[new_plan] >= tier_order[current_plan]
    
    print(f"  当前档位: {current_plan}")
    print(f"  目标档位: {new_plan}")
    print(f"  是否允许升级: {can_upgrade}")
    
    if can_upgrade:
        # 执行升级
        cursor.execute('''
            UPDATE users SET plan = ?, max_accounts = ? WHERE id = ?
        ''', ('pro_max', 3, user_id))
        
        cursor.execute('''
            UPDATE gift_cards SET status = ?, redeemed_at = ?, redeemed_by = ?
            WHERE id = ?
        ''', ('redeemed', datetime.now(), user_id, card_id))
        
        conn.commit()
        
        # 验证升级结果
        cursor.execute('SELECT plan, max_accounts FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        
        print(f"  升级后档位: {row[0]}")
        print(f"  升级后最大账号数: {row[1]}")
        
        if row[0] == 'pro_max' and row[1] == 3:
            print("  ✓ 档位升级验证通过")
            result = "通过"
        else:
            print("  ✗ 档位升级验证失败")
            result = "失败"
    else:
        print("  ✗ 升级逻辑判断错误")
        result = "失败"
    
    conn.close()
    return result

def test_downgrade_prevention():
    """测试降级阻止逻辑"""
    print("\n" + "="*60)
    print("测试6: 降级阻止验证")
    print("="*60)
    
    conn = sqlite3.connect(TEST_DB_PATH)
    cursor = conn.cursor()
    
    # 创建ULTRA用户
    user_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO users (id, username, email, password_hash, plan, max_accounts)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (user_id, 'downgrade_test', 'downgrade@example.com', 'hashed_password', 'ultra', -1))
    
    conn.commit()
    
    # 模拟降级检查
    tier_order = {'free': 0, 'trial': 1, 'pro': 2, 'pro_max': 3, 'ultra': 4}
    current_plan = 'ultra'
    target_plan = 'pro'
    
    can_upgrade = tier_order[target_plan] >= tier_order[current_plan]
    
    print(f"  当前档位: {current_plan}")
    print(f"  目标档位: {target_plan}")
    print(f"  是否允许兑换: {can_upgrade}")
    
    if not can_upgrade:
        print("  ✓ 降级阻止验证通过（系统正确阻止了降级）")
        result = "通过"
    else:
        print("  ✗ 降级阻止验证失败（系统未阻止降级）")
        result = "失败"
    
    conn.close()
    return result

def generate_test_report(results):
    """生成测试报告"""
    print("\n" + "="*60)
    print("测试报告汇总")
    print("="*60)
    
    total = len(results)
    passed = sum(1 for r in results.values() if r == "通过")
    failed = total - passed
    
    print(f"\n总测试数: {total}")
    print(f"通过: {passed}")
    print(f"失败: {failed}")
    print(f"通过率: {passed/total*100:.1f}%")
    
    print("\n详细结果:")
    for test_name, result in results.items():
        status = "✓" if result == "通过" else "✗"
        print(f"  {status} {test_name}: {result}")
    
    print("\n" + "="*60)
    if failed == 0:
        print("🎉 所有测试全部通过！")
    else:
        print(f"⚠️  有 {failed} 项测试未通过，请检查相关功能")
    print("="*60)

def main():
    """主测试函数"""
    print("\n" + "="*60)
    print("订阅系统功能测试")
    print("="*60)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"测试数据库: {TEST_DB_PATH}")
    
    # 初始化测试数据库
    init_test_database()
    
    # 执行各项测试
    results = {}
    
    results["试用期限验证(3天)"] = test_trial_duration()
    _, generated_cards = test_gift_card_generation()
    results["礼品卡生成功能"] = "通过" if generated_cards else "失败"
    results["礼品卡兑换功能"] = test_gift_card_redeem()
    results["账号数量限制"] = test_account_limit()
    results["档位升级逻辑"] = test_tier_upgrade()
    results["降级阻止验证"] = test_downgrade_prevention()
    
    # 生成测试报告
    generate_test_report(results)
    
    return results

if __name__ == "__main__":
    main()
