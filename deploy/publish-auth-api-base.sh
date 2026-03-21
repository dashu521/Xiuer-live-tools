#!/usr/bin/env bash
set -euo pipefail

SOURCE_IMAGE="${SOURCE_IMAGE:-auth-api-runtime-base:3.11-local}"
TARGET_IMAGE="${TARGET_IMAGE:-}"
REGISTRY_USERNAME="${REGISTRY_USERNAME:-}"
REGISTRY_PASSWORD="${REGISTRY_PASSWORD:-}"

if [[ -z "$TARGET_IMAGE" ]]; then
  echo "用法: TARGET_IMAGE=registry.example.com/xiuer/auth-api-runtime-base:3.11-slim $0"
  exit 1
fi

if ! docker image inspect "$SOURCE_IMAGE" >/dev/null 2>&1; then
  echo "未找到本地基础镜像: $SOURCE_IMAGE"
  exit 1
fi

registry_host="${TARGET_IMAGE%%/*}"

if [[ -n "$REGISTRY_USERNAME" && -n "$REGISTRY_PASSWORD" ]]; then
  echo "$REGISTRY_PASSWORD" | docker login "$registry_host" --username "$REGISTRY_USERNAME" --password-stdin
fi

docker tag "$SOURCE_IMAGE" "$TARGET_IMAGE"
docker push "$TARGET_IMAGE"

echo "已推送基础镜像: $TARGET_IMAGE"
