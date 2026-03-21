#!/bin/bash
# 在服务器上执行的部署脚本

cd /opt/auth-api

echo "=== 停止旧服务 ==="
docker compose down 2>/dev/null || true

echo ""
echo "=== 重新构建 ==="
DOCKER_BUILDKIT=0 docker compose build --pull=false api 2>&1

echo ""
echo "=== 启动服务 ==="
docker compose up -d api --no-build

echo ""
echo "=== 等待启动 ==="
sleep 15

echo ""
echo "=== 检查状态 ==="
docker compose ps

echo ""
echo "=== 测试API ==="
curl -s http://127.0.0.1:8000/openapi.json 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    paths = data.get('paths', {})
    print(f'Total APIs: {len(paths)}')
    print('')
    print('SMS APIs:')
    for p in sorted(paths.keys()):
        if 'sms' in p:
            print(f'  {p}')
except:
    print('API not ready')
"

echo ""
echo "=== 部署完成 ==="
