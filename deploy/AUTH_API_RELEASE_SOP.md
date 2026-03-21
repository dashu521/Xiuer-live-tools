# Auth API Release SOP

更新时间：2026-03-21 14:38:43 CST

## 目标

将 `auth-api` 发布到阿里云 ECS，并固定使用阿里云 ACR 私有基础镜像，避免构建过程依赖 Docker Hub。

配套文件：

- 发布留痕：[RELEASE_LOG.md](./RELEASE_LOG.md)
- CI 检查清单：[CI_CHECKLIST.md](./CI_CHECKLIST.md)

当前线上基础镜像地址：

```text
crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api-runtime-base:3.11-slim
```

当前线上服务目录：

```text
/opt/auth-api
```

## 一、发布前检查

本地执行：

```bash
npm run auth:check
```

确认以下文件已在仓库中：

- `auth-api/Dockerfile`
- `deploy/docker-compose.yml`
- `deploy/docker-compose.rds.yml`
- `deploy/use-auth-api-base-image.sh`
- `deploy/publish-auth-api-base.sh`

## 二、基础镜像未变化时

如果你还没有推送完整业务镜像，才使用这一条。只需要同步业务代码后，在 ECS 上重建 `api`：

```bash
cd /opt/auth-api
TARGET_IMAGE=crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api-runtime-base:3.11-slim \
./use-auth-api-base-image.sh
```

该脚本会执行：

```bash
DOCKER_BUILDKIT=0 docker compose build --pull=false api
docker compose up -d api --no-build
```

并强制执行：

- `TARGET_IMAGE` 必须是 ACR VPC 地址
- `docker pull $TARGET_IMAGE`
- 发布后 smoke test

## 二点五、推荐路径：完整业务镜像发布

推荐以后优先使用这一条，而不是 ECS 现场 build。

### 1. 推送完整业务镜像

```bash
BASE_IMAGE=crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api-runtime-base:3.11-slim \
TARGET_IMAGE=crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api:release-tag \
REGISTRY_USERNAME=17701259200 \
REGISTRY_PASSWORD=你的 ACR 密码 \
./deploy/publish-auth-api-app-image.sh
```

### 2. 服务器直接拉取业务镜像

```bash
cd /opt/auth-api
TARGET_IMAGE=crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api:release-tag \
./use-auth-api-app-image.sh
```

这条链路的优先级应高于“基础镜像未变化时”的现场构建方案。

### 3. 一条命令发布

如果要把“推送业务镜像 + 服务器部署”收口成一个动作，执行：

```bash
REGISTRY_USERNAME=17701259200 \
REGISTRY_PASSWORD=你的 ACR 密码 \
AUTH_API_TEST_IDENTIFIER=你的测试账号 \
AUTH_API_TEST_PASSWORD=你的测试密码 \
./deploy/release-auth-api.sh
```

默认行为：

- 业务镜像 tag 使用当前 git 短哈希
- 推送 `auth-api` 业务镜像到 ACR VPC 仓库
- 通过 `remote-deploy.sh` 在 ECS 上直接拉取该镜像
- 自动跑 smoke test

## 三、基础镜像变化时

只有在 `auth-api/Dockerfile` 的基础层变化时才需要执行这一步。

### 1. 推送基础镜像到 ACR

在能访问 ACR 的机器上执行：

```bash
TARGET_IMAGE=crpi-ee6rz2ks9c36lft8.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api-runtime-base:3.11-slim \
REGISTRY_USERNAME=17701259200 \
REGISTRY_PASSWORD=你的 ACR 密码 \
./deploy/publish-auth-api-base.sh
```

### 2. 服务器切换到 VPC 镜像地址并重建

```bash
cd /opt/auth-api
TARGET_IMAGE=crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api-runtime-base:3.11-slim \
./use-auth-api-base-image.sh
```

## 四、发布后回归

### 1. 健康检查

```bash
curl -s http://127.0.0.1:8000/health
```

期望：

```json
{"ok":true}
```

如果服务器上已设置：

- `AUTH_API_TEST_IDENTIFIER`
- `AUTH_API_TEST_PASSWORD`

则可直接复用：

```bash
cd /opt/auth-api
./run-auth-api-smoke.sh
```

### 2. 登录契约检查

```bash
curl -s -X POST http://127.0.0.1:8000/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"你的账号","password":"你的密码"}'
```

期望返回中同时包含：

- `access_token`
- `token`
- `refresh_token`

且 `access_token == token`

### 3. 订阅状态检查

```bash
curl -s "http://127.0.0.1:8000/subscription/status?username=你的账号" \
  -H "Authorization: Bearer 你的access_token"
```

### 4. 短信错误契约抽查

```bash
curl -s -X POST "http://127.0.0.1:8000/auth/sms/send?phone=123"
```

期望 `detail.code = "phone_format_error"`

### 5. 发布记录

发布完成后，必须把本次信息补记到：

- [RELEASE_LOG.md](./RELEASE_LOG.md)

至少写清：

- git commit
- 业务镜像
- 基础镜像
- 回归结果
- 回滚点

## 五、线上配置基线

服务器 `.env` 里应保留：

```text
AUTH_API_BASE_IMAGE=crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api-runtime-base:3.11-slim
```

## 六、回滚

已在服务器备份当前配置：

```text
/opt/auth-api-backups/20260321_143844
```

需要回滚时，至少恢复这些文件：

- `.env`
- `docker-compose.yml`
- `Dockerfile`

恢复后重新执行：

```bash
cd /opt/auth-api
docker compose build --pull=false api
docker compose up -d api --no-build
```

## 七、安全动作

本轮结束后应立即执行：

1. 轮转 RAM `AccessKey`
2. 修改 ACR 登录密码
3. 把新凭据只保存在密码管理器中，不再通过聊天工具传递
