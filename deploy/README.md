# Auth API 部署（阿里云 ECS + 可选 RDS）

配套文档：

- 发布 SOP：[AUTH_API_RELEASE_SOP.md](./AUTH_API_RELEASE_SOP.md)
- 发布记录：[RELEASE_LOG.md](./RELEASE_LOG.md)
- CI 检查清单：[CI_CHECKLIST.md](./CI_CHECKLIST.md)

## 一、本地先跑通

### 1. 本地 MySQL（或 Docker MySQL）

```bash
# 创建数据库
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS auth_db;"
```

### 2. 启动 API（项目根目录）

```bash
cd auth-api
pip install -r requirements.txt
export DATABASE_URL="mysql+pymysql://root:你的密码@127.0.0.1:3306/auth_db"
export JWT_SECRET=your-secret
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 或用 Docker Compose（项目根目录）

```bash
cd deploy
docker-compose up -d
# API: http://127.0.0.1:8000
```

---

## 二、阿里云 ECS 部署步骤（可复制执行）

### 1. 购买 ECS

- 地域：按需选择（如华东1）
- 镜像：Alibaba Cloud Linux 3 或 Ubuntu 22.04
- 安全组：放行 22（SSH）、80、443、8000（API 或仅内网）

### 2. 登录 ECS 并安装 Docker

```bash
ssh root@你的ECS公网IP

# 安装 Docker（以 Aliyun Linux 3 为例）
yum install -y docker
systemctl start docker
systemctl enable docker
```

### 3. 上传代码并构建

在**本机**将 `auth-api` 和 `deploy` 上传到 ECS（或从 Git 拉取）：

```bash
# 在 ECS 上
cd /opt
git clone 你的仓库地址 oba-live-tool
cd oba-live-tool
```

### 4. 使用 Docker Compose 启动（含 MySQL）

```bash
cd /opt/oba-live-tool/deploy
# 若 ECS 无法直连 Docker Hub，请先把 AUTH_API_BASE_IMAGE 设为私有仓库镜像
# 或服务器本地预置标签，例如 auth-api-runtime-base:3.11-local
# export AUTH_API_BASE_IMAGE=registry.example.com/xiuer/auth-api-python-base:3.11-slim
# 生产请修改 docker-compose.yml 中的 JWT_SECRET、MYSQL_ROOT_PASSWORD
DOCKER_BUILDKIT=0 docker compose build --pull=false api
docker compose up -d api --no-build
docker compose up -d mysql
```

### 5. 仅启动 API + 连接阿里云 RDS

若使用阿里云 RDS MySQL：

1. 在 RDS 控制台创建数据库 `auth_db`，记下内网地址、端口、账号密码。
2. 修改 `docker-compose.yml`：删除 `mysql` 服务，API 的 `DATABASE_URL` 改为 RDS 内网地址。
3. 如使用私有基础镜像，先设置 `AUTH_API_BASE_IMAGE`。
4. 只启动 api 服务：

```bash
DOCKER_BUILDKIT=0 docker compose -f docker-compose.rds.yml build --pull=false api
docker compose -f docker-compose.rds.yml up -d api --no-build
```

### 6. Nginx 反代（可选，HTTPS）

```nginx
# /etc/nginx/conf.d/auth-api.conf
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

重载：`nginx -s reload`。HTTPS 可在阿里云申请免费证书并配置 `listen 443 ssl`。

---

## 三、验证命令（curl）

假设 API 地址：`http://127.0.0.1:8000`（本地）或 `https://your-domain.com`（生产）。

### 健康检查

```bash
curl -s http://127.0.0.1:8000/health
```

### 注册

```bash
curl -s -X POST http://127.0.0.1:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"identifier":"user@example.com","password":"123456"}'
```

### 登录

```bash
curl -s -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"user@example.com","password":"123456"}'
```

记下返回的 `access_token` 和 `refresh_token`。

### 获取当前用户（/me）

