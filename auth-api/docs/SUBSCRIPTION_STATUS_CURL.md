# GET /subscription/status 自测（curl）

**对齐真相**：仅 POST /register、POST /login（无 /auth 前缀）；/login 返回字段名为 **token**（非 access_token）。

基准 URL：`http://127.0.0.1:8000` 或 `http://121.41.179.197:8000`

## 1) 注册新用户

```bash
curl -s -X POST "http://127.0.0.1:8000/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"subtest@example.com","password":"Pass123456"}'
```

- 成功：HTTP 200，返回 `user`、`access_token`（register 仍用 access_token）、`refresh_token` 等。
- 若账号已存在：HTTP 400。

## 2) 登录拿 token

```bash
curl -s -X POST "http://127.0.0.1:8000/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"subtest@example.com","password":"Pass123456"}'
```

- 成功：HTTP 200，响应 JSON 中字段名为 **token**（jq 取值用 `.token`），后续请求用该值作为 Bearer。

## 3) GET /subscription/status（带 Authorization）

```bash
# YOUR_TOKEN 为上一步 .token，USERNAME 为同一用户（需 URL 编码）
curl -s -w "\nHTTP_CODE:%{http_code}" "http://127.0.0.1:8000/subscription/status?username=subtest%40example.com" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

- 成功：HTTP 200，例如：
  `{"success":true,"username":"subtest@example.com","is_disabled":0,"plan":"trial","expires_at":0,"expired":true}`
- 查他人：HTTP 403。
- 无 token 或 token 无效：HTTP 401。

## 自测命令示例（jq 取 .token）

```bash
TOKEN=$(curl -s -X POST "http://127.0.0.1:8000/login" -H "Content-Type: application/json" \
  -d '{"username":"your@email.com","password":"YourPass"}' | jq -r '.token')
curl -s "http://127.0.0.1:8000/subscription/status?username=your%40email.com" \
  -H "Authorization: Bearer $TOKEN"
```
