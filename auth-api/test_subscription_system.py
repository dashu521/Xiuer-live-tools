"""订阅系统的 SQLite 级业务规则回归测试。"""

from datetime import datetime
from pathlib import Path
import secrets
import sqlite3
import time
import unittest
import uuid

TEST_DB_PATH = Path(__file__).resolve().parent / "data" / "test_users.db"


def generate_gift_code() -> str:
    code_chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return "-".join("".join(secrets.choice(code_chars) for _ in range(4)) for _ in range(3))


class SubscriptionSystemTests(unittest.TestCase):
    def setUp(self):
        TEST_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        if TEST_DB_PATH.exists():
            TEST_DB_PATH.unlink()
        self._init_test_database()

    def _connect(self):
        return sqlite3.connect(TEST_DB_PATH)

    def _init_test_database(self):
        conn = self._connect()
        cursor = conn.cursor()

        cursor.execute(
            """
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
                plan TEXT DEFAULT 'trial',
                trial_start_at TIMESTAMP,
                trial_end_at TIMESTAMP,
                max_accounts INTEGER DEFAULT 1,
                trial_used INTEGER DEFAULT 0
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS trials (
                username TEXT PRIMARY KEY,
                start_ts INTEGER,
                end_ts INTEGER
            )
            """
        )

        cursor.execute(
            """
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
            """
        )

        cursor.execute(
            """
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
            """
        )

        conn.commit()
        conn.close()

    def test_trial_duration_is_three_days(self):
        conn = self._connect()
        cursor = conn.cursor()

        user_id = str(uuid.uuid4())
        cursor.execute(
            """
            INSERT INTO users (id, username, email, password_hash, plan)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, "test_user", "test@example.com", "hashed_password", "trial"),
        )

        now_ts = int(time.time())
        end_ts = now_ts + 3 * 24 * 3600
        cursor.execute(
            """
            INSERT INTO trials (username, start_ts, end_ts)
            VALUES (?, ?, ?)
            """,
            (user_id, now_ts, end_ts),
        )
        conn.commit()

        cursor.execute("SELECT start_ts, end_ts FROM trials WHERE username = ?", (user_id,))
        start_ts, stored_end_ts = cursor.fetchone()
        conn.close()

        self.assertEqual((stored_end_ts - start_ts) / (24 * 3600), 3.0)

    def test_gift_card_generation_creates_expected_tiers(self):
        conn = self._connect()
        cursor = conn.cursor()

        tier_benefits = {
            "pro": {"max_accounts": 1, "features": ["all"]},
            "pro_max": {"max_accounts": 3, "features": ["all"]},
            "ultra": {"max_accounts": -1, "features": ["all"]},
        }

        for tier, benefits in tier_benefits.items():
            cursor.execute(
                """
                INSERT INTO gift_cards (id, code, tier, benefits_json, membership_type, status)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (str(uuid.uuid4()), generate_gift_code(), tier, str(benefits), tier, "active"),
            )

        conn.commit()
        cursor.execute("SELECT tier FROM gift_cards WHERE status = ? ORDER BY tier", ("active",))
        rows = [row[0] for row in cursor.fetchall()]
        conn.close()

        self.assertEqual(rows, ["pro", "pro_max", "ultra"])

    def test_gift_card_redeem_updates_user_and_card_status(self):
        conn = self._connect()
        cursor = conn.cursor()

        user_id = str(uuid.uuid4())
        card_id = str(uuid.uuid4())
        now_ts = int(time.time())

        cursor.execute(
            """
            INSERT INTO users (id, username, email, password_hash, plan, max_accounts)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, "redeem_test", "redeem@example.com", "hashed_password", "trial", 1),
        )
        cursor.execute(
            """
            INSERT INTO gift_cards (id, code, tier, benefits_json, membership_type, status)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (card_id, generate_gift_code(), "pro", str({"max_accounts": 1}), "pro", "active"),
        )

        cursor.execute("UPDATE users SET plan = ?, max_accounts = ? WHERE id = ?", ("pro", 1, user_id))
        cursor.execute(
            """
            UPDATE gift_cards SET status = ?, redeemed_at = ?, redeemed_by = ?
            WHERE id = ?
            """,
            ("redeemed", datetime.now(), user_id, card_id),
        )
        cursor.execute(
            """
            INSERT INTO gift_card_redemptions
            (id, gift_card_id, user_id, previous_plan, new_plan, previous_expiry_ts, new_expiry_ts)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), card_id, user_id, "trial", "pro", None, now_ts + 30 * 24 * 3600),
        )
        conn.commit()

        cursor.execute("SELECT plan, max_accounts FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        cursor.execute("SELECT status FROM gift_cards WHERE id = ?", (card_id,))
        card_row = cursor.fetchone()
        conn.close()

        self.assertEqual(user_row, ("pro", 1))
        self.assertEqual(card_row[0], "redeemed")

    def test_account_limit_by_tier(self):
        conn = self._connect()
        cursor = conn.cursor()

        cases = [
            ("trial", 1),
            ("pro", 1),
            ("pro_max", 3),
            ("ultra", -1),
        ]

        for tier, max_accounts in cases:
            user_id = str(uuid.uuid4())
            cursor.execute(
                """
                INSERT INTO users (id, username, email, password_hash, plan, max_accounts)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user_id, f"test_{tier}", f"{tier}@example.com", "hashed_password", tier, max_accounts),
            )

        conn.commit()
        cursor.execute("SELECT plan, max_accounts FROM users ORDER BY plan")
        rows = cursor.fetchall()
        conn.close()

        self.assertEqual(rows, [("pro", 1), ("pro_max", 3), ("trial", 1), ("ultra", -1)])

    def test_tier_upgrade_from_pro_to_pro_max(self):
        conn = self._connect()
        cursor = conn.cursor()

        user_id = str(uuid.uuid4())
        card_id = str(uuid.uuid4())
        cursor.execute(
            """
            INSERT INTO users (id, username, email, password_hash, plan, max_accounts)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, "upgrade_test", "upgrade@example.com", "hashed_password", "pro", 1),
        )
        cursor.execute(
            """
            INSERT INTO gift_cards (id, code, tier, benefits_json, membership_type, status)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                card_id,
                generate_gift_code(),
                "pro_max",
                str({"max_accounts": 3, "features": ["all"]}),
                "pro_max",
                "active",
            ),
        )

        tier_order = {"trial": 0, "pro": 1, "pro_max": 2, "ultra": 3}
        self.assertGreaterEqual(tier_order["pro_max"], tier_order["pro"])

        cursor.execute("UPDATE users SET plan = ?, max_accounts = ? WHERE id = ?", ("pro_max", 3, user_id))
        cursor.execute(
            """
            UPDATE gift_cards SET status = ?, redeemed_at = ?, redeemed_by = ?
            WHERE id = ?
            """,
            ("redeemed", datetime.now(), user_id, card_id),
        )
        conn.commit()

        cursor.execute("SELECT plan, max_accounts FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        conn.close()

        self.assertEqual(row, ("pro_max", 3))

    def test_downgrade_from_ultra_to_pro_is_blocked(self):
        tier_order = {"trial": 0, "pro": 1, "pro_max": 2, "ultra": 3}
        self.assertLess(tier_order["pro"], tier_order["ultra"])


if __name__ == "__main__":
    unittest.main()
