# 环境差异清单

> **版本**: v1.0
> **最后更新**: 2026-03-14
> **状态**: 已固化
> **负责人**: TEAM
> **当前适用性**: 当前有效
> **关联主文档**: 本文档为环境差异的唯一可信来源

---

> 本文档记录开发态与生产态（打包后）的关键差异，修改涉及这些差异的代码时必须同时验证两种环境。

---

## 一、环境变量差异

### 1.1 Vite 环境变量

| 变量 | 开发态 | 生产态 | 说明 |
|------|--------|--------|------|
| `import.meta.env.VITE_*` | ✅ 渲染进程可用 | ✅ 渲染进程可用（构建时替换） | Vite 在构建时会将值硬编码到代码中 |
| `process.env.VITE_*` | ❌ 主进程不可用 | ❌ 主进程不可用 | 主进程不经过 Vite 处理 |
| `process.env.AUTH_STORAGE_SECRET` | ⚠️ 可选（有 fallback） | ✅ 构建/服务端必须显式设置 | 终端用户客户端运行时允许本地设备密钥 |

### 1.2 主进程配置读取方式

**正确方式**：使用 `buildTimeConfig.ts`

```typescript
// electron/main/config/buildTimeConfig.ts
import { getAuthApiBaseUrl } from './config/buildTimeConfig'

const baseUrl = getAuthApiBaseUrl() // 正确：从构建时生成的配置文件读取
```

**错误方式**：直接读取环境变量

```typescript
// ❌ 错误：打包后主进程读取不到
const baseUrl = process.env.VITE_AUTH_API_BASE_URL
```

### 1.3 配置文件生成流程

```
构建时（npm run build）:
  └─> scripts/generate-build-config.js
        └─> 读取 VITE_AUTH_API_BASE_URL
              └─> 写入 dist-electron/build-config.json

运行时（打包后）:
  └─> electron/main/config/buildTimeConfig.ts
        └─> 读取 build-config.json（从 asar 包内）
```

---

## 二、文件路径差异

### 2.1 配置文件路径

| 环境 | 路径 | 说明 |
|------|------|------|
| 开发态 | `process.cwd()/dist-electron/build-config.json` | 项目根目录 |
| 生产态 | `process.resourcesPath/app.asar/dist-electron/build-config.json` | asar 包内 |

### 2.2 asar 内文件读取注意事项

**正确方式**：使用 Node.js 原生 fs 模块

```typescript
// ✅ 正确：Node.js 会自动处理 asar 路径
const content = fs.readFileSync('/path/to/app.asar/dist-electron/build-config.json', 'utf-8')
```

**错误方式**：先检查文件是否存在

```typescript
// ❌ 错误：fs.existsSync 对 asar 内路径返回 false
if (fs.existsSync('/path/to/app.asar/dist-electron/build-config.json')) {
  // 这里永远不会执行
}
```

**推荐方式**：直接读取 + catch 错误

```typescript
// ✅ 推荐：直接尝试读取，失败后 fallback
try {
  const content = fs.readFileSync(configPath, 'utf-8')
  return JSON.parse(content)
} catch {
  // fallback 到默认值
  return defaultConfig
}
```

### 2.3 用户数据目录

| 平台 | 路径 |
|------|------|
| macOS | `~/Library/Application Support/秀儿直播助手/` |
| Windows | `%APPDATA%/秀儿直播助手/` |

**获取方式**：

```typescript
import { app } from 'electron'
const userDataPath = app.getPath('userData')
```

---

## 三、安全配置差异

### 3.1 AUTH_STORAGE_SECRET

| 环境 | 要求 | 行为 |
|------|------|------|
| 开发态 | 可选 | 未设置时使用 fallback 密钥 + 警告日志 |
| 生产态（服务端 / CI / 打包链路） | **必须显式设置** | 未设置视为发布不合规 |
| 生产态（终端用户客户端运行时） | 允许首次生成本地 `.key` | 依赖 `userData/auth/.key` 作为设备密钥；不要求终端用户手工配置环境变量 |

