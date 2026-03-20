# 二次安全审计报告

**审计日期**: 2026-03-12  
**审计范围**: 全仓库代码复核  
**审计重点**: HIGH/MEDIUM 项证据验证、误判识别

---

## 一、已确认问题（Critical / High / Medium）

### 1. [Critical] auth:getTokens 直接暴露完整 Token 给 Renderer

**风险等级**: Critical  
**证据文件**: [electron/main/ipc/auth.ts L245-256](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/auth.ts#L245-L256)

```typescript
ipcMain.handle('auth:getTokens', async () => {
  console.log('[Auth IPC] Getting tokens from storage')
  const tokens = await getStoredTokens()
  return {
    token: tokens.access_token,        // 完整 access_token
    refreshToken: tokens.refresh_token // 完整 refresh_token
  }
})
```

**Preload 暴露链**: [electron/preload/auth.ts L47-49](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/preload/auth.ts#L47-L49)
```typescript
const authAPI = {
  getTokens: () => ipcRenderer.invoke('auth:getTokens'),
  // ...
}
contextBridge.exposeInMainWorld('authAPI', authAPI)
```

**可利用前提**:
1. Renderer 进程被 XSS 攻击（通过加载的第三方脚本或恶意网页内容）
2. 恶意浏览器扩展访问 renderer 内存
3. DevTools 被打开，开发者手动执行

**真实影响**:
- 攻击者获取完整 access_token 和 refresh_token
- 可冒充用户调用后端 API
- 可获取用户敏感数据（账号信息、直播数据等）

**为什么上一轮结论正确**:
- 代码明确返回完整 token，无脱敏处理
- Renderer 可通过 `window.authAPI.getTokens()` 直接获取

**最小修复方案**:
```typescript
// 替换 auth:getTokens 为 auth:getAuthStatus
ipcMain.handle('auth:getAuthStatus', async () => {
  const tokens = await getStoredTokens()
  return {
    isAuthenticated: !!tokens.access_token,
    hasRefreshToken: !!tokens.refresh_token,
    // 可选：返回过期时间戳（不包含 token 值）
    expiresAt: tokens.expires_at
  }
})
```

---

### 2. [Critical] 生产环境可能使用硬编码密钥

**风险等级**: Critical  
**证据文件**: [electron/main/services/CloudAuthStorage.ts L72-82](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/services/CloudAuthStorage.ts#L72-L82)

```typescript
function getSecretKey(): Buffer {
  const base = process.env.AUTH_STORAGE_SECRET
  if (!base) {
    console.warn('[CloudAuthStorage] AUTH_STORAGE_SECRET not set, using default key for development')
    return scryptSync('dev-secret-key-please-change-in-production', 'salt', KEY_LEN)
  }
  return scryptSync(base, 'salt', KEY_LEN)  // 固定 salt
}
```

**可利用前提**:
1. 生产构建时未设置 `AUTH_STORAGE_SECRET` 环境变量
2. 使用可预测的默认密钥加密所有用户 token
3. 攻击者获取加密文件后可离线解密

**真实影响**:
- 所有用户 token 可被解密
- 攻击者无需知道用户密码即可获取认证凭证

**为什么上一轮结论正确**:
- 代码明确存在默认密钥回退逻辑
- 生产环境未强制检查环境变量

**最小修复方案**:
```typescript
function getSecretKey(): Buffer {
  const secret = process.env.AUTH_STORAGE_SECRET
  
  // 生产环境强制要求设置密钥
  if (app.isPackaged && !secret) {
    throw new Error('AUTH_STORAGE_SECRET must be set in production')
  }
  
  if (!secret) {
    // 开发环境：生成随机临时密钥（不持久化）
    if (!global._tempAuthKey) {
      global._tempAuthKey = crypto.randomBytes(32)
    }
    return global._tempAuthKey
  }
  
  // 使用随机 salt
  return scryptSync(secret, crypto.randomBytes(16), KEY_LEN)
}
```

---

### 3. [High] IPC 通道缺少输入校验

**风险等级**: High  
**证据文件**: [electron/main/ipc/subAccount.ts L335-360](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/subAccount.ts#L335-L360)

```typescript
ipcMain.handle(IPC_CHANNELS.TASKS.SUBACCOUNT.IMPORT_ACCOUNTS, async (_, jsonData: string) => {
  // 直接解析，无 schema 校验
  const accounts = JSON.parse(jsonData) as Array<{
    id: string
    name: string
    platform: LiveControlPlatform
  }>
  // ...
})
```

**其他无校验 IPC**:
- [commentListener.ts L35](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/commentListener.ts#L35): `JSON.parse(config)`
- [autoMessage.ts L21](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/autoMessage.ts#L21): `JSON.parse(config)`

**可利用前提**:
1. Renderer 被 XSS 攻击
2. 攻击者构造恶意 JSON payload
3. 利用原型链污染或类型混淆

**真实影响**:
- 原型链污染攻击
- 应用逻辑异常
- 可能的权限绕过

**最小修复方案**:
```typescript
import { z } from 'zod'

const ImportAccountsSchema = z.array(z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  platform: z.enum(['douyin', 'kuaishou', 'taobao', 'xiaohongshu'])
}))

ipcMain.handle(IPC_CHANNELS.TASKS.SUBACCOUNT.IMPORT_ACCOUNTS, async (_, jsonData: string) => {
  const accounts = ImportAccountsSchema.parse(JSON.parse(jsonData))
  // ...
})
```

---

### 4. [High] 文件导出路径存在目录遍历风险

**风险等级**: High  
**证据文件**: [electron/main/ipc/liveStats.ts L167-172](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/liveStats.ts#L167-L172)

```typescript
const safeAccountName = (data.accountName || '未知账号').replace(/[<>:"/\\|?*]/g, '_')
const fileName = `直播数据_${safeAccountName}_${timestamp}.xlsx`
const exportDir = path.join(documentsPath, 'TASI直播数据')
const filePath = path.join(exportDir, fileName)  // 未验证路径前缀
```

**问题分析**:
- `replace()` 未处理 `..` 和 `.`
- `path.join` 规范化后仍可能逃逸出目标目录
- 示例: `accountName = '../../../etc/passwd'`

**可利用前提**:
1. 攻击者控制 `data.accountName`（通过 IPC 调用或数据篡改）
2. 构造包含 `..` 的账号名

**真实影响**:
- 文件写入任意目录
- 可能覆盖系统文件（取决于权限）

**最小修复方案**:
```typescript
const sanitizeFilename = (name: string): string => {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\.{2,}/g, '_')
}

const fileName = `直播数据_${sanitizeAccountName}_${timestamp}.xlsx`
const filePath = path.join(exportDir, fileName)

// 验证最终路径在目标目录内
if (!filePath.startsWith(exportDir + path.sep)) {
  throw new Error('Invalid file path')
}
```

---

### 5. [High] Windows 自动更新未启用代码签名验证

**风险等级**: High  
**证据文件**: [electron-builder.json L129](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron-builder.json#L129)

```json
"win": {
  "signAndEditExecutable": false
}
```

**更新管理器配置**: [UpdateManager.ts L186-328](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/managers/UpdateManager.ts#L186-L328)

```typescript
class WindowsUpdater {
  private configureUpdater() {
    this.autoUpdater.forceDevUpdateConfig = true
    this.autoUpdater.disableWebInstaller = false
    this.autoUpdater.allowDowngrade = false
    // 未配置 verifyUpdateCodeSignature
  }
}
```

**可利用前提**:
1. 更新服务器被入侵
2. 中间人攻击（HTTPS 被绕过）
3. 恶意更新包被下载并执行

**真实影响**:
- 执行恶意代码
- 完全控制用户机器

**为什么上一轮结论过于乐观**:
- SHA512 校验只能验证文件完整性，不能验证来源可信性
- 缺少代码签名意味着任何人可构造"合法"更新

**最小修复方案**:
```json
// electron-builder.json
"win": {
  "signAndEditExecutable": true,
  "certificateFile": "path/to/cert.p12",
  "certificatePassword": "${env.CERT_PASSWORD}"
}
```

```typescript
// UpdateManager.ts
this.autoUpdater.verifyUpdateCodeSignature = true
this.autoUpdater.publisherName = ['秀儿直播助手']
```

---

### 6. [Medium] OSS/CDN 发布存在缓存不一致风险

**风险等级**: Medium  
**证据文件**: [VersionManager.ts L63](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/managers/VersionManager.ts#L63)

```typescript
this.channels = [
  { name: 'stable', priority: 1, checkUrl: 'https://xiuer.work/releases/latest' },
  // CDN 地址
]
```

**问题分析**:
- CDN 缓存可能导致 latest.yml 与实际文件不一致
- 客户端下载的 SHA512 与实际文件不匹配
- 更新失败或安装损坏

**可利用前提**:
1. CDN 缓存配置不当
2. 文件更新后 CDN 未刷新
3. 用户下载到旧版本 yml 但新版本安装包

**真实影响**:
- 更新失败
- 用户体验差
- 可能的更新循环

**最小修复方案**:
```typescript
// 添加缓存破坏参数
const ymlUrl = `${baseUrl}/${ymlFile}?t=${Date.now()}`

// 或使用版本号
const ymlUrl = `${baseUrl}/${ymlFile}?v=${app.getVersion()}`
```

---

### 7. [Medium] xlsx 包为直接依赖但未使用

**风险等级**: Medium  
**证据文件**: [package.json L56](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/package.json#L56)

```json
"dependencies": {
  "exceljs": "^4.4.0",
  "xlsx": "^0.18.5"  // 存在 CVE 漏洞
}
```

**使用验证**:
```bash
# 全仓库搜索 xlsx 导入
$ grep -r "import.*xlsx\|require.*xlsx" --include="*.ts" --include="*.js"
# 无结果
```

**实际使用**: [liveStats.ts L167](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/liveStats.ts#L167)
```typescript
const { Workbook } = await import('exceljs')  // 使用 exceljs
```

**问题分析**:
- xlsx 0.18.5 存在已知漏洞（原型链污染、ReDoS）
- 作为直接依赖被打包进产物
- 增加攻击面

**最小修复方案**:
```bash
# 从依赖中移除
npm uninstall xlsx
```

---

## 二、被高估的风险

### 1. webSecurity 在开发环境禁用

**原评级**: HIGH  
**实际评级**: Low  
**理由**:
- 开发环境禁用 webSecurity 是 Electron 常见做法
- `contextIsolation: true` 和 `nodeIntegration: false` 已提供基础保护
- 攻击需物理访问开发机器或开发环境已被入侵

---

### 2. 未显式启用 sandbox

**原评级**: HIGH  
**实际评级**: Low  
**理由**:
- Electron 12+ 默认启用 sandbox（当 `nodeIntegration: false`）
- 当前配置 `nodeIntegration: false` + `contextIsolation: true` 已安全
- 未显式设置不构成实际风险

---

### 3. Token 日志泄露

**原评级**: MEDIUM  
**实际评级**: Low  
**理由**:
- [auth.ts L246-251](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/auth.ts#L246-L251) 仅输出布尔值:
  ```typescript
  console.log('[Auth IPC] Tokens retrieved:', {
    hasAccessToken: !!tokens.access_token,   // 布尔值
    hasRefreshToken: !!tokens.refresh_token  // 布尔值
  })
  ```
- cloudAuthClient.ts 已实现请求数据脱敏

---

### 4. child_process exec 命令注入

**原评级**: MEDIUM  
**实际评级**: Low  
**理由**:
- [checkChrome.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/utils/checkChrome.ts) 使用的命令是硬编码的
- 用户输入仅用于过滤，不直接拼接到命令
- 实际注入风险极低

---

## 三、被低估的风险

### 1. Preload 暴露面过大

**原评级**: 未明确评估  
**实际评级**: High  
**证据**:

**Preload 暴露 API 清单**:

| API | 文件系统 | Shell | 网络 | 鉴权信息 | 风险 |
|-----|----------|-------|------|----------|------|
| `authAPI.getTokens` | ❌ | ❌ | ❌ | ✅ | Critical |
| `authAPI.setTokens` | ❌ | ❌ | ✅ | ✅ | High |
| `authAPI.clearTokens` | ❌ | ❌ | ❌ | ✅ | Medium |
| `ipcRenderer.invoke` | 取决于 IPC | 取决于 IPC | 取决于 IPC | 取决于 IPC | High |
| `ipcRenderer.send` | 取决于 IPC | 取决于 IPC | 取决于 IPC | 取决于 IPC | Medium |
| `ipcRenderer.on` | ❌ | ❌ | ❌ | ❌ | Low |

**问题**:
- Preload 暴露了通用 IPC 调用能力
- 任何 IPC handler 的漏洞都可通过 Preload 被利用

**修复建议**:
- 限制 Preload 暴露的 IPC 通道白名单
- 移除通用 `invoke`/`send`，改为具体方法暴露

---

### 2. 开发/生产配置隔离不严格

**原评级**: 未明确评估  
**实际评级**: Medium  
**证据**:

**package.json L17**:
```json
"dev": "cross-env USE_REAL_AUTH=true USE_MOCK_AUTH=false AUTH_API_BASE_URL=http://121.41.179.197:8000 vite"
```

**问题**:
- 开发脚本硬编码了真实 API 地址
- 开发环境配置可能被打包进产物
- 内网 IP 暴露

**修复建议**:
- 使用 `.env.local` 存储开发配置
- 确保生产构建不包含开发环境变量

---

### 3. OSS 上传使用长期 AccessKey

**原评级**: MEDIUM  
**实际评级**: High  
**证据**: [.github/workflows/build-windows.yml L182-183](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/.github/workflows/build-windows.yml#L182-L183)

**问题**:
- 使用长期有效的 AccessKey
- 密钥泄露风险高
- 权限范围可能过大

**修复建议**:
- 使用 OIDC 联邦身份认证
- 或配置短期 STS Token

---

## 四、发布前必须修复清单

### 阻断发布问题（Critical / High）

- [ ] **移除或修复 auth:getTokens** - 必须改为返回状态而非完整 token
- [ ] **强制生产环境设置 AUTH_STORAGE_SECRET** - 禁止回退到默认密钥
- [ ] **启用 Windows 代码签名** - 配置 `signAndEditExecutable: true` 和证书
- [ ] **添加 IPC 输入校验** - 所有 IPC handler 使用 zod 验证输入
- [ ] **修复文件导出路径遍历** - 验证路径前缀，阻止目录逃逸

### 强烈建议修复（Medium）

- [ ] **移除未使用的 xlsx 依赖** - 减少攻击面
- [ ] **配置 OSS OIDC 认证** - 替代长期 AccessKey
- [ ] **添加 CDN 缓存破坏参数** - 防止更新不一致
- [ ] **隔离开发/生产配置** - 避免开发配置混入生产包

---

**审计完成** | 报告生成时间: 2026-03-12
