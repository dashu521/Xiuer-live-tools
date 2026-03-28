import os
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

TEST_DB_PATH = Path(__file__).resolve().parent / "data" / "test_healthcheck.db"
TEST_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

os.environ["DB_PATH"] = str(TEST_DB_PATH)
os.environ["JWT_SECRET"] = "test-healthcheck-secret-32-byte-key"
os.environ["SMS_MODE"] = "dev"

from main import app  # noqa: E402


class HealthcheckTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_returns_200_when_database_is_available(self):
        with patch(
            "main.check_database_health",
            return_value={"ok": True, "dialect": "sqlite"},
        ):
            response = self.client.get("/health")

        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertTrue(body["ok"])
        self.assertEqual(body["service"], "auth-api")
        self.assertEqual(body["database"]["dialect"], "sqlite")
        self.assertIn("timestamp", body)

    def test_health_returns_503_when_database_is_unavailable(self):
        with patch(
            "main.check_database_health",
            return_value={"ok": False, "dialect": "sqlite", "error": "OperationalError"},
        ):
            response = self.client.get("/health")

        self.assertEqual(response.status_code, 503, response.text)
        body = response.json()
        self.assertFalse(body["ok"])
        self.assertEqual(body["database"]["error"], "OperationalError")


if __name__ == "__main__":
    unittest.main()
