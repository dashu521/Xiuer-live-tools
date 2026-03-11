# 秀儿直播助手 - 发布流程指南

## 📋 发布架构

```
┌─────────────────────────────────────────────────────────────┐
│                     发布架构概览                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐         ┌──────────────────────┐         │
│  │  本机 Mac    │         │   GitHub Actions     │         │
│  │  (M3 Ultra)  │         │   (windows-latest)   │         │
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

## 🎯 发布前准备

### 1. 环境检查

确保已安装：
- Node.js >= 20.0.0
- npm >= 10.0.0
- Git
- macOS 11 及以上（本机）

### 2. 环境变量

发布前必须设置生产 API 地址：

```bash
export VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000
```

### 3. 发布前审计

```bash
npm run release:audit
```

此命令会检查：
- Git 状态
- .gitignore 配置
- Git 跟踪文件
- API 地址配置
- Publish 配置

## 🚀 一键发布流程

### 步骤 1：执行一键发布脚本

```bash
export VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000
npm run release
```

脚本会依次执行：
1. 环境检查（Node.js、npm、Git）
2. 读取版本信息
3. Git 状态检查（分支、干净程度、remote）
4. Tag 可用性检查
5. 环境变量检查
6. 发布审计
7. 阻断检查（release:guard）
8. macOS 构建
9. 构建产物检查

### 步骤 2：本地测试

构建成功后，测试 macOS 安装包：

```bash
open "release/1.2.1"  # 替换为实际版本号
```

### 步骤 3：创建并推送 Tag

macOS 构建验证通过后，创建 Tag 触发 Windows 构建：

```bash
git tag v1.2.1  # 替换为实际版本号
git push origin v1.2.1
```

### 步骤 4：等待 Windows 构建

访问 GitHub Actions 查看 Windows 构建进度：
https://github.com/Xiuer-Chinese/Xiuer-live-tools/actions

### 步骤 5：发布到 GitHub Releases

1. 等待 GitHub Actions Windows 构建完成
2. 访问：https://github.com/Xiuer-Chinese/Xiuer-live-tools/releases
3. 点击 "Create a new release"
4. 选择 Tag（如 v1.2.1）
5. 填写 Release 标题和说明
6. 上传文件：
   - macOS: `秀儿直播助手_1.2.1_macos_*.dmg`
   - Windows: `秀儿直播助手_1.2.1_win-x64.exe`
   - Windows: `秀儿直播助手_1.2.1_win-x64.zip`
   - 自动更新文件：`latest.yml`（Windows）

## 📦 Release 页面文件清单

| 文件 | 说明 | 来源 |
|------|------|------|
| 秀儿直播助手_1.2.1_macos_x64.dmg | macOS Intel 安装包 | 本机构建 |
| 秀儿直播助手_1.2.1_macos_arm64.dmg | macOS Apple Silicon 安装包 | 本机构建 |
| 秀儿直播助手_1.2.1_win-x64.exe | Windows 安装程序 | GitHub Actions |
| 秀儿直播助手_1.2.1_win-x64.zip | Windows 便携版 | GitHub Actions |
| latest.yml | Windows 自动更新配置 | GitHub Actions |

## ⚠️ 常见失败原因

### 1. Git 工作区不干净

**错误信息**：`Git 工作区存在未提交修改`

**解决方案**：
```bash
git add .
git commit -m "chore: prepare release v1.2.1"
```

### 2. 未设置 VITE_AUTH_API_BASE_URL

**错误信息**：`VITE_AUTH_API_BASE_URL 未设置`

**解决方案**：
```bash
export VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000
```

### 3. Remote 错误

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

## 🔧 手动构建命令

如需手动执行构建步骤：

### macOS 构建

```bash
# 设置环境变量
export VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000

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
   git tag v1.2.1
   git push origin v1.2.1
   ```

2. **手动触发**：
   - 访问：https://github.com/Xiuer-Chinese/Xiuer-live-tools/actions
   - 选择 "Build Windows"
   - 点击 "Run workflow"

## 📝 发布检查清单

发布前请确认：

- [ ] `npm run release:audit` 无严重问题
- [ ] `VITE_AUTH_API_BASE_URL` 已设置为生产地址
- [ ] Git 工作区干净
- [ ] 当前分支为 main
- [ ] Tag 未重复
- [ ] macOS 安装包已本地测试
- [ ] Windows 构建已完成
- [ ] GitHub Release 已创建
- [ ] 所有安装包已上传

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

例如：`release-notes/v1.2.1.md`

### 文件结构

```markdown
# 秀儿直播助手 v1.2.1

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
cat release-notes/v1.2.1.md
# 复制内容到 GitHub Release 页面
```

**方式 2：命令行更新**
```bash
gh release edit v1.2.1 --notes-file release-notes/v1.2.1.md
```

**方式 3：创建 Release 时直接指定**
```bash
gh release create v1.2.1 --notes-file release-notes/v1.2.1.md
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

## 🆘 获取帮助

如遇问题：

1. 查看详细日志：`npm run release 2>&1 | tee release.log`
2. 检查 GitHub Actions 日志
3. 联系技术支持：support@xiuer.live

---

**最后更新**：2025-03-11
**版本**：v1.2.1
