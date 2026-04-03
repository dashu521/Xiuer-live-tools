# 秀儿直播助手最简发布 SOP

这份文档只回答一个问题：

**如何把当前代码优化真正发到用户客户端，并让客户端收到更新提醒。**

## 先记住两件事

1. 用户客户端默认更新源是国内 CDN：
   `https://download.xiuer.work/releases/latest`
2. 想让客户端识别到新版本，必须提升版本号。

只推代码到仓库，不会让现有客户端弹更新。

---

## 职责边界

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          发布职责边界                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  【本地 Mac 职责】                                                        │
│  ├── 构建 macOS 安装包                                                   │
│  ├── 上传到 GitHub Release                                               │
│  └── ❌ 不再依赖 OSS 凭证（本地无需配置阿里云密钥）                          │
│                                                                         │
│  【GitHub Actions 职责】                                                  │
│  ├── 构建 Windows 安装包                                                 │
│  ├── 上传 Windows 产物到 GitHub Release                                  │
│  ├── 同步 Windows 产物到 OSS/CDN                                         │
│  ├── 同步 macOS 产物到 OSS/CDN（upload-mac-oss workflow）                 │
│  └── ✅ OSS 凭证统一由 GitHub Secrets 管理                                │
│                                                                         │
│  【手工兜底】                                                             │
│  └── npm run upload:mac:oss 仅在当地有 OSS 凭证时使用                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 标准发布流程（完整版）

### 步骤 1: 本地 Mac 构建

```bash
# 设置生产环境 HTTPS API 地址
export VITE_AUTH_API_BASE_URL=https://auth.xiuer.work
export AUTH_STORAGE_SECRET=$(openssl rand -hex 32)

# 提升版本号（先定版本号）
npm version patch  # 或 minor

# 执行 Mac 构建（读取版本号生成产物）
npm run release:mac
```

产物位置：`release/<version>/*.dmg + latest-mac.yml`

### 步骤 2: 创建 Tag、推送并打开 draft Release

```bash
# 推送 main、创建 tag、推送 tag、创建 draft Release
npm run publish:confirm
```

### 步骤 3: 并行编排平台资产

```bash
# 根据当前状态自动补齐：
# - 若本地 mac 产物已就绪，则上传到 draft Release
# - 若 mac CDN 未同步，则触发 Upload Mac to OSS
npm run publish:orchestrate
```

### 步骤 4: 等待 Windows CI 完成

Windows CI 会自动：
- 构建 `.exe` + `.zip` + `latest.yml`
- 上传到 draft GitHub Release
- 同步 Windows 产物到 OSS/CDN

查看状态：https://github.com/Xiuer-Chinese/Xiuer-live-tools/actions

### 步骤 5: 发布后纯验收

```bash
npm run publish:verify
```

---

## 最简发布命令（人执行版）

### 只发 Windows（最常用）

```bash
# 1. 合并代码到 main
git checkout main
git merge <feature-branch>

# 2. 提升版本号
npm version patch  # 或 minor

# 3. 确认并推送
npm run publish:confirm

# 4. 等待 Windows CI 完成并执行纯验收
npm run publish:verify

# 5. 如需查看状态
npm run release:status
```

### 同时发 macOS + Windows

```bash
# 1. 设置环境变量
export VITE_AUTH_API_BASE_URL=https://auth.xiuer.work
export AUTH_STORAGE_SECRET=$(openssl rand -hex 32)

# 2. 提升版本号（先定版本号）
npm version patch  # 或 minor

# 3. 构建 Mac（读取版本号生成产物）
npm run release:mac

# 4. 推送代码、tag，并创建 draft Release
npm run publish:confirm

# 5. 并行编排平台资产
npm run publish:orchestrate

# 6. 验收
npm run publish:verify
```

---

## 发布成功的判断标准

满足下面几项，才算真正"用户可更新"：

- [ ] `package.json` 版本号已提升
- [ ] GitHub draft Release 已创建
- [ ] Windows 产物已上传到 GitHub Release
- [ ] macOS 产物已上传到 GitHub Release
- [ ] `latest.yml` 已同步到 OSS（Windows 自动更新）
- [ ] `latest-mac.yml` 已同步到 OSS（macOS 自动更新）
- [ ] 所有安装包可从 `download.xiuer.work/releases/latest/` 下载

---

## 常见误区

### 误区 1：只要推到 GitHub 就算发版

不对。客户端检查的是版本号和更新清单，不是普通提交记录。

### 误区 2：代码改了但版本号不变也能更新

通常不行。客户端会认为当前已经是同一版本，不会提示更新。

### 误区 3：本地需要配置 OSS 凭证

**不再需要**。OSS 上传统一走 GitHub Actions，本地无需配置阿里云密钥。

### 误区 4：GitHub Release 成功 = 发布完成

不对。还需要确认 OSS/CDN 同步完成，用户才能从国内 CDN 下载。

---

## 相关文档

- [RELEASE_SPECIFICATION.md](./RELEASE_SPECIFICATION.md) - 发布规范
- [RELEASE_PROCESS.md](./RELEASE_PROCESS.md) - 发布流程指南
- [RELEASE_TROUBLESHOOTING.md](./RELEASE_TROUBLESHOOTING.md) - **发布失败处理指南**
- [ONLINE_UPDATE_SPEC.md](./ONLINE_UPDATE_SPEC.md) - 在线更新规范
- [CDN_SETUP_GUIDE.md](./CDN_SETUP_GUIDE.md) - CDN 配置指南

---

## 发布失败？

👉 **请查阅 [RELEASE_TROUBLESHOOTING.md](./RELEASE_TROUBLESHOOTING.md)**

覆盖以下失败场景：
- `npm run release:mac` 失败
- `gh release create` 失败
- Windows CI 失败
- Upload Mac to OSS workflow 失败
- CDN / latest-mac.yml 验证失败

---

**最后更新**：2026-03-18
**版本**：v2.0
