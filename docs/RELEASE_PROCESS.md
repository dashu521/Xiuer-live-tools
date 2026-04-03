# 秀儿直播助手 - 发布流程指南

> **重要提示**：本流程遵循 [RELEASE_SPECIFICATION.md](./RELEASE_SPECIFICATION.md) 中的三层发布结构：
> - **A. 本地测试构建**：任何 Mac 均可，无需证书
> - **B. 正式发布构建**：需要 Apple 开发者证书
> - **C. 推荐环境**：本地 Mac 构建 macOS，GitHub Actions 构建 Windows

## 📋 发布架构

```
┌─────────────────────────────────────────────────────────────┐
│                     发布架构概览                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐         ┌──────────────────────┐         │
│  │  本地 Mac    │         │   GitHub Actions     │         │
│  │  (任意 Mac)  │         │   (windows-latest)   │         │
│  └──────┬───────┘         └──────────┬───────────┘         │
│         │                            │                     │
│         ▼                            ▼                     │
│  ┌──────────────┐         ┌──────────────────────┐         │
│  │  macOS 安装包 │         │   Windows 安装包     │         │
│  │     .dmg     │         │   .exe / .zip        │         │
│  └──────┬───────┘         └──────────┬───────────┘         │
│         │                            │                     │
│         └────────────┬───────────────┘                     │
│                      ▼                                      │
│           ┌────────────────────┐                           │
│           │   GitHub Releases   │                           │
│           │  统一分发平台       │                           │
│           └────────────────────┘                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

注：本地 Mac 可以是任何 Apple Silicon 或 Intel Mac，不限于特定机型。
     测试构建无需证书，正式发布构建需要 Apple Developer ID。
```

## 🚀 安全版一键发布流程（推荐）

## ✅ 发布改进清单（v1.6.1 后固化）

以下清单用于避免再次出现“tag 已发出，但 CI 或 Windows 构建稍后才暴露问题”的情况。

### 1. 合并策略

- 大功能继续拆分后再合并到 `main`
- 高风险能力不要和稳定性修复放在同一个发布包里
- 发版前先确认 `main` 只包含本次计划发布内容

### 2. 发版时序

- 先推送 `main`
- 等 `Quality Gate` 变绿
- 再确认 Windows 工作流没有明显阻塞项
- 最后再创建正式 tag
- 不要再采用“先打 tag，再看 CI”的顺序

### 3. 版本准备

- 升版本号
- 生成并人工润色 `release-notes`
- 提交 `chore: prepare release vX.Y.Z`
- 运行 `npm run release:guard`

### 4. 本地验证

- `npm run typecheck`
- `npm test -- --run`
- 必要时补一次关键页面 smoke test
- 构建后确认生产 API 地址没有回退到 `localhost`

### 5. CI 稳定性

- 定期运行 `npm audit`
- 依赖漏洞尽量在日常开发阶段处理，不要等到发版再暴露
- Windows 构建工作流保持：
  - `npm ci`
  - npm cache
  - 安装失败重试

### 6. 脚本可靠性

- 一键发布脚本的退出状态必须和真实结果一致
- 发现“子检查通过但主脚本误判失败”时，应优先修复脚本，不要继续依赖人工判断

### 7. Release 资产核对

- 检查 GitHub Release 是否包含：
  - `latest.yml`
  - `latest-mac.yml`
  - mac x64 dmg
  - mac arm64 dmg
  - Windows exe
  - Windows zip
  - 对应 blockmap
- 再核对 `latest.yml` / `latest-mac.yml` 中的文件名和大小是否与 Release 资产一致

### 8. 热修复原则

- 已发布 tag 出现问题时，优先发 `x.y.z+1`
- 不改写旧 tag
- 热修复版本只包含最小必要改动

### 最值得优先遵守的 3 条

1. 先等 CI 绿，再打 tag
2. 发版前固定执行 Release 资产完整性检查
3. 把依赖审计问题前置到日常开发，而不是在发版当天修

