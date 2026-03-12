# 最终安全发布审计报告

**审计日期**: 2026-03-12  
**审计范围**: 全仓库代码复核（基于第一次复核 + 第二次审计）  
**目标**: 输出可直接执行的修复优先级清单

---

## 一、已确认问题

### 1. [Critical] auth:getTokens 直接暴露完整 Token 给 Renderer

**风险等级**: Critical  
**阻断发布**: Yes

**证据文件**: 
- [electron/main/ipc/auth.ts L245-256](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/auth.ts#L245-L256)
- [electron/preload/auth.ts L47-48](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/preload/auth.ts#L47-L48)

**关键代码**:
```typescript
// auth.ts
ipcMain.handle('auth:getTokens', async () => {
  const tokens = await getStoredTokens()
  return {
    token: tokens.access_token,        // 完整 access_token
    refreshToken: tokens.refresh_token // 完整 refresh_token
  }
})

// preload/auth.ts
getTokens: async (): Promise<AuthTokens> => {
  return await ipcRenderer.invoke('auth:getTokens')
}
```

**利用前提**:
1. Renderer 被 XSS 攻击
2. 恶意浏览器扩展
3. DevTools 被打开

**真实影响**:
- 攻击者获取完整 access_token 和 refresh_token
- 可冒充用户调用后端 API
- 可获取用户敏感数据

**为什么之前结论不够准确**:
- 第二次审计已确认问题，但未强调此问题同时暴露了 refresh_token
- refresh_token 长期有效，泄露后攻击者可长期保持访问

**最小修复方案**:
```typescript
// 1. 移除 auth:getTokens，改为 auth:getAuthStatus
ipcMain.handle('auth:getAuthStatus', async () => {
  const tokens = await getStoredTokens()
  return {
    isAuthenticated: !!tokens.access_token,
    hasRefreshToken: !!tokens.refresh_token,
    expiresAt: tokens.expires_at  // 可选：返回过期时间
  }
})

// 2. 在 preload 中同步修改
const authAPI = {
  // 移除 getTokens
  getAuthStatus: () => ipcRenderer.invoke('auth:getAuthStatus'),
  // ...
}
```

---

### 2. [Critical] CloudAuthStorage 生产环境可能使用默认密钥

**风险等级**: Critical  
**阻断发布**: Yes

**证据文件**: [electron/main/services/CloudAuthStorage.ts L72-82](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/services/CloudAuthStorage.ts#L72-L82)

**关键代码**:
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

**利用前提**:
1. 生产构建时未设置 `AUTH_STORAGE_SECRET`
2. 所有用户 token 使用可预测的默认密钥加密

**真实影响**:
- 攻击者获取加密文件后可离线解密所有用户 token
- 无需知道用户密码即可获取认证凭证

**为什么之前结论不够准确**:
- 第二次审计已指出，但未给出"可真实落地"的修复方案
- 需注意：salt 在加密时随机生成（L118），但密钥派生使用固定 salt（L81）

**最小修复方案**:
```typescript
function getSecretKey(): Buffer {
  const secret = process.env.AUTH_STORAGE_SECRET
  
  // 生产环境强制要求设置密钥
  if (app.isPackaged && !secret) {
    throw new Error('AUTH_STORAGE_SECRET must be set in production')
  }
  
  // 开发环境：使用随机临时密钥（每次启动不同，不持久化）
  if (!secret) {
    console.warn('[CloudAuthStorage] Using random temp key for development')
    if (!global._tempAuthKey) {
      global._tempAuthKey = crypto.randomBytes(32)
    }
    return global._tempAuthKey
  }
  
  // 生产环境：使用环境变量密钥
  // 注意：salt 在 setStoredTokens 中随机生成，此处仅派生密钥
  return scryptSync(secret, 'salt', KEY_LEN)
}
```

---

### 3. [High] Preload 暴露通用 IPC 调用能力

**风险等级**: High  
**阻断发布**: No（但强烈建议修复）

**证据文件**: [electron/preload/index.ts L10-40](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/preload/index.ts#L10-L40)

**关键代码**:
```typescript
const ipcRendererApi: ElectronAPI['ipcRenderer'] = {
  on: (channel, listener) => { /* ... */ },
  send: (channel, ...args) => ipcRenderer.send(channel as string, ...args),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel as string, ...args),
}

contextBridge.exposeInMainWorld('ipcRenderer', ipcRendererApi)
```

**Preload 暴露 API 清单**:

| API | 文件系统 | Shell | 网络 | 鉴权信息 | 风险等级 |
|-----|----------|-------|------|----------|----------|
| `authAPI.getTokens` | ❌ | ❌ | ❌ | ✅ Critical | Critical |
| `authAPI.setTokens` | ❌ | ❌ | ✅ | ✅ | High |
| `authAPI.validateToken` | ❌ | ❌ | ✅ | ❌ | Medium |
| `authAPI.getCurrentUser` | ❌ | ❌ | ✅ | ❌ | Medium |
| `ipcRenderer.invoke` | 取决于通道 | 取决于通道 | 取决于通道 | 取决于通道 | High |
| `ipcRenderer.send` | 取决于通道 | 取决于通道 | 取决于通道 | 取决于通道 | Medium |

**利用前提**:
1. Renderer 被 XSS 攻击
2. 通过 `ipcRenderer.invoke` 调用任意 IPC 通道

**真实影响**:
- 任何 IPC handler 的漏洞都可通过 Preload 被利用
- 权限边界过宽

**为什么之前结论不够准确**:
- 第一次复核未评估 Preload 暴露面
- 第二次审计已指出，但未给出具体修复方案

**最小修复方案**:
```typescript
// 限制可调用通道白名单
const ALLOWED_CHANNELS = [
  'app:version',
  'app:platform',
  'auth:getAuthStatus',  // 替换后的接口
  // ... 其他必要通道
] as const

const ipcRendererApi = {
  invoke: (channel: string, ...args: unknown[]) => {
    if (!ALLOWED_CHANNELS.includes(channel)) {
      throw new Error(`Channel ${channel} is not allowed`)
    }
    return ipcRenderer.invoke(channel, ...args)
  }
}
```

---

### 4. [High] IPC 通道缺少输入校验

**风险等级**: High  
**阻断发布**: No（但强烈建议修复）

**证据文件**:
- [electron/main/ipc/subAccount.ts L335-360](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/subAccount.ts#L335-L360)
- [electron/main/ipc/commentListener.ts L35](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/commentListener.ts#L35)
- [electron/main/ipc/autoMessage.ts L21](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/autoMessage.ts#L21)

**关键代码**:
```typescript
// subAccount.ts
ipcMain.handle(IPC_CHANNELS.TASKS.SUBACCOUNT.IMPORT_ACCOUNTS, async (_, jsonData: string) => {
  const accounts = JSON.parse(jsonData) as Array<{ id: string; name: string; platform: LiveControlPlatform }>
  // 无 schema 校验
})
```

**高权限 IPC 清单**:

| 通道 | 权限 | 校验状态 |
|------|------|----------|
| `auth:setTokens` | 写入认证凭证 | ❌ 无校验 |
| `tasks:subAccount:importAccounts` | JSON 解析 | ❌ 无校验 |
| `tasks:commentListener:configure` | JSON 解析 | ❌ 无校验 |
| `tasks:autoMessage:configure` | JSON 解析 | ❌ 无校验 |
| `app:openExternal` | 打开外部链接 | ✅ 有协议校验 |
| `liveStats:exportData` | 文件写入 | ❌ 部分校验 |

**利用前提**:
1. Renderer 被 XSS 攻击
2. 构造恶意 JSON payload
3. 利用原型链污染或类型混淆

**真实影响**:
- 原型链污染攻击
- 应用逻辑异常

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

### 5. [High] 文件导出路径存在目录遍历风险

**风险等级**: High  
**阻断发布**: Yes

**证据文件**: [electron/main/ipc/liveStats.ts L167-173](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/liveStats.ts#L167-L173)

**关键代码**:
```typescript
const safeAccountName = (data.accountName || '未知账号').replace(/[<>:"/\\|?*]/g, '_')
const fileName = `直播数据_${safeAccountName}_${dateTimeStr}.xlsx`
const exportFolder = getExportFolder()  // user documents
const filePath = path.join(exportFolder, fileName)
// 未验证 filePath 是否在 exportFolder 内
```

**利用前提**:
1. 攻击者控制 `data.accountName`
2. 构造包含 `..` 的账号名

**真实影响**:
- 文件写入任意目录
- 可能覆盖系统文件

**为什么之前结论不够准确**:
- 第二次审计已指出，但给出的 `startsWith` 示例不严谨（未考虑路径分隔符）

**最小修复方案**:
```typescript
const sanitizeFilename = (name: string): string => {
  // 替换 Windows 非法字符和路径遍历
  return name
    .replace(/[<>"/\\|?*]/g, '_')  // Windows 非法字符
    .replace(/\.{2,}/g, '_')        // 路径遍历 ..
    .replace(/^\.+/, '_')           // 隐藏文件 .
}

const fileName = `直播数据_${sanitizeFilename(data.accountName || '未知账号')}_${dateTimeStr}.xlsx`
const filePath = path.resolve(exportFolder, fileName)

// 严格验证路径前缀
const resolvedExportFolder = path.resolve(exportFolder)
if (!filePath.startsWith(resolvedExportFolder + path.sep)) {
  throw new Error('Invalid file path: path traversal detected')
}
```

---

### 6. [High] Windows 自动更新未启用代码签名

**风险等级**: High  
**阻断发布**: Yes

**证据文件**:
- [electron-builder.json L129](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron-builder.json#L129)
- [electron-builder.json L145-149](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron-builder.json#L145-L149)

**关键代码**:
```json
"win": {
  "signAndEditExecutable": false,
  "publisherName": "秀儿直播助手"
},
"publish": {
  "provider": "generic",
  "url": "https://xiuer.work/releases/latest"
}
```

**利用前提**:
1. 更新服务器被入侵
2. 中间人攻击（HTTPS 被绕过）
3. 恶意更新包被下载

**真实影响**:
- 执行恶意代码
- 完全控制用户机器

**为什么之前结论不够准确**:
- 第二次审计已指出，但未强调 `signAndEditExecutable: false` 明确禁用了签名
- 当前配置仅设置了 `publisherName`，但未启用实际签名验证

**最小修复方案**:
```json
"win": {
  "signAndEditExecutable": true,
  "certificateFile": "path/to/cert.p12",
  "certificatePassword": "${env.CERT_PASSWORD}",
  "publisherName": "秀儿直播助手"
}
```

并在 CI 中设置:
```yaml
env:
  CERT_PASSWORD: ${{ secrets.CERT_PASSWORD }}
```

---

### 7. [Medium] xlsx 为直接依赖但未使用

**风险等级**: Medium  
**阻断发布**: No

**证据文件**:
- [package.json L56](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/package.json#L56)
- [electron/main/ipc/liveStats.ts L167](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/ipc/liveStats.ts#L167)

**关键代码**:
```json
"dependencies": {
  "exceljs": "^4.4.0",
  "xlsx": "^0.18.5"
}
```

**使用验证**:
```bash
$ grep -r "import.*xlsx\|require.*xlsx" --include="*.ts" --include="*.js"
# 无结果
```

实际使用:
```typescript
const { Workbook } = await import('exceljs')  // 使用 exceljs
```

**真实影响**:
- xlsx 0.18.5 存在已知漏洞（原型链污染、ReDoS）
- 作为直接依赖被打包进产物
- 增加攻击面

**最小修复方案**:
```bash
npm uninstall xlsx
```

验证:
```bash
npm run build
npm run dist:win
# 检查 release 目录，确认无 xlsx 相关文件
```

---

### 8. [Medium] OSS/CDN 发布存在缓存不一致风险

**风险等级**: Medium  
**阻断发布**: No

**证据文件**: [electron/main/managers/VersionManager.ts L63](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/managers/VersionManager.ts#L63)

**关键代码**:
```typescript
this.channels = [
  { name: 'stable', priority: 1, checkUrl: 'https://xiuer.work/releases/latest' },
]
```

**问题分析**:
- CDN 缓存可能导致 latest.yml 与实际文件不一致
- 客户端下载的 SHA512 与实际文件不匹配

**最小修复方案**:
```typescript
// VersionManager.ts
async fetchVersionInfo(sourceUrl: string): Promise<VersionInfo> {
  // ...
  const ymlUrl = new URL(`${ymlFile}?_t=${Date.now()}`, baseUrl).href
  // ...
}
```

---

### 9. [Medium] 开发配置混入生产包

**风险等级**: Medium  
**阻断发布**: No

**证据文件**:
- [package.json L17](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/package.json#L17)
- [.github/workflows/build-windows.yml L34](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/.github/workflows/build-windows.yml#L34)

**关键代码**:
```json
"dev": "cross-env USE_REAL_AUTH=true AUTH_API_BASE_URL=http://121.41.179.197:8000 vite"
```

```yaml
env:
  VITE_AUTH_API_BASE_URL: http://121.41.179.197:8000
```

**问题分析**:
- 开发脚本硬编码了真实 API 地址
- 内网 IP 暴露
- 开发环境配置可能被打包进产物

**最小修复方案**:
```json
"dev": "cross-env USE_REAL_AUTH=true vite"
```

使用 `.env.local` 存储开发配置:
```
# .env.local（不提交到 git）
VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000
```

---

## 二、被高估的风险

### 1. webSecurity 在开发环境禁用

**原评级**: HIGH  
**实际评级**: Low

**理由**:
- 开发环境禁用 webSecurity 是 Electron 常见做法
- `contextIsolation: true` 和 `nodeIntegration: false` 已提供基础保护
- 攻击需物理访问开发机器

**代码证据**: [app.ts L358](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/app.ts#L358)
```typescript
webSecurity: app.isPackaged  // 生产环境启用
```

---

### 2. 未显式启用 sandbox

**原评级**: HIGH  
**实际评级**: Low

**理由**:
- Electron 12+ 默认启用 sandbox（当 `nodeIntegration: false`）
- 当前配置已安全

**代码证据**: [app.ts L354-359](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/app.ts#L354-L359)
```typescript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
}
```

---

### 3. child_process exec 命令注入

**原评级**: MEDIUM  
**实际评级**: Low

**理由**:
- [checkChrome.ts](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/electron/main/utils/checkChrome.ts) 命令是硬编码的
- 用户输入仅用于过滤，不直接拼接到命令

**代码证据**:
```typescript
const command = `powershell -NoProfile -Command "Get-Process -Name '${name}' ..."`
// name 来自 path.parse(processName).name，非用户直接输入
```

---

## 三、被低估的风险

### 1. OSS 上传使用长期 AccessKey

**原评级**: MEDIUM  
**实际评级**: High

**证据文件**: [.github/workflows/build-windows.yml L182-183](file:///Users/xiuer/TRAE-CN/Xiuer-live-tools/.github/workflows/build-windows.yml#L182-L183)

**关键代码**:
```yaml
env:
  ALIYUN_ACCESS_KEY_ID: ${{ secrets.ALIYUN_ACCESS_KEY_ID }}
  ALIYUN_ACCESS_KEY_SECRET: ${{ secrets.ALIYUN_ACCESS_KEY_SECRET }}
```

**风险**:
- 长期凭证泄露风险高
- 权限范围可能过大

**修复方案**:
使用 OIDC 联邦身份:
```yaml
- name: Configure Aliyun Credentials
  uses: aliyun/configure-aliyun-credentials@v1
  with:
    role-to-assume: arn:acs:ram::123456789:role/GitHubActionsRole
    oidc-provider-arn: arn:acs:ram::123456789:oidc-provider/GitHub
```

---

## 四、发布前必须修复清单（阻断发布）

| 优先级 | 问题 | 文件 | 修复内容 |
|--------|------|------|----------|
| P0 | auth:getTokens 暴露 token | auth.ts | 改为返回状态而非完整 token |
| P0 | 默认密钥回退 | CloudAuthStorage.ts | 生产环境强制设置 AUTH_STORAGE_SECRET |
| P0 | 文件路径遍历 | liveStats.ts | 验证路径前缀，阻止目录逃逸 |
| P0 | Windows 代码签名 | electron-builder.json | 启用 signAndEditExecutable |

---

## 五、发布后可排期修复清单

| 优先级 | 问题 | 文件 | 修复内容 |
|--------|------|------|----------|
| P1 | IPC 输入校验 | subAccount.ts, commentListener.ts | 使用 zod 验证 |
| P1 | Preload 暴露面 | preload/index.ts | 限制 IPC 通道白名单 |
| P1 | OSS OIDC | build-windows.yml | 替代长期 AccessKey |
| P1 | xlsx 依赖 | package.json | 移除未使用的依赖 |
| P2 | CDN 缓存 | VersionManager.ts | 添加缓存破坏参数 |
| P2 | 开发配置隔离 | package.json | 使用 .env.local |

---

## 六、修复优先级排序

### P0 = 阻断发布（必须立即修复）

1. **auth:getTokens** → 移除接口，改为 `auth:getAuthStatus`
2. **CloudAuthStorage 默认密钥** → 生产环境强制检查
3. **文件路径遍历** → 添加 `path.resolve` + 前缀校验
4. **Windows 代码签名** → 配置证书

### P1 = 应尽快修（建议发布前完成）

5. **IPC 输入校验** → 高权限通道优先
6. **Preload 暴露面** → 限制通道白名单
7. **OSS OIDC** → 替代长期 AccessKey
8. **移除 xlsx** → 减少攻击面

### P2 = 可排期优化

9. **CDN 缓存** → 添加时间戳参数
10. **开发配置隔离** → 使用 .env.local

---

**审计完成** | 报告生成时间: 2026-03-12
