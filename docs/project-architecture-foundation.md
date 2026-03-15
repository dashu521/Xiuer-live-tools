# 项目架构固化文档

> **版本**: v1.0  
> **最后更新**: 2026-03-16  
> **状态**: 已固化  
> **负责人**: TEAM  
> **当前适用性**: 当前有效  
> **关联主文档**: 本文档为全仓库架构边界与真相源的总说明

---

## 1. 文档目标

本文档用于固化当前仓库的核心架构边界，回答 4 个问题：

1. 哪些模块是系统主轴，职责怎么分。
2. 哪些状态/规则有唯一真相源。
3. 哪些模块之间允许依赖，哪些不允许。
4. 后续开发应该沿着什么边界继续演进，避免再次回到“补丁式修复”。

本文档不替代专题规范，而是作为总入口，统一指向各专题唯一规范源。

配套提交前检查请见：

- `docs/architecture-change-checklist.md`

---

## 2. 当前系统地图

当前仓库按运行层和业务域拆为 5 个主块：

### 2.1 Electron 主进程

路径：

- `electron/main/ipc`
- `electron/main/services`
- `electron/main/tasks`
- `electron/main/managers`

职责：

- 管理浏览器会话和平台连接
- 持有真正的运行时任务实例
- 执行评论监听、自动发言、自动弹窗等底层任务
- 负责认证安全存储和桥接调用

原则：

- 主进程是浏览器会话、底层任务实例、token 安全存储的唯一权威

### 2.2 React 渲染层

路径：

- `src/pages`
- `src/hooks`
- `src/stores`
- `src/tasks`
- `src/utils`

职责：

- 页面 UI
- 页面级状态展示
- 用户动作编排
- 轻量任务调度与前端运行态同步

原则：

- 渲染层不直接持有真实浏览器任务，只消费主进程结果并维护 UI 语义状态

### 2.3 Shared 契约层

路径：

- `shared/ipcChannels.ts`
- `shared/electron-api.d.ts`
- `shared/planRules.ts`
- `shared/planRules.data.json`
- `shared/authFeatureRules.ts`
- `shared/authFeatureRules.data.json`

职责：

- 定义跨进程通道
- 定义桥接接口类型
- 定义跨语言共享规则数据

原则：

- `shared` 是 TypeScript 侧跨层契约的唯一真相源
- Python 侧允许复用 `shared/*.data.json`，但不应再复制静态规则表

### 2.4 auth-api

路径：

- `auth-api/routers`
- `auth-api/subscription_rules.py`
- `auth-api/auth_feature_rules.py`

职责：

- 用户认证
- 订阅/试用/礼品卡能力判断
- 输出服务端能力 DTO

原则：

- 服务端负责输出能力结论
- 前端权限层优先消费服务端能力，不重算核心业务规则

### 2.5 文档与治理层

路径：

- `docs/*.md`
- `.github/workflows/quality-gate.yml`

职责：

- 固化行为规范
- 固化架构边界
- 固化 CI / 发布 / 回归要求

原则：

- 文档不是历史记录，而是当前实现的约束来源

---

## 3. 当前已固化的主架构原则

### 3.1 任务系统

当前原则：

- `TaskManager` 是前端任务调度入口
- `TaskStateManager` 是统一停任务和运行态聚合入口
- `stopAllLiveTasks(accountId, reason)` 是统一总停入口
- `App` 不再直接承载大段任务业务逻辑，只负责装配监听

主文件：

- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/src/tasks/TaskManager.ts`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/src/utils/TaskStateManager.ts`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/src/utils/stopAllLiveTasks.ts`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/src/hooks/useAppIpcBootstrap.ts`

约束：

- 新任务接入应优先纳入 `TaskManager`
- 批量停止必须走 `TaskStateManager` / `stopAllLiveTasks`
- 不允许页面自己再维护一套独立“总停”逻辑

### 3.2 认证与 token 真相源

当前原则：

- token 的唯一写入口在主进程
- renderer 不再作为 token 权威写源
- access token 刷新必须走正式 `auth.refreshSession` IPC
- preload/global/shared 契约必须保持一致
- 新增 IPC 通道后，必须同步再生成 preload 白名单

主文件：

- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/auth.ts`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/preload/auth.ts`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/preload/ipcWhitelist.gen.ts`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/src/stores/authStore.ts`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/src/services/apiClient.ts`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/shared/electron-api.d.ts`

约束：

- 不允许新增 renderer 侧直接写 token 的旁路
- 不允许再次恢复废弃的 `setTokens/getTokens` 语义
- 不允许手改 whitelist 语义却不回写 `shared/ipcChannels.ts` 和生成产物

