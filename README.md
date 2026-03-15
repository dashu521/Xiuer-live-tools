# 秀儿直播助手

> **版本**: v1.2.1
> **最后更新**: 2026-03-14
> **状态**: 当前有效
> **负责人**: TEAM
> **当前适用性**: 项目总入口文档

---

专业的直播带货助手工具，支持多平台直播间管理与自动化运营。

## 产品简介

秀儿直播助手是一款专为直播带货从业者设计的高效工具集，提供智能化的直播间管理、自动回复、商品弹窗等功能，帮助主播和运营团队提升直播效率与转化效果。

## 核心功能

### 多平台支持
- 抖音小店 / 巨量百应 / 抖音团购
- 小红书 / 视频号 / 快手小店 / 淘宝直播
- 统一管理多个平台账号，独立运行互不干扰

### 智能消息管理
- **自动发言**：预设消息模板，支持变量随机组合，告别重复机械喊话
- **快捷键弹窗**：一键触发商品讲解弹窗，支持全局快捷键
- **置顶管理**：重要评论置顶显示（平台支持）

### AI 自动回复
- **实时监听**：捕捉直播间评论互动，自动生成回复内容
- **关键词回复**：自定义关键词规则，精准回复用户问题
- **AI 智能助理**：接入 DeepSeek、OpenRouter、硅基流动等主流 AI 服务
- **多平台适配**：抖音小店、巨量百应、视频号、小红书

### 商品自动讲解
- 智能商品弹窗，随心所欲触发讲解
- 支持多商品快捷键映射
- 提升商品曝光与转化率

### 高级功能
- **多账号管理**：支持多组账号配置，针对不同直播间使用不同策略
- **WebSocket 服务**：实时数据广播，支持第三方集成
- **开发者模式**：开放开发者工具，便于定制调试

## 下载安装

### 正式下载入口

**对外统一入口**：https://download.xiuer.work/

