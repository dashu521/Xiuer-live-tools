# Auth API Release Log

用途：

- 记录每次 `auth-api` 生产发布的关键事实
- 固定回滚所需信息
- 让“发布是否按规范执行”有可追溯记录

使用方式：

1. 每次发布完成后，新增一条记录
2. 不要只写“已发布”，必须写清镜像、提交、结果
3. 如有异常或回滚，单独补一条，不要覆盖原记录

## 模板

```md
## YYYY-MM-DD HH:mm CST

- 发布人：
- 环境：production
- git commit：
- 业务镜像：
- 基础镜像：
- 发布方式：
- 服务器：
- 回归结果：
- 风险/异常：
- 回滚点：
```

字段说明：

- `git commit`：本次发布对应提交哈希
- `业务镜像`：`AUTH_API_APP_IMAGE`
- `基础镜像`：`AUTH_API_BASE_IMAGE`
- `发布方式`：例如 `release-auth-api.sh` / `use-auth-api-app-image.sh`
- `回归结果`：至少记录 `health`、`login contract`、`subscription status`
- `回滚点`：可回滚到的旧镜像 tag 或配置备份目录

## 已记录发布

## 2026-03-21 14:38 CST

- 发布人：Codex + 用户协作
- 环境：production
- git commit：`ecb45a7`
- 业务镜像：未切换到业务镜像直拉
- 基础镜像：`crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api-runtime-base:3.11-slim`
- 发布方式：`use-auth-api-base-image.sh`
- 服务器：`121.41.179.197:/opt/auth-api`
- 回归结果：`/health`、`/login`、`/subscription/status` 通过
- 风险/异常：历史线上镜像缺少 `PyJWT`，已在本轮修复并切换到 ACR 基础镜像
- 回滚点：`/opt/auth-api-backups/20260321_143844`

## 2026-03-21 15:00 CST

- 发布人：Codex + 用户协作
- 环境：production
- git commit：`058d852`
- 业务镜像：`crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api:ecb45a7`
- 基础镜像：`crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api-runtime-base:3.11-slim`
- 发布方式：`release-auth-api.sh` / `use-auth-api-app-image.sh`
- 服务器：`121.41.179.197:/opt/auth-api`
- 回归结果：`health ok`、`login contract ok`、`subscription status ok`
- 风险/异常：本地 Docker daemon 不可用，已通过远端构建回退路径完成发布
- 回滚点：上一可用配置 + 旧镜像 tag
