import os
import unittest
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text

TEST_DB_PATH = Path(__file__).resolve().parent / "data" / "test_subscription_contracts.db"
TEST_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

os.environ["DB_PATH"] = str(TEST_DB_PATH)
os.environ["JWT_SECRET"] = "test-subscription-contracts-secret-32-byte-key"
os.environ["SMS_MODE"] = "dev"

from database import SessionLocal, create_tables, engine  # noqa: E402
from main import app  # noqa: E402
from models import Subscription, User  # noqa: E402
from routers.subscription import get_current_user  # noqa: E402


class SubscriptionContractTests(unittest.TestCase):
    def setUp(self):
        with engine.begin() as conn:
            for table in (
                "user_configs",
                "feedbacks",
                "gift_card_redemptions",
                "gift_cards",
                "audit_logs",
                "subscriptions",
                "refresh_tokens",
                "sms_codes",
                "trials",
                "users",
            ):
                conn.execute(text(f"DROP TABLE IF EXISTS {table}"))
        create_tables()
        self.client = TestClient(app)

    def _register(self, username: str, password: str) -> dict:
        response = self.client.post("/register", json={"username": username, "password": password})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def _auth_headers(self, token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def test_subscription_status_forbidden_error_is_structured(self):
        register_data = self._register("subscription@example.com", "secret123")

        response = self.client.get(
            "/subscription/status?username=other@example.com",
            headers=self._auth_headers(register_data["access_token"]),
        )

        self.assertEqual(response.status_code, 403, response.text)
        self.assertEqual(
            response.json()["detail"],
            {"code": "forbidden", "message": "无权查询其他用户状态"},
        )

    def test_subscription_status_user_not_found_error_is_structured(self):
        class _MissingUser:
            email = "missing@example.com"
            phone = None
            id = "missing-user-id"

        app.dependency_overrides[get_current_user] = lambda: _MissingUser()
        try:
            response = self.client.get("/subscription/status?username=missing@example.com")

            self.assertEqual(response.status_code, 404, response.text)
            self.assertEqual(
                response.json()["detail"],
                {"code": "user_not_found", "message": "用户不存在"},
            )
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_subscription_status_uses_user_id_and_normalizes_datetime_period_end(self):
        register_data = self._register("paid@example.com", "secret123")
        user_id = register_data["user"]["id"]
        db = SessionLocal()
        try:
            subscription = db.query(Subscription).filter(Subscription.user_id == user_id).first()
            self.assertIsNotNone(subscription)
            subscription.plan = "pro_max"
            subscription.status = "active"
            subscription.current_period_end = datetime.utcnow() + timedelta(days=7)
            db.commit()
        finally:
            db.close()

        response = self.client.get(
            "/subscription/status?username=paid@example.com",
            headers=self._auth_headers(register_data["access_token"]),
        )

        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["plan"], "pro_max")
        self.assertEqual(body["username"], "paid@example.com")
        self.assertIsInstance(body["current_period_end"], int)
        self.assertFalse(body["expired"])


if __name__ == "__main__":
    unittest.main()
