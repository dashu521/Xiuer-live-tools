# 秀儿直播助手 - 发布规范 v2.0

## 三层发布结构

本规范明确区分三种构建场景，避免"测试构建"和"正式发布构建"的混淆。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        发布规范三层结构                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  A. macOS 本地测试构建                                                   │
│     ├── 目的：开发调试、内部测试                                          │
│     ├── 签名：可选（无证书则生成未签名应用）                               │
│     ├── 公证：跳过                                                        │
│     ├── 限制：Gatekeeper 会阻止运行，需右键"打开"或禁用 Gatekeeper       │
│     └── 命令：npm run build && npx electron-builder --mac --publish never │
│                                                                         │
│  B. macOS 正式发布构建                                                   │
│     ├── 目的：向终端用户分发                                               │
│     ├── 签名：必需（Apple Developer ID）                                 │
│     ├── 公证：必需（Apple Notary Service）                               │
│     ├── 限制：无（用户可正常安装运行）                                     │
│     └── 环境变量：APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID   │
│                                                                         │
│  C. 推荐发布环境                                                          │
│     ├── macOS 构建：本地 Mac（任何 Apple Silicon 或 Intel Mac）          │
│     ├── Windows 构建：GitHub Actions（windows-latest）                   │
│     └── 原因：Windows 构建依赖 Windows 特定工具链，GitHub Actions 更可靠  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## A. macOS 本地测试构建详解

### 适用场景
- 开发阶段快速验证
- 内部团队测试
- CI/CD 自动化测试

### 构建条件
| 条件 | 要求 | 说明 |
|------|------|------|
| 操作系统 | macOS 10.15+ | 任何 Mac 均可 |
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

## B. macOS 正式发布构建详解

### 适用场景
- 向终端用户发布
- 需要自动更新功能
- 避免 Gatekeeper 拦截

### 构建条件
| 条件 | 要求 | 说明 |
|------|------|------|
| 操作系统 | macOS 10.15+ | 任何 Mac 均可 |
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
1. **证书安全**：Apple 开发者证书不离开本地机器
2. **构建速度**：本地构建通常比 CI 更快
3. **调试方便**：构建失败时易于排查

---

## 这台机器的定位

### 1）是否可用于测试构建？
**✅ 是**

任何 macOS 机器都可以执行测试构建：
```bash
npm run build
npx electron-builder --mac --publish never
```

生成的应用可以在本机运行测试，只需处理 Gatekeeper 拦截。

### 2）是否具备正式发布条件？
**取决于证书配置**

| 条件 | 状态 | 说明 |
|------|------|------|
| Apple ID | ❓ 待确认 | 是否有开发者账号？ |
| 证书 | ❓ 待确认 | 是否已下载 Developer ID 证书？ |
| 公证 | ❓ 待确认 | 环境变量是否已配置？ |

**检查命令**：
```bash
# 检查证书
security find-identity -v -p codesigning

# 检查环境变量
echo $APPLE_ID
echo $APPLE_TEAM_ID
```

### 3）两者区别

| 特性 | 测试构建 | 正式发布构建 |
|------|----------|--------------|
| 签名 | ❌ 无 | ✅ 有 |
| 公证 | ❌ 无 | ✅ 有 |
| Gatekeeper | ⚠️ 需手动允许 | ✅ 正常通过 |
| 自动更新 | ❌ 不支持 | ✅ 支持 |
| 分发方式 | 内部测试 | 公开发布 |

---

## 历史构建复现

根据用户反馈，这台 Mac 之前已成功构建过 macOS 版本。复现步骤：

### 测试构建（复现历史成功）
```bash
# 步骤 1：设置 API 地址
export VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000

# 步骤 2：执行构建
npm run build
npx electron-builder --mac --publish never

# 步骤 3：检查产物
ls -la release/*/mac*/
```

### 如果历史构建是成功的
说明这台机器具备：
- ✅ Node.js 环境正常
- ✅ 项目依赖完整
- ✅ electron-builder 配置正确

**不说明**：
- ❓ 是否有 Apple 开发者证书
- ❓ 是否配置了签名/公证环境变量

---

## 规则：先复现，再判断

### ❌ 错误做法
仅凭以下 checklist 直接下结论：
- "没有 Xcode → 不能构建"
- "没有证书 → 不能构建"
- "不是 M3 Ultra → 不能构建"

### ✅ 正确做法
1. **复现历史成功命令**：先执行之前成功的构建命令
2. **观察实际结果**：看是否生成 .app 或 .dmg
3. **区分构建类型**：
   - 能生成 → 可以测试构建 ✅
   - 能签名 → 可以正式发布 ✅
4. **明确告知用户**：
   - "可以构建测试包，但用户安装时需要右键打开"
   - "可以构建测试包，但正式发布需要配置证书"

---

## 修改记录

| 日期 | 版本 | 修改内容 |
|------|------|----------|
| 2025-03-12 | v2.0 | 建立三层发布结构，明确区分测试构建和正式发布构建 |

---

**最后更新**：2025-03-12
**规范版本**：v2.0