### 五阶段发布流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     安全版一键发布流程                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  第一阶段: npm run publish                                       │
│  ├─ 执行 release:audit          [自动] 检查发布前置条件         │
│  ├─ 执行 release:guard          [自动] 阻断检查                 │
│  ├─ 执行 release                [自动] 本地构建 macOS 安装包    │
│  ├─ 执行 release:notes          [自动] 生成 Release Notes       │
│  └─ 校验本地 mac 产物            [自动] 不写 GitHub Release      │
│                              ↓                                  │
│  第二阶段: npm run publish:confirm                               │
│  ├─ 推送 main 分支              [自动]                          │
│  ├─ 创建 / 推送 tag             [自动]                          │
│  └─ 创建 draft GitHub Release   [自动] 作为统一汇总点           │
│                              ↓                                  │
│  第三阶段: npm run publish:orchestrate                           │
│  ├─ 上传本地 mac 产物           [自动/按需]                     │
│  ├─ 触发 Mac OSS 同步           [自动/按需]                     │
│  └─ 等待缺失动作收敛            [自动]                          │
│                              ↓                                  │
│  第四阶段: Windows CI                                             │
│  ├─ 构建 Windows 安装包        [自动]                           │
│  ├─ 上传到 draft Release       [自动]                           │
│  └─ 同步 Windows 到 OSS/CDN    [自动]                           │
│                              ↓                                  │
│  第五阶段: npm run publish:verify                                │
│  ├─ 纯检查 GitHub Actions      [自动]                           │
│  ├─ 纯检查 Release 资产        [自动]                           │
│  └─ 纯检查 CDN 与自动更新链路   [自动]                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 快速开始

#### 第一阶段：准备发布

```bash
export VITE_AUTH_API_BASE_URL=https://auth.xiuer.work
npm run publish
```

**说明：**
- 构建 macOS 安装包
- 生成 Release Notes
- 校验本地 mac 产物
- **不会**自动推 tag，也不会写 GitHub Release

#### 第二阶段：确认发布

```bash
npm run publish:confirm
```

**说明：**
- 检查 git 工作区干净
- 检查 tag 不存在
- 先确认 `main` 已推送且 `Quality Gate` 已变绿
- 创建并推送 tag
- 创建 / 更新 draft GitHub Release
- 触发 GitHub Actions Windows 构建
- **这是不可撤销的操作**

#### 第三阶段：编排并行动作

```bash
npm run publish:orchestrate
```

**说明：**
- 若 Release 已存在且本地 mac 产物已就绪，则上传 mac 资产
- 若 mac Release 资产已齐，但 CDN 未同步，则触发 `Upload Mac to OSS`
- 这是编排脚本，不是最终验收脚本

#### 第四阶段：纯验收检查

等待 5-10 分钟后：

```bash
npm run publish:verify
```

**说明：**
- 检查 Windows CI 构建状态
- 验证 Release 资产完整性
- 验证 CDN 与自动更新链路
- **不会触发任何写操作**

---

## 🎯 发布前准备

### 1. 环境检查

确保已安装：
- Node.js >= 20.0.0
- npm >= 10.0.0
- Git
- GitHub CLI (`gh`)
- macOS 11 及以上（任意 Mac 均可，不限机型）

**关于证书**：
- **测试构建**：无需 Apple 开发者证书，生成未签名应用
- **正式发布**：需要 Apple Developer ID 证书进行签名和公证

### 2. 环境变量

**【发布规范】正式发布必须显式注入 HTTPS 生产 API 地址和主进程安全存储密钥。**

```bash
# 生产环境 API 地址（HTTPS）
export VITE_AUTH_API_BASE_URL=https://auth.xiuer.work
export AUTH_STORAGE_SECRET=$(openssl rand -hex 32)
```

#### 强制要求

| 要求 | 说明 |
|------|------|
| 正式发布必须显式设置 | 未设置时 Release Guard 会拦截发布 |
| 禁止使用 localhost | localhost/127.0.0.1 会被 Release Guard 拦截 |
| 必须设置 AUTH_STORAGE_SECRET | 未设置时构建脚本和 Release Guard 会双重拦截 |
| 禁止 fallback 进入发布包 | 代码中的 fallback 仅用于开发调试 |

#### Release Guard 拦截规则

| 检查项 | 级别 | 行为 |
|--------|------|------|
| `VITE_AUTH_API_BASE_URL` 未设置 | BLOCKER | 阻止发布 |
| `VITE_AUTH_API_BASE_URL` 包含 localhost | BLOCKER | 阻止发布 |
| `VITE_AUTH_API_BASE_URL` 包含 127.0.0.1 | BLOCKER | 阻止发布 |
| `AUTH_STORAGE_SECRET` 未设置 | BLOCKER | 阻止发布 |

详见 [RELEASE_SPECIFICATION.md](./RELEASE_SPECIFICATION.md) 中的"生产环境 API 地址固化规范"章节。

