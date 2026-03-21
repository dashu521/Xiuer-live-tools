#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${AUTH_API_BASE_URL:-http://127.0.0.1:8000}"
TEST_IDENTIFIER="${AUTH_API_TEST_IDENTIFIER:-}"
TEST_PASSWORD="${AUTH_API_TEST_PASSWORD:-}"
HEALTH_RETRIES="${AUTH_API_HEALTH_RETRIES:-30}"
HEALTH_INTERVAL="${AUTH_API_HEALTH_INTERVAL:-2}"

health_json=""
for ((i = 1; i <= HEALTH_RETRIES; i++)); do
  if health_json="$(curl -fsS "$BASE_URL/health" 2>/dev/null)"; then
    break
  fi
  sleep "$HEALTH_INTERVAL"
done

if [[ -z "$health_json" ]]; then
  echo "health check failed after ${HEALTH_RETRIES} attempts: $BASE_URL/health"
  exit 1
fi

python3 - <<'PY' "$health_json"
import json
import sys

payload = json.loads(sys.argv[1])
if payload.get("ok") is not True:
    raise SystemExit(f"health check failed: {payload}")
print("health ok")
PY

if [[ -z "$TEST_IDENTIFIER" || -z "$TEST_PASSWORD" ]]; then
  echo "skip auth smoke: AUTH_API_TEST_IDENTIFIER or AUTH_API_TEST_PASSWORD not set"
  exit 0
fi

login_json="$(curl -fsS -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$TEST_IDENTIFIER\",\"password\":\"$TEST_PASSWORD\"}")"

access_token="$(
  python3 - <<'PY' "$login_json"
import json
import sys

payload = json.loads(sys.argv[1])
access_token = payload.get("access_token")
token = payload.get("token")
refresh_token = payload.get("refresh_token")

if not access_token or not token or access_token != token:
    raise SystemExit(f"login contract invalid: {payload}")
if not refresh_token:
    raise SystemExit(f"refresh token missing: {payload}")

print(access_token)
PY
)"
echo "login contract ok"

subscription_json="$(curl -fsS "$BASE_URL/subscription/status?username=$TEST_IDENTIFIER" \
  -H "Authorization: Bearer $access_token")"

python3 - <<'PY' "$subscription_json" "$TEST_IDENTIFIER"
import json
import sys

payload = json.loads(sys.argv[1])
identifier = sys.argv[2]

if payload.get("success") is not True:
    raise SystemExit(f"subscription status failed: {payload}")
if payload.get("username") != identifier:
    raise SystemExit(f"subscription username mismatch: {payload}")

print("subscription status ok")
PY
