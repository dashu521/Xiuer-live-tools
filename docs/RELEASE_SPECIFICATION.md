# 秀儿直播助手 - 发布规范 v2.4

## 三层发布结构

本规范明确区分三种构建场景，避免"测试构建"和"正式发布构建"的混淆。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        发布规范三层结构                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  A. macOS 本地测试构建（当前项目使用）                                     │
│     ├── 目的：开发调试、内部测试、公开发布                                  │
│     ├── 签名：无（未签名应用）                                            │
│     ├── 公证：跳过                                                        │
│     ├── 限制：Gatekeeper 会阻止运行，需右键"打开"或禁用 Gatekeeper       │
│     └── 命令：npm run build && npx electron-builder --mac --publish never │
│                                                                         │
│  B. macOS 正式发布构建（未来可升级）                                       │
│     ├── 目的：向终端用户分发（无 Gatekeeper 限制）                          │
│     ├── 签名：必需（Apple Developer ID）                                 │
│     ├── 公证：必需（Apple Notary Service）                               │
│     ├── 限制：无（用户可正常安装运行）                                     │
│     └── 环境变量：APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID   │
│                                                                         │
│  C. 推荐发布环境                                                          │
│     ├── macOS 构建：本地 Mac（任何 Apple Silicon 或 Intel Mac 均可）      │
│     ├── Windows 构建：GitHub Actions（windows-latest）                   │
│     └── 原因：Windows 构建依赖 Windows 特定工具链，GitHub Actions 更可靠  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 发布架构与职责边界