### 3. 发布前审计

```bash
npm run release:audit
```

此命令会检查：
- Git 状态
- .gitignore 配置
- Git 跟踪文件
- API 地址配置
- 安全存储密钥配置
- Publish 配置

---

## 📝 传统发布流程（备用）

如需手动控制每个步骤，可使用以下传统流程：

### 详细步骤

#### 步骤 1：发布前审计（人工）

```bash
npm run release:audit
```

检查 Git 状态、配置、API 地址等。

#### 步骤 2：本地构建 macOS（人工）

```bash
export VITE_AUTH_API_BASE_URL=https://auth.xiuer.work
npm run release
```

构建 macOS 安装包，自动执行阻断检查。

#### 步骤 3：本地测试（人工）

```bash
open "release/1.3.3"  # 替换为实际版本号
```

安装并测试 macOS 安装包。

#### 步骤 4：生成 Release Notes（自动）

```bash
npm run release:notes
```

自动生成 `release-notes/v1.3.3.md`，包含分类的更新日志。

#### 步骤 5：推送 Tag（人工）

```bash
git tag v1.3.3
git push origin v1.3.3
```

推送 tag 后自动触发：
- GitHub Actions Windows 构建
- Windows 产物自动上传到 GitHub Release

#### 步骤 6：上传 Mac 产物（自动）

等待 Windows 构建完成后，执行：

```bash
npm run upload:mac
```

自动上传 Mac 产物到同一 Release。

---

## 📦 Release 页面文件清单

推送 tag 并完成上传后，GitHub Release 将包含：

| 文件 | 来源 | 上传方式 |
|------|------|----------|
| `Xiuer-Live-Assistant_1.3.3_macos_x64.dmg` | 本机构建 | `npm run upload:mac` |
| `Xiuer-Live-Assistant_1.3.3_macos_arm64.dmg` | 本机构建 | `npm run upload:mac` |
| `Xiuer-Live-Assistant_1.3.3_win-x64.exe` | GitHub Actions | 自动上传 |
| `Xiuer-Live-Assistant_1.3.3_win-x64.zip` | GitHub Actions | 自动上传 |
| `latest-mac.yml` | 本机构建 | `npm run upload:mac` |
| `latest.yml` | GitHub Actions | 自动上传 |
| `*.blockmap` | 自动 | 自动上传 |

---

## ⚠️ 常见失败原因

### 1. Git 工作区不干净

**错误信息**：`Git 工作区存在未提交修改`

**解决方案**：
```bash
git add .
git commit -m "chore: prepare release v1.3.3"
```

### 2. 未设置 VITE_AUTH_API_BASE_URL

**错误信息**：`VITE_AUTH_API_BASE_URL 未设置`

**解决方案**：
```bash
export VITE_AUTH_API_BASE_URL=https://auth.xiuer.work
```

### 3. 未设置 AUTH_STORAGE_SECRET

**错误信息**：`AUTH_STORAGE_SECRET must be set`

**解决方案**：
```bash
export AUTH_STORAGE_SECRET=$(openssl rand -hex 32)
```

### 4. Remote 错误

**错误信息**：`Origin URL 错误`

**检查**：
```bash
git remote -v
```

应显示：
```
origin  https://github.com/Xiuer-Chinese/Xiuer-live-tools.git (fetch)
origin  https://github.com/Xiuer-Chinese/Xiuer-live-tools.git (push)
```

### 4. 构建目录被 Git 跟踪

**错误信息**：`发现被 Git 跟踪的禁止文件`

**解决方案**：
```bash
# 从 Git 中移除但保留文件
git rm -r --cached release/ dist/ dist-electron/
git commit -m "chore: remove build dirs from git tracking"
```

### 5. 数据库被跟踪

**错误信息**：`*.db 被 Git 跟踪`

**解决方案**：
```bash
git rm --cached *.db *.sqlite *.sqlite3
git commit -m "chore: remove database files from git tracking"
```

### 6. Localhost 风险

**警告信息**：`发现高风险 localhost/127.0.0.1`

**说明**：
- `src/` 目录中的 localhost 会被视为 BLOCKER（阻止发布）
- `electron/main/` 目录中的 localhost 会被视为 WARNING（需确认）
- `scripts/` 目录中的 localhost 会被视为 INFO（正常）

**解决方案**：
确保 `VITE_AUTH_API_BASE_URL` 已设置为生产地址，代码中的 localhost fallback 不会生效。

