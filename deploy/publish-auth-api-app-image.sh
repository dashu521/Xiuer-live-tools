#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BASE_IMAGE="${BASE_IMAGE:-}"
TARGET_IMAGE="${TARGET_IMAGE:-}"
REGISTRY_USERNAME="${REGISTRY_USERNAME:-}"
REGISTRY_PASSWORD="${REGISTRY_PASSWORD:-}"
DOCKERFILE_PATH="${DOCKERFILE_PATH:-$REPO_ROOT/auth-api/Dockerfile}"
BUILD_CONTEXT="${BUILD_CONTEXT:-$REPO_ROOT/auth-api}"

if [[ -z "$TARGET_IMAGE" ]]; then
  echo "用法: TARGET_IMAGE=registry.example.com/xiuer/auth-api:release-tag $0"
  exit 1
fi

if [[ ! -f "$DOCKERFILE_PATH" ]]; then
  echo "未找到 Dockerfile: $DOCKERFILE_PATH"
  exit 1
fi

registry_host="${TARGET_IMAGE%%/*}"

if [[ -n "$REGISTRY_USERNAME" && -n "$REGISTRY_PASSWORD" ]]; then
  echo "$REGISTRY_PASSWORD" | docker login "$registry_host" --username "$REGISTRY_USERNAME" --password-stdin
fi

build_args=()
if [[ -n "$BASE_IMAGE" ]]; then
  build_args+=(--build-arg "BASE_IMAGE=$BASE_IMAGE")
fi

docker build "${build_args[@]}" -f "$DOCKERFILE_PATH" -t "$TARGET_IMAGE" "$BUILD_CONTEXT"
docker push "$TARGET_IMAGE"

echo "已推送业务镜像: $TARGET_IMAGE"