| 平台 | 下载地址 | 适用系统 |
|------|----------|----------|
| Windows | [下载 Windows 版](https://download.xiuer.work/releases/latest/Xiuer-Live-Assistant_1.3.2_win-x64.exe) | Windows 10/11 64位 |
| macOS Apple 芯片 | [下载 Apple 芯片版](https://download.xiuer.work/releases/latest/Xiuer-Live-Assistant_1.3.2_macos_arm64.dmg) | M1/M2/M3/M4 Mac |
| macOS Intel | [下载 Intel 版](https://download.xiuer.work/releases/latest/Xiuer-Live-Assistant_1.3.2_macos_x64.dmg) | Intel 处理器 Mac |

> **安装提示**：
> - Windows：如果浏览器提示风险，请点击"保留"或"更多信息"→"仍要运行"
> - macOS：如果提示"无法打开"，请前往 系统设置 → 隐私与安全性 → 点击"仍要打开"

## 系统要求

- **操作系统**：Windows 10 及以上（推荐 Windows 11）/ macOS 11 及以上
- **浏览器**：Chrome 或 Edge 浏览器（最新版本）
- **平台权限**：账号需具备相应平台的中控台访问权限
- **Node.js**：>= 20.0.0
- **npm**：>= 10.0.0

## 开发环境

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建应用

```bash
# 仅构建，不打包
npm run build

# 构建并打包（本地测试）
npm run build-exe

# 完整构建并打包（用于发布）
npm run dist
```

### 运行测试

```bash
npm test
```

## 项目结构

```
├── electron/           # Electron 主进程代码
│   ├── main/          # 主进程业务逻辑
│   └── preload/       # 预加载脚本
├── src/               # 渲染进程代码 (React + TypeScript)
│   ├── components/    # UI 组件
│   ├── pages/         # 页面组件
│   ├── hooks/         # 自定义 Hooks
│   └── utils/         # 工具函数
├── shared/            # 共享类型和常量
├── auth-api/          # 认证后端服务 (Python/FastAPI)
├── docs/              # 文档
└── scripts/           # 构建和发布脚本
```

## 构建命令说明

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run build-exe` | 构建并打包为可执行文件（本地测试） |
| `npm run dist` | 完整构建并打包（用于发布） |
| `npm run dist:clean` | 清理发布目录 |
| `npm test` | 运行测试 |

---

## 文档索引（唯一可信来源）

> **重要说明**：以下文档为当前有效的唯一可信来源。审计报告不是最终规范，最终行为以主规范和当前代码为准。

### 核心规范文档

| 文档 | 职责 | 状态 |
|------|------|------|
| [README.md](README.md) | 项目总入口 | 当前有效 |
| [docs/project-architecture-foundation.md](docs/project-architecture-foundation.md) | 全仓库架构总规范 | 已固化 |
| [docs/architecture-change-checklist.md](docs/architecture-change-checklist.md) | 架构变更提交前检查清单 | 已固化 |
| [docs/live-control-lifecycle-spec.md](docs/live-control-lifecycle-spec.md) | 中控台/直播状态规范 | 已固化 |
| [docs/access-control-architecture.md](docs/access-control-architecture.md) | 权限与套餐架构 | 已固化 |
| [docs/HIGH_RISK_FILES.md](docs/HIGH_RISK_FILES.md) | 高风险文件准入清单 | 当前有效 |
| [docs/ENVIRONMENT_DIFFERENCES.md](docs/ENVIRONMENT_DIFFERENCES.md) | 环境差异说明 | 已固化 |
| [docs/REGRESSION_CHECKLIST.md](docs/REGRESSION_CHECKLIST.md) | 回归验证清单 | 当前有效 |

### 敏感主题唯一规范源

| 主题 | 唯一规范源 |
|------|-----------|
| 全仓库架构边界 | [docs/project-architecture-foundation.md](docs/project-architecture-foundation.md) |
| 架构变更提交流程 | [docs/architecture-change-checklist.md](docs/architecture-change-checklist.md) |
| Windows 关闭行为 | [docs/live-control-lifecycle-spec.md](docs/live-control-lifecycle-spec.md) §2.5 |
| second-instance 处理 | [docs/live-control-lifecycle-spec.md](docs/live-control-lifecycle-spec.md) |
| 直播生命周期 | [docs/live-control-lifecycle-spec.md](docs/live-control-lifecycle-spec.md) |
| 套餐/权限上下文 | [docs/access-control-architecture.md](docs/access-control-architecture.md) |
| 环境差异 | [docs/ENVIRONMENT_DIFFERENCES.md](docs/ENVIRONMENT_DIFFERENCES.md) |

### 历史归档文档

> ⚠️ **注意**：`docs/archive/` 中的文档**仅供历史参考，不作为当前实现依据**。

- `docs/archive/package-diagnosis/` - 打包问题诊断历史
- `docs/archive/regression-fix/` - 回归修复历史
- `docs/archive/healthchecks/` - 健康检查历史
- `docs/archive/implementation-reports/` - 实现报告历史

### 文档治理规则

详见 [docs/DOC_GOVERNANCE.md](docs/DOC_GOVERNANCE.md)

---

## 首发版本

**v1.2.1** - 首发版本

- 完成基础框架整理
- 统一项目命名为「秀儿直播助手」
- 支持多平台直播中控台连接
- 实现自动发言、自动弹窗、自动回复功能
- 集成 AI 智能回复能力
- 支持多账号管理与数据隔离

## 技术支持

- **官方网站**：https://xiuer.live
- **技术支持**：support@xiuer.live
- **用户手册**：详见应用内帮助文档

## AI Rules

本项目 AI 协作规则位于：

```
docs/ai-rules/
```

其中包含：

- **四阶段问题修复流程** - 规范化问题修复流程，避免 AI 直接修改代码导致问题扩大

使用方式：

```
引用规则：四阶段问题修复流程
问题：
【问题描述】
```

## 许可证

本项目遵循 MIT 许可证开源。

---

© 2025-2026 秀儿直播助手团队. 保留所有权利。