### 核心原则

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        发布架构与职责边界                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  【本地 Mac 职责】                                                        │
│  ├── 构建 macOS 安装包                                                   │
│  ├── 上传到 GitHub Release                                               │
│  └── ❌ 不再依赖 OSS 正式凭证（本地无需配置阿里云密钥）                      │
│                                                                         │
│  【GitHub Actions 职责】                                                  │
│  ├── 构建 Windows 安装包                                                 │
│  ├── 上传 Windows 产物到 GitHub Release                                  │
│  ├── 同步 Windows 产物到 OSS/CDN                                         │
│  ├── 同步 macOS 产物到 OSS/CDN（通过 upload-mac-oss workflow）            │
│  └── ✅ OSS 凭证统一由 GitHub Secrets 管理                                │
│                                                                         │
│  【手工兜底方案】                                                          │
│  └── npm run upload:mac:oss 保留，仅在当地有 OSS 凭证时作为备用方案         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 标准发布流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        标准发布流程                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  步骤 1: 本地 Mac 构建                                                    │
│  ├── export VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000           │
│  ├── npm run release:mac                                                 │
│  └── 产物: release/<version>/*.dmg + latest-mac.yml                      │
│                                                                         │
│  步骤 2: 创建 GitHub Release + 上传 Mac 产物                              │
│  ├── git tag v<version>                                                  │
│  ├── git push origin v<version>                                          │
│  ├── gh release create v<version> --draft                                │
│  └── gh release upload v<version> release/<version>/*macos*              │
│                                                                         │
│  步骤 3: Windows 构建（自动触发）                                          │
│  ├── 触发: build-windows.yml                                             │
│  ├── 构建: .exe + .zip + latest.yml                                      │
│  ├── 上传: GitHub Release                                                │
│  └── 同步: OSS/CDN (Windows 产物)                                        │
│                                                                         │
│  步骤 4: Mac 产物同步 OSS（手动触发）                                       │
│  ├── 触发: upload-mac-oss.yml                                            │
│  └── 同步: OSS/CDN (macOS 产物)                                          │
│                                                                         │
│  步骤 5: 发布后验收                                                        │
│  └── 验证: download.xiuer.work 所有资源可访问                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## A. macOS 本地测试构建详解（当前项目使用）

### 适用场景
- 开发阶段快速验证
- 内部团队测试
- **公开发布（当前项目采用此方式）**

### 当前项目发布方式
> **注意**：当前项目使用"无签名测试构建"方式发布 macOS 版本。
> 
> 这意味着：
> - ✅ 任何 Mac（Intel / Apple Silicon）均可构建
> - ✅ 无需 Apple Developer 证书
> - ✅ 无需公证
> - ⚠️ 用户安装时需右键"打开"或按文档指引操作
> 
> **未来可升级**：如有需要，可后续配置 Apple Developer 签名和公证。

### 构建条件
| 条件 | 要求 | 说明 |
|------|------|------|
| 操作系统 | macOS 10.15+ | **任何 Mac 均可**（Intel / Apple Silicon） |
| Xcode | 不需要 | 无需安装 Xcode |
| 证书 | 不需要 | 生成未签名应用 |
| 公证 | 不需要 | 跳过公证流程 |

### 构建命令
```bash
# 基础测试构建（无签名）
npm run build
npx electron-builder --mac --publish never

# 或使用脚本（跳过阻断检查中的证书检查）
npm run release:mac
```

### 运行测试包
由于未签名，macOS Gatekeeper 会阻止运行：

```bash
# 方法 1：右键"打开"（推荐）
# 在 Finder 中找到 .app，右键 → 打开

# 方法 2：xattr 移除隔离属性
xattr -rd com.apple.quarantine "/path/to/秀儿直播助手.app"

# 方法 3：临时禁用 Gatekeeper（不推荐长期使用）
sudo spctl --master-disable
# 使用完后重新启用
sudo spctl --master-enable
```

---

## B. macOS 正式发布构建详解（未来可升级）

### 适用场景
- 向终端用户发布
- 需要自动更新功能
- **完全避免 Gatekeeper 拦截**

### 说明
> 这是**未来可升级**的发布方式，当前项目尚未使用。
> 
> 如需升级到此方式，需要：
> 1. 注册 Apple Developer 账号（$99/年）
> 2. 申请 Developer ID 证书
> 3. 配置签名和公证环境变量

### 构建条件
| 条件 | 要求 | 说明 |
|------|------|------|
| 操作系统 | macOS 10.15+ | **任何 Mac 均可**（Intel / Apple Silicon） |
| Xcode | 不需要 | 仅需命令行工具 |
| Apple ID | 必需 | 开发者账号 |
| 证书 | 必需 | Developer ID Application |
| 公证 | 必需 | 自动进行 |

### 环境变量配置
```bash
# 必需：Apple ID（开发者账号邮箱）
export APPLE_ID="your-email@example.com"

# 必需：App 专用密码（非 Apple ID 密码）
# 生成方式：appleid.apple.com → 安全 → App 专用密码
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"

# 必需：Team ID
# 查看方式：developer.apple.com → Account → Membership
export APPLE_TEAM_ID="XXXXXXXXXX"
```

### 构建命令
```bash
# 设置环境变量后执行
export APPLE_ID="your-email@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
export APPLE_TEAM_ID="YOUR_TEAM_ID"

npm run release:mac
```

### 验证签名和公证
```bash
# 检查签名
codesign -dv --verbose=4 "/path/to/秀儿直播助手.app"

# 检查公证状态
spctl -a -vv "/path/to/秀儿直播助手.app"

# 检查公证票证
xcrun stapler validate "/path/to/秀儿直播助手.app"
```

---

## C. 推荐发布环境

### 当前项目配置
```
┌─────────────────────────────────────────────────────────────┐
│                     推荐发布架构                             │
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
```

### 为什么 Windows 用 GitHub Actions？
1. **工具链依赖**：Windows 构建需要 Windows 特定工具（如 electron-winstaller）
2. **环境一致性**：避免"在我机器上能跑"问题
3. **并行构建**：与 macOS 构建并行，节省时间
4. **自动发布**：构建完成后自动上传到 GitHub Release

### 为什么 macOS 用本地构建？
1. **灵活性**：任何 Mac（Intel / Apple Silicon）均可构建
2. **无证书要求**：当前使用无签名方式，无需 Apple Developer 证书
3. **构建速度**：本地构建通常比 CI 更快
4. **调试方便**：构建失败时易于排查

### Windows 构建
- **平台**：GitHub Actions（windows-latest）
- **状态**：✅ 已配置，自动构建并上传到阿里云 OSS
- **触发方式**：推送 v* 标签自动触发

---

## macOS 构建环境说明

### 1）任何 Mac 均可构建
**✅ 是**

**任何 Mac（Intel / Apple Silicon）都可以执行构建**：
```bash
npm run build
npx electron-builder --mac --publish never
```

生成的应用可以在本机运行测试，用户安装时需按文档指引处理 Gatekeeper 拦截。

### 2）当前项目使用"无签名构建"

| 条件 | 当前状态 | 说明 |
|------|----------|------|
| Apple Developer 证书 | ❌ 不需要 | 当前使用无签名方式 |
| 公证 | ❌ 不需要 | 跳过公证流程 |
| 环境变量 | ✅ 简单 | 仅需设置 API 地址 |

**检查命令**：
```bash
# 检查 Node.js
node --version

# 检查环境变量
echo $VITE_AUTH_API_BASE_URL
```

### 3）构建方式对比

| 特性 | 当前无签名构建 | 未来签名构建（可选） |
|------|----------------|---------------------|
| 签名 | ❌ 无 | ✅ 有（需证书） |
| 公证 | ❌ 无 | ✅ 有（需配置） |
| Gatekeeper | ⚠️ 需右键打开 | ✅ 正常通过 |
| 构建环境 | 任何 Mac | 任何 Mac |
| 证书成本 | 免费 | $99/年 |
| 适用场景 | 当前项目使用 | 未来可升级 |

---

## 历史构建复现

根据用户反馈，这台 Mac 之前已成功构建过 macOS 版本。复现步骤：

### 构建步骤（任何 Mac 均可执行）
```bash
# 步骤 1：设置 API 地址
export VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000

# 步骤 2：执行构建
npm run build
npx electron-builder --mac --publish never

# 步骤 3：检查产物
ls -la release/*/mac*/
```

### 构建成功说明
任何 Mac（Intel / Apple Silicon）构建成功说明：
- ✅ Node.js 环境正常
- ✅ 项目依赖完整
- ✅ electron-builder 配置正确
- ✅ **无需 Apple 开发者证书即可构建**

---

## 生产环境 API 地址固化规范

### 规范目的
**确保正式发布必须使用生产环境 API 地址，禁止 localhost fallback 进入发布包。**

### 生产环境 API 地址

| 环境变量 | 生产环境值 | 说明 |
|----------|------------|------|
| `VITE_AUTH_API_BASE_URL` | `http://121.41.179.197:8000` | 阿里云 ECS 生产 API 服务器 |

