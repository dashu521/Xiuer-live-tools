#!/bin/bash
# 在服务器上执行的诊断命令（你 SSH 登录后复制整段运行）
# 用法：先 ssh root@121.41.179.197 登录，然后复制下面 --- 之间的全部内容粘贴执行

cat << 'INNER'
--- 复制从下一行到 INNER 结束 ---
cd /opt/auth-api
echo "=== 容器状态 ==="
docker compose ps -a
echo ""
echo "=== api 最近 150 行日志 ==="
docker compose logs --tail=150 api
echo ""
echo "=== 健康检查 ==="
curl -s -w "\nHTTP_CODE:%{http_code}\n" http://127.0.0.1:8000/health || true
--- 复制到此处结束 ---
INNER
