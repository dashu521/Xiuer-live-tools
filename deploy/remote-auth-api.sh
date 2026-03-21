#!/usr/bin/env bash
set -euo pipefail

cd /opt/auth-api

APP_IMAGE="${TARGET_APP_IMAGE:-$(grep '^AUTH_API_APP_IMAGE=' .env 2>/dev/null | cut -d= -f2-)}"
TARGET_IMAGE="${TARGET_IMAGE:-$(grep '^AUTH_API_BASE_IMAGE=' .env | cut -d= -f2-)}"

if [[ -n "$APP_IMAGE" ]]; then
  TARGET_IMAGE="$APP_IMAGE" ./use-auth-api-app-image.sh
  exit 0
fi

if [[ -z "$TARGET_IMAGE" ]]; then
  echo "未设置 TARGET_IMAGE，且 .env 中未找到 AUTH_API_BASE_IMAGE"
  exit 1
fi

TARGET_IMAGE="$TARGET_IMAGE" ./use-auth-api-base-image.sh
