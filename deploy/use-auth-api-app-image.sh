#!/usr/bin/env bash
set -euo pipefail

SERVER_PATH="${SERVER_PATH:-/opt/auth-api}"
TARGET_IMAGE="${TARGET_IMAGE:-}"
REQUIRE_ACR_VPC_IMAGE="${REQUIRE_ACR_VPC_IMAGE:-1}"
SMOKE_SCRIPT="${SMOKE_SCRIPT:-./run-auth-api-smoke.sh}"
OVERRIDE_FILE=".auth-api.app-image.override.yml"

if [[ -z "$TARGET_IMAGE" ]]; then
  echo "用法: TARGET_IMAGE=registry.example.com/xiuer/auth-api:release-tag $0"
  exit 1
fi

cd "$SERVER_PATH"

if [[ "$REQUIRE_ACR_VPC_IMAGE" == "1" && "$TARGET_IMAGE" != *"-vpc."*".aliyuncs.com/"* ]]; then
  echo "拒绝发布：TARGET_IMAGE 必须使用 ACR VPC 地址，当前为: $TARGET_IMAGE"
  exit 1
fi

docker pull "$TARGET_IMAGE"

python3 - <<PY
from pathlib import Path
env_path = Path(".env")
lines = env_path.read_text().splitlines() if env_path.exists() else []
key = "AUTH_API_APP_IMAGE="
value = "AUTH_API_APP_IMAGE=${TARGET_IMAGE}"
if any(line.startswith(key) for line in lines):
    lines = [value if line.startswith(key) else line for line in lines]
else:
    lines.append(value)
env_path.write_text("\\n".join(lines) + "\\n")
PY

cat > "$OVERRIDE_FILE" <<EOF
services:
  api:
    image: ${TARGET_IMAGE}
EOF

docker compose -f docker-compose.yml -f "$OVERRIDE_FILE" pull api
docker compose -f docker-compose.yml -f "$OVERRIDE_FILE" up -d api --no-build
docker compose -f docker-compose.yml -f "$OVERRIDE_FILE" ps api

if [[ -x "$SMOKE_SCRIPT" ]]; then
  "$SMOKE_SCRIPT"
else
  echo "skip smoke: $SMOKE_SCRIPT 不存在或不可执行"
fi