### 强制要求

#### 1. 正式发布必须显式注入环境变量

```bash
# ✅ 正确：显式设置生产环境 API 地址
export VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000
npm run release

# ❌ 错误：未设置环境变量
npm run release
# Release Guard 会拦截并阻止发布
```

#### 2. 禁止 localhost fallback 进入发布包

- 代码中的 `import.meta.env.VITE_AUTH_API_BASE_URL || 'localhost'` fallback 模式
- **仅在开发调试时生效**
- **正式发布必须设置环境变量**，否则 Release Guard 会拦截

#### 3. Release Guard 强制拦截

Release Guard (`scripts/release-guard.js`) 在发布前执行以下检查：

| 检查项 | 级别 | 行为 |
|--------|------|------|
| `VITE_AUTH_API_BASE_URL` 未设置 | BLOCKER | 阻止发布 |
| `VITE_AUTH_API_BASE_URL` 包含 localhost | BLOCKER | 阻止发布 |
| `VITE_AUTH_API_BASE_URL` 包含 127.0.0.1 | BLOCKER | 阻止发布 |
| src/ 目录中存在 localhost 引用 | BLOCKER | 阻止发布 |

**任何一项检查失败，都无法执行发布。**

### 违规处理

| 违规场景 | 处理方式 |
|----------|----------|
| 未设置 VITE_AUTH_API_BASE_URL | Release Guard 拦截，提示设置生产 API 地址 |
| 使用 localhost/127.0.0.1 | Release Guard 拦截，提示使用生产地址 |
| 代码中存在硬编码 localhost | Release Guard 扫描并拦截 |

### 快速验证

发布前验证环境变量配置：

```bash
# 验证环境变量已设置
echo $VITE_AUTH_API_BASE_URL

# 预期输出
http://121.41.179.197:8000

# 执行阻断检查
npm run release:guard
```

---

## 规则：已发布 Tag 不覆盖

### 核心原则
**已发布的 tag 永不覆盖、不删除、不强推。**

