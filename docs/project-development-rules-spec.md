# 项目开发规则规范

> **版本**: v1.0
> **最后更新**: 2026-03-16
> **状态**: 已固化
> **负责人**: TEAM
> **当前适用性**: 当前有效
> **关联主文档**: `docs/project-architecture-foundation.md`

---

## 1. 文档目标

本文档基于当前仓库代码、配置、CI、发布脚本和现有规范文档的系统检查结果，统一定义项目开发规则，用于约束以下内容：

- 代码风格与格式
- 命名约定与目录组织
- 架构边界与依赖方向
- Git / 提交 / 评审 / 发布流程
- 测试、错误处理、性能、安全和文档标准

本文档不是“理想建议清单”，而是当前仓库应执行的统一规则。若规则与代码冲突，以本文档和关联主规范为后续整改依据。

---

## 2. 检查结论

### 2.1 当前已具备的工程基础

1. 仓库已形成清晰的分层结构：`src/` 渲染层、`electron/` 主进程、`shared/` 契约层、`auth-api/` 服务端、`docs/` 治理层。
2. 代码质量工具已落地：
   - `Biome` 负责格式化、lint、导入整理
   - `TypeScript strict` 已开启
   - `Vitest` 已覆盖关键任务、权限、存储、IPC 契约与日志安全
   - GitHub Actions 已执行前端质量门禁和 Python 语法、导入、稳定单测检查
3. 核心架构边界已有明确真相源：
   - IPC 契约以 `shared/ipcChannels.ts` 和 `shared/electron-api.d.ts` 为准
   - 套餐 / 权限规则以 `shared/*.data.json` 为准
   - token 安全存储以 Electron 主进程为准
4. 发布流程、回归清单、文档治理已经文档化，说明团队有较强的流程意识。

### 2.2 当前主要缺口

1. 项目规则分散在 README、架构文档、发布文档和专题文档中，缺少统一的开发规范总表。
2. 团队已实际采用 Conventional Commit 风格，但分支命名、PR 审查要求、合并前检查项尚未在单一规范中固定。
3. Python 侧已具备统一的语法检查、导入冒烟和稳定单测入口，但仍缺少 formatter / lint / pytest 级别的完整质量基线。
4. `auth-api/test_subscription_system.py` 属于高耦合集成脚本，当前未纳入统一门禁，需要后续拆分为可重复执行的稳定测试。
5. Python 用户全局环境可能与其他工具冲突，`auth-api` 开发与检查应优先使用项目内虚拟环境隔离。

### 2.3 现状评估

- **代码规范**：中上。前端规范工具完备，前端本地质量闭环已打通；Python 侧仍需补齐格式化和 lint。
- **架构设计**：较强。核心边界、真相源和依赖关系已经清晰。
- **开发流程**：中上。发布和回归流程较完整，但提交与评审规则缺少统一入口。
- **质量标准**：中上。已有类型、测试、CI 门禁，但性能、安全、Python 质量门槛仍偏“规则驱动”，自动化不足。
- **团队协作模式**：中等。已体现文档驱动和 commit 规范，但 branch / review / owner 机制有待进一步固化。

---

## 3. 规则等级

- `MUST`：必须遵守，违反即视为不合规，不应合并。
- `SHOULD`：默认必须遵守，除非有明确理由并在 PR 中说明。
- `MAY`：允许使用，但不得与 MUST / SHOULD 冲突。
- `禁止`：默认不允许，除非先更新主规范并通过评审。

---

## 4. 通用总则

### 4.1 真相源

1. `MUST` 复用已有真相源，不得复制第二份业务规则表。
2. `MUST` 以 `shared/` 作为跨进程、跨层 TypeScript 契约唯一真相源。
3. `MUST` 以 Electron 主进程作为 token、安全存储、浏览器任务实例的唯一权威。
4. `MUST` 以 `shared/planRules.data.json` 和 `shared/authFeatureRules.data.json` 作为套餐与功能权限静态规则源。
5. `禁止` 在 renderer、页面组件或临时脚本中复制权限、套餐、IPC 名称、账号上限等核心规则。

### 4.2 架构边界