---

## 🔧 手动构建命令

如需手动执行构建步骤：

### macOS 构建

```bash
# 设置环境变量
export VITE_AUTH_API_BASE_URL=https://auth.xiuer.work

# 阻断检查
npm run release:guard

# 清理构建目录
npm run dist:clean

# 构建应用
npm run build

# 打包 macOS
npx electron-builder --mac
```

### Windows 构建（GitHub Actions）

Windows 构建只能通过以下方式触发：

1. **推送 Tag**：
   ```bash
   git tag v1.3.3
   git push origin v1.3.3
   ```

2. **手动触发**：
   - 访问：https://github.com/Xiuer-Chinese/Xiuer-live-tools/actions
   - 选择 "Build Windows"
   - 点击 "Run workflow"

---

## 📝 发布检查清单

发布前请确认：

- [ ] `npm run release:audit` 无严重问题
- [ ] `VITE_AUTH_API_BASE_URL` 已设置为 HTTPS 生产地址
- [ ] `VITE_AUTH_API_BASE_URL` 不包含 localhost/127.0.0.1
- [ ] `AUTH_STORAGE_SECRET` 已设置为 32+ 字符随机字符串
- [ ] Release Guard 检查通过（`npm run release:guard`）
- [ ] Git 工作区干净
- [ ] 当前分支为 main
- [ ] Tag 未重复
- [ ] macOS 安装包已本地测试
- [ ] Windows 构建已完成
- [ ] GitHub Release 已创建
- [ ] 所有安装包已上传

---

## 📝 自动生成 Release Notes

### 功能说明

项目提供自动生成 Release Notes 的功能，根据 Git 提交记录自动生成分类清晰的更新日志。

### 执行命令

```bash
npm run release:notes
```

### 生成分类

脚本会自动按以下前缀分组提交记录：

| 前缀 | 分类 | 示例 |
|------|------|------|
| `feat:` | 新增功能 | `feat: 添加抖音小店支持` |
| `fix:` | 问题修复 | `fix: 修复自动回复失效问题` |
| `perf:` / `refactor:` | 优化调整 | `perf: 优化消息发送速度` |
| `chore:` / `build:` / `ci:` | 构建与发布 | `chore: 更新依赖版本` |
| `docs:` | 文档更新 | `docs: 更新使用说明` |
| `test:` | 测试相关 | `test: 添加单元测试` |
| `style:` | 代码格式 | `style: 格式化代码` |
| 其他 | 其他改动 | - |

### 生成文件位置

生成的 Release Notes 文件保存在：
```
release-notes/vX.X.X.md
```

例如：`release-notes/v1.3.3.md`

### 文件结构

```markdown
# 秀儿直播助手 v1.3.3

## 📋 更新概览

### 新增功能
- 添加抖音小店支持 (`a1b2c3d`)
- 实现自动弹窗功能 (`e4f5g6h`)

### 问题修复
- 修复自动回复失效问题 (`i7j8k9l`)

### 构建与发布
- 添加一键发布脚本 (`m0n1o2p`)

...
```

### 用于 GitHub Release

生成后可以通过以下方式使用：

**方式 1：复制粘贴**
```bash
cat release-notes/v1.3.3.md
# 复制内容到 GitHub Release 页面
```

**方式 2：命令行更新**
```bash
gh release edit v1.3.3 --notes-file release-notes/v1.3.3.md
```

**方式 3：创建 Release 时直接指定**
```bash
gh release create v1.3.3 --notes-file release-notes/v1.3.3.md
```

### 提交信息规范建议

为了生成高质量的 Release Notes，建议遵循以下提交规范：

```
<type>(<scope>): <subject>

<body>
```

**示例：**
```bash
git commit -m "feat(douyin): 添加抖音小店自动回复功能"
git commit -m "fix(ai): 修复 DeepSeek API 调用超时问题"
git commit -m "chore(release): 添加一键发布脚本"
```

### 首发版本特殊处理

如果是首发版本（没有历史 tag），脚本会自动生成包含核心功能介绍的完整首发说明。

---

## 🆘 获取帮助

如遇问题：

1. 查看详细日志：`npm run publish 2>&1 | tee publish.log`
2. 检查 GitHub Actions 日志
3. 运行检查命令：`npm run publish:check`
4. 联系技术支持：support@xiuer.work

---

**最后更新**：2025-03-11
**版本**：v1.3.3
