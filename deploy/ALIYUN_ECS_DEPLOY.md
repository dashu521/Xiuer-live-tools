# 阿里云 ECS 无域名上线 Auth API（最小步骤，可复制执行）

目标：用 ECS 公网 IP + 端口 8000 访问 Auth API，无域名。  
项目内已有 `auth-api/`（FastAPI）与 `deploy/docker-compose.yml`。

---

## 1) 阿里云控制台需要做的事

### 1.1 购买 / 使用 ECS

- **地域**：按需选择（如华东1 杭州）
- **规格**：最低 1 核 2GiB 即可（如 ecs.t6-c1m2.large 或同档）
- **镜像**：**Alibaba Cloud Linux 3** 或 **Ubuntu 22.04**
- **系统盘**：40GiB 默认即可
- **网络**：按默认 VPC，分配公网 IP（按量或固定）

### 1.2 安全组放行端口

在 ECS 实例所在安全组中添加入方向规则：

| 端口 | 协议 | 授权对象 | 说明 |
|------|------|----------|------|
| 22   | TCP  | 0.0.0.0/0 或你的办公 IP | SSH |
| 8000 | TCP  | 0.0.0.0/0 或你的办公 IP | Auth API |

**不要放行 3306**。MySQL 只在 ECS 本机或容器内使用，不对外暴露。

---

## 2) ECS 上从 0 到跑起来的命令（按顺序复制执行）

以下在 **ECS 上** 以 root 或带 sudo 的用户执行。`<你的ECS公网IP>` 替换为实际 IP。

### 2.1 SSH 登录

```bash
ssh root@<你的ECS公网IP>
```

### 2.2 安装 Docker

**Alibaba Cloud Linux 3 / CentOS 系：**

```bash
yum install -y docker
systemctl start docker
systemctl enable docker
```

**Ubuntu 22.04：**

```bash
apt-get update && apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a644 /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl start docker
systemctl enable docker
```

### 2.3 确认 Docker Compose 可用

```bash
docker compose version
```

### 2.4 拉取代码（二选一）

**方式 A：Git 克隆（推荐）**

```bash
cd /opt
git clone <你的仓库地址> oba-live-tool
cd oba-live-tool
```

**方式 B：本地上传后解压**

在本地打包后上传到 ECS（如 `/opt/oba-live-tool.tar.gz`），然后在 ECS 上：

```bash
mkdir -p /opt/oba-live-tool
cd /opt
tar -xzf oba-live-tool.tar.gz -C oba-live-tool --strip-components=1
cd oba-live-tool
```

### 2.5 进入 deploy 目录

```bash
cd /opt/oba-live-tool/deploy
```

### 2.6 配置 .env（生产务必改 JWT_SECRET）

**方案 A：使用 compose 内置 MySQL（最省事）**

```bash
cat > .env << 'EOF'
JWT_SECRET=请替换为下面生成的随机串
CORS_ORIGINS=*
EOF
```

**生成 JWT_SECRET（任选一种）：**

```bash
openssl rand -base64 32
```

把上面命令输出替换进 `.env` 里的 `JWT_SECRET=`。

**方案 B：使用阿里云 RDS MySQL**

先到阿里云 RDS 控制台创建 MySQL 实例、创建数据库 `auth_db`、记下内网地址与账号密码，然后：

```bash
# 将 <RDS内网地址>、<端口>、<用户名>、<密码> 替换为实际值
cat > .env << 'EOF'
DATABASE_URL=mysql+pymysql://<用户名>:<密码>@<RDS内网地址>:<端口>/auth_db
JWT_SECRET=请替换为 openssl rand -base64 32 的输出
CORS_ORIGINS=*
EOF
```

RDS 安全建议：仅允许 ECS 所在 VPC 访问 RDS（RDS 白名单中加入 ECS 内网 IP 或 VPC 网段），不要对 0.0.0.0/0 放行。

### 2.7 启动服务

**方案 A：compose 内置 MySQL（不暴露 3306 到公网）**

```bash
cd /opt/oba-live-tool/deploy
docker compose -f docker-compose.yml -f docker-compose.ecs.yml up -d --build
```

**方案 B：使用 RDS，只起 API**

```bash
cd /opt/oba-live-tool/deploy
docker compose -f docker-compose.rds.yml up -d --build
```

### 2.8 确认端口监听

```bash
ss -tlnp | grep 8000
```

或：

```bash
docker compose -f docker-compose.yml -f docker-compose.ecs.yml ps
```

（方案 B 把 `-f docker-compose.ecs.yml` 换成 `-f docker-compose.rds.yml`）

---

## 3) 两种数据库方案小结