### 具体规则
1. **已发布 tag 不覆盖**：一旦 tag 推送到远端，禁止删除后重新创建同名 tag
2. **修复后递增版本号**：如 v1.3.0 发布后发现构建错误或平台兼容问题，修复后发布 v1.3.1
3. **保持历史可追溯**：每个 tag 对应一个不可变的发布版本，便于审计、回滚和复现

### 版本递增规则
| 问题类型 | 版本递增 | 示例 |
|----------|----------|------|
| 构建错误（CI 失败） | 补丁版本 +1 | v1.3.0 → v1.3.1 |
| 平台兼容问题 | 补丁版本 +1 | v1.3.0 → v1.3.1 |
| 紧急 Bug 修复 | 补丁版本 +1 | v1.3.0 → v1.3.1 |
| 新功能发布 | 次版本 +1 | v1.3.0 → v1.4.0 |
| 重大变更 | 主版本 +1 | v1.3.0 → v2.0.0 |

### 执行时间
**从 v1.3.1 开始严格执行此规则。**

> 注：v1.3.0 因首次发布流程中存在 tag 强推操作，作为历史特例记录。后续版本严格遵循此规则。

---

## 规则：先复现，再判断

### ❌ 错误做法
仅凭以下 checklist 直接下结论：
- "没有 Xcode → 不能构建"
- "没有证书 → 不能构建"
- "不是特定机型 → 不能构建"

### ✅ 正确做法
1. **执行构建命令**：任何 Mac（Intel / Apple Silicon）均可尝试构建
2. **观察实际结果**：看是否生成 .app 或 .dmg
3. **明确构建类型**：
   - 能生成 → ✅ 可以构建（当前项目使用无签名方式）
   - 用户安装 → 按文档指引处理 Gatekeeper
4. **明确告知用户**：
   - "任何 Mac 均可构建，当前项目使用无签名方式"
   - "用户安装时需右键打开，详见安装文档"
   - "未来如有需要，可升级至 Apple Developer 签名版本"

---

## 下载页部署规范

### 架构约定

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    download.xiuer.work 目录结构                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  /                           ← 正式下载页（静态网站首页）                 │
│  └── index.html              ← 用户下载入口，面向推广期用户               │
│                                                                         │
│  /releases/latest/           ← 自动更新目录（禁止覆盖）                   │
│  ├── latest.yml              ← Windows 自动更新配置                      │
│  ├── latest-mac.yml          ← macOS 自动更新配置                        │
│  ├── Xiuer-Live-Assistant_*.exe      ← Windows 安装包                    │
│  ├── Xiuer-Live-Assistant_*_arm64.dmg ← macOS Apple 芯片安装包           │
│  └── Xiuer-Live-Assistant_*_x64.dmg   ← macOS Intel 安装包               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 路径独立原则

**重要**：以下两个路径完全独立，禁止互相覆盖

| 路径 | 用途 | 部署方式 |
|------|------|----------|
| `/` (根目录) | 正式下载页 | 手动部署 `index.html` |
| `/releases/latest/` | 自动更新源 | CI 自动上传构建产物 |

### 部署命令

```bash
# 部署下载页到 OSS 根目录
npm run deploy:download-page

# 或直接使用脚本
node scripts/deploy-download-page.js
```

### 发布后必验地址

每次发布后必须验证以下地址可正常访问：

| 地址 | 期望状态 | 说明 |
|------|----------|------|
| `https://download.xiuer.work/` | HTTP 200 | 正式下载页 |
| `https://download.xiuer.work/releases/latest/latest.yml` | HTTP 200 | Windows 自动更新配置 |
| `https://download.xiuer.work/releases/latest/latest-mac.yml` | HTTP 200 | macOS 自动更新配置 |
| `https://download.xiuer.work/releases/latest/Xiuer-Live-Assistant_*_win-x64.exe` | HTTP 200 | Windows 安装包 |
| `https://download.xiuer.work/releases/latest/Xiuer-Live-Assistant_*_macos_arm64.dmg` | HTTP 200 | macOS Apple 芯片安装包 |
| `https://download.xiuer.work/releases/latest/Xiuer-Live-Assistant_*_macos_x64.dmg` | HTTP 200 | macOS Intel 安装包 |

### 验证命令

