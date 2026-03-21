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
    # docker compose 会自动读取当前目录 .env 并注入到 service 环境变量

    echo "  停止旧容器..."
    docker compose down || true

    echo "  重新构建镜像..."
    DOCKER_BUILDKIT=0 docker compose build --pull=false api

    echo "  启动服务..."
    docker compose up -d api --no-build

    echo "  等待服务启动..."
    sleep 10

    echo "  检查容器状态..."
    docker compose ps
EOF

echo ""
echo "3. 验证部署..."

ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" << 'EOF'
    sleep 3
    
    API_LIST=$(curl -s http://127.0.0.1:8000/openapi.json 2>/dev/null | python3 -c "import sys,json; print(' '.join(json.load(sys.stdin).get('paths',{}).keys()))" 2>/dev/null || echo "")
    
    if echo "$API_LIST" | grep -q "/auth/sms/send"; then
        echo ""
        echo "=== ✅ 部署成功！==="
        echo ""
        echo "可用API:"
        echo "  - POST /auth/sms/send  (发送验证码)"
        echo "  - POST /auth/sms/login (验证码登录)"
        echo ""
        echo "测试命令（phone 为 query 参数）:"
        echo '  curl -X POST "http://127.0.0.1:8000/auth/sms/send?phone=13800138000"'
        echo ""
        echo "若收不到验证码：请在 号码认证控制台 配置赠送签名与模板，并设置 ALIYUN_SMS_SIGN_NAME、ALIYUN_SMS_TEMPLATE_CODE，详见 docs/SMS_SETUP.md"
        echo ""
        echo "查看日志:"
        echo "  docker compose logs -f api"
    else
        echo "  API检查失败，查看日志:"
        docker compose logs --tail=20 api
    fi
EOF