| 方案 | 适用 | 命令 | 说明 |
|------|------|------|------|
| **A. 内置 MySQL** | 最省事、单机 | `docker compose -f docker-compose.yml -f docker-compose.ecs.yml up -d` | MySQL 不映射到主机端口，仅容器内网访问 |
| **B. 阿里云 RDS** | 多机/高可用 | 配置 `.env` 的 `DATABASE_URL` 后执行 `docker compose -f docker-compose.rds.yml up -d` | RDS 白名单只放 ECS 所在 VPC，不要对公网开放 3306 |

**不要暴露 MySQL 3306 到公网**：安全组不添加 3306；使用方案 A 时已用 `docker-compose.ecs.yml` 去掉 MySQL 的 `ports`，3306 仅在容器网络内可用。

---

## 4) 健康检查与验证

以下 `<ECS公网IP>` 替换为你的 ECS 公网 IP，例如 `47.96.xxx.xxx`。

### 4.1 健康检查

```bash
curl -s http://<ECS公网IP>:8000/health
```

预期：`{"status":"ok"}`

### 4.2 注册

```bash
curl -s -X POST http://<ECS公网IP>:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com","password":"123456"}'
```

预期：返回 `user`、`access_token`、`refresh_token`。

### 4.3 登录

```bash
curl -s -X POST http://<ECS公网IP>:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com","password":"123456"}'
```

记下返回的 `access_token` 和 `refresh_token`。

### 4.4 获取当前用户（/me）

```bash
# 将 YOUR_ACCESS_TOKEN 替换为上面登录返回的 access_token
export ACCESS_TOKEN="YOUR_ACCESS_TOKEN"
curl -s http://<ECS公网IP>:8000/me -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 4.5 刷新 access_token

```bash
# 将 YOUR_REFRESH_TOKEN 替换为登录返回的 refresh_token
export REFRESH_TOKEN="YOUR_REFRESH_TOKEN"
curl -s -X POST http://<ECS公网IP>:8000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}"
```

### 4.6 看容器日志

```bash
cd /opt/oba-live-tool/deploy
docker compose -f docker-compose.yml -f docker-compose.ecs.yml logs -f api
```

（方案 B：`docker compose -f docker-compose.rds.yml logs -f api`）  
按 `Ctrl+C` 退出。

### 4.7 重启服务

```bash
cd /opt/oba-live-tool/deploy
docker compose -f docker-compose.yml -f docker-compose.ecs.yml restart
```

（方案 B：`docker compose -f docker-compose.rds.yml restart`）

### 4.8 确认 8000 端口在监听

```bash
ss -tlnp | grep 8000
```

或：

```bash
docker compose -f docker-compose.yml -f docker-compose.ecs.yml ps
```

---

## 5) 生产最小加固（不阻塞先跑通）

### 5.1 JWT_SECRET 如何生成

在 ECS 或本机执行一次，把输出写入 `.env` 的 `JWT_SECRET`：

```bash
openssl rand -base64 32
```

生产环境必须使用随机、足够长的密钥，不要使用默认 `change-me-in-production`。

### 5.2 CORS 从 * 收紧到指定来源

先保持 `CORS_ORIGINS=*` 可正常跑通。  
收紧时在 `.env` 中设置，例如只允许 Electron 桌面端或你的前端域名：

```bash
# 示例：只允许某域名（多个用英文逗号分隔，不要空格）
CORS_ORIGINS=https://your-app.example.com,http://localhost:5173
```

改完后重启 API 容器：

```bash
cd /opt/oba-live-tool/deploy
docker compose -f docker-compose.yml -f docker-compose.ecs.yml up -d --force-recreate api
```

### 5.3 不要暴露 MySQL 3306 到公网

- **安全组**：不要添加 3306 入方向规则。
- **方案 A（compose 内置 MySQL）**：已使用 `docker-compose.ecs.yml` 去掉 MySQL 的 `ports`，3306 仅容器内网可访问。
- **方案 B（RDS）**：RDS 白名单只放 ECS 所在 VPC/内网 IP，不对 0.0.0.0/0 开放。

---

## 一键脚本（可选）

将下面整段保存为 ECS 上的 `deploy.sh`，按需修改 `JWT_SECRET`、`REPO_URL` 后执行 `bash deploy.sh`（方案 A 内置 MySQL）：

```bash
#!/bin/bash
set -e
REPO_URL="https://github.com/你的用户名/你的仓库.git"
JWT_SECRET=$(openssl rand -base64 32)

yum install -y docker git 2>/dev/null || apt-get update && apt-get install -y docker.io git
systemctl start docker
systemctl enable docker

cd /opt
git clone "$REPO_URL" oba-live-tool
cd oba-live-tool/deploy

echo "JWT_SECRET=$JWT_SECRET" > .env
echo "CORS_ORIGINS=*" >> .env

docker compose -f docker-compose.yml -f docker-compose.ecs.yml up -d --build
echo "done. check: curl -s http://$(curl -s ifconfig.me):8000/health"
```

（若使用 Ubuntu 且需 Docker Compose V2，请先按上文 2.2 安装 `docker-compose-plugin` 后再执行。）
