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

## 2026-03-21 18:10 CST

- 发布人：Codex + 用户协作
- 环境：production
- git commit：`5a0fe05`
- 业务镜像：`crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api:5a0fe05`
- 基础镜像：`crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api-runtime-base:3.11-slim`
- 发布方式：`release-auth-api.sh`
- 服务器：`121.41.179.197:/opt/auth-api`
- 回归结果：脚本健康检查 `health ok`；用户手工验证登录正常、订阅正常
- 风险/异常：发布脚本未提供测试账号，因此自动 smoke 仅执行了 `/health`；发布后已手工补验证
- 回滚点：上一稳定业务镜像 tag `ecb45a7`

## 2026-03-21 18:06 CST

- 发布人：Codex + 用户协作
- 环境：production
- git commit：N/A（服务器数据库维护）
- 业务镜像：不变
- 基础镜像：不变
- 发布方式：MySQL 手工清理
- 服务器：`121.41.179.197:/opt/auth-api`
- 回归结果：删除 `3` 个测试账号；清空关联 `refresh_tokens / subscriptions / user_configs / gift_card_redemptions / trials`；释放 `6` 张礼品卡
- 风险/异常：保留 `audit_logs` 以维持审计链
- 回滚点：`/opt/auth-api-backups/test-account-cleanup_20260321_180644`

## 2026-03-22 22:51 CST

- 发布人：Codex + 用户协作
- 环境：production
- git commit：`df1ffdc`（基于本地未提交的 `auth-api` 热修复工作树）
- 业务镜像：未切换新业务镜像；线上容器已改为基于服务器本地源码重建的 `auth-api-api:latest`
- 基础镜像：沿用服务器当前 `AUTH_API_BASE_IMAGE`
- 发布方式：最小化源文件同步（`routers/admin.py`、`routers/gift_card.py`）+ `docker compose build --pull=false api && docker compose up -d api --no-build`
- 服务器：`121.41.179.197:/opt/auth-api`
- 回归结果：`/health` 返回 `{"ok":true}`；`/admin/login` 成功；`/admin/users?page=1&size=2` 与 `page=2&size=2` 均返回 `200` 且 `total=7`；线上只读检查显示 `active` 礼品卡 `10` 张，其中非法配置（`membership_days <= 0`）为 `0`
- 风险/异常：`.env` 与 `.auth-api.app-image.override.yml` 仍保留旧业务镜像 `74d9e6f` 记录，但本次发布实际运行的是服务器本地重建镜像；后续若再次执行 `use-auth-api-app-image.sh`，会覆盖回旧镜像发布路径
- 回滚点：远端源码备份 `routers/admin.py.bak.20260322_225123`、`routers/gift_card.py.bak.20260322_225123`；旧业务镜像记录 `crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api:74d9e6f`

## 2026-03-22 23:09 CST

- 发布人：Codex + 用户协作
- 环境：production
- git commit：`df1ffdc`（基于本地未提交的 `auth-api` 热修复工作树）
- 业务镜像：`crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api:df1ffdc-hotfix-20260322-230949`
- 基础镜像：`crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api-runtime-base:3.11-slim`
- 发布方式：服务器远端构建并推送业务镜像 `publish-auth-api-app-image.sh` + 标准镜像部署 `use-auth-api-app-image.sh`
- 服务器：`121.41.179.197:/opt/auth-api`
- 回归结果：容器状态 `healthy`；`/health` 返回 `{"ok":true}`；`/admin/login` 成功；`/admin/users?page=1&size=2` 返回 `200`，`total=7`，`items=2`
- 风险/异常：业务镜像 tag 由当前热修工作树生成，尚未对应仓库内正式提交；已完成服务器 `.env` 与 `.auth-api.app-image.override.yml` 的镜像版本收口
- 回滚点：上一个业务镜像 `crpi-ee6rz2ks9c36lft8-vpc.cn-hangzhou.personal.cr.aliyuncs.com/xiuer-live-tools/auth-api:74d9e6f`；远端源码备份 `routers/admin.py.bak.20260322_225123`、`routers/gift_card.py.bak.20260322_225123`
