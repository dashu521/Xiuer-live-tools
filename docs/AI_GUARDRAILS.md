# 项目级 AI 改代码守则 v1.0

> **文档版本**: v1.0  
> **最后更新**: 2026-03-21  
> **状态**: 正式规范  
> **负责人**: TEAM  
> **当前适用性**: 当前有效  
> **适用范围**: 所有 AI 代理与代码助手

---

## 一、文档定位与使用原则

### 1.1 本文档是什么

本文档是**项目级 AI 改代码守则**，用于约束所有 AI 代理在修改代码时的行为边界。

**核心定位**:
- 约束 AI 的改代码行为，不是功能说明书
- 明确 AI 改代码前必须查阅的文档和必须遵守的规则
- 防止 AI 因不了解项目规范而引入回归问题

### 1.2 谁必须遵守本文档

**所有 AI 代理**，包括但不限于各类代码助手、自动化代理与协作式改码工具。

### 1.3 改代码前的文档查阅顺序

AI 在修改代码前**必须**按以下顺序查阅文档:

```
1. docs/README.md              → 了解文档分类体系和入口
2. docs/AI_GUARDRAILS.md        → 了解 AI 改代码守则（本文档）
3. 对应主题的主规范文档        → 了解具体业务规则
```

**禁止**:
- 跳过主规范直接凭猜测改代码
- 用 archive 文档、历史审计报告替代主规范
- 用历史聊天记录、旧聊天结论替代现行规范

### 1.4 文档冲突处理原则

若发现以下冲突，按以下优先级处理:

1. **当前代码实现** (最高优先级)
2. **主规范文档** (RELEASE_SPECIFICATION, task-state-governance, access-control-architecture, live-control-lifecycle-spec, SUBSCRIPTION_RULES)
3. **本文档 (AI_GUARDRAILS.md)**
4. **archive 历史文档** (仅作参考，不作为规范依据)
5. **历史聊天记录/旧说明** (无效)

---

## 二、现行文档入口及适用范围

### 2.1 文档索引与分类

| 文档 | 管什么 | 改代码前必读场景 |
|------|--------|-----------------|
| [docs/README.md](./README.md) | 文档分类体系、索引入口 | 所有改动前必须先查阅，了解文档角色 |
| [docs/RELEASE_SPECIFICATION.md](./RELEASE_SPECIFICATION.md) | 发布架构、构建规范、环境要求、发布检查清单 | 发布流程、构建配置、环境变量、CI/CD |
| [docs/task-state-governance.md](./task-state-governance.md) | 任务状态定义、治理规则、状态流转、修复记录 | 任务状态管理、绿点显示、stopAll 行为 |
| [docs/access-control-architecture.md](./access-control-architecture.md) | 权限控制架构、AccessContext、策略定义、套餐权限实现 | 权限判断、套餐权限、gateStore、AccessControl |
| [docs/live-control-lifecycle-spec.md](./live-control-lifecycle-spec.md) | 中控台连接生命周期、状态流转、连接管理 | 中控台连接、关播、disconnect、浏览器生命周期 |
| [docs/SUBSCRIPTION_RULES.md](./SUBSCRIPTION_RULES.md) | 套餐定义、权限矩阵、UI 映射、前后端一致性要求 | 订阅套餐、账号上限、功能权限、套餐显示 |

### 2.2 禁止行为

**禁止**:
- 用 archive 文档作为当前规范依据
- 用历史审计报告替代主规范
- 在 docs/README.md 已明确分类的情况下仍找错文档

---

## 三、规则分类说明

本文档将规则分为两类，AI 必须准确理解其含义:

### A 类：当前代码与主规范已共同确认的规则

**可以写成**:
- "当前规则是..."
- "当前实现为..."
- "当前唯一口径是..."
- "【当前已对齐】"

**含义**: 代码实现与主规范文档已完全一致，AI 改代码时必须遵守。

### B 类：项目必须遵守的规则

**必须写成**:
- "项目必须..."
- "禁止..."
- "需要..."
- "【项目必须遵守】"

**含义**: 这是项目规范方向，即使当前代码未必在所有角落完全落地，AI 也不得朝相反方向扩写。

---

## 四、A 类规则（当前已对齐）

### 4.1 中控台与直播状态

**【当前已对齐】**

