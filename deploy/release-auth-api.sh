#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SERVER_HOST="${SERVER_HOST:-121.41.179.197}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PATH="${SERVER_PATH:-/opt/auth-api}"

PUBLISH_REGISTRY_HOST="${PUBLISH_REGISTRY_HOST:-crpi-ee6rz2ks9c36lft8.cn-hangzhou.personal.cr.aliyuncs.com}"
DEPLOY_REGISTRY_HOST="${DEPLOY_REGISTRY_HOST:-crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com}"
REGISTRY_NAMESPACE="${REGISTRY_NAMESPACE:-xiuer-live-tools}"
BASE_IMAGE_TAG="${BASE_IMAGE_TAG:-3.11-slim}"
APP_IMAGE_TAG="${APP_IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"

REGISTRY_USERNAME="${REGISTRY_USERNAME:-}"
REGISTRY_PASSWORD="${REGISTRY_PASSWORD:-}"

BASE_IMAGE="${BASE_IMAGE:-$DEPLOY_REGISTRY_HOST/$REGISTRY_NAMESPACE/auth-api-runtime-base:$BASE_IMAGE_TAG}"
PUBLISH_APP_IMAGE="${PUBLISH_APP_IMAGE:-$PUBLISH_REGISTRY_HOST/$REGISTRY_NAMESPACE/auth-api:$APP_IMAGE_TAG}"
DEPLOY_APP_IMAGE="${DEPLOY_APP_IMAGE:-$DEPLOY_REGISTRY_HOST/$REGISTRY_NAMESPACE/auth-api:$APP_IMAGE_TAG}"

PUBLISH_BASE_IMAGE="${PUBLISH_BASE_IMAGE:-0}"
AUTH_API_TEST_IDENTIFIER="${AUTH_API_TEST_IDENTIFIER:-}"
AUTH_API_TEST_PASSWORD="${AUTH_API_TEST_PASSWORD:-}"
FORCE_REMOTE_BUILD="${FORCE_REMOTE_BUILD:-0}"

if [[ -z "$REGISTRY_USERNAME" || -z "$REGISTRY_PASSWORD" ]]; then
  echo "缺少 REGISTRY_USERNAME 或 REGISTRY_PASSWORD"
  exit 1
fi

echo "== release config =="
echo "server: $SERVER_USER@$SERVER_HOST:$SERVER_PATH"
echo "base image: $BASE_IMAGE"
echo "publish app image: $PUBLISH_APP_IMAGE"
echo "deploy app image: $DEPLOY_APP_IMAGE"
echo "publish base image: $PUBLISH_BASE_IMAGE"
echo "force remote build: $FORCE_REMOTE_BUILD"

if [[ "$PUBLISH_BASE_IMAGE" == "1" ]]; then
  BASE_IMAGE="$BASE_IMAGE" \
  TARGET_IMAGE="$BASE_IMAGE" \
  REGISTRY_USERNAME="$REGISTRY_USERNAME" \
  REGISTRY_PASSWORD="$REGISTRY_PASSWORD" \
  "$SCRIPT_DIR/publish-auth-api-base.sh"
fi

if [[ "$FORCE_REMOTE_BUILD" == "1" ]] || ! docker info >/dev/null 2>&1; then
  scp "$SCRIPT_DIR/publish-auth-api-app-image.sh" \
      "$SCRIPT_DIR/run-auth-api-smoke.sh" \
      "$SCRIPT_DIR/use-auth-api-app-image.sh" \
      "$SCRIPT_DIR/remote-deploy.sh" \
      "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/"

  ssh -o BatchMode=yes "$SERVER_USER@$SERVER_HOST" \
    "chmod +x $SERVER_PATH/publish-auth-api-app-image.sh \
              $SERVER_PATH/run-auth-api-smoke.sh \
              $SERVER_PATH/use-auth-api-app-image.sh \
              $SERVER_PATH/remote-deploy.sh && \
     cd $SERVER_PATH && \
     BASE_IMAGE='$BASE_IMAGE' \
     TARGET_IMAGE='$DEPLOY_APP_IMAGE' \
     REGISTRY_USERNAME='$REGISTRY_USERNAME' \
     REGISTRY_PASSWORD='$REGISTRY_PASSWORD' \
     ./publish-auth-api-app-image.sh"
else
  BASE_IMAGE="$BASE_IMAGE" \
  TARGET_IMAGE="$PUBLISH_APP_IMAGE" \
  REGISTRY_USERNAME="$REGISTRY_USERNAME" \
  REGISTRY_PASSWORD="$REGISTRY_PASSWORD" \
  "$SCRIPT_DIR/publish-auth-api-app-image.sh"
fi

scp "$SCRIPT_DIR/run-auth-api-smoke.sh" \
    "$SCRIPT_DIR/use-auth-api-app-image.sh" \
    "$SCRIPT_DIR/remote-deploy.sh" \
    "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/"

ssh -o BatchMode=yes "$SERVER_USER@$SERVER_HOST" \
  "chmod +x $SERVER_PATH/run-auth-api-smoke.sh $SERVER_PATH/use-auth-api-app-image.sh $SERVER_PATH/remote-deploy.sh && \
   cd $SERVER_PATH && \
   AUTH_API_TEST_IDENTIFIER='$AUTH_API_TEST_IDENTIFIER' \
   AUTH_API_TEST_PASSWORD='$AUTH_API_TEST_PASSWORD' \
   TARGET_APP_IMAGE='$DEPLOY_APP_IMAGE' \
   ./remote-deploy.sh"

echo "release completed: $DEPLOY_APP_IMAGE"
