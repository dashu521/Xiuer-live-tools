# 管理后台生产环境运维说明

> 本文档记录管理后台生产环境的部署配置和运维要点
> 最后更新：2026-03-17

---

## 1. 生产环境基本信息

### 1.1 唯一生产后台入口
```
https://<your-admin-domain>/admin/app
```

> 说明：公网访问必须经 HTTPS 反向代理入口，禁止把 `http://121.41.179.197:8000/admin/app` 作为正式生产后台地址对外使用。

### 1.2 唯一生产目录
```
/opt/auth-api
```

### 1.3 唯一生效配置文件
```
/opt/auth-api/.env
```

### 1.4 管理员登录凭据
- **用户名**：`admin`
- **密码来源**：`.env` 文件中的 `ADMIN_PASSWORD` 变量
- **密码查看方式**：`grep ADMIN_PASSWORD /opt/auth-api/.env`

---

## 2. 配置文件说明

### 2.1 .env 文件位置
```bash
/opt/auth-api/.env
```

### 2.2 关键配置项
```bash
# 数据库连接
DATABASE_URL=mysql+pymysql://root:password@mysql:3306/auth_db

# JWT 密钥（生产环境必须修改为随机强密钥）
JWT_SECRET=xiuer-live-tools-jwt-secret-key-2024

# CORS 配置（生产环境应限制为具体域名）
CORS_ORIGINS=*

# 管理员账号（从 .env 文件读取，请勿硬编码）
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
```

### 2.3 配置备份
修改前必须备份：
```bash
cp /opt/auth-api/.env /opt/auth-api/.env.bak.$(date +%Y%m%d_%H%M%S)
```

---

## 3. 容器管理

### 3.1 当前运行容器
```bash
# 查看容器状态
cd /opt/auth-api && docker compose ps

# 预期输出：
# NAME               IMAGE          STATUS                 PORTS
# auth-api-api-1     auth-api-api   Up ...                 0.0.0.0:8000->8000/tcp
# auth-api-mysql-1   mysql:8.0      Up ... (healthy)       0.0.0.0:3306->3306/tcp
```

### 3.2 重启服务
```bash
cd /opt/auth-api && docker compose restart api
```

### 3.3 查看日志
```bash
# API 日志
cd /opt/auth-api && docker compose logs api --tail=100

# MySQL 日志
cd /opt/auth-api && docker compose logs mysql --tail=100
```

### 3.4 消息中心实时通道（SSE）

消息中心使用：

```text
GET /messages/stream
```

生产环境应统一走 HTTPS 反向代理；若接入 Nginx / 其他反向代理，必须确保 `/messages/stream` 关闭代理缓冲：

```nginx
location /messages/stream {
    proxy_pass http://127.0.0.1:8000/messages/stream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    add_header X-Accel-Buffering no;
}
```

### 3.5 实时通道验证

```bash
curl -N https://<your-admin-domain>/messages/stream \
  -H "Accept: text/event-stream" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

预期：

1. 首次连接立即返回 `event: snapshot`
2. 空闲时持续返回 `: heartbeat`
3. 管理后台发布、撤回、编辑消息后，连接会马上收到新的 `snapshot`

---

## 4. 历史变更记录

### 4.1 2026-03-17 密码恢复
- **操作**：将管理员密码从默认 `admin123` 恢复为用户历史密码
- **原因**：`admin123` 是 2026-03-17 新系统部署时的默认值
- **证据**：在 Docker overlay2 历史层中找到历史密码配置
- **备份文件**：`/opt/auth-api/.env.bak.20260317_221923`

### 4.2 系统迁移历史
- **旧系统**：`admin-users.service`（端口 9001，systemd 服务）
- **新系统**：`auth-api-api-1` 容器（端口 8000，Docker Compose）
- **迁移时间**：2026-03-07 旧系统停止，2026-03-17 新系统部署

---

## 5. 故障排查

### 5.1 无法登录管理后台
1. 检查容器状态：`docker compose ps`
2. 检查 .env 配置：`cat /opt/auth-api/.env | grep ADMIN`
3. 检查容器环境变量：`docker inspect auth-api-api-1 --format '{{json .Config.Env}}'`
4. 查看 API 日志：`docker compose logs api --tail=50`

### 5.2 修改密码后未生效
必须重新创建容器才能读取新 .env：
```bash
cd /opt/auth-api && docker compose up -d --force-recreate api
```

### 5.3 消息中心不实时
1. 查看日志：`docker compose logs api --tail=100 | grep messages`
2. 用 `curl -N` 直接连接 HTTPS 入口 `https://<your-admin-domain>/messages/stream`
3. 如果经过 Nginx，确认 `/messages/stream` 已配置 `proxy_buffering off`
4. 确认客户端当前版本已包含消息中心实时通道改动

---

## 6. 安全注意事项

1. **禁止提交 .env 到 Git**：`.env` 文件包含敏感信息，已加入 `.gitignore`
2. **定期备份数据库**：`docker exec auth-api-mysql-1 mysqldump -uroot -ppassword auth_db > backup.sql`
3. **限制 CORS 来源**：生产环境应将 `CORS_ORIGINS=*` 改为具体域名
4. **修改 JWT_SECRET**：生产环境应使用随机生成的强密钥

---

## 7. 相关文档

- [PRE_DEPLOY_CHECKLIST.md](./PRE_DEPLOY_CHECKLIST.md) - 部署前检查清单
- [ADMIN_RESET_PASSWORD.md](./ADMIN_RESET_PASSWORD.md) - 管理员密码重置说明
- [ADMIN_API_DELIVERY.md](./ADMIN_API_DELIVERY.md) - 管理后台 API 交付文档