| 规则 | 当前实现 | 主规范依据 |
|------|---------|-----------|
| 停止所有任务 ≠ 断开中控台连接 | `AccountSession.stopTasksAndUpdateState()` 参数化控制 | live-control-lifecycle-spec §2.3 |
| 结束直播 ≠ 断开中控台连接 | `AccountSession.stopForStreamEnded()` 不断开连接 | live-control-lifecycle-spec §2.4 |
| 断开中控台连接 ≠ 关闭浏览器 | `AccountSession.disconnect()` 默认 `closeBrowser=false` | live-control-lifecycle-spec §2.5 |
| 左侧绿色点只表示真实运行中 | `Sidebar.tsx` 绑定 `isRunning` 状态 | live-control-lifecycle-spec §2.6 |
| `stopAll` 必须幂等 | `TaskStateManager.stopAllTasksForAccount()` 先检查 `isRunning` | live-control-lifecycle-spec §2.3 |
| 所有状态必须按 `accountId` 严格隔离 | `AccountSession` 实例独立，Store 使用 `contexts[accountId]` | live-control-lifecycle-spec §3.3 |

### 4.2 任务状态治理

**【当前已对齐】**

| 规则 | 当前实现 | 主规范依据 |
|------|---------|-----------|
| 异常必须上抛，不能静默吞掉 | `BaseTask.catch` 后 `throw err` | task-state-governance §2.1 |
| `activeTasks` 只登记真实运行任务 | `AccountSession.startTask` 确认后登记 | task-state-governance §2.1 |
| 自动回复绿点仅在 `isListening === 'listening'` 时亮 | `useAutoReply()` 返回 `isListening === 'listening'` | task-state-governance §3.1 |
| 状态必须按 `accountId` 隔离 | 所有 Store 使用 `contexts[accountId]` 结构 | task-state-governance §3.6 |
| 真实运行态判断必须基于运行状态而不是 UI 猜测 | `TaskStateManager` 统一从 Store 读取真实状态 | task-state-governance §3.2 |

### 4.3 订阅/会员规则

**【当前已对齐】**

| 规则 | 当前实现 | 主规范依据 |
|------|---------|-----------|
| 当前唯一套餐编码体系 | `trial / pro / pro_max / ultra` | SUBSCRIPTION_RULES §1.2 |
| 对外套餐名称体系 | Trial / Pro / ProMax / Ultra | SUBSCRIPTION_RULES §1.2 |
| 账号上限：Trial=1，Pro=1，ProMax=3，Ultra=不限 | `shared/planRules.data.json` max_accounts 配置 | SUBSCRIPTION_RULES §2.1 |
| 试用期为 3 天 | 后端数据库字段定义 | SUBSCRIPTION_RULES §1.2 |
| 试用期间全功能可用 | `AccessPolicy` 策略判断 | SUBSCRIPTION_RULES §3.1 |
| 不得重新引入 `basic / premium / promax` 作为当前正式编码 | `shared/planRules.ts` normalizePlan 处理兼容 | SUBSCRIPTION_RULES §6.1 |
| 前端显示、后端判权、状态管理、文档口径必须一致 | `AccessControl` 统一权限层 | SUBSCRIPTION_RULES §5.4 |

### 4.4 发布流程关键规则

**【当前已对齐】**

| 规则 | 当前实现 | 主规范依据 |
|------|---------|-----------|
| 生产 API 地址必须使用正式生产地址 | `scripts/release-guard.js` checkEnv 强制检查 | RELEASE_SPECIFICATION §3 |
| 已发布 tag 不覆盖 | `scripts/release-audit.js` 检查 tag 是否存在 | RELEASE_SPECIFICATION §4 |
| Release Guard 是发布前检查机制的重要组成部分 | `scripts/release-guard.js` 执行 BLOCKER/WARNING 检查 | RELEASE_SPECIFICATION §3 |
| 发布链路改动前必须先查 RELEASE_SPECIFICATION.md | 文档明确定义发布架构 | RELEASE_SPECIFICATION 全文 |

### 4.5 权限控制架构

**【当前已对齐】**

| 规则 | 当前实现 | 主规范依据 |
|------|---------|-----------|
| 权限检查统一通过权限控制层进行 | `checkAccess()` 为统一入口 | access-control-architecture §4 |
| 不允许在 UI、store、业务组件中再散落第二套套餐判权逻辑 | `gateStore` 和 UI 组件均使用 `useAccessCheck` | access-control-architecture §6 |
| 访问控制逻辑的统一入口必须保持唯一 | `AccessControl.ts` 提供 `checkAccess` 和 `useAccessCheck` | access-control-architecture §4 |

### 4.6 AI 改代码通用行为约束

**【当前已对齐】**

