#!/bin/bash
set -e

echo "=== 部署短信验证码功能到服务器 (Docker Compose) ==="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_HOST="121.41.179.197"
SERVER_USER="root"
SERVER_PATH="/opt/auth-api"
LOCAL_DIR="${SCRIPT_DIR}/../auth-api"

FILES=(
    "config.py"
    "schemas_admin.py"
    "sms_service.py"
    "routers/sms.py"
    "routers/auth.py"
    "routers/me.py"
    "routers/subscription.py"
    "routers/admin.py"
    "routers/gift_card.py"
    "models.py"
    "schemas.py"
    "database.py"
    "main.py"
    "deps.py"
    "routers/__init__.py"
    "requirements.txt"
    "Dockerfile"
    "static/admin_ui.html"
    "run-auth-api-smoke.sh"
    "use-auth-api-base-image.sh"
)

echo ""
echo "1. 同步文件到服务器..."

ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" "mkdir -p $SERVER_PATH/static $SERVER_PATH/routers"

for file in "${FILES[@]}"; do
    echo "  复制: $file"
    scp -o StrictHostKeyChecking=no "$LOCAL_DIR/$file" "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/$file"
done

echo "  复制: docker-compose.yml"
scp -o StrictHostKeyChecking=no "$SCRIPT_DIR/docker-compose.yml" "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/docker-compose.yml"

if [[ -f "$SCRIPT_DIR/.env" ]]; then
    echo "  复制: .env (阿里云等环境变量)"
    scp -o StrictHostKeyChecking=no "$SCRIPT_DIR/.env" "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/.env"
fi

echo ""
echo "2. 重启Docker服务..."

ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" << 'EOF'
    cd /opt/auth-api
    chmod +x ./run-auth-api-smoke.sh ./use-auth-api-base-image.sh
    TARGET_IMAGE=$(grep '^AUTH_API_BASE_IMAGE=' .env | cut -d= -f2-)
    if [ -z "$TARGET_IMAGE" ]; then
        echo "  缺少 AUTH_API_BASE_IMAGE，拒绝发布"
        exit 1
    fi
    AUTH_API_TEST_IDENTIFIER="${AUTH_API_TEST_IDENTIFIER:-}" \
    AUTH_API_TEST_PASSWORD="${AUTH_API_TEST_PASSWORD:-}" \
    TARGET_IMAGE="$TARGET_IMAGE" ./use-auth-api-base-image.sh
EOF

echo ""
echo "3. 验证部署..."

ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" << 'EOF'
    API_LIST=$(curl -s http://127.0.0.1:8000/openapi.json 2>/dev/null | python3 -c "import sys,json; print(' '.join(json.load(sys.stdin).get('paths',{}).keys()))" 2>/dev/null || echo "")
    if echo "$API_LIST" | grep -q "/auth/sms/send"; then
        echo ""
        echo "=== ✅ 部署成功！==="
        echo "查看日志: docker compose logs -f api"
    else
        echo "  API检查失败，查看日志:"
        docker compose logs --tail=20 api
        exit 1
    fi
EOF
