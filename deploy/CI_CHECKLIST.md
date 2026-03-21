# Auth API CI Checklist

用途：

- 固定 `auth-api` 相关改动在合并前必须经过的检查
- 避免以后发版仍依赖人工记忆
- 为后续 CI 工作流补强提供统一参考

## 一、必须阻断的检查

以下任一项失败，都不应合并到主分支：

- `npm run auth:check`
- `npx biome check --no-errors-on-unmatched --files-ignore-unknown=true .`
- `npx tsc --noEmit`
- `bash -n deploy/*.sh`
- `python -m py_compile` 覆盖 `auth-api` 入口、规则文件、`routers/`
- FastAPI import check：`python -c "from main import app"`

说明：

- `npm run auth:check` 已覆盖：
  - `auth:syntax`
  - `auth:smoke`
  - `auth:test`
- 这项应始终保留为 `auth-api` 的最小后端门禁

## 二、发布链路专项检查

涉及以下文件时，应额外检查发布链路：

- `auth-api/Dockerfile`
- `deploy/docker-compose.yml`
- `deploy/docker-compose.rds.yml`
- `deploy/publish-auth-api-base.sh`
- `deploy/publish-auth-api-app-image.sh`
- `deploy/use-auth-api-base-image.sh`
- `deploy/use-auth-api-app-image.sh`
- `deploy/release-auth-api.sh`
- `deploy/run-auth-api-smoke.sh`

必须确认：

- `BASE_IMAGE` build arg 仍存在
- 默认镜像地址仍指向 ACR
- ECS 部署脚本仍优先使用 `AUTH_API_APP_IMAGE`
- smoke test 仍覆盖：
  - `/health`
  - `/login`
  - `/subscription/status`

## 三、建议加入 CI 的工作流项

当前仓库已有：

- [quality-gate.yml](../.github/workflows/quality-gate.yml)

建议后续在 CI 中明确加入或收敛到以下步骤：

1. Node 侧：
   - `npm ci`
   - `npx biome check --no-errors-on-unmatched --files-ignore-unknown=true .`
   - `npx tsc --noEmit`

2. Auth API 侧：
   - `npm run auth:check`
   - `python -m py_compile ...`
   - `python -c "from main import app"`

3. Shell 脚本侧：
   - `bash -n deploy/*.sh`

4. 可选增强：
   - 构建一次 `auth-api` 业务镜像但不 push
   - 验证 `deploy/release-auth-api.sh` 在 dry-run 或最小环境下可执行

## 四、人工发布前检查

正式发版前，至少确认：

- 本次改动对应的 git commit 已知
- ACR 凭据有效
- 目标镜像 tag 已确定
- ECS 目标机器可 SSH
- 服务器 `.env` 中关键变量未丢失：
  - `AUTH_API_BASE_IMAGE`
  - `AUTH_API_APP_IMAGE`（如走业务镜像直拉）
  - `AUTH_API_TEST_IDENTIFIER`
  - `AUTH_API_TEST_PASSWORD`

## 五、人工发布后检查

发布后必须记录到 [RELEASE_LOG.md](./RELEASE_LOG.md)，并确认：

- `docker ps` 中 `auth-api-api-1` 为 `healthy`
- `/health` 通过
- `/login` 契约通过
- `/subscription/status` 通过
- 如本次涉及短信链路，补抽查短信错误契约

## 六、建议的后续自动化方向

优先级从高到低：

1. 把 `bash -n deploy/*.sh` 放进现有 `quality-gate.yml`
2. 把 `npm run auth:check` 明确纳入单独 job 或作为 Python job 的核心步骤
3. 增加一个不 push 的 `auth-api` 镜像构建检查
4. 条件允许时再增加预发布环境 smoke test
