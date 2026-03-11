# POST /auth/trial/start 与 GET /auth/trial/status 服务器验证

部署后执行：`docker compose build && docker compose up -d`，再用下面两条 curl 验收。

## 1. 先登录拿 token

```bash
curl -s -X POST "http://121.41.179.197:8000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"你的邮箱或手机号","password":"你的密码"}'
```

从响应中取出 `token` 或 `access_token`，记为 `TOKEN`。

## 2. 启动试用（POST /auth/trial/start）

```bash
curl -s -X POST "http://121.41.179.197:8000/auth/trial/start" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

将 `YOUR_ACCESS_TOKEN` 替换为第 1 步拿到的 token。预期响应示例：

```json
{"success":true,"trialEndsAt":1738xxxxxx}
```

## 3. 查询试用状态（GET /auth/trial/status）

```bash
curl -s -X GET "http://121.41.179.197:8000/auth/trial/status" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

预期响应示例（已开通且未过期）：

```json
{"hasTrial":true,"trialEndsAt":1738xxxxxx,"isActive":true}
```

未开通时：`{"hasTrial":false,"trialEndsAt":null,"isActive":false}`。

---

## 一键示例（替换 USER、PASS 和 BASE_URL 后执行）

```bash
BASE_URL="http://121.41.179.197:8000"
RESP=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"USER","password":"PASS"}')
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token') or d.get('access_token',''))")

# 启动试用
curl -s -X POST "$BASE_URL/auth/trial/start" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json"

# 查询状态
curl -s -X GET "$BASE_URL/auth/trial/status" -H "Authorization: Bearer $TOKEN"
```
