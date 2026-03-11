#!/bin/bash
# 在服务器上运行此脚本，排查「收不到验证码」问题。
# 用法：在 deploy 目录下执行 ./check-sms.sh，或 bash check-sms.sh

set -e
BASE_URL="${1:-http://127.0.0.1:8000}"
echo "=== 1. 检查短信服务状态（容器内环境）==="
curl -s "${BASE_URL}/auth/sms/status" | python3 -m json.tool 2>/dev/null || curl -s "${BASE_URL}/auth/sms/status"
echo ""
echo "=== 2. 若上面 configured 为 false，说明 ALIYUN_* 未传入容器 ==="
echo "请确认执行 docker compose 的目录下有 .env，且含："
echo "  SMS_MODE=aliyun_dypns"
echo "  ALIYUN_ACCESS_KEY_ID=..."
echo "  ALIYUN_ACCESS_KEY_SECRET=..."
echo "  ALIYUN_SMS_SIGN_NAME=..."
echo "  ALIYUN_SMS_TEMPLATE_CODE=..."
echo ""
echo "=== 3. 测试发送接口（仅测接口是否可达，不会真发短信到手机）==="
echo "curl -X POST \"${BASE_URL}/auth/sms/send?phone=13800138000\""
echo ""