```bash
# 验证下载页
curl -I https://download.xiuer.work/

# 验证自动更新配置
curl -I https://download.xiuer.work/releases/latest/latest.yml
curl -I https://download.xiuer.work/releases/latest/latest-mac.yml

# 验证安装包（示例版本号，实际根据发布版本调整）
curl -I https://download.xiuer.work/releases/latest/Xiuer-Live-Assistant_1.3.3_win-x64.exe
curl -I https://download.xiuer.work/releases/latest/Xiuer-Live-Assistant_1.3.3_macos_arm64.dmg
curl -I https://download.xiuer.work/releases/latest/Xiuer-Live-Assistant_1.3.3_macos_x64.dmg
```

---

## 修改记录

| 日期 | 版本 | 修改内容 |
|------|------|----------|
| 2025-03-12 | v2.0 | 建立三层发布结构，明确区分测试构建和正式发布构建 |
| 2025-03-12 | v2.1 | 更新 macOS 构建说明：删除 M3 Ultra 特定表述，明确任何 Mac 均可构建，当前使用无签名方式，未来可升级至 Apple Developer 签名 |
| 2025-03-14 | v2.2 | 添加下载页部署规范：明确 download.xiuer.work/ 为正式下载页，/releases/latest/ 为自动更新目录，两者路径独立；添加发布后必验地址清单 |
| 2026-03-18 | v2.3 | 添加生产环境 API 地址固化规范：明确 VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000 为生产环境地址，强制要求正式发布必须显式注入，禁止 localhost fallback 进入发布包，Release Guard 强制拦截 |
| 2026-03-18 | v2.4 | 明确发布架构与职责边界：本地 Mac 不再依赖 OSS 凭证，OSS 上传统一走 GitHub Actions，npm run upload:mac:oss 保留为手工兜底方案 |

---

## 附录：发布检查清单

发布前请逐项确认：

### 环境检查
- [ ] Node.js >= 20.0.0
- [ ] npm >= 10.0.0
- [ ] Git
- [ ] GitHub CLI (`gh`)
- [ ] macOS 11 及以上

### 配置检查
- [ ] `VITE_AUTH_API_BASE_URL` 已设置为 `http://121.41.179.197:8000`
- [ ] `VITE_AUTH_API_BASE_URL` 不包含 localhost/127.0.0.1
- [ ] Release Guard 检查通过

### Git 检查
- [ ] Git 工作区干净（无未提交修改）
- [ ] 当前分支为 main
- [ ] Tag 未重复

### 构建检查
- [ ] macOS 安装包已本地测试
- [ ] Windows CI 构建已完成
- [ ] GitHub Release 已创建
- [ ] 所有安装包已上传

### 发布后验证
- [ ] `latest.yml` 可访问
- [ ] `latest-mac.yml` 可访问
- [ ] Windows 安装包可下载
- [ ] macOS 安装包可下载

---

## 附录：常见失败原因

### 1. Git 工作区不干净

**错误信息**：`Git 工作区存在未提交修改`

**解决方案**：
```bash
git add .
git commit -m "chore: prepare release vX.X.X"
```

### 2. 未设置 VITE_AUTH_API_BASE_URL

**错误信息**：`VITE_AUTH_API_BASE_URL 未设置`

**解决方案**：
```bash
export VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000
```

### 3. Localhost 风险

**警告信息**：`发现高风险 localhost/127.0.0.1`

**说明**：
- `src/` 目录中的 localhost 会被视为 BLOCKER（阻止发布）
- `electron/main/` 目录中的 localhost 会被视为 WARNING（需确认）
- `scripts/` 目录中的 localhost 会被视为 INFO（正常）

**解决方案**：确保 `VITE_AUTH_API_BASE_URL` 已设置为生产地址。

---

**最后更新**：2026-03-18
**规范版本**：v2.4

> **文档关系**：
> - 本规范为发布架构与要求的权威定义
> - 具体操作步骤请查阅 [RELEASE_SOP_MINIMAL.md](./RELEASE_SOP_MINIMAL.md)
> - 发布失败处理请查阅 [RELEASE_TROUBLESHOOTING.md](./RELEASE_TROUBLESHOOTING.md)
> - 本文档已吸收原 [RELEASE_PROCESS.md](./archive/2026-03-release-audit/RELEASE_PROCESS.md) 中的检查清单和故障排除内容
