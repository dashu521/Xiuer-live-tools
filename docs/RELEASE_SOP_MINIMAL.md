# 秀儿直播助手最简发布 SOP

这份文档只回答一个问题：

**如何把当前代码优化真正发到用户客户端，并让客户端收到更新提醒。**

## 先记住两件事

1. 用户客户端默认更新源是国内 CDN：
   `https://download.xiuer.work/releases/latest`
2. 想让客户端识别到新版本，必须提升版本号。

只推代码到仓库，不会让现有客户端弹更新。

## 标准流程

### 1. 切到 `main` 并合并本次改动

```bash
git checkout main
git merge codex/split-current-work
```

### 2. 提升版本号

补丁更新：

```bash
npm version patch
```

功能型更新：

```bash
npm version minor
```

## 3. 推送 `main` 和版本标签

```bash
git push origin main
git push origin --tags
```

说明：

- `npm version patch` / `minor` 会自动创建 `vX.Y.Z` tag
- 推送 tag 后会触发 Windows 发布工作流

### 4. 等 Windows 工作流完成

Windows 工作流会负责：

- 构建 `.exe`
- 生成 `latest.yml`
- 上传 GitHub Release
- 同步到阿里云 OSS / CDN 的 `releases/latest`

对应工作流：
[build-windows.yml](/Users/xiuer/TRAE-CN/Xiuer-live-tools/.github/workflows/build-windows.yml)

### 5. 如果本次需要发布 macOS，再执行本地发布

```bash
npm run publish:mac:full
```

这一步会把 macOS 产物同步到 CDN，并验证：

- `latest-mac.yml`
- `.dmg`
- `https://download.xiuer.work/releases/latest/`

### 6. 做发布检查

```bash
npm run publish:check
```

### 7. 部署下载首页

如果这次改动影响了下载页，或者希望首页上的版本号、按钮链接立即同步到最新发布，再执行：

```bash
npm run deploy:download-page
```

说明：

- 这一步会把 `download-page/index.html` 上传到 OSS 根目录
- 不影响 `releases/latest/` 更新链路
- 首页现在会运行时读取 `latest.yml / latest-mac.yml`，但页面本身仍然需要部署一次

## 发布成功的判断标准

满足下面几项，才算真正“用户可更新”：

- `package.json` 版本号已经提升
- Windows 的 `latest.yml` 已更新
- 如果发 macOS，`latest-mac.yml` 也已更新
- 安装包已经同步到 `download.xiuer.work/releases/latest/`
- 下载首页已经同步到 OSS 根目录（如本次有首页改动）
- `npm run publish:check` 通过

## 最常用的一套命令

只发 Windows / 国内用户主链路：

```bash
git checkout main
git merge codex/split-current-work
npm version patch
git push origin main
git push origin --tags
npm run publish:check
npm run deploy:download-page
```

同时发 macOS：

```bash
git checkout main
git merge codex/split-current-work
npm version patch
git push origin main
git push origin --tags
npm run publish:mac:full
npm run publish:check
npm run deploy:download-page
```

## 常见误区

### 误区 1：只要推到 GitHub 就算发版

不对。

客户端检查的是版本号和更新清单，不是普通提交记录。

### 误区 2：代码改了但版本号不变也能更新

通常不行。

客户端会认为当前已经是同一版本，不会提示更新。

### 误区 3：国内用户主要走 GitHub 下载

不对。

当前正式链路是：

`客户端 -> download.xiuer.work -> 阿里云 CDN -> OSS`

## 相关文档

- [ONLINE_UPDATE_SPEC.md](/Users/xiuer/TRAE-CN/Xiuer-live-tools/docs/ONLINE_UPDATE_SPEC.md)
- [RELEASE_PROCESS.md](/Users/xiuer/TRAE-CN/Xiuer-live-tools/docs/RELEASE_PROCESS.md)
- [RELEASE_SPECIFICATION.md](/Users/xiuer/TRAE-CN/Xiuer-live-tools/docs/RELEASE_SPECIFICATION.md)
- [CDN_SETUP_GUIDE.md](/Users/xiuer/TRAE-CN/Xiuer-live-tools/docs/CDN_SETUP_GUIDE.md)