### 3.3 权限 / 套餐 / 能力真相源

当前原则：

- 套餐静态规则来自 `shared/planRules.data.json`
- 功能权限静态规则来自 `shared/authFeatureRules.data.json`
- 服务端输出 `capabilities`
- 前端权限层优先消费服务端 `capabilities.feature_access`

主文件：

- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/shared/planRules.data.json`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/shared/authFeatureRules.data.json`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/auth-api/subscription_rules.py`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/auth-api/auth_feature_rules.py`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/src/domain/access/AccessControl.ts`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/src/domain/access/AccessPolicy.ts`

约束：

- 新增套餐等级或功能权限时，先改 `shared/*.data.json`
- 前端不应再次复制一份独立套餐优先级规则

### 3.4 小号互动独立子系统

当前原则：

- 小号互动是独立子系统
- 不依赖主账号登录态
- 不依赖直播控制任务是否启动
- 只允许“获取直播间地址”与主账号体系发生弱关联

主文件：

- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/src/pages/SubAccount/index.tsx`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/src/hooks/useSubAccount.ts`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/subAccount.ts`

约束：

- 不允许把小号互动重新并回主账号任务状态
- 小号互动自己的任务、账号、导入导出应继续独立演进

### 3.5 自动回复与数据监控的共享评论监听

当前原则：

- 自动回复与数据监控不互相依赖
- 两者共同依赖 `comment-listener runtime`
- 共享评论监听是基础设施，不属于自动回复私有能力
- 评论监听 IPC 正名为 `commentListener`，`autoReply` 下的旧通道仅保留兼容别名

主文件：

- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/src/utils/commentListenerRuntime.ts`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/src/tasks/autoReplyTask.ts`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/src/pages/LiveStats/index.tsx`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/commentListener.ts`
- `/Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/tasks/CommentListenerTask.ts`

约束：

- 自动回复启动不应自动点亮数据监控
- 数据监控启动不应自动点亮自动回复
- 停止一个消费者时，只释放自己的监听占用；只有无消费者时才真正关闭底层监听
- `shared/ipcChannels.ts`、preload whitelist、renderer 监听名称必须同步为 `commentListener`

---

## 4. 模块依赖规则

### 4.1 允许的依赖方向

允许：

- `src/pages` -> `src/hooks` / `src/tasks` / `src/utils`
- `src/hooks` -> `shared`
- `electron/main/ipc` -> `electron/main/services` / `electron/main/tasks`
- `auth-api` -> `shared/*.data.json`

### 4.2 禁止的依赖方向

禁止：

- `src/pages` 直接拼主进程运行时真相
- `src/stores` 再自造第二份核心业务规则表
- `App.tsx` 持续堆积业务域编排
- 小号互动依赖主账号任务状态
- 新功能绕开 `shared/ipcChannels.ts` 直接写裸 channel 字符串

---

## 5. 当前唯一可信来源索引

### 5.1 总体架构

- 本文档：`docs/project-architecture-foundation.md`

### 5.2 中控台 / 直播状态 / stopAll 规范

- `docs/live-control-lifecycle-spec.md`

### 5.3 权限 / 套餐 / 能力规则

- `docs/access-control-architecture.md`

### 5.4 文档治理规则

- `docs/DOC_GOVERNANCE.md`

---

## 6. 后续开发准入规则

新增需求时，必须先判断它属于哪一类：

1. 新页面能力  
   先决定是主账号体系、小号互动，还是独立子系统。

2. 新任务  
   先决定是否纳入 `TaskManager`，以及如何接入 `TaskStateManager`。

3. 新权限能力  
   先改 `shared/authFeatureRules.data.json`，再改服务端能力 DTO。

4. 新套餐或账号上限  
   先改 `shared/planRules.data.json`，再改服务端解释逻辑。

5. 新共享基础设施  
   必须明确“消费者”和“基础设施”边界，禁止挂在某个业务名义下偷偷复用。

---

## 7. 明确不再采用的旧模式

以下模式视为回退：

- 前端和后端各自维护一套套餐优先级
- token 在 renderer 与主进程双写
- 任务停止链路多个入口各自收状态
- `App.tsx` 持续接管具体业务副作用
- 自动回复名义下承载共享评论监听基础设施
- 数据监控通过改自动回复 store 来伪造运行态

---

## 8. 变更策略

后续如果要修改本文档描述的边界，必须同时满足：

1. 改动代码实现
2. 更新本文档
3. 如涉及专题规范，同步更新专题文档
4. 补最小回归测试

如果只改代码、不改文档，视为架构变更未完成。
