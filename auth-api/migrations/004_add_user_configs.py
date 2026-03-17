"""添加 user_configs 表用于跨设备配置同步"""
from datetime import datetime
import uuid
from sqlalchemy import text
from database import get_db, is_mysql


def upgrade():
    """创建 user_configs 表"""
    db = next(get_db())
    
    try:
        if is_mysql():
            sql = """
            CREATE TABLE IF NOT EXISTS user_configs (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL UNIQUE,
                config_json JSON NOT NULL DEFAULT ('{}'),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """
        else:
            sql = """
            CREATE TABLE IF NOT EXISTS user_configs (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL UNIQUE,
                config_json TEXT NOT NULL DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_user_configs_user_id ON user_configs(user_id);
            """
        
        db.execute(text(sql))
        db.commit()
        print("[Migration 004] user_configs table created successfully")
    except Exception as e:
        db.rollback()
        print(f"[Migration 004] Error creating user_configs table: {e}")
        raise


def downgrade():
    """删除 user_configs 表"""
    db = next(get_db())
    
    try:
        db.execute(text("DROP TABLE IF EXISTS user_configs"))
        db.commit()
        print("[Migration 004] user_configs table dropped successfully")
    except Exception as e:
        db.rollback()
        print(f"[Migration 004] Error dropping user_configs table: {e}")
        raise


if __name__ == "__main__":
    upgrade()