1. `MUST` 遵守已固化的五层结构：`src/`、`electron/`、`shared/`、`auth-api/`、`docs/`。
2. `MUST` 保持“渲染层负责 UI 语义，主进程负责真实运行时”的职责划分。
3. `MUST` 通过 `TaskManager`、`TaskStateManager`、`stopAllLiveTasks` 处理任务编排和总停逻辑。
4. `MUST` 通过 `commentListener` 语义管理评论监听基础设施，禁止退回 `autoReply` 私有语义。
5. `禁止` 页面组件直接承担主进程权威职责，禁止页面私自维护第二套总停、总启、权限判断或 token 写入逻辑。

---

## 5. 代码风格与格式规则

### 5.1 前端 / Electron / Shared TypeScript

1. `MUST` 使用 `Biome` 作为前端、Electron、shared 代码的统一 formatter 和 linter。
2. `MUST` 以仓库根目录 `biome.json` 为唯一格式配置源，当前基线包括：
   - 缩进使用空格
   - 行宽 100
   - 单引号
   - JSX 双引号
   - 结尾逗号保留
   - 分号按需
3. `MUST` 在提交前执行导入整理，保持 import 顺序稳定，不允许手工留存未整理导入。
4. `MUST` 保持 `TypeScript strict` 通过，禁止提交 `tsc --noEmit` 失败代码。
5. `SHOULD` 优先使用明确类型；`any` 仅允许出现在边界适配、第三方库兼容或历史迁移代码，并需附带原因。
6. `SHOULD` 以函数和纯数据结构优先，避免无必要的复杂 class。
7. `禁止` 为绕过检查而大面积添加 `eslint-disable`、`@ts-ignore`、非空断言和未解释的类型断言。

### 5.2 Python(auth-api)

1. `MUST` 保持路由、schema、依赖、模型职责清晰，禁止在单文件内混合过多不相关职责。
2. `MUST` 保证 Python 代码至少通过语法检查、应用导入冒烟和受影响测试。
3. `MUST` `auth-api` 的依赖安装、检查和测试优先使用 `auth-api/.venv`，禁止依赖用户全局 Python 环境作为稳定基线。
4. `SHOULD` 逐步补齐 Python formatter / lint / pytest 统一入口；在其落地前，新增模块必须附带最小测试或验证方法。

---

## 6. 命名约定

1. `MUST` React 组件、页面、对话框、错误边界文件使用 `PascalCase.tsx`。
2. `MUST` Hook 文件使用 `useXxx.ts` 或 `useXxx.tsx`。
3. `MUST` 工具、服务、配置、常量文件使用 `camelCase.ts`。
4. `MUST` 类型声明优先放入 `src/types/` 或 `shared/*.d.ts`；新增代码不得继续扩散 `src/type/` 这类不一致目录。
5. `MUST` 测试文件使用 `*.test.ts`、`*.test.py` 或 `__tests__/` 目录。
6. `MUST` 文档命名遵守 `docs/DOC_GOVERNANCE.md`：
   - 规范文档用 `*-spec.md`
   - 架构文档用 `*-architecture.md`
   - 检查清单用 `*-checklist.md` 或 `*_CHECKLIST.md`
   - 审计报告用 `*_AUDIT_REPORT.md`
7. `SHOULD` 让名称体现职责，不使用 `temp`、`tmp`、`new2`、`final-final` 一类临时命名。

---

## 7. 文件组织与依赖规则

1. `MUST` 页面级功能放在 `src/pages/<Feature>/` 下，页面私有组件放在对应 `components/` 子目录。
2. `MUST` 可复用 UI 基础组件放在 `src/components/ui/`，业务共用组件放在 `src/components/common/` 或明确业务目录。
3. `MUST` 状态管理、运行态编排与页面 UI 分离：
   - store 放在 `src/stores/` 或特定 hook/store 模块中
   - 页面只消费状态，不定义新的跨页面权威状态
4. `MUST` 跨运行层共享常量、通道名、类型契约放在 `shared/`，禁止在 `src/` 和 `electron/` 各维护一份。
5. `MUST` 通过 alias 导入：
   - renderer 优先使用 `@/`
   - shared 使用 `shared/*`
   - Electron 主进程内部优先使用 `#/*` 或同层相对路径
