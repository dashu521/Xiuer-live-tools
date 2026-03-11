# Task 4：部署到服务器并验证 /subscription/status

## 4.1 将代码同步到服务器 /opt/auth-api

按你当前部署方式任选一种，在**服务器**上执行或从本机推代码。

**方式 A：本机 rsync/scp 推送到服务器**

```bash
# 本机执行（替换为你的服务器用户与路径）
rsync -avz --exclude __pycache__ --exclude "*.pyc" --exclude test_sub.db \
  auth-api/ user@121.41.179.197:/opt/auth-api/
```

或仅同步本次改动文件：

```bash
scp auth-api/routers/subscription.py auth-api/main.py auth-api/config.py user@121.41.179.197:/opt/auth-api/
scp auth-api/routers/subscription.py user@121.41.179.197:/opt/auth-api/routers/
```

**方式 B：服务器上 git pull（若 /opt/auth-api 为 git clone）**

```bash
ssh user@121.41.179.197 "cd /opt/auth-api && git pull"
```

## 4.2 重建并重启 auth-api 容器

在**服务器**上，进入部署目录（一般为含 docker-compose 的目录，且 context 指向 auth-api 或 /opt/auth-api）：

```bash
# 若 compose 在 /opt/auth-api 同级的 deploy 目录
cd /opt/deploy   # 或你实际路径
docker compose build api
docker compose up -d api
```

若使用 SQLite 且挂载宿主机目录（宿主机 /opt/auth-api/data -> 容器 /data）：

```bash
# 确保 compose 中 api 服务有：
#   environment: DATABASE_URL=sqlite:////data/users.db
#   volumes: - /opt/auth-api/data:/data
docker compose build api
docker compose up -d api
```

## 4.3 在服务器上用 curl 验证

在**服务器**上执行（或本机用 121.41.179.197:8000）：

```bash
# 1) Login 拿 token（替换为已有用户）
TOKEN=$(curl -s -X POST "http://127.0.0.1:8000/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"你的邮箱或手机","password":"你的密码"}' | jq -r '.token')

# 2) GET /subscription/status（替换 USERNAME 为同一用户的邮箱/手机，需 URL 编码）
curl -s -w "\nHTTP_CODE:%{http_code}" "http://127.0.0.1:8000/subscription/status?username=你的邮箱" \
  -H "Authorization: Bearer $TOKEN"
```

期望：HTTP 200，JSON 含 `success`, `username`, `is_disabled`, `plan`, `expires_at`, `expired`。

## 4.4 关键输出（执行后贴回）

- **docker ps** 中 auth-api 容器一行（名称、状态、端口）。
- **docker logs --tail 30 <api 容器名>** 最后 30 行（无报错即可）。
- 上述 **curl** 的完整响应（含 HTTP 状态码与 JSON）。

## 硬性约束核对（对齐真相）

- 现有接口仅 POST /register、POST /login（无 /auth 前缀）；/login 返回字段名为 **token**。
- 未引入新路由前缀（仅新增 /subscription/status）。
- 未改动现有 token 生成/校验逻辑（复用 get_current_user）。
- 只能查自己：username 等于 user.email 或 user.phone 或 str(user.id)，否则 403。