**解决方案**：

1. **推荐**：在 CI/CD 中设置环境变量
   ```bash
   export AUTH_STORAGE_SECRET="your-secure-key"
   ```

2. **客户端运行时允许的设备兜底**：代码自动生成并存储
   ```typescript
   // CloudAuthStorage.ts 已实现
   // 当前实现可能自动生成随机密钥存储到 userData/auth/.key
   // 这不替代 CI/打包链路的显式密钥配置，但允许终端用户客户端首次运行
   ```

### 3.2 Token 存储位置

| 环境 | 存储位置 |
|------|---------|
| 开发态 | `userData/auth/tokens.enc` |
| 生产态 | `userData/auth/tokens.enc` |

**注意**：不同环境（开发/生产）使用不同的加密密钥，token 不互通。

---

## 四、平台差异

### 4.1 路径分隔符

| 平台 | 分隔符 | 示例 |
|------|--------|------|
| macOS | `/` | `/Users/xiuer/...` |
| Windows | `\` | `C:\Users\xiuer\...` |

**推荐**：始终使用 `path.join()` 或 `path.resolve()`

```typescript
import path from 'path'

// ✅ 正确：自动处理平台差异
const configPath = path.join(resourcesPath, 'build-config.json')

// ❌ 错误：硬编码分隔符
const configPath = resourcesPath + '/build-config.json'
```

### 4.2 可执行文件路径

| 平台 | Chrome 默认路径 |
|------|----------------|
| macOS | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| Windows | `C:\Program Files\Google\Chrome\Application\chrome.exe` |

### 4.3 打包后应用路径

| 平台 | 应用位置 |
|------|---------|
| macOS | `/Applications/秀儿直播助手.app/Contents/Resources/app.asar` |
| Windows | `C:\Users\{user}\AppData\Local\Programs\秀儿直播助手\resources\app.asar` |

---

## 五、日志输出差异

### 5.1 控制台日志

| 环境 | 主进程日志 | 渲染进程日志 |
|------|-----------|-------------|
| 开发态 | 终端输出 | DevTools 控制台 |
| 生产态 | 系统日志* | DevTools 控制台（需手动打开） |

*macOS: Console.app → 用户诊断报告
*Windows: 事件查看器

### 5.2 查看生产态日志

**macOS**：
```bash
# 从终端启动应用，查看主进程日志
/Applications/秀儿直播助手.app/Contents/MacOS/秀儿直播助手
```

**Windows**：
```cmd
# 从命令行启动应用
"C:\Users\{user}\AppData\Local\Programs\秀儿直播助手\秀儿直播助手.exe"
```

---

## 六、常见问题速查

| 问题 | 开发态 | 生产态 | 原因 | 解决方案 |
|------|--------|--------|------|---------|
| 密码登录失败 | ✅ | ❌ | 主进程读取不到环境变量 | 使用 `buildTimeConfig.ts` |
| AUTH_STORAGE_SECRET 错误 | ⚠️ 警告 | ❌ 发布不合规 | 生产环境必须显式配置 | 配置环境变量；自动生成仅作排障兜底 |
| 配置文件读取失败 | ✅ | ❌ | asar 内路径处理错误 | 直接读取 + catch |
| Windows 双击无响应 | ✅ | ❌ | 路径/权限问题 | 检查路径分隔符和权限 |
| 浏览器不弹出 | ✅ | ❌ | playwright 路径问题 | 检查 Chrome 路径配置 |

---

## 七、环境验证命令

```bash
# 检查当前环境
node -e "console.log('Node version:', process.version)"
node -e "console.log('Platform:', process.platform)"
node -e "console.log('Arch:', process.arch)"

# 检查打包后配置文件
npx asar list release/1.2.3/mac-arm64/秀儿直播助手.app/Contents/Resources/app.asar | grep build-config

# 检查环境变量
echo $VITE_AUTH_API_BASE_URL
echo $AUTH_STORAGE_SECRET
```
