# 忘记密码（人工支持版）与管理员重置

## 概述

- **桌面端**：登录页提供「忘记密码？」入口，点击后弹窗说明「请联系微信客服重置密码」并展示微信二维码（本地 `public/support-wechat-qr.png`）。不引入短信/邮件服务。
- **管理员后台**：在 `/admin/app` 用户列表中可对每行执行「重置密码」「生成临时密码」「禁用/启用」。
- **auth-api**：当前代码使用 `POST /admin/users/{username}/reset-password`、`POST /admin/users/{username}/disable`、`POST /admin/users/{username}/enable`，依赖管理员 JWT；审计日志不记录明文密码。

## 安全

- **访问控制现状**：当前代码中未实现 `ADMIN_ALLOWED_IPS` / `require_admin_ip` 一类的代码级 IP 白名单；管理员接口主要依赖管理员 JWT。
- **部署建议**：若管理后台需要公网暴露，建议在 Nginx、WAF、堡垒机或内网入口处额外加来源 IP 限制。
- **审计日志**：每次操作记录 `requestId`、操作类型、`username`、来源 IP、结果；不记录明文密码。
- **密码**：DB 写入使用 bcrypt hash；用户不存在时返回 404 + 友好 `detail`。

## 本机 curl 自测（127.0.0.1）

假设 auth-api 运行在 `http://127.0.0.1:8000`，并已配置管理员账号密码。

### 1. 管理员登录获取 token

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"change-me-admin"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
echo "Token: ${TOKEN:0:20}..."
```

### 2. 重置密码（指定新密码）

```bash
curl -s -X POST http://127.0.0.1:8000/admin/users/user%40example.com/reset-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"new_password":"newpass123"}' | python3 -m json.tool
```

预期：`{"ok": true, "message": "密码已更新"}`

### 3. 生成临时密码

```bash
curl -s -X POST http://127.0.0.1:8000/admin/users/user%40example.com/reset-password \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

预期：`{"ok": true, "temp_password": "随机12位", "message": "已生成临时密码，请妥善保管"}`（仅返回一次，请妥善保管）

### 4. 禁用用户

```bash
curl -s -X POST http://127.0.0.1:8000/admin/users/user%40example.com/disable \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

预期：`{"ok": true, "username": "user@example.com", "status": "disabled"}`

### 5. 启用用户

```bash
curl -s -X POST http://127.0.0.1:8000/admin/users/user%40example.com/enable \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

预期：`{"ok": true, "username": "user@example.com", "status": "active"}`

### 6. 用户不存在时的响应

```bash
curl -s -X POST http://127.0.0.1:8000/admin/users/nonexistent%40example.com/reset-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"new_password":"newpass123"}' | python3 -m json.tool
```

预期：HTTP 404，`{"detail": {"code": "user_not_found", "message": "用户不存在"}}`

## 管理员 UI

- **地址**：`http://127.0.0.1:8000/admin/app`（与 auth-api 同机时）。当前代码未内建来源 IP 白名单，如需进一步收口访问面，请在反向代理或网络边界层限制来源。
- **操作流程**：
  1. 打开 `/admin/app`，输入管理员账号密码，登录。
  2. 用户列表展示：账号、状态、创建时间、试用截止（不展示 password 哈希）。
  3. 每行操作：
     - **重置密码**：弹窗输入新密码（≥8 位），确认后提交。
     - **生成临时密码**：后端生成 12 位临时密码，弹窗仅显示一次，提供复制按钮。
     - **禁用/启用**：二次确认后切换 `users.status`（disabled/active）。

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 管理员登录账号密码 | 见 config |
| `ADMIN_JWT_SECRET` | 管理员 JWT 使用的独立密钥；为空时回退复用 `JWT_SECRET` | 空 |

## 改动文件一览

- **auth-api**：`deps.py`（管理员 JWT 鉴权）、`routers/admin.py`（`POST /admin/users/{username}/reset-password`、`POST /admin/users/{username}/disable`、`POST /admin/users/{username}/enable`、`GET /admin/app`）、`schemas_admin.py`（管理员请求/响应模型）、`static/admin_ui.html`（管理员 UI 单页）
- **桌面端**：`src/components/auth/AuthDialog.tsx`（忘记密码入口 + 弹窗展示微信二维码与说明）
- **文档**：`auth-api/docs/ADMIN_RESET_PASSWORD.md`（本文件）、可选更新 `README` 或部署说明