| 规则 | 说明 |
|------|------|
| 改代码前必须先查文档 | 违反此条的改动视为无效 |
| 禁止不读规范直接改 | 必须先读 docs/README.md 和对应主规范 |
| 禁止复制出第二份逻辑 | 发现已有逻辑应复用，不重写 |
| 禁止吞异常 | 异常必须上抛或明确处理 |
| 改规则必须同步文档 | 规则变化必须更新主规范 |
| 改核心逻辑必须补测试或给出明确回归验证方案 | 无验证的改动视为不完整 |

---

## 五、B 类规则（项目必须遵守）

**【项目必须遵守】**

以下规则是项目规范方向，AI 不得朝相反方向扩写:

### 5.1 试用状态处理

1. **试用状态应以后端最终状态为准**，前端不得长期缓存并覆盖后端结论
2. 前端可缓存试用状态用于 UI 优化，但必须以服务端返回为最终依据
3. 试用状态变更（激活/过期/升级）必须触发 `refreshUserStatus()`

### 5.2 套餐衍生规则

1. **数据保留期限等套餐衍生规则**，若文档已定义但代码未全面体现，后续 AI 不得朝相反方向扩写
2. 新增套餐相关功能时，必须明确该功能在各套餐中的权限配置
3. 套餐权限矩阵变化必须同步更新 `SUBSCRIPTION_RULES.md` 和 `AccessPolicy.ts`

### 5.3 直播状态检测

1. **关播后必须保持必要检测器持续运行**，以支持再次开播识别
2. `StreamStateDetector` 在关播时不得停止，除非明确要求断开中控台
3. 必须支持同一连接会话内多次 `live ↔ offline` 状态往返

### 5.4 发布流程收敛

1. **发布流程中的自动验证脚本、校验链路、风险拦截机制**，应持续朝主规范方向收敛
2. 新增发布检查项应优先写入 `RELEASE_SPECIFICATION.md`，再实现为脚本
3. 发布脚本的变化不得违反主规范定义的架构要求

### 5.5 改动影响声明

1. **任意涉及套餐、权限、状态机、发布链路的改动**，都必须先声明影响范围，再执行修改
2. 影响范围声明必须包括：影响模块、影响边界、不影响范围、前后端联动需求
3. 未声明影响范围的改动视为不完整

---

## 六、AI 改代码标准流程

### 6.1 改动前（必须执行）

**步骤 1: 查阅文档**
```
1. 读 docs/README.md
   → 了解文档分类体系
   → 确认需求属于哪类文档管辖

2. 读对应主规范文档
   → 了解业务规则
   → 了解技术约束
   → 了解验收标准

3. 读 docs/AI_GUARDRAILS.md
   → 了解 AI 改代码守则
   → 确认是否触碰红线
```

**步骤 2: 判断影响范围**
```
必须说明:
- 影响哪些模块
- 影响边界在哪里
- 不影响哪些范围

必须声明:
- 是否涉及前后端联动
- 是否需要文档同步更新
- 是否需要测试同步更新
```

**步骤 3: 确认红线**
```
若触碰以下红线，必须先获得确认:
- 中控台生命周期规则
- 任务状态治理规则
- 订阅/套餐/权限规则
- 发布流程关键约束
```

### 6.2 改动中（禁止行为）

**禁止**:
- 顺手修改与需求无关的红线规则
- 保留旧逻辑副本（应删除或迁移）
- 为了通过测试写硬编码
- 把临时调试逻辑混入正式实现
- 只改 UI 文案不核实真实逻辑
- 在多个层级散落重复判权逻辑

**必须**:
- 复用已有逻辑，不重写第二份
- 异常处理必须明确（上抛或处理）
- 状态变化必须同步更新 UI
- 接口变化必须声明契约变更

### 6.3 改动后（必须验收）

**检查清单**:
```
文档检查:
□ 主规范文档是否需要同步更新
□ docs/README.md 是否需要调整索引
□ 是否需要更新回归检查清单

测试检查:
□ 是否需要补自动化测试
□ 是否需要给出手工回归验证清单
□ 是否已执行回归验证

影响检查:
□ 是否影响发布流程
□ 是否影响配置文件
□ 是否影响接口契约
□ 是否影响数据结构

风险输出:
□ 列出风险点
□ 给出验收步骤
□ 说明回滚思路（如适用）
□ 说明是否有遗留项需要后续收口
```

---

## 七、哪些改动必须同步文档

**【强制要求】**

