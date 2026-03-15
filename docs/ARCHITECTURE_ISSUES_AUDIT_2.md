# 架构问题清单 · 二次审计报告

**审计日期**: 2026-03-16  
**范围**: 对《架构问题清单》中 P1/P2/P3 各项进行逐项代码核查  
**结论**: 清单描述**总体准确**，行号与事实有少量偏差，已在下文逐条标注并补充证据与修正建议。

---

## P1 级别（高优先级）

### P1-1：任务系统没有真正的单一真相源

| 审计项 | 清单描述 | 核查结果 | 证据/修正 |
|--------|----------|----------|-----------|
| 三套任务编排接口 | TaskManager.ts、useTaskStateManager.ts、App.tsx 三处并存 | **确认** | 见下 |
| TaskManager 门控依赖 store | 启动时回头读 useLiveControlStore 做门控 | **确认** | `TaskManager.ts` 第 111-114 行：`const liveControlStore = useLiveControlStore.getState()` 用于 gate 检查 |
| useTaskStateManager 角色 | “从 store 拼装状态” | **确认** | `useTaskStateManager.ts` 第 45-80 行：从 useAutoMessageStore、useAutoPopUpStore、useAutoReplyStore、useSubAccountStore、useLiveStatsStore 拼装 `getAllTaskStatuses`，注释虽称“单一真相源”，实为聚合层 |
| App 根层直接停任务/写 store | 全局 IPC 中直接 stop 或写 store | **确认** | `App.tsx` 第 51-134 行：`useGlobalIpcListener()` 内对 `disconnectedEvent`、`autoMessage.stoppedEvent` 等直接调用 `taskManager.stop`、`setIsRunningAutoMessage(id, false)` 等，与 TaskManager/useTaskStateManager 形成多控制面 |

**行号说明**：清单中的「App.tsx 第 53 行」对应的是 `useGlobalIpcListener` 内逻辑（约 51-56 行）；「第 233 行」对应的是 `AppContent` 中调用 `useGlobalIpcListener()` 的位置（实际为 234 行），含义正确。

**二次审计结论**：问题成立，且“三套控制面并存”的概括准确；建议将“任务单一真相源”明确收口到 TaskManager，由 IPC 只通知 TaskManager，再由 TaskManager 驱动 store 更新。

---

### P1-2：认证状态和 token 所有权分裂

| 审计项 | 清单描述 | 核查结果 | 证据/修正 |
|--------|----------|----------|-----------|
| preload setTokens 为 no-op | setTokens 已废弃且为空实现 | **确认** | `electron/preload/auth.ts` 第 129-134 行：`setTokens` 仅打 deprecation warning，无写入逻辑 |
| authStore 仍调 setTokens | 登录成功后写入 token | **确认** | `src/stores/authStore.ts` 第 199-202 行：登录成功后 `if (authAPI?.setTokens) { await authAPI.setTokens({...}) }` |
| apiClient 刷新后调 setTokens | 刷新 token 后写入 | **确认** | `src/services/apiClient.ts` 第 183-185 行：refresh 成功后 `await authAPI.setTokens({ token: ..., refreshToken: ... })` |

**二次审计结论**：问题成立。主进程为“唯一可信来源”的设计与实现不一致：渲染层 authStore、apiClient 仍把废弃的 `setTokens` 当作写入口，实际写入已被 preload 置为 no-op，存在“调用但无效”的语义混淆。

**建议**：登录/刷新流程改为仅通过 IPC 由主进程写入；渲染层移除对 `setTokens` 的调用，并逐步从 preload 中删除该接口。

---

### P1-3：IPC/预加载契约不是唯一来源

| 审计项 | 清单描述 | 核查结果 | 证据/修正 |
|--------|----------|----------|-----------|
| shared 与 preload 两套契约 | electron-api.d.ts + preload 白名单 vs 手写 auth 桥接 | **部分确认** | `shared/electron-api.d.ts` 第 60-66 行已包含 `getAuthSummary`、`getTokenInternal`；preload 通过 `electron/preload/auth.ts` 的 `contextBridge.exposeInMainWorld('authAPI', authAPI)` 暴露（清单“第 22 行”对应 `authAPI` 对象定义起点约 21 行）。index.ts 第 4 行 `import './auth'`，第 14 行为 `ipcRendererApi` 定义开始，白名单在 `ipcWhitelist.gen.ts` |
| global.d.ts 与 preload 不一致 | 渲染层类型只有 getTokens/setTokens，缺少新接口 | **确认** | `src/types/global.d.ts` 第 76-78 行：`AuthAPI` 仅声明 `getTokens`、`setTokens`，**未声明** `getAuthSummary`、`getTokenInternal`、`proxyRequest`，与 preload 实际暴露的 API 不一致 |

**行号说明**：清单“electron-api.d.ts 第 7 行”可能指 auth 相关条目的起始附近；实际 `getAuthSummary`/`getTokenInternal` 在 60-66 行，结论“存在 electron-api.d.ts 与白名单”正确。

**二次审计结论**：契约漂移成立。渲染层 `global.d.ts` 仍以废弃的 getTokens/setTokens 为正式接口，导致类型与运行时行为脱节；建议以 `shared/electron-api.d.ts` 或从 preload 抽离的单一类型定义为准，让 `global.d.ts` 的 `Window['authAPI']` 与其对齐。

---

## P2 级别（中优先级）