6. `SHOULD` 单文件保持单一职责；超过 300 行且同时承担多种职责的模块，应优先拆分。
7. `禁止` renderer 直接依赖 Electron 运行时实现细节；跨层通信必须经过 preload 和 `shared` 契约。

---

## 8. 版本控制策略

1. `MUST` 使用短生命周期分支开发，默认从 `main` 拉出功能分支。
2. `MUST` 分支名体现目的，推荐格式：
   - `feat/<topic>`
   - `fix/<topic>`
   - `refactor/<topic>`
   - `docs/<topic>`
   - `chore/<topic>`
3. `MUST` 使用 Conventional Commit 风格，当前仓库实际已采用：
   - `feat:`
   - `fix:`
   - `refactor:`
   - `docs:`
   - `test:`
   - `ci:`
   - `chore:`
4. `MUST` 发布标签使用语义化版本 `vX.Y.Z`；Windows 发布工作流以 `v*` tag 为触发条件。
5. `SHOULD` 避免直接向 `main` 推送高风险变更；涉及架构、认证、IPC、发布链路的改动必须走 PR。
6. `禁止` 混入与当前任务无关的大量格式化、重命名和逻辑变更，导致评审失焦。

---

## 9. 代码审查与合并规则

1. `MUST` 任何涉及以下内容的改动走代码审查：
   - IPC 通道
   - 认证 / token / 权限 / 套餐
   - 任务调度与 stopAll
   - 浏览器连接和生命周期
   - 发布、更新、安装包相关脚本
2. `MUST` PR 描述至少包含：
   - 变更目标
   - 影响范围
   - 风险点
   - 验证结果
   - 是否更新文档
3. `MUST` 修改高风险文件时，同时引用 `docs/HIGH_RISK_FILES.md` 和 `docs/REGRESSION_CHECKLIST.md` 完成验证。
4. `MUST` 架构边界变化时，同时执行并勾对 `docs/architecture-change-checklist.md`。
5. `SHOULD` 单个 PR 聚焦单一主题；超过 500 行有效逻辑改动时，应拆分或先做设计说明。
6. `禁止` 在未说明风险与验证结论的情况下合并高风险变更。

---

## 10. 测试与质量门禁

### 10.1 提交前最低门槛

1. `MUST` 前端 / Electron / shared 改动至少通过：
   - `npx biome check --no-errors-on-unmatched --files-ignore-unknown=true .`
   - `npx tsc --noEmit`
   - `npm test -- --run`
2. `MUST` auth-api 改动至少通过：
   - `npm run auth:venv`
   - `npm run auth:syntax`
   - `npm run auth:smoke`
   - `npm run auth:test`
3. `MUST` 高风险链路变更补充人工回归结果，不能只给“已自测”。

### 10.2 测试策略

1. `MUST` 为新增的共享规则、IPC 契约、权限策略、任务状态机和存储迁移提供最小测试。
2. `SHOULD` 优先测试“边界”和“回归锁点”，而不是只测 happy path。
3. `SHOULD` 测试文件与被测模块同域放置，便于维护。
4. `禁止` 以删除测试、跳过测试或长期注释掉断言作为临时修复手段。

### 10.3 CI 规则

1. `MUST` 保持 GitHub Actions 质量门禁为合并前必过项。
2. `MUST` 质量门禁失败时先修复问题，再讨论合并，不允许“先合后补”。
3. `SHOULD` 将后续新增的质量脚本纳入 CI，而不是只写入文档。

---

## 11. 错误处理与日志规则

1. `MUST` 在用户可见链路中统一处理错误，技术错误需转换为用户可理解提示。
2. `MUST` 在关键异步流程中使用 `try/catch` 或统一错误处理 hook，禁止静默吞错。
3. `MUST` 错误提示包含上下文，至少说明动作、对象和失败原因。
4. `MUST` 日志遵守脱敏规则，禁止输出 token、password、验证码、secret、Authorization 原文。
5. `MUST` 生产环境默认抑制 debug 级噪音日志，保留必要的 info / warn / error。
6. `SHOULD` 对跨账号、跨进程、高风险链路记录 `accountId`、`traceId`、channel 或任务名。
7. `禁止` 在高频循环、轮询或评论流里输出无控制的大量日志。

