#!/usr/bin/env bash
set -euo pipefail

SERVER_PATH="${SERVER_PATH:-/opt/auth-api}"
TARGET_IMAGE="${TARGET_IMAGE:-}"

if [[ -z "$TARGET_IMAGE" ]]; then
  echo "用法: TARGET_IMAGE=registry.example.com/xiuer/auth-api-runtime-base:3.11-slim $0"
  exit 1
fi

cd "$SERVER_PATH"

python3 - <<PY
from pathlib import Path
env_path = Path(".env")
lines = env_path.read_text().splitlines() if env_path.exists() else []
key = "AUTH_API_BASE_IMAGE="
value = "AUTH_API_BASE_IMAGE=${TARGET_IMAGE}"
if any(line.startswith(key) for line in lines):
    lines = [value if line.startswith(key) else line for line in lines]
else:
    lines.append(value)
env_path.write_text("\\n".join(lines) + "\\n")
PY

DOCKER_BUILDKIT=0 docker compose build --pull=false api
docker compose up -d api --no-build
docker compose ps api