### P2-1：权限/套餐规则存在双重真相

| 审计项 | 清单描述 | 核查结果 | 证据/修正 |
|--------|----------|----------|-----------|
| 服务端计算 plan/trial/max_accounts | auth.py 内优先级：订阅 > 试用 > 免费 | **确认** | `auth-api/routers/auth.py` 第 65-174 行：`build_user_status_response` 中先查 subscriptions，再 trials，再 user 表，最后 `max_accounts = getattr(user, "max_accounts", 1)` |
| 渲染层重新计算 effectivePlan/试用/账号上限 | AccessControl.ts 内再算一遍 | **确认** | `src/domain/access/AccessControl.ts` 第 47-75 行：`buildAccessContext()` 中 `effectivePlan = getEffectivePlan(userStatus?.plan, userStatus?.trial)`，`trialActive`/`trialExpired` 从 `userStatus?.trial` 取，`maxAccounts = userStatus?.max_accounts ?? getMaxLiveAccounts(effectivePlan)` |

**行号说明**：清单“auth.py 第 65 行”对应 `build_user_status_response` 起始；“AccessControl.ts 第 47 行”对应 `buildAccessContext` 起始，正确。

**二次审计结论**：问题成立。前后端各自实现了一套“正式 > 试用 > 免费”与账号上限逻辑，规则变更需双端同步，存在错位风险；建议服务端作为唯一规则源，前端仅消费 `/auth/status`（或等价接口）的返回字段，不再本地再算 effectivePlan/max_accounts。

---

### P2-2：App 根组件承担过多跨域编排责任

| 审计项 | 清单描述 | 核查结果 | 证据/修正 |
|--------|----------|----------|-----------|
| useGlobalIpcListener 集中处理多类事件 | 评论、断开、直播状态、更新、任务同步、多 store 写入 | **确认** | `App.tsx` 第 51-220 行：同一 hook 内处理 showComment、disconnectedEvent、autoMessage.stoppedEvent、autoPopUp.stoppedEvent、listenerStopped、streamStateChanged、更新、任务同步等，并直接写多个 store |
| 根层统一装配副作用 | 在 App 根层挂载上述监听与加载逻辑 | **确认** | `App.tsx` 第 233-244 行：`AppContent` 中依次调用 `useGlobalIpcListener()`、`useLoadChromeConfigOnLogin()`、`useLoadAutoReplyConfigOnLogin()` 等，新模块易继续挂到根上 |

**二次审计结论**：问题成立。根组件了解过多业务与 store 细节，不利于收敛；建议按领域拆分（如 liveControl、tasks、auth、update）到各自 Provider 或 hook，App 只做组合与壳层。

---

### P2-3：文档与真实运行脚本偏差

| 审计项 | 清单描述 | 核查结果 | 证据/修正 |
|--------|----------|----------|-----------|
| README 要求 build-exe / dist | 文档与 package.json 不一致 | **确认** | `README.md` 第 83-86 行：写有 `npm run build-exe`、`npm run dist`；`package.json` 的 scripts（第 16-47 行）仅有 `dist:win`、`dist:mac`、`dist:linux`，**无** `build-exe`、`dist` |

**二次审计结论**：问题成立。建议在 README 中改为与现有脚本一致，例如“构建并打包（本地测试）”指向 `dist:win`/`dist:mac`/`dist:linux`，“完整构建并打包（用于发布）”同样指向对应 `dist:*` 或补充 `dist` 为聚合脚本。

---

## P3 级别（低优先级）

### P3-1：测试覆盖未落在最脆弱的架构接缝上

| 审计项 | 清单描述 | 核查结果 | 证据/修正 |
|--------|----------|----------|-----------|
| 现有测试侧重 | IPC channel 存在性、少量 auth util、TaskManager 多账号 | **确认** | `shared/__tests__/ipcChannels.test.ts` 仅验证 `IPC_CHANNELS` 的 key 存在与命名规范；`src/tasks/__tests__/TaskManager.multi-account.test.ts` 验证账号隔离；`src/stores/auth/__tests__/utils.test.ts` 等为工具/状态测试 |
| 缺失的约束测试 | preload 契约与 shared/global 一致、auth token 唯一写入口、前后端套餐规则一致、App 全局事件编排 | **确认** | 无“preload 暴露的 authAPI 与 electron-api.d.ts / global.d.ts 一致”的测试；无“仅主进程写入 token”的契约测试；无“AccessControl 与 auth.py build_user_status_response 规则一致”的契约或快照测试；无对 useGlobalIpcListener 行为或收口边界的测试 |

**二次审计结论**：问题成立。建议增加：（1）preload 与 shared/global 类型或契约一致性测试；（2）auth 写入口仅主进程的约束测试；（3）套餐/账号上限规则前后端一致性测试（或接口契约测试）；（4）可选：App 层 IPC 监听收口与模块边界的集成/文档约束。

---

## 审计总结

| 优先级 | 项数 | 全部确认 | 行号/表述微调 |
|--------|------|----------|----------------|
| P1     | 3    | 3        | P1-3 行号以本报告为准 |
| P2     | 3    | 3        | 无 |
| P3     | 1    | 1        | 无 |

**总体结论**：原架构问题清单描述与代码事实一致，可采信。本报告对行号与细节做了核对与少量修正，并补充了证据位置与改进建议，便于按优先级落地治理。
