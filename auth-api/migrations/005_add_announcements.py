"""添加消息中心 announcements 与 announcement_receipts 表"""
from sqlalchemy import text

from database import get_db, is_mysql


def upgrade():
    """创建消息表与已读状态表"""
    db = next(get_db())

    try:
        if is_mysql():
            sql_statements = [
                """
                CREATE TABLE IF NOT EXISTS announcements (
                    id VARCHAR(36) PRIMARY KEY,
                    title VARCHAR(200) NOT NULL,
                    content TEXT NOT NULL,
                    type VARCHAR(20) DEFAULT 'notice',
                    status VARCHAR(20) DEFAULT 'draft',
                    target_scope VARCHAR(20) DEFAULT 'all',
                    target_value VARCHAR(255) NULL,
                    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
                    created_by VARCHAR(100) NULL,
                    published_at DATETIME NULL,
                    expires_at DATETIME NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_announcements_status (status),
                    INDEX idx_announcements_target (target_scope, target_value),
                    INDEX idx_announcements_published (published_at),
                    INDEX idx_announcements_expires (expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """,
                """
                CREATE TABLE IF NOT EXISTS announcement_receipts (
                    id VARCHAR(36) PRIMARY KEY,
                    announcement_id VARCHAR(36) NOT NULL,
                    user_id VARCHAR(36) NOT NULL,
                    read_at DATETIME NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_announcement_receipt_user (announcement_id, user_id),
                    INDEX idx_receipt_user_read_at (user_id, read_at),
                    CONSTRAINT fk_announcement_receipts_announcement
                        FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """,
            ]
        else:
            sql_statements = [
                """
                CREATE TABLE IF NOT EXISTS announcements (
                    id VARCHAR(36) PRIMARY KEY,
                    title VARCHAR(200) NOT NULL,
                    content TEXT NOT NULL,
                    type VARCHAR(20) DEFAULT 'notice',
                    status VARCHAR(20) DEFAULT 'draft',
                    target_scope VARCHAR(20) DEFAULT 'all',
                    target_value VARCHAR(255) NULL,
                    is_pinned BOOLEAN NOT NULL DEFAULT 0,
                    created_by VARCHAR(100) NULL,
                    published_at DATETIME NULL,
                    expires_at DATETIME NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                """,
                "CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);",
                "CREATE INDEX IF NOT EXISTS idx_announcements_target ON announcements(target_scope, target_value);",
                "CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(published_at);",
                "CREATE INDEX IF NOT EXISTS idx_announcements_expires ON announcements(expires_at);",
                """
                CREATE TABLE IF NOT EXISTS announcement_receipts (
                    id VARCHAR(36) PRIMARY KEY,
                    announcement_id VARCHAR(36) NOT NULL,
                    user_id VARCHAR(36) NOT NULL,
                    read_at DATETIME NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
                );
                """,
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_announcement_receipt_user ON announcement_receipts(announcement_id, user_id);",
                "CREATE INDEX IF NOT EXISTS idx_receipt_user_read_at ON announcement_receipts(user_id, read_at);",
            ]

        for statement in sql_statements:
            db.execute(text(statement))
        db.commit()
        print("[Migration 005] announcements tables created successfully")
    except Exception as e:
        db.rollback()
        print(f"[Migration 005] Error creating announcements tables: {e}")
        raise


def downgrade():
    """删除消息表"""
    db = next(get_db())

    try:
        db.execute(text("DROP TABLE IF EXISTS announcement_receipts"))
        db.execute(text("DROP TABLE IF EXISTS announcements"))
        db.commit()
        print("[Migration 005] announcements tables dropped successfully")
    except Exception as e:
        db.rollback()
        print(f"[Migration 005] Error dropping announcements tables: {e}")
        raise


if __name__ == "__main__":
    upgrade()
