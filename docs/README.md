# 秀儿直播助手 - 文档中心

本文档索引帮助您快速定位所需文档。

---

## 📋 文档分类体系

### 主规范文档（权威定义）

定义系统架构、设计原则和规范要求的权威文档。其他文档如有冲突，以此类文档为准。

| 文档 | 管什么 | 不管什么 | 与谁互补 | 权威等级 |
|------|--------|----------|----------|----------|
| [RELEASE_SPECIFICATION.md](./RELEASE_SPECIFICATION.md) | 发布架构、构建规范、环境要求、发布检查清单 | 具体操作命令、失败处理细节 | RELEASE_SOP_MINIMAL（操作）、RELEASE_TROUBLESHOOTING（排障） | **唯一权威** |
| [task-state-governance.md](./task-state-governance.md) | 任务状态定义、治理规则、状态流转、修复记录 | 具体操作步骤、回归测试方法 | task-state-regression-checklist（回归检查） | **唯一权威** |
| [access-control-architecture.md](./access-control-architecture.md) | 权限控制架构、AccessContext、策略定义、套餐权限实现 | 套餐定价、支付流程 | SUBSCRIPTION_RULES（套餐定义）、AUTH_REGRESSION_CHECKLIST（回归检查） | **唯一权威** |
| [live-control-lifecycle-spec.md](./live-control-lifecycle-spec.md) | 中控台连接生命周期、状态流转、连接管理 | 任务执行细节、权限控制 | task-state-governance（任务治理） | **唯一权威** |
| [SUBSCRIPTION_RULES.md](./SUBSCRIPTION_RULES.md) | 套餐定义（Trial/Pro/ProMax/Ultra）、权限矩阵、UI映射、前后端一致性要求 | 支付实现细节、退款流程、定价策略 | access-control-architecture（权限实现） | **唯一权威** |

### 操作文档（SOP）

指导具体操作的步骤说明文档。依赖主规范文档中的定义。

| 文档 | 管什么 | 不管什么 | 依赖主规范 | 权威等级 |
|------|--------|----------|------------|----------|
| [RELEASE_SOP_MINIMAL.md](./RELEASE_SOP_MINIMAL.md) | 发布操作步骤、命令清单、执行顺序 | 架构设计、失败处理 | RELEASE_SPECIFICATION | **当前有效SOP** |
| [SMS_SETUP.md](./SMS_SETUP.md) | 短信服务配置（开发/生产）、阿里云配置、验收标准 | 短信发送逻辑实现、故障排查 | - | **当前有效SOP** |
| [CDN_SETUP_GUIDE.md](./CDN_SETUP_GUIDE.md) | CDN配置、OSS同步、下载加速 | 发布流程、构建规范 | RELEASE_SPECIFICATION | **当前有效SOP** |
| [ADMIN_PRODUCTION_DEPLOYMENT.md](./ADMIN_PRODUCTION_DEPLOYMENT.md) | 管理后台部署步骤、环境配置 | 业务逻辑、权限规则 | - | **当前有效SOP** |
| [deploy/README.md](./deploy/README.md) | 部署目录结构、部署脚本说明 | 具体部署操作 | - | **当前有效SOP** |

### 排障文档

问题排查和故障处理的参考文档。基于主规范和SOP的异常处理。

| 文档 | 管什么 | 不管什么 | 依赖文档 | 权威等级 |
|------|--------|----------|----------|----------|
| [RELEASE_TROUBLESHOOTING.md](./RELEASE_TROUBLESHOOTING.md) | 发布失败场景、处理方案、决策树 | 正常发布流程 | RELEASE_SPECIFICATION, SOP_MINIMAL | **当前有效排障** |
| [SMS_TROUBLESHOOTING.md](./SMS_TROUBLESHOOTING.md) | 短信发送失败排查、常见问题 | 正常配置流程 | SMS_SETUP | **当前有效排障** |

### 回归检查文档

用于验证功能稳定性的检查清单。在修改相关代码后执行。

| 文档 | 管什么 | 不管什么 | 依赖主规范 | 权威等级 |
|------|--------|----------|------------|----------|
| [task-state-regression-checklist.md](./task-state-regression-checklist.md) | 任务状态功能回归测试（启动/停止/开播自动/失败后重试） | 登录链路、跨平台测试 | task-state-governance | **当前有效回归检查** |
| [AUTH_REGRESSION_CHECKLIST.md](./AUTH_REGRESSION_CHECKLIST.md) | 认证功能回归测试（登录/权限/套餐） | 任务状态、直播连接 | access-control-architecture, SUBSCRIPTION_RULES | **当前有效回归检查** |
| [REGRESSION_CHECKLIST.md](./REGRESSION_CHECKLIST.md) | 通用回归检查（登录链路、直播连接、浏览器、跨平台、性能） | 任务状态专项测试 | - | **当前有效回归检查** |

> **说明**: REGRESSION_CHECKLIST.md 与 task-state-regression-checklist.md 角色不同，前者为通用回归检查，后者为任务状态专项回归检查，两者互补，均保留。

