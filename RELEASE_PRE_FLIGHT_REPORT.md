# 正式版发行前报告（Pre-Release Report）

**生成时间**：发行前检查  
**当前分支**：`dev-after-electron-fix`  
**最新已提交**：`5f013d7 feat: auth and trial API integration, GET /auth/status with trial from DB, frontend trial flow, archive doc`

---

## 一、当前仓库状态

### 1.1 未提交变更（需在发行前提交）

| 类型 | 文件 |
|------|------|
| 已修改 | `auth-api/config.py` |
| 已修改 | `auth-api/database.py` |
| 已修改 | `auth-api/deps.py` |
| 已修改 | `auth-api/main.py` |
| 已修改 | `auth-api/routers/auth.py` |
| 已修改 | `auth-api/routers/me.py` |
| 已修改 | `auth-api/schemas.py` |
| 已修改 | `src/components/auth/LoginPage.tsx` |
| 已修改 | `src/components/auth/SubscribeDialog.tsx` |
| 已修改 | `src/config/authApiBase.ts` |
| 已修改 | `src/stores/authStore.ts` |
| 已修改 | `src/stores/trialStore.ts` |
| 新增 | `auth-api/docs/ADMIN_API_DELIVERY.md` |
| 新增 | `auth-api/docs/SUBSCRIPTION_STATUS_CURL.md` |
| 新增 | `auth-api/docs/SUBSCRIPTION_STATUS_DEPLOY.md` |
| 新增 | `auth-api/docs/TASK1_AUTH_FINDINGS.md` |
| 新增 | `auth-api/export_openapi.py` |
| 新增 | `auth-api/openapi.json` |
| 新增 | `auth-api/routers/admin.py` |
| 新增 | `auth-api/routers/subscription.py` |
| 新增 | `auth-api/schemas_admin.py` |
| 新增 | `auth-api/scripts/` |
| 新增 | `deploy/appsmith/` |
| 新增 | `deploy/datasette/` |