---

## 12. 性能规则

1. `MUST` 新页面或大模块默认支持按路由或功能分块加载，避免无必要首屏膨胀。
2. `MUST` 保持渲染层与主进程职责分离，避免在 renderer 中复制底层任务状态机。
3. `MUST` 关注多账号场景下的状态隔离和资源释放，停止一个账号不得误伤其他账号。
4. `SHOULD` 延续当前构建优化策略：
   - 手动 vendor chunk 切分
   - 生产构建移除 `console` / `debugger`
   - 对 markdown、AI、图标等相对重依赖按需加载
5. `SHOULD` 高频状态同步、事件监听和 store selector 避免不必要重渲染。
6. `禁止` 通过增加大量日志、重复轮询或重复订阅来掩盖状态问题。

---

## 13. 安全规则

1. `MUST` token 只允许由主进程安全存储和刷新；renderer 不得新增旁路写入口。
2. `MUST` 新增 IPC 通道时同步更新：
   - `shared/ipcChannels.ts`
   - `shared/electron-api.d.ts`
   - preload 暴露
   - `electron/preload/ipcWhitelist.gen.ts`
3. `MUST` 所有跨进程通信通过白名单通道进行，禁止裸字符串私写 channel。
4. `MUST` 外部输入、URL、HTML 渲染、文件路径、平台参数做最小校验和必要清洗。
5. `MUST` 敏感配置走环境变量或安全存储，不得硬编码到业务逻辑。
6. `SHOULD` 认证、订阅、礼品卡、更新、下载链路改动后追加安全回归。
7. `禁止` 把调试用 token、短信验证码、礼品卡明文写进代码、日志、截图或文档。

---

## 14. 文档编写规则

1. `MUST` 新增或修改规范文档时遵守 `docs/DOC_GOVERNANCE.md` 的状态头、命名和生命周期要求。
2. `MUST` 代码改变行为边界、流程或真相源时同步更新相关文档和 README 索引。
3. `MUST` 文档内容与 `package.json`、CI、当前代码保持一致；命令、路径、触发条件不得失真。
4. `MUST` 审计报告、修复报告、归档文档不得充当当前实现依据。
5. `SHOULD` 每个专题只保留一个当前有效规范入口，避免同一主题多份文档并存。
6. `禁止` 创建副本、临时版、补丁版命名文档，例如 `*_copy.md`、`*_temp.md`、`*_patch.md`。

---

## 15. 发布与变更管理规则

1. `MUST` 发布前执行既有发布审计、阻断检查和构建验证。
2. `MUST` 正式发布前保证 Git 工作区干净，禁止带未提交本地修改打 tag。
3. `MUST` 按平台隔离策略构建产物：
   - macOS 由本地 Mac 构建
   - Windows 由 GitHub Actions 构建
4. `MUST` 发布产物、更新源和下载页信息保持版本一致。
5. `SHOULD` 发布前同步生成 release notes，并核对 API 地址、构建配置、产物清单。
6. `禁止` 跳过 `release:guard`、`dist:validate`、产物核验等防事故步骤直接发布。

---

## 16. 执行清单

每次提交前至少完成以下动作：

1. 运行格式化和静态检查。
2. 运行类型检查。
3. 运行受影响测试。
4. 若改动高风险链路，补充人工回归记录。
5. 若改动架构边界，更新主架构文档和 README 索引。
6. 确认文档、脚本、CI、代码中的命令和路径一致。

---

## 17. 后续整改优先级

以下事项应作为本规范落地后的第一批补齐项：

1. 为 auth-api 补齐统一的 lint / formatter / pytest 入口。
2. 将性能和安全高风险检查逐步从“文档约束”升级为“脚本 / CI 门禁”。
3. 将高风险回归清单进一步脚本化，减少人工漏检。

---

本规范与 `docs/project-architecture-foundation.md`、`docs/architecture-change-checklist.md`、`docs/REGRESSION_CHECKLIST.md`、`docs/HIGH_RISK_FILES.md` 共同构成项目当前开发治理基线。
