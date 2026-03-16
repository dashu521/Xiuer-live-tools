# 发布阻断修复方案与回滚计划

- 日期：2026-03-16
- 目标版本：`v1.3.2`
- 原则：仅修复发布阻断或高风险问题；避免改变既有业务语义；每项修复都要有可回滚路径与验证闭环。

## 一、修复范围

### A. 代码/配置类阻断

1. `auth-api/test_subscription_system.py`
   - 问题：硬编码旧仓库绝对路径，导致 `pytest` 在当前仓库直接失败。
   - 修复：改为相对路径，并在每个测试前重建干净数据库。

2. `auth-api/main.py`
   - 问题：`CORS_ORIGINS="*"` 与 `allow_credentials=True` 组合存在高风险。
   - 修复：保留 wildcard 兼容性，但在 wildcard 场景下自动禁用 credentials。

3. `electron/main/ipc/app.ts`
   - 问题：`mailto:` 被 `openExternal` 协议白名单拒绝。
   - 修复：允许 `mailto:`，不扩大到其他协议。

4. `scripts/release-guard.js`
   - 问题：把合法镜像 remote 一律判定为 blocker。
   - 修复：允许 `origin` 与 `backup` 并存，未知 remote 仍保持 blocker。

5. 发布文档
   - 问题：版本号、脚本名、发布示例与当前代码不一致。
   - 修复：同步关键文档到 `1.3.2`，对齐真实脚本。

### B. 不在本轮放宽的检查

1. Git 工作区必须干净
   - 原因：这是发布安全阈值，不应为“让检查通过”而降级。

2. `VITE_AUTH_API_BASE_URL` 必须显式设置
   - 原因：渲染进程构建仍依赖该变量，直接放宽会引入环境不确定性。

## 二、实施步骤

1. 先修复测试和后端安全配置。
2. 再修复主进程协议白名单与发布门禁脚本。
3. 最后同步关键发布文档与 release notes。
4. 完成后统一执行验证：
   - `npm test`
   - `npm run lint`
   - `npm run typecheck`
   - `npm run auth:check`
   - `pytest -q`
   - `VITE_AUTH_API_BASE_URL=... npm run build`
   - `VITE_AUTH_API_BASE_URL=... npm run dist:mac`
   - `VITE_AUTH_API_BASE_URL=... npm run release:guard`

## 三、回滚计划

### 回滚原则

- 每项改动只影响单一职责文件。
- 若验证出现回归，优先按文件维度回滚，而不是整体回退全部修复。

### 分项回滚

1. `auth-api/test_subscription_system.py`
   - 回滚条件：测试用例逻辑本身被改坏。
   - 回滚方式：恢复旧测试文件，再单独重写测试基座。

2. `auth-api/main.py`
   - 回滚条件：出现跨域异常，确认与 `allow_credentials` 调整有关。
   - 回滚方式：恢复原 CORS 配置，并在部署层改为显式白名单。

3. `electron/main/ipc/app.ts`
   - 回滚条件：外链打开行为出现非预期扩大。
   - 回滚方式：移除 `mailto:` 支持，仅保留 `http/https`。

4. `scripts/release-guard.js`
   - 回滚条件：镜像 remote 白名单导致误放行。
   - 回滚方式：恢复“仅 origin”策略，并补充分发仓库规范。

5. 文档文件
   - 回滚条件：仅当版本说明写错或与最终发布版本不一致。
   - 回滚方式：恢复到对应标签版本文档。

## 四、验证与对比指标

### 修复前基线

- 前端单元测试：`86/86` 通过
- `Biome`：失败，`12 error + 1 warning`
- 后端 `pytest`：`7 通过 / 6 失败`
- `release:guard`：4 个 blocker
- 生产构建：未设环境变量失败；设变量后通过
- `dist:mac`：可生成双架构 DMG

### 修复后目标

- 前端单元测试：保持全通过
- `Biome`：清零 error
- 后端 `pytest`：全部通过
- `release:guard`：代码/配置类 blocker 清零，仅保留真实流程状态类限制
- 构建与打包：继续通过，耗时不出现明显退化

