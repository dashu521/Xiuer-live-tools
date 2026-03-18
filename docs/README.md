# 秀儿直播助手 - 文档中心

本文档索引帮助您快速定位所需文档。

---

## 📋 文档分类

### 主规范文档

定义系统架构、设计原则和规范要求的权威文档。

| 文档 | 说明 | 相关文档 |
|------|------|----------|
| [RELEASE_SPECIFICATION.md](./RELEASE_SPECIFICATION.md) | 发布规范 v2.4 | SOP_MINIMAL, TROUBLESHOOTING |
| [task-state-governance.md](./task-state-governance.md) | 任务状态治理规范 | task-state-regression-checklist |
| [access-control-architecture.md](./access-control-architecture.md) | 访问控制架构 | AUTH_REGRESSION_CHECKLIST |
| [live-control-lifecycle-spec.md](./live-control-lifecycle-spec.md) | 中控台生命周期规范 | - |
| [SUBSCRIPTION_RULES.md](./SUBSCRIPTION_RULES.md) | 订阅与会员规则 | - |

### 操作文档

指导具体操作的步骤说明文档。

| 文档 | 说明 | 适用场景 |
|------|------|----------|
| [RELEASE_SOP_MINIMAL.md](./RELEASE_SOP_MINIMAL.md) | 最简发布 SOP | 执行发布操作 |
| [SMS_SETUP.md](./SMS_SETUP.md) | 短信服务配置 | 配置短信验证码 |
| [CDN_SETUP_GUIDE.md](./CDN_SETUP_GUIDE.md) | CDN 配置指南 | 配置下载加速 |
| [ADMIN_PRODUCTION_DEPLOYMENT.md](./ADMIN_PRODUCTION_DEPLOYMENT.md) | 管理后台部署 | 部署管理后台 |
| [deploy/README.md](./deploy/README.md) | 部署目录说明 | 了解部署结构 |

### 排障文档

问题排查和故障处理的参考文档。

| 文档 | 说明 | 适用场景 |
|------|------|----------|
| [RELEASE_TROUBLESHOOTING.md](./RELEASE_TROUBLESHOOTING.md) | 发布失败处理 | 发布过程出错 |
| [SMS_TROUBLESHOOTING.md](./SMS_TROUBLESHOOTING.md) | 短信排障指南 | 收不到验证码 |

### 回归检查文档

用于验证功能稳定性的检查清单。

| 文档 | 说明 | 适用场景 |
|------|------|----------|
| [task-state-regression-checklist.md](./task-state-regression-checklist.md) | 任务状态回归检查 | 任务相关代码修改后 |
| [AUTH_REGRESSION_CHECKLIST.md](./AUTH_REGRESSION_CHECKLIST.md) | 认证回归检查 | 认证相关代码修改后 |
| [REGRESSION_CHECKLIST.md](./REGRESSION_CHECKLIST.md) | 通用回归检查 | 待确认内容 |

### 历史归档文档

记录历史事件、审计和修复过程的文档，仅作参考。

| 目录 | 内容 |
|------|------|
| [archive/2026-03-release-audit/](./archive/2026-03-release-audit/) | 2026年3月发布评估历史 |
| [archive/2026-03-sms-fix/](./archive/2026-03-sms-fix/) | 2026年3月短信修复历史 |
| [archive/security-audit/](./archive/security-audit/) | 安全审计历史 |
| [archive/regression-fix/](./archive/regression-fix/) | 回归修复历史 |
| [archive/implementation-reports/](./archive/implementation-reports/) | 实现报告历史 |

---

## ⚠️ 文档状态说明

### 已降级文档（待合并/删除）

以下文档内容已被其他主文档覆盖，建议查阅主文档：

- `RELEASE_PROCESS.md` → 请查阅 [RELEASE_SPECIFICATION.md](./RELEASE_SPECIFICATION.md) 和 [RELEASE_SOP_MINIMAL.md](./RELEASE_SOP_MINIMAL.md)
- `SMS_PRODUCTION_DEPLOYMENT.md` → 请查阅 [SMS_SETUP.md](./SMS_SETUP.md)
- `access-control-guidelines.md` → 请查阅 [access-control-architecture.md](./access-control-architecture.md)

### 待确认文档

以下内容需人工确认是否保留：

- `ONLINE_UPDATE_TASKS.md` - 实现在线更新过程中的任务清单
- `REGRESSION_CHECKLIST.md` - 需确认是否与 task-state-regression-checklist 重复

---

## 🔍 按主题查找

### 发布相关
1. 了解规范 → [RELEASE_SPECIFICATION.md](./RELEASE_SPECIFICATION.md)
2. 执行发布 → [RELEASE_SOP_MINIMAL.md](./RELEASE_SOP_MINIMAL.md)
3. 发布失败 → [RELEASE_TROUBLESHOOTING.md](./RELEASE_TROUBLESHOOTING.md)

### 任务状态相关
1. 了解治理 → [task-state-governance.md](./task-state-governance.md)
2. 回归测试 → [task-state-regression-checklist.md](./task-state-regression-checklist.md)

### 认证相关
1. 了解架构 → [access-control-architecture.md](./access-control-architecture.md)
2. 回归测试 → [AUTH_REGRESSION_CHECKLIST.md](./AUTH_REGRESSION_CHECKLIST.md)

### 短信相关
1. 了解配置 → [SMS_SETUP.md](./SMS_SETUP.md)
2. 排查问题 → [SMS_TROUBLESHOOTING.md](./SMS_TROUBLESHOOTING.md)

---

**最后更新**：2026-03-18
