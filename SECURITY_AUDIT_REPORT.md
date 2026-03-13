# Electron 项目安全审计报告

> **版本**: v1.0
> **最后更新**: 2026-03-12
> **状态**: 已完成
> **负责人**: TEAM
> **当前适用性**: 部分有效（部分问题已修复，建议对照当前代码验证）
> **关联主文档**: 无
> **问题状态**: 部分已修复

---

**项目名称**: 秀儿直播助手  
**审计日期**: 2026-03-12  
**Electron 版本**: ^36.3.2  
**风险评估**: 🔴 HIGH - 发现多项安全隐患

---

## 1. Electron 主进程安全配置

### 1.1 BrowserWindow 配置分析

**文件**: [electron/main/app.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/app.ts#L308-L323)

```typescript
win = new BrowserWindow({
  title: `秀儿直播助手 - v${app.getVersion()}`,
  width: 1280,
  height: 800,
  // ...
  webPreferences: {
    preload,
    nodeIntegration: false,      // ✅ 安全：禁用 Node 集成
    contextIsolation: true,      // ✅ 安全：启用上下文隔离
    webSecurity: app.isPackaged, // ⚠️ 条件性：仅打包时启用
  },
})
```

| 配置项 | 状态 | 风险等级 | 说明 |
|--------|------|----------|------|
| `nodeIntegration` | ✅ false | LOW | 正确禁用 Node 集成 |
| `contextIsolation` | ✅ true | LOW | 正确启用上下文隔离 |
| `webSecurity` | ⚠️ 条件 | MEDIUM | 开发环境禁用，生产环境启用 |
| `sandbox` | ❌ 未设置 | MEDIUM | 未显式启用沙箱 |
| `enableRemoteModule` | ✅ 未使用 | LOW | 未使用危险模块 |

### 1.2 安全问题

#### 🔴 HIGH - webSecurity 在开发环境禁用
- **文件**: [electron/main/app.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/app.ts#L321)
- **行号**: 321
- **问题描述**: `webSecurity: app.isPackaged` 在开发环境 (`!app.isPackaged`) 时禁用 webSecurity，允许跨域请求和不安全内容
- **风险**: 开发环境可能成为攻击向量，如果开发机器被入侵
- **修复建议**: 
  ```typescript
  webPreferences: {
    // 始终启用 webSecurity，开发环境使用代理解决跨域
    webSecurity: true,
    // 如需跨域，使用 webRequest API 拦截修改
  }
  ```

#### 🟡 MEDIUM - 未显式启用 sandbox
- **文件**: [electron/main/app.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/app.ts#L317-L323)
- **问题描述**: 未设置 `sandbox: true`，依赖 Electron 默认行为
- **风险**: 默认行为可能因版本变化而改变
- **修复建议**: 显式添加 `sandbox: true` 到 webPreferences

---

## 2. Preload 与 Renderer 边界

### 2.1 contextBridge 暴露分析

**文件**: [electron/preload/index.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/preload/index.ts#L40)

```typescript
contextBridge.exposeInMainWorld('ipcRenderer', ipcRendererApi)
```

**文件**: [electron/preload/auth.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/preload/auth.ts#L88)

```typescript
contextBridge.exposeInMainWorld('authAPI', authAPI)
```

### 2.2 暴露的 API 清单

| API | 暴露内容 | 风险等级 | 说明 |
|-----|----------|----------|------|
| `ipcRenderer.on` | 事件监听 | LOW | 仅监听，不执行 |
| `ipcRenderer.send` | 发送消息 | LOW | 单向通信 |
| `ipcRenderer.invoke` | 调用主进程 | MEDIUM | 需要配合 IPC handler 审查 |
| `authAPI.*` | 认证相关 | MEDIUM | 包含 token 操作 |

### 2.3 安全问题

#### 🟡 MEDIUM - IPC 通道未做来源验证
- **文件**: [electron/preload/index.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/preload/index.ts#L10-L37)
- **问题描述**: Preload 暴露的 IPC 方法未验证消息来源
- **风险**: 如果 renderer 被 XSS 攻击，攻击者可调用任意 IPC 通道
- **修复建议**: 在 IPC handler 中添加来源验证或能力检查

---

## 3. IPC 通信安全

### 3.1 IPC Handler 清单

| 通道 | 文件 | 操作类型 | 风险等级 |
|------|------|----------|----------|
| `auth:login` | auth.ts | 用户认证 | MEDIUM |
| `auth:getTokens` | auth.ts | 读取 Token | HIGH |
| `auth:setTokens` | auth.ts | 写入 Token | HIGH |
| `auth:clearTokens` | auth.ts | 清除 Token | LOW |
| `tasks:liveControl:connect` | connection.ts | 启动浏览器 | MEDIUM |
| `tasks:subAccount:importAccounts` | subAccount.ts | JSON 解析 | MEDIUM |
| `chrome:selectPath` | browser.ts | 文件选择 | LOW |
| `app:openExternal` | app.ts | 打开外部链接 | MEDIUM |
| `liveStats:exportData` | liveStats.ts | 文件写入 | MEDIUM |
| `updater:*` | update.ts | 自动更新 | HIGH |

### 3.2 安全问题

#### 🔴 HIGH - Token 可通过 IPC 读取
- **文件**: [electron/main/ipc/auth.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/auth.ts#L245-L256)
- **行号**: 245-256
- **问题描述**: `auth:getTokens` 直接返回存储的 token 给 renderer
```typescript
ipcMain.handle('auth:getTokens', async () => {
  const tokens = await getStoredTokens()
  return {
    token: tokens.access_token,
    refreshToken: tokens.refresh_token,
  }
})
```
- **风险**: Renderer 进程可获取敏感 token，如果 renderer 被入侵则 token 泄露
- **修复建议**: 
  - 避免将 token 返回给 renderer
  - 在主进程使用 token 完成请求，只返回结果
  - 或使用 session cookie 替代 token 传递

#### 🔴 HIGH - 自动更新未校验签名
- **文件**: [electron/main/managers/UpdateManager.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/managers/UpdateManager.ts#L186-L328)
- **问题描述**: WindowsUpdater 依赖 electron-updater，但未显式配置签名验证
- **风险**: 中间人攻击可导致下载恶意更新包
- **修复建议**: 
  - 启用 `publisherName` 验证
  - 配置 `verifyUpdateCodeSignature: true`
  - 确保更新服务器使用 HTTPS

#### 🟡 MEDIUM - openExternal 未限制协议
- **文件**: [electron/main/ipc/app.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/app.ts#L23-L38)
- **行号**: 23-38
- **问题描述**: 虽然限制了 http/https，但 URL 验证后未对重定向进行限制
```typescript
const allowedProtocols = ['http:', 'https:']
// ...
shell.openExternal(url)
```
- **风险**: 某些平台 shell.openExternal 可能存在协议绕过
- **修复建议**: 添加更严格的 URL 白名单机制

#### 🟡 MEDIUM - importAccounts 解析未验证
- **文件**: [electron/main/ipc/subAccount.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/subAccount.ts#L335-L360)
- **行号**: 335-360
- **问题描述**: 直接 `JSON.parse(jsonData)` 未验证数据结构
```typescript
const accounts = JSON.parse(jsonData) as Array<{
  id: string
  name: string
  platform: LiveControlPlatform
}>
```
- **风险**: 可能导致原型链污染或意外数据结构
- **修复建议**: 使用 zod 或 joi 进行 schema 验证

#### 🟡 MEDIUM - 浏览器路径执行未验证
- **文件**: [electron/main/utils/checkChrome.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/utils/checkChrome.ts#L2)
- **行号**: 2
- **问题描述**: 使用 `exec` 执行 PowerShell/osascript 查找浏览器
```typescript
import { exec } from 'node:child_process'
```
- **风险**: 如果配置被篡改，可能执行任意命令
- **修复建议**: 使用 `execFile` 替代 `exec`，避免 shell 解释

---

## 4. 文件系统安全

### 4.1 文件操作清单

| 操作 | 文件 | 路径来源 | 风险等级 |
|------|------|----------|----------|
| `fs.writeFileSync` | liveStats.ts | 用户数据目录 | LOW |
| `fs.writeFileSync` | DownloadManager.ts | 下载目录 | MEDIUM |
| `fs.rm` | screenshot.ts | 临时目录 | LOW |
| `fs.readdir` | screenshot.ts | 临时目录 | LOW |

### 4.2 安全问题

#### 🟡 MEDIUM - 导出文件名可能包含路径遍历
- **文件**: [electron/main/ipc/liveStats.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/liveStats.ts#L171)
- **行号**: 171
- **问题描述**: 账号名清理可能不完整
```typescript
const safeAccountName = (data.accountName || '未知账号').replace(/[<>:"/\\|?*]/g, '_')
```
- **风险**: 虽然替换了危险字符，但使用正则可能遗漏某些 Unicode 字符
- **修复建议**: 使用专用库如 `sanitize-filename`

#### 🟡 MEDIUM - 下载文件路径未验证
- **文件**: [electron/main/managers/DownloadManager.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/managers/DownloadManager.ts#L64-L99)
- **行号**: 64-99
- **问题描述**: `destination` 参数直接传入，未验证是否在允许目录
- **风险**: 可能写入系统关键目录
- **修复建议**: 验证 `destination` 在应用目录或用户目录下

---

## 5. 自动更新安全

### 5.1 配置分析

**文件**: [electron-builder.json](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron-builder.json#L144-L148)

```json
"publish": {
  "provider": "generic",
  "url": "https://xiuer.work/releases/latest",
  "channel": "latest"
}
```

### 5.2 安全问题

#### 🔴 HIGH - 更新源未使用 HTTPS 证书固定
- **文件**: [electron/main/managers/UpdateManager.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/managers/UpdateManager.ts)
- **问题描述**: 使用 generic provider，依赖系统证书链，无证书固定
- **风险**: 如果 DNS 被劫持或证书被伪造，可能下载恶意更新
- **修复建议**: 
  - 实现证书固定 (certificate pinning)
  - 验证更新包签名
  - 使用 GitHub Releases 官方 API 而非 generic provider

#### 🟡 MEDIUM - latest-mac.yml 来源未经验证
- **文件**: [electron/main/managers/UpdateManager.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/managers/UpdateManager.ts#L345-L347)
- **行号**: 345-347
- **问题描述**: 直接获取并解析 yml 文件，未验证签名
```typescript
const ymlContent = (await net.fetch(latestYmlURL).then(res => res.text())) as string
const latestYml = yaml.parse(ymlContent) as LatestYml
```
- **风险**: yml 文件可能被篡改
- **修复建议**: 对 yml 文件进行数字签名验证

#### 🟢 LOW - 有 SHA512 校验逻辑
- **文件**: [electron/main/managers/UpdateManager.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/managers/UpdateManager.ts#L391-L400)
- **说明**: MacOSUpdater 实现了 SHA512 校验，但 WindowsUpdater 依赖 electron-updater 默认行为

---

## 6. 认证与 Token 安全

### 6.1 Token 存储分析

**文件**: [electron/main/services/CloudAuthStorage.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/services/CloudAuthStorage.ts)

```typescript
// AES-256-GCM 加密存储
const ALG = 'aes-256-gcm'
const filePath = path.join(userData, 'auth', 'tokens.enc')
```

### 6.2 安全问题

#### 🔴 HIGH - 开发环境使用硬编码密钥
- **文件**: [electron/main/services/CloudAuthStorage.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/services/CloudAuthStorage.ts#L72-L81)
- **行号**: 72-81
- **问题描述**: 
```typescript
function getSecretKey(): Buffer {
  const base = process.env.AUTH_STORAGE_SECRET
  if (!base) {
    console.warn('[CloudAuthStorage] AUTH_STORAGE_SECRET not set, using default key for development')
    return scryptSync('dev-secret-key-please-change-in-production', 'salt', KEY_LEN)
  }
  return scryptSync(base, 'salt', KEY_LEN)
}
```
- **风险**: 开发环境密钥可预测，如果开发构建被泄露则 token 可被解密
- **修复建议**: 
  - 开发环境也要求设置环境变量
  - 使用随机生成的临时密钥
  - 添加构建时检查，确保生产环境必须设置密钥

#### 🟡 MEDIUM - Token 在日志中可能泄露
- **文件**: [electron/main/ipc/auth.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/auth.ts#L246-L251)
- **行号**: 246-251
- **问题描述**: 
```typescript
console.log('[Auth IPC] Tokens retrieved:', {
  hasAccessToken: !!tokens.access_token,
  hasRefreshToken: !!tokens.refresh_token,
})
```
- **风险**: 虽然只打印布尔值，但其他地方的日志可能泄露完整 token
- **修复建议**: 审计所有日志输出，确保 token 不会被打印

#### 🟡 MEDIUM - 固定 Salt 值
- **文件**: [electron/main/services/CloudAuthStorage.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/services/CloudAuthStorage.ts#L81)
- **行号**: 81
- **问题描述**: 使用固定字符串 `'salt'` 作为 salt
- **风险**: 降低密钥派生安全性
- **修复建议**: 使用随机生成的 salt 并存储

---

## 7. 依赖安全

### 7.1 生产依赖分析

| 包名 | 版本 | 风险等级 | 说明 |
|------|------|----------|------|
| `electron-updater` | 6.6.2 | MEDIUM | 自动更新功能，需确保配置安全 |
| `playwright` | ^1.50.0 | MEDIUM | 浏览器自动化，可能执行任意代码 |
| `xlsx` | ^0.18.5 | MEDIUM | 存在已知安全漏洞 (CVE-2023-...) |
| `jsonwebtoken` | ^9.0.2 | LOW | 使用最新版本，安全 |
| `bcryptjs` | ^2.4.3 | LOW | 纯 JS 实现，性能较慢但安全 |
| `better-sqlite3` | ^11.7.0 | LOW | 原生模块，需确保来源可信 |
| `exceljs` | ^4.4.0 | LOW | Excel 处理库 |

### 7.2 安全问题

#### 🟡 MEDIUM - xlsx 包存在已知漏洞
- **包名**: xlsx
- **版本**: ^0.18.5
- **风险**: 存在原型链污染等已知漏洞
- **修复建议**: 
  - 升级到最新版本 0.20.0+
  - 或考虑使用 `exceljs` 替代（已作为依赖）

#### 🟡 MEDIUM - playwright 可执行任意浏览器操作
- **包名**: playwright
- **风险**: 如果配置被篡改，可能访问恶意网站
- **缓解措施**: 
  - 浏览器路径由用户选择或自动检测
  - 不执行任意用户输入的脚本

---

## 8. CI/CD 与发布安全

### 8.1 GitHub Actions 配置

**文件**: [.github/workflows/build-windows.yml](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/.github/workflows/build-windows.yml)

### 8.2 安全问题

#### 🟡 MEDIUM - OSS 上传使用长期凭证
- **文件**: [.github/workflows/build-windows.yml](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/.github/workflows/build-windows.yml#L182-L183)
- **行号**: 182-183
- **问题描述**: 
```yaml
env:
  ALIYUN_ACCESS_KEY_ID: ${{ secrets.ALIYUN_ACCESS_KEY_ID }}
  ALIYUN_ACCESS_KEY_SECRET: ${{ secrets.ALIYUN_ACCESS_KEY_SECRET }}
```
- **风险**: 使用 AccessKey 可能权限过大，且为长期凭证
- **修复建议**: 
  - 使用 OIDC 联邦身份认证
  - 或使用短期 STS Token

#### 🟢 LOW - 构建产物验证良好
- **说明**: 工作流中实现了 Mac 产物检查，防止 Windows 构建产生 Mac 产物

#### 🟢 LOW - 未上传敏感目录
- **说明**: OSS 上传仅选择特定文件，不递归上传整个 release 目录

---

## 9. 危险代码扫描

### 9.1 扫描结果

| 危险模式 | 发现数量 | 风险等级 | 说明 |
|----------|----------|----------|------|
| `eval()` | 0 | - | ✅ 未发现 |
| `Function()` | 0 | - | ✅ 未发现 |
| `child_process` | 有 | MEDIUM | 仅在构建脚本和浏览器检测中使用 |
| `dangerouslySetInnerHTML` | 1 | LOW | 已使用 DOMPurify 防护 |
| `console.log` | 多 | LOW | 主进程日志，可能泄露信息 |

### 9.2 安全问题

#### 🟡 MEDIUM - child_process 使用
- **文件**: [electron/main/utils/checkChrome.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/utils/checkChrome.ts#L2)
- **问题描述**: 使用 `exec` 执行系统命令
- **风险**: 如果输入被污染，可能导致命令注入
- **修复建议**: 使用 `execFile` 替代

#### 🟢 LOW - dangerouslySetInnerHTML 已防护
- **文件**: [src/components/common/HtmlRenderer.tsx](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/src/components/common/HtmlRenderer.tsx)
- **说明**: 已使用 DOMPurify 进行 HTML 净化
```typescript
const safeHtml = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
return <div dangerouslySetInnerHTML={{ __html: safeHtml }} {...props} />
```

---

## 10. 总结与建议

### 10.1 风险统计

| 风险等级 | 数量 | 状态 |
|----------|------|------|
| 🔴 HIGH | 5 | 需立即修复 |
| 🟡 MEDIUM | 12 | 建议修复 |
| 🟢 LOW | 3 | 可接受 |

### 10.2 优先修复项

1. **立即修复 (HIGH)**:
   - [ ] 修复开发环境硬编码加密密钥
   - [ ] 限制 Token 通过 IPC 暴露给 Renderer
   - [ ] 启用自动更新签名验证
   - [ ] 实现更新源证书固定
   - [ ] 始终启用 webSecurity

2. **建议修复 (MEDIUM)**:
   - [ ] 升级 xlsx 包到安全版本
   - [ ] 使用 execFile 替代 exec
   - [ ] 验证 IPC 输入参数
   - [ ] 使用随机 Salt
   - [ ] 使用 OIDC 替代长期 AccessKey

### 10.3 安全加固建议

```typescript
// 1. BrowserWindow 安全配置示例
const win = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,              // 显式启用沙箱
    webSecurity: true,          // 始终启用
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
  },
})

// 2. IPC 输入验证示例
import { z } from 'zod'

const ImportAccountsSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  platform: z.enum(['douyin', 'kuaishou', ...])
}))

ipcMain.handle('importAccounts', async (_, data) => {
  const accounts = ImportAccountsSchema.parse(JSON.parse(data))
  // ...
})

// 3. 安全存储示例
function getSecretKey(): Buffer {
  const secret = process.env.AUTH_STORAGE_SECRET
  if (!secret) {
    if (app.isPackaged) {
      throw new Error('AUTH_STORAGE_SECRET must be set in production')
    }
    // 开发环境生成随机临时密钥
    return crypto.randomBytes(32)
  }
  return scryptSync(secret, crypto.randomBytes(32), 32)
}
```

---

**审计完成** | 报告生成时间: 2026-03-12
