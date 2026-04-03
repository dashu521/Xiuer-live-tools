# 秀儿直播助手 - 发布失败处理指南

本文档覆盖标准发布流程中各环节的失败处理方案。

---

## 快速索引

| 失败环节 | 严重程度 | 是否可继续 | 处理章节 |
|----------|----------|------------|----------|
| `npm run release:mac` 失败 | 🔴 阻断 | ❌ 不可继续 | [场景 1](#场景-1-npm-run-releasemac-失败) |
| `gh release create` 失败 | 🟡 中等 | ⚠️ 视情况 | [场景 2](#场景-2-gh-release-create-失败) |
| Windows CI 失败 | 🔴 阻断 | ❌ 不可继续 | [场景 3](#场景-3-windows-ci-失败) |
| Upload Mac to OSS 失败 | 🟡 中等 | ✅ 可继续 | [场景 4](#场景-4-upload-mac-to-oss-workflow-失败) |
| CDN 验证失败 | 🔴 阻断 | ❌ 不可继续 | [场景 5](#场景-5-cdn--latest-macyml-验证失败) |

---

## 场景 1: npm run release:mac 失败

### 现象

```
❌ FAIL 构建失败
Error: Command failed: npm run build
```

或

```
❌ [BLOCKER] VITE_AUTH_API_BASE_URL 未设置
```

### 检查命令

```bash
# 1. 检查环境变量
echo $VITE_AUTH_API_BASE_URL
# 预期输出: https://auth.xiuer.work

# 2. 检查 Node.js 版本
node --version
# 预期: >= 20.0.0

# 3. 检查依赖是否完整
npm install

# 4. 单独运行阻断检查
npm run release:guard

# 5. 查看详细错误日志
npm run release:mac 2>&1 | tee build-error.log
```

### 处理原则

| 错误类型 | 处理方式 |
|----------|----------|
| 环境变量未设置 | `export VITE_AUTH_API_BASE_URL=https://auth.xiuer.work` |
| 环境变量包含 localhost | 设置正确的生产地址 |
| 依赖缺失 | `npm install` |
| 类型错误 | 修复 TypeScript 错误后重新构建 |
| 构建配置错误 | 检查 `electron-builder.yml` |

### 是否允许继续后续步骤

**❌ 不可继续**。必须修复构建问题后重新执行。

### 回滚操作

```bash
# 如果版本号已提升但构建失败，回滚版本号
git reset --hard HEAD~1

# 如果 tag 已创建但构建失败，删除 tag
git tag -d v<version>
git push origin :refs/tags/v<version>  # 如果已推送
```

---

## 场景 2: gh release create 失败

### 现象

```
HTTP 422: Validation Failed
Release already exists
```

或

```
HTTP 404: Not Found
```

或

```
gh: command not found
```

### 检查命令

```bash
# 1. 检查 gh CLI 是否已认证
gh auth status

# 2. 检查 Release 是否已存在
gh release view v<version>

# 3. 检查 tag 是否存在
git tag -l "v<version>"

# 4. 检查产物文件是否存在
ls -la release/<version>/

# 5. 检查网络连接
curl -I https://api.github.com
```

### 处理原则

| 错误类型 | 处理方式 |
|----------|----------|
| gh 未认证 | `gh auth login` |
| Release 已存在 | 使用 `gh release upload` 追加文件 |
| Tag 不存在 | 先创建 tag: `git tag v<version> && git push origin v<version>` |
| 产物不存在 | 重新构建: `npm run release:mac` |
| 网络问题 | 检查网络或使用代理 |

### 是否允许继续后续步骤

**⚠️ 视情况**：

- 如果 Release 已存在但产物未上传 → 使用 `gh release upload` 补传
- 如果 tag 不存在 → 先推送 tag
- 如果 gh 认证失败 → 认证后重试

### 补救命令

```bash
# Release 已存在，追加上传 Mac 产物
gh release upload v<version> \
  release/<version>/*macos*.dmg \
  release/<version>/*macos*.dmg.blockmap \
  release/<version>/latest-mac.yml \
  --clobber

# 删除并重建 Release
gh release delete v<version> --yes
gh release create v<version> --title "v<version>" --notes-file CHANGELOG.md \
  release/<version>/*macos*.dmg \
  release/<version>/*macos*.dmg.blockmap \
  release/<version>/latest-mac.yml
```

---

## 场景 3: Windows CI 失败

### 现象

```bash
gh run watch --exit-status
# Error: exit status 1
```

或 GitHub Actions 页面显示红色 ❌

### 检查命令

```bash
# 1. 查看 CI 运行状态
gh run list --workflow "Build Windows" --limit 5

# 2. 查看具体运行详情
gh run view <run-id>

# 3. 查看失败日志
gh run view <run-id> --log-failed

# 4. 在浏览器中查看
gh run view <run-id> --web
```

### 处理原则

| 错误类型 | 处理方式 |
|----------|----------|
| 依赖安装失败 | 检查 `package.json` 依赖版本 |
| 构建错误 | 检查 Windows 特定代码路径 |
| Release Guard 拦截 | 检查环境变量配置 |
| OSS 上传失败 | 检查 GitHub Secrets 配置 |
| 超时 | 重新触发 workflow |

### 是否允许继续后续步骤

**❌ 不可继续**。Windows 产物是发布必需品，必须修复后重新触发。

### 重新触发方式

```bash
# 方式 1: 删除并重建 tag（会触发新的 CI）
git tag -d v<version>
git push origin :refs/tags/v<version>
git tag v<version>
git push origin v<version>

# 方式 2: 手动触发 workflow
gh workflow run "Build Windows" -f publish=true

# 注意：手动触发需要手动上传 Release
```

### 常见 CI 失败原因

1. **Release Guard 拦截**
   - 检查 `VITE_AUTH_API_BASE_URL` 是否正确
   - 检查代码中是否有 localhost 硬编码

2. **依赖安装超时**
   - 重新触发 workflow

3. **OSS Secrets 未配置**
   - 检查仓库 Settings → Secrets
   - 确保 `ALIYUN_ACCESS_KEY_ID` 和 `ALIYUN_ACCESS_KEY_SECRET` 已设置

---

## 场景 4: Upload Mac to OSS workflow 失败

### 现象

```bash
gh run watch --exit-status
# Error: exit status 1
```

或 OSS 上传步骤显示红色 ❌

### 检查命令

```bash
# 1. 查看 workflow 运行状态
gh run list --workflow "upload-mac-oss.yml" --limit 5

# 2. 查看失败日志
gh run view <run-id> --log-failed

# 3. 检查 GitHub Release 中是否有 Mac 产物
gh release view v<version> --json assets --jq '.assets[].name'

# 4. 检查 OSS Secrets 是否配置
# 需要在 GitHub 仓库 Settings → Secrets 中检查

# 5. 检查 OSS 当前状态
curl -sI https://download.xiuer.work/releases/latest/latest-mac.yml
```

### 处理原则

| 错误类型 | 处理方式 |
|----------|----------|
| Mac 产物不在 Release 中 | 先上传到 Release: `gh release upload v<version> ...` |
| OSS Secrets 未配置 | 在 GitHub 仓库设置中添加 Secrets |
| OSS 凭证无效 | 更新 GitHub Secrets 中的阿里云密钥 |
| 网络问题 | 重新触发 workflow |

### 是否允许继续后续步骤

**✅ 可继续后续验收步骤**，但必须修复后重新触发。

Mac 产物已在 GitHub Release 中，用户可从 GitHub 下载，只是国内 CDN 暂未同步。

### 重新触发方式

```bash
# 确保 Mac 产物已上传到 Release
gh release upload v<version> \
  release/<version>/*macos*.dmg \
  release/<version>/*macos*.dmg.blockmap \
  release/<version>/latest-mac.yml \
  --clobber

# 重新触发 OSS 上传
gh workflow run "Upload Mac to OSS" -f version=<version>

# 等待完成
gh run watch --exit-status
```

### 手工兜底方案

如果 GitHub Actions OSS 上传持续失败，且本地有有效的 OSS 凭证：

```bash
# 设置本地 OSS 凭证
export ALIYUN_ACCESS_KEY_ID=<your_key_id>
export ALIYUN_ACCESS_KEY_SECRET=<your_key_secret>

# 执行本地上传
npm run upload:mac:oss
```

---

## 场景 5: CDN / latest-mac.yml 验证失败

### 现象

```bash
curl -I https://download.xiuer.work/releases/latest/latest-mac.yml
# HTTP 404 或 HTTP 403
```

或

```bash
curl -s https://download.xiuer.work/releases/latest/latest-mac.yml
# 内容为空或版本号不对
```

### 检查命令

```bash
# 1. 检查 latest-mac.yml 是否存在
curl -sI https://download.xiuer.work/releases/latest/latest-mac.yml

# 2. 检查版本号是否正确
curl -s https://download.xiuer.work/releases/latest/latest-mac.yml | head -1
# 预期: version: <version>

# 3. 检查 DMG 文件是否存在
curl -sI https://download.xiuer.work/releases/latest/Xiuer-Live-Assistant_<version>_macos_arm64.dmg
curl -sI https://download.xiuer.work/releases/latest/Xiuer-Live-Assistant_<version>_macos_x64.dmg

# 4. 检查 Windows 产物
curl -sI https://download.xiuer.work/releases/latest/latest.yml
curl -sI https://download.xiuer.work/releases/latest/Xiuer-Live-Assistant_<version>_win-x64.exe

# 5. 检查版本目录
curl -sI https://download.xiuer.work/releases/v<version>/latest-mac.yml
```

### 处理原则

| 错误类型 | 处理方式 |
|----------|----------|
| latest-mac.yml 不存在 | 重新触发 Upload Mac to OSS workflow |
| 版本号不对 | 重新触发 Upload Mac to OSS workflow |
| DMG 文件不存在 | 检查 Release 是否有产物，重新触发 OSS 上传 |
| CDN 缓存问题 | 等待 CDN 刷新（通常 5-10 分钟）或强制刷新 |

### 是否允许继续后续步骤

**❌ 不可继续**。CDN 验证失败意味着用户无法正常更新，必须修复。

### 修复步骤

```bash
# 1. 确认 GitHub Release 有正确产物
gh release view v<version> --json assets --jq '.assets[].name'

# 2. 重新触发 OSS 上传
gh workflow run "Upload Mac to OSS" -f version=<version>

# 3. 等待完成
gh run watch --exit-status

# 4. 等待 CDN 刷新（5-10 分钟）

# 5. 重新验证
curl -sI https://download.xiuer.work/releases/latest/latest-mac.yml
```

### CDN 缓存强制刷新

如果 CDN 缓存导致旧版本残留：

1. 登录阿里云 OSS 控制台
2. 进入 `xiuer-live-tools-download` Bucket
3. 选择 `releases/latest/` 目录
4. 点击"刷新缓存"

---

## 发布失败决策树

```
发布失败
    │
    ├── 步骤 1: npm run release:mac 失败
    │   └── 🔴 阻断 → 修复构建问题 → 重新开始
    │
    ├── 步骤 2: gh release create 失败
    │   ├── Release 已存在 → ⚠️ 补传产物
    │   ├── 认证失败 → 认证后重试
    │   └── 其他错误 → 🔴 阻断 → 修复后重试
    │
    ├── 步骤 3: Windows CI 失败
    │   └── 🔴 阻断 → 查看 CI 日志 → 修复 → 重新触发
    │
    ├── 步骤 4: Upload Mac to OSS 失败
    │   ├── Mac 产物在 Release 中 → ✅ 可继续验收 → 后续修复
    │   └── Mac 产物不在 Release 中 → ⚠️ 先补传 Release
    │
    └── 步骤 5: CDN 验证失败
        └── 🔴 阻断 → 重新触发 OSS 上传 → 等待 CDN 刷新
```

---

## 紧急回滚

如果发布后发现严重问题需要回滚：

### 回滚到上一版本

```bash
# 1. 获取上一版本号
PREV_VERSION=$(git tag --sort=-version:refname | head -2 | tail -1)
echo "上一版本: $PREV_VERSION"

# 2. 触发上一版本的 OSS 同步（覆盖 latest）
gh workflow run "Upload Mac to OSS" -f version=${PREV_VERSION#v}

# 3. 等待完成
gh run watch --exit-status

# 4. 验证
curl -s https://download.xiuer.work/releases/latest/latest-mac.yml | head -1
```

### 注意事项

1. **不要删除已发布的 tag**：保留历史版本便于追溯
2. **版本号只增不减**：修复后发布新版本，不覆盖旧版本
3. **通知用户**：如有必要，在 Release Notes 中说明问题

---

## 相关文档

- [RELEASE_SOP_MINIMAL.md](./RELEASE_SOP_MINIMAL.md) - 最简发布 SOP
- [RELEASE_SPECIFICATION.md](./RELEASE_SPECIFICATION.md) - 发布规范
- [RELEASE_PROCESS.md](./RELEASE_PROCESS.md) - 发布流程指南

---

**最后更新**：2026-03-18
**版本**：v1.0