### 执行清单文档

实现任务的工作清单，用于跟踪开发进度。**不是规范文档**，仅作为开发过程中的任务跟踪工具。

| 文档 | 用途 | 性质 | 权威等级 |
|------|------|------|----------|
| [ONLINE_UPDATE_TASKS.md](./ONLINE_UPDATE_TASKS.md) | 在线更新功能实现任务清单（Phase 1/2/3） | **执行清单/任务跟踪** | 非规范，仅供参考 |

> **说明**: ONLINE_UPDATE_TASKS.md 是开发过程中的任务跟踪清单，不是主规范文档。了解在线更新的架构规范请查阅 [RELEASE_SPECIFICATION.md](./RELEASE_SPECIFICATION.md)。

### AI 改代码守则

AI 代理修改代码前必须阅读的元规范文档，约束 AI 如何遵守主规范。

| 文档 | 用途 | 性质 | 权威等级 |
|------|------|------|----------|
| [AI_GUARDRAILS.md](./AI_GUARDRAILS.md) | 项目级 AI 改代码守则（行为边界、文档查阅顺序、禁止行为清单） | **元规范/AI 行为约束** | **AI 必须遵守** |

> **说明**: AI_GUARDRAILS.md 不替代主规范文档，而是约束 AI 如何正确查阅和遵守主规范。所有 AI 代理与代码助手改代码前必须先读本文档。

### 历史归档文档

记录历史事件、审计和修复过程的文档，**仅作参考，不作为当前规范依据**。

| 目录 | 内容类型 | 时间范围 | 状态 |
|------|----------|----------|------|
| [archive/2026-03-release-audit/](./archive/2026-03-release-audit/) | 发布评估、修复报告 | 2026-03 | 仅历史参考 |
| [archive/2026-03-sms-fix/](./archive/2026-03-sms-fix/) | 短信服务修复记录 | 2026-03 | 仅历史参考 |
| [archive/security-audit/](./archive/security-audit/) | 安全审计报告 | 历史 | 仅历史参考 |
| [archive/regression-fix/](./archive/regression-fix/) | 回归修复记录 | 历史 | 仅历史参考 |
| [archive/implementation-reports/](./archive/implementation-reports/) | 功能实现报告 | 历史 | 仅历史参考 |

---

## ⚠️ 已废弃/已合并文档

以下文档内容已被主文档吸收，不再维护：

| 原文档 | 处理方式 | 内容并入 | 删除时间 |
|--------|----------|----------|----------|
| `RELEASE_PROCESS.md` | 已删除 | RELEASE_SPECIFICATION.md（检查清单、故障排除） | 2026-03-18 |
| `SMS_PRODUCTION_DEPLOYMENT.md` | 已删除 | SMS_SETUP.md（生产环境强制配置） | 2026-03-18 |
| `access-control-guidelines.md` | 已删除 | access-control-architecture.md（内容完全覆盖） | 2026-03-18 |

---

## 🔍 按主题快速查找

### 发布主题
```
了解架构要求 → RELEASE_SPECIFICATION.md（主规范）
执行发布操作 → RELEASE_SOP_MINIMAL.md（SOP）
发布失败处理 → RELEASE_TROUBLESHOOTING.md（排障）
```

### 任务状态主题
```
了解治理规范 → task-state-governance.md（主规范）
回归测试验证 → task-state-regression-checklist.md（回归检查）
```

### 认证/权限/套餐主题
```
了解套餐规则 → SUBSCRIPTION_RULES.md（主规范）
了解权限架构 → access-control-architecture.md（主规范）
回归测试验证 → AUTH_REGRESSION_CHECKLIST.md（回归检查）
```

### 短信服务主题
```
了解配置方法 → SMS_SETUP.md（SOP）
排查发送问题 → SMS_TROUBLESHOOTING.md（排障）
```

### 中控台主题
```
了解生命周期 → live-control-lifecycle-spec.md（主规范）
```

---

## 📖 文档使用原则

1. **先查主规范**：了解架构设计和规范要求（RELEASE_SPECIFICATION, task-state-governance, access-control-architecture, live-control-lifecycle-spec, SUBSCRIPTION_RULES）
2. **再查SOP**：获取具体操作步骤（RELEASE_SOP_MINIMAL, SMS_SETUP, CDN_SETUP_GUIDE）
3. **出问题查排障**：根据现象定位解决方案（RELEASE_TROUBLESHOOTING, SMS_TROUBLESHOOTING）
4. **修改后做回归**：使用回归检查清单验证（task-state-regression-checklist, AUTH_REGRESSION_CHECKLIST, REGRESSION_CHECKLIST）
5. **历史文档仅参考**：archive目录文档不作为当前依据

---

## 📝 文档维护

- **主规范文档**：变更需经过产品+技术评审
- **SOP文档**：随工具/流程更新而更新
- **排障文档**：随新问题发现而补充
- **回归检查文档**：随功能变更而更新
- **历史归档文档**：归档后不再修改

---

**最后更新**：2026-03-18
**文档版本**：v3.0
