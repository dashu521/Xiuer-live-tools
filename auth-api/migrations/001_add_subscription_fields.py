"""
数据库迁移脚本：添加订阅系统字段
- 添加用户账号数量限制
- 添加礼品卡档位字段
- 添加权益配置JSON字段
"""

from sqlalchemy import create_engine, text, Column, Integer, String, JSON
from sqlalchemy.ext.declarative import declarative_base
import os
import sys

# 添加父目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def migrate():
    """执行数据库迁移"""
    # 获取数据库连接
    db_path = os.environ.get('DB_PATH', '/data/users.db')
    database_url = f"sqlite:///{db_path}"
    
    print(f"连接到数据库: {database_url}")
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        # 1. 检查并添加 users.max_accounts 字段
        try:
            conn.execute(text("SELECT max_accounts FROM users LIMIT 1"))
            print("✓ users.max_accounts 字段已存在")
        except Exception:
            print("添加 users.max_accounts 字段...")
            conn.execute(text("ALTER TABLE users ADD COLUMN max_accounts INTEGER DEFAULT 1"))
            print("✓ users.max_accounts 字段添加成功")
        
        # 2. 检查并添加 users.trial_used 字段
        try:
            conn.execute(text("SELECT trial_used FROM users LIMIT 1"))
            print("✓ users.trial_used 字段已存在")
        except Exception:
            print("添加 users.trial_used 字段...")
            conn.execute(text("ALTER TABLE users ADD COLUMN trial_used INTEGER DEFAULT 0"))
            print("✓ users.trial_used 字段添加成功")
        
        # 3. 检查并添加 gift_cards.tier 字段
        try:
            conn.execute(text("SELECT tier FROM gift_cards LIMIT 1"))
            print("✓ gift_cards.tier 字段已存在")
        except Exception:
            print("添加 gift_cards.tier 字段...")
            conn.execute(text("ALTER TABLE gift_cards ADD COLUMN tier VARCHAR(20)"))
            # 更新现有数据，根据 membership_type 推断 tier
            conn.execute(text("""
                UPDATE gift_cards 
                SET tier = CASE 
                    WHEN membership_type = 'ultra' THEN 'ultra'
                    WHEN membership_type = 'pro_max' THEN 'pro_max'
                    ELSE 'pro'
                END
                WHERE tier IS NULL
            """))
            print("✓ gift_cards.tier 字段添加成功")
        
        # 4. 检查并添加 gift_cards.benefits_json 字段
        try:
            conn.execute(text("SELECT benefits_json FROM gift_cards LIMIT 1"))
            print("✓ gift_cards.benefits_json 字段已存在")
        except Exception:
            print("添加 gift_cards.benefits_json 字段...")
            conn.execute(text("ALTER TABLE gift_cards ADD COLUMN benefits_json JSON"))
            # 初始化现有数据的 benefits_json
            conn.execute(text("""
                UPDATE gift_cards 
                SET benefits_json = json_object(
                    'max_accounts', 1,
                    'features', json_array('all'),
                    'duration_days', NULL
                )
                WHERE benefits_json IS NULL
            """))
            print("✓ gift_cards.benefits_json 字段添加成功")
        
        conn.commit()
        print("\n数据库迁移完成！")
        
        # 验证迁移结果
        print("\n验证迁移结果:")
        result = conn.execute(text("PRAGMA table_info(users)"))
        columns = [row[1] for row in result]
        print(f"users 表字段: {', '.join(columns)}")
        
        result = conn.execute(text("PRAGMA table_info(gift_cards)"))
        columns = [row[1] for row in result]
        print(f"gift_cards 表字段: {', '.join(columns)}")

if __name__ == "__main__":
    migrate()