```bash
export ACCESS_TOKEN="上一步返回的 access_token"
curl -s http://127.0.0.1:8000/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 刷新 access_token

```bash
export REFRESH_TOKEN="登录返回的 refresh_token"
curl -s -X POST http://127.0.0.1:8000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}"
```

## 私有 Registry 基础镜像

如果 ECS 无法稳定访问 Docker Hub，建议把 `auth-api` 的基础镜像单独推到你的私有 registry，再让 API 构建时引用它。

### 1. 在可访问 registry 的机器上推送基础镜像

```bash
cd deploy
TARGET_IMAGE=registry.example.com/xiuer/auth-api-runtime-base:3.11-slim \
REGISTRY_USERNAME=your-user \
REGISTRY_PASSWORD=your-password \
./publish-auth-api-base.sh
```

默认推送的本地源镜像是 `auth-api-runtime-base:3.11-local`。如需改源镜像，可额外设置 `SOURCE_IMAGE=...`。

### 2. 在服务器上切换到私有基础镜像

```bash
cd deploy
scp use-auth-api-base-image.sh root@your-ecs-ip:/opt/auth-api/
ssh root@your-ecs-ip \
  "cd /opt/auth-api && TARGET_IMAGE=registry.example.com/xiuer/auth-api-runtime-base:3.11-slim ./use-auth-api-base-image.sh"
```

这会把服务器 `.env` 里的 `AUTH_API_BASE_IMAGE` 改成目标镜像，并执行：

```bash
DOCKER_BUILDKIT=0 docker compose build --pull=false api
docker compose up -d api --no-build
```

脚本还会执行两类保护：

- 前置校验：`TARGET_IMAGE` 必须是 ACR VPC 地址，且 `docker-compose.yml` 必须带 `BASE_IMAGE` build arg。
- 发布后 smoke test：默认检查 `/health`；如果设置了 `AUTH_API_TEST_IDENTIFIER` 和 `AUTH_API_TEST_PASSWORD`，还会继续检查 `/login` 与 `/subscription/status`。

## 推荐：直接发布完整业务镜像

这是比 ECS 现场构建更稳的方式。推荐把 `auth-api` 完整镜像推到 ACR，再让 ECS 只做 `pull + up`。

### 1. 推送完整业务镜像

```bash
BASE_IMAGE=crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api-runtime-base:3.11-slim \
TARGET_IMAGE=crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api:release-tag \
REGISTRY_USERNAME=17701259200 \
REGISTRY_PASSWORD=你的ACR密码 \
./deploy/publish-auth-api-app-image.sh
```

### 2. 服务器按业务镜像直接部署

```bash
cd /opt/auth-api
TARGET_IMAGE=crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api:release-tag \
./use-auth-api-app-image.sh
```

这个流程不会在 ECS 上执行业务镜像构建，只会：

- `docker pull`
- `docker compose up -d api --no-build`
- 运行 smoke test

### 3. 一条命令完成推送与部署

```bash
REGISTRY_USERNAME=17701259200 \
REGISTRY_PASSWORD=你的ACR密码 \
AUTH_API_TEST_IDENTIFIER=你的测试账号 \
AUTH_API_TEST_PASSWORD=你的测试密码 \
./deploy/release-auth-api.sh
```

如果只想检查发布路径是否正确、不触发真实动作：

```bash
DRY_RUN=1 \
REGISTRY_USERNAME=17701259200 \
REGISTRY_PASSWORD=你的ACR密码 \
./deploy/release-auth-api.sh
```

可选项：

- `APP_IMAGE_TAG=release-20260321`
- `PUBLISH_BASE_IMAGE=1`
- `SERVER_HOST=你的ECS地址`

---

## CORS 说明

- 当前默认 `CORS_ORIGINS=*`，便于本地和 Electron 测通。
- 生产建议收紧：设置 `CORS_ORIGINS=https://your-app-domain.com` 或 Electron 打包后的自定义协议（如 `app://`），按需多值用逗号分隔。

---

## 四、Electron 客户端接云鉴权

本地或打包后的 Electron 需指定 Auth API 地址，主进程才会走云鉴权（否则仍走 Mock/本地 SQLite）。

**开发时：**

```bash
# Windows PowerShell
$env:AUTH_API_BASE_URL="http://127.0.0.1:8000"; npm run dev

# Linux/macOS
AUTH_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

**打包后：** 在应用内通过设置写入，或构建时通过 `env.VITE_AUTH_API_BASE_URL` 注入（若主进程能读到该变量）。当前主进程读取 `AUTH_API_BASE_URL` 或 `VITE_AUTH_API_BASE_URL`。