**说明**：上述变更包含「auth-api 无 /auth 前缀、/login 返回 .token、GET /subscription/status、管理员 /admin/* 接口」「前端鉴权基准与订阅状态」「Appsmith/Datasette 部署脚本」等，发行前需**全部提交**后再打 tag / 构建。  
**注意**：`auth-api/__pycache__/`、`auth-api/routers/__pycache__/`、`auth-api/test_align.db`、`auth-api/test_sub.db` 为忽略或临时文件，勿提交。

---

## 二、版本与构建配置

| 项目 | 当前值 | 说明 |
|------|--------|------|
| `package.json` version | `1.0.0` | 已为 1.0.0，可直接用于正式版 |
| `package.json` productName | `TASI-live-Supertool` | 与文档一致 |
| `electron-builder.json` artifactName (win) | `TASI-live-Supertool_V1.0_win-x64.${ext}` | 写死 V1.0，与 1.0.x 一致 |
| 构建命令 | `npm run dist` | 会执行 dist:clean → build → dist:check → electron-builder --win |

**结论**：版本与产物命名已对齐，无需改版本号即可发行；若希望产物名随 `package.json` 的 version 变化，可把 `artifactName` 改为 `TASI-live-Supertool_${version}_win-x64.${ext}`（可选）。

---

## 三、环境与配置检查

### 3.1 鉴权 API（正式版必看）

- **文件**：`src/config/authApiBase.ts`、`src/config/auth.ts`
- **逻辑**：默认基准地址 `http://121.41.179.197:8000`；构建时可通过 `VITE_AUTH_API_BASE_URL` 覆盖；主进程用 `AUTH_API_BASE_URL` / `VITE_AUTH_API_BASE_URL` / `AUTH_API_BASE`。
- **建议**：正式版若使用其他鉴权域名，请在构建时设置 `VITE_AUTH_API_BASE_URL` 或在文档中说明。

### 3.2 Electron 主进程鉴权

- **文件**：`electron/main/ipc/auth.ts`、`electron/main/services/cloudAuthClient.ts`
- **逻辑**：打包后走云鉴权；基准 URL 来自环境变量或 `authApiBase.ts` 默认值。

### 3.3 敏感信息

- `.gitignore` 已包含 `.env`、`.env.*`；未发现硬编码密钥；构建/运行若需密钥，请通过环境变量或构建时注入，勿提交进仓库。

---

## 四、代码质量与发行建议

### 4.1 console 使用情况

- **src 下**：约 150+ 处 `console.log` / `console.warn` / `console.error`，多为状态机、任务、门控等调试/排错输出。
- **建议**：发行不强制删除；若希望正式包控制台更干净，可后续用 Vite 的 drop_console 或按 `import.meta.env.PROD` 条件化（**本次可不做**）。

### 4.2 TODO / FIXME

- 均为功能增强或边界条件，不阻塞当前正式版发行；可在发行后迭代处理。

### 4.3 Lint / 构建

- 建议发行前执行：`npm run build`（或 `pnpm run build`），确保无 TypeScript / Vite 报错；可执行 `scripts/pre-release-check.ps1` 做只读检查。

---

## 五、发行前准备步骤（建议顺序）

1. **提交当前所有变更**
   - 将「一、当前仓库状态」中未提交变更全部 add 并 commit（排除 __pycache__、*.db），建议 message 示例：  
     `release: v1.0.0 - 云鉴权、订阅状态、管理员后台、无 /auth 前缀与 .token 对齐`

2. **（可选）版本与 CHANGELOG**
   - 若沿用 `1.0.0`：无需改版本。
   - 若使用 `npm run release`：需保证已有 `CHANGELOG.md`，或先执行 `npm run bump` 生成再 release。
   - **若仅打 tag 并推送代码**：可跳过 `npm run release`，改为手动打 tag 和 push。

3. **打 Tag**
   - 建议 tag：`v1.0.0` 或 `v1.0`（与 RELEASE_V1.0_CHECKLIST 一致）
   - 命令示例：`git tag -a v1.0.0 -m "Release v1.0.0"`

4. **本地构建验证**
   - `npm run build`
   - `npm run dist`
   - 检查 `release/<version>/` 下是否生成：
     - `TASI-live-Supertool_V1.0_win-x64.exe`
     - `TASI-live-Supertool_V1.0_win-x64.zip`

5. **推送到远程**
   - 推送当前分支：`git push origin dev-after-electron-fix`（或您要发布的分支名）
   - 推送 tag：`git push origin v1.0.0`（或 `git push origin --tags`）

6. **Release 页面**
   - 在 GitHub / Gitee 的 Releases 中创建对应 tag 的 Release，上传上述 .exe 与 .zip，并粘贴或精简 `RELEASE_NOTES_V1.0.md` 作为说明（参考 `scripts/RELEASE_V1.0_CHECKLIST.md`）。

---

## 六、执行清单（可打印/勾选）

| 序号 | 项 | 说明 |
|------|----|------|
| 1 | 未提交变更已全部提交 | git status 干净或仅允许忽略项 |
| 2 | package.json version 正确 | 如 1.0.0 |
| 3 | electron-builder 产物名符合预期 | 如 V1.0_win-x64 |
| 4 | npm run build 通过 | 无 TS/Vite 报错 |
| 5 | npm run dist 通过 | release/ 下生成 exe + zip |
| 6 | 鉴权基准 URL 确认 | 默认或 VITE_AUTH_API_BASE_URL 与生产一致 |
| 7 | auth-api 已部署且接口对齐 | /register、/login(.token)、/subscription/status |
| 8 | 无敏感信息提交 | .env 未提交、无硬编码密钥 |
| 9 | RELEASE_NOTES 已更新 | 关键变更、已知限制、下载说明 |
| 10 | Tag 已打并推送 | 如 v1.0.0 |
| 11 | GitHub/Gitee Release 已创建 | 附件含 exe、zip，说明已粘贴 |

**不包含**（需您自行决定或本地执行）：

- 不自动执行 `npm run release`（依赖 CHANGELOG.md，且会 commit+tag+push）
- 不修改 `package.json` version 或 `electron-builder.json` artifactName
- 不删除或修改代码中的 console / TODO

---

## 七、总结

| 检查项 | 状态 |
|--------|------|
| 版本号 1.0.0 | 已就绪 |
| 构建配置与产物名 | 已就绪 |
| 鉴权 API 配置 | 默认 121.41.179.197:8000，可构建时覆盖 |
| 未提交变更 | 需在发行前提交（见第一节） |
| 阻塞性 TODO/console | 无，可发行 |
| 敏感信息 | 未发现泄露 |

**结论**：完成「提交变更 → 打 tag → 构建验证 → 推送」后，即可进行正式版发行。auth-api 部署与接口对齐见 `auth-api/docs/ADMIN_API_DELIVERY.md`、`auth-api/docs/SUBSCRIPTION_STATUS_DEPLOY.md`。