| 改动主题 | 必须更新的文档 | 更新时机 |
|---------|---------------|---------|
| 订阅/套餐/账号上限/试用规则 | `docs/SUBSCRIPTION_RULES.md` | 改动提交前 |
| 中控台生命周期（连接/关播/disconnect） | `docs/live-control-lifecycle-spec.md` | 改动提交前 |
| 任务状态治理（绿点/stopAll/状态隔离） | `docs/task-state-governance.md` | 改动提交前 |
| 权限架构（AccessControl/套餐权限） | `docs/access-control-architecture.md` | 改动提交前 |
| 发布流程/发布检查/构建配置 | `docs/RELEASE_SPECIFICATION.md` | 改动提交前 |
| 文档角色或入口关系调整 | `docs/README.md` | 改动提交前 |

**禁止**:
- 改动已提交但文档未更新
- 文档更新滞后于代码改动
- 只在代码注释中说明规则变化

---

## 八、哪些改动必须补测试或回归验证

**【强制要求】**

以下改动**必须**补充测试或回归验证:

### 8.1 中控台相关

- 中控台连接/断开逻辑改动
- 关播检测逻辑改动
- 开播识别逻辑改动
- 浏览器生命周期改动

**回归验证**: 必须执行 live-control-lifecycle-spec §7 定义的 7 个核心验收场景

### 8.2 任务状态相关

- 任务状态与真实运行态判断改动
- 绿点显示逻辑改动
- stopAll 行为改动
- 任务启动/停止逻辑改动

**回归验证**: 必须执行 task-state-governance §4 定义的验收清单

### 8.3 订阅/权限相关

- 订阅/套餐/试用/权限改动
- 套餐编码/套餐名称改动
- 账号上限判断改动
- 功能权限矩阵改动

**回归验证**: 必须执行 AUTH_REGRESSION_CHECKLIST.md 定义的认证回归检查

### 8.4 接口契约相关

- IPC 通道改动
- API 接口改动
- 数据结构改动
- 前后端通信协议改动

**回归验证**: 必须给出接口兼容性分析和回归测试方案

### 8.5 登录/认证流程相关

- 登录/注册/试用流程改动
- Token 管理改动
- 认证状态持久化改动

**回归验证**: 必须执行 REGRESSION_CHECKLIST.md 定义的登录链路回归

### 8.6 发布/更新链路相关

- 发布流程改动
- 自动更新逻辑改动
- 版本检查/下载/安装改动

**回归验证**: 必须执行 RELEASE_SPECIFICATION.md 定义的发布检查清单

### 8.7 无法补自动化测试的处理

若客观条件限制无法补充自动化测试，**必须**:
1. 给出手工回归验证清单
2. 明确验证步骤和预期结果
3. 记录技术债务，说明后续如何补自动化测试

**禁止**:
- 未验证即视为完成
- 只依赖"本地测试通过"
- 不给出明确验收方案

---

## 九、禁止行为清单

**【AI 改代码红线】**

以下行为**严格禁止**，违反的改动视为无效:

### 9.1 文档相关

- ❌ 不读规范直接改代码
- ❌ 用历史聊天记录替代主规范
- ❌ 用 archive 文档替代现行规范
- ❌ 改规则却不更新文档
- ❌ 发现代码与文档冲突时，未经核实直接选一边修改

### 9.2 代码质量相关

- ❌ 为了图快保留旧逻辑副本
- ❌ 在多个层级散落重复判权逻辑
- ❌ 为了通过测试写硬编码
- ❌ 把临时调试逻辑混入正式实现
- ❌ 吞异常（catch 后不处理也不上抛）

### 9.3 协作沟通相关

- ❌ 改接口却不声明前后端联动影响
- ❌ 只改 UI 文案，不核实业务真实逻辑
- ❌ 把"项目必须遵守"误写成"当前已全部实现"
- ❌ 不输出影响范围和风险点

### 9.4 架构红线相关

- ❌ 绕过 AccessControl 直接判断套餐权限
- ❌ 在 disconnect 逻辑中顺手关闭浏览器
- ❌ 在 stopAll 逻辑中修改连接状态
- ❌ 用"已配置"冒充"运行中"
- ❌ 跳过 accountId 直接读全局状态

---

## 十、AI 输出格式要求

**【强制要求】**

AI 每次完成改动后，**必须**输出以下信息:

```markdown
## 改动报告

### 1. 修改文件清单
- [文件路径 1] - [修改目的]
- [文件路径 2] - [修改目的]

### 2. 修改目的
[简要说明为什么要做这些修改]

### 3. 影响范围
- 影响模块：[列出受影响的模块]
- 影响边界：[说明影响的具体范围]
- 不影响范围：[说明明确不影响的范围]

### 4. 是否触碰项目红线
- [ ] 中控台生命周期规则
- [ ] 任务状态治理规则
- [ ] 订阅/套餐/权限规则
- [ ] 发布流程关键约束
- [ ] 无触碰

### 5. 是否更新文档
- [ ] 已更新 [文档名]
- [ ] 无需更新文档
- [ ] 需要后续更新 [说明原因]

### 6. 是否补测试 / 做了哪些验证
- [ ] 已补自动化测试 [测试文件]
- [ ] 已执行手工回归验证 [验证清单]
- [ ] 无需补测试 [说明原因]
- [ ] 技术债务：[说明后续如何补]

### 7. 风险点
- [风险点 1] - [风险等级：高/中/低]
- [风险点 2] - [风险等级：高/中/低]

### 8. 验收步骤
1. [验收步骤 1]
2. [验收步骤 2]
3. [验收步骤 3]

### 9. 是否存在需要后续继续收口的遗留项
- [ ] 无遗留项
- [ ] 有遗留项：[说明遗留内容和后续计划]
```

---

## 十一、文档风格要求

### 11.1 写作规范

**必须**:
- 使用结构化、明确、可执行的表述
- 使用"必须 / 禁止 / 允许 / 需要"等强约束措辞
- 每条规则标注【当前已对齐】或【项目必须遵守】
- 给出明确的代码文件路径和文档路径

**禁止**:
- 写空泛口号（如"提高代码质量"）
- 引用过期示例
- 使用模糊表述（如"应该"、"最好"）
- 混淆 A 类和 B 类规则

### 11.2 套餐编码规范

所有涉及套餐编码的示例**必须**统一使用:

```typescript
// ✅ 正确
'trial' | 'pro' | 'pro_max' | 'ultra'

// ❌ 错误
'trial' | 'pro' | 'promax' | 'ultra'  // promax 缺少下划线
'basic' | 'premium' | 'free'          // 已废弃命名
```

### 11.3 文档引用规范

引用文档时**必须**:
- 使用完整文件名（带.md 后缀）
- 给出具体章节号（如 §2.3）
- 使用相对路径（如 `./RELEASE_SPECIFICATION.md`）

---

## 十二、与主规范文档的关系

### 12.1 本文档角色

**本文档是**:
- 项目级 AI 变更守则
- AI 改代码前必读文档
- 约束 AI 如何遵守主规范的元规范

**本文档不是**:
- 不替代主规范文档
- 不是功能说明书
- 不是技术实现细节文档

### 12.2 文档使用流程

```
AI 接到需求
    │
    ▼
读 docs/README.md
    │
    ├─→ 发布相关 → 读 RELEASE_SPECIFICATION.md
    ├─→ 任务状态 → 读 task-state-governance.md
    ├─→ 权限/套餐 → 读 access-control-architecture.md + SUBSCRIPTION_RULES.md
    ├─→ 中控台 → 读 live-control-lifecycle-spec.md
    └─→ 其他 → 读对应主规范
    │
    ▼
读 docs/AI_GUARDRAILS.md
    │
    ▼
执行改动 → 输出改动报告
```

---

## 十三、版本历史

| 版本 | 日期 | 修改内容 |
|------|------|---------|
| v1.0 | 2026-03-18 | 初始版本，基于文档治理收尾后的当前状态 |

---

## 附录 A：快速查找表

### A.1 按主题查文档

| 需求主题 | 必读文档 |
|---------|---------|
| 发布/构建/CI/CD | RELEASE_SPECIFICATION.md |
| 任务状态/绿点/stopAll | task-state-governance.md |
| 权限/套餐/账号上限 | access-control-architecture.md + SUBSCRIPTION_RULES.md |
| 中控台/关播/连接 | live-control-lifecycle-spec.md |
| 登录/认证/试用 | access-control-architecture.md + AUTH_REGRESSION_CHECKLIST.md |
| 回归测试 | REGRESSION_CHECKLIST.md + 对应专项清单 |

### A.2 红线规则速查

**改代码前快速自检**:

- [ ] 我是否读了 docs/README.md？
- [ ] 我是否读了对应主规范？
- [ ] 我是否了解影响范围？
- [ ] 我是否触碰了红线规则？
- [ ] 我是否需要更新文档？
- [ ] 我是否需要补测试？
- [ ] 我是否输出了改动报告？

---

**文档维护**: 技术团队  
**下次评审**: 2026-04-18  
**文档状态**: ✅ 正式规范
