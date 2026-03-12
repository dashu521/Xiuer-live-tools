# 高风险文件改动准入清单

> 本文档列出修改后必须触发完整回归验证的高风险文件。修改这些文件前，必须确认回归验证时间。

---

## 一、登录链路文件

### 1.1 密码登录链路

| 文件 | 风险等级 | 必须验证项 |
|------|---------|-----------|
| `electron/main/services/cloudAuthClient.ts` | 🔴 高 | 开发态密码登录、打包后密码登录 |
| `electron/main/ipc/auth.ts` | 🔴 高 | 开发态密码登录、打包后密码登录、Token 刷新 |
| `electron/preload/auth.ts` | 🔴 高 | 所有登录方式、Token 获取 |
| `electron/main/services/CloudAuthStorage.ts` | 🔴 高 | 所有登录方式、Token 存储、生产态启动 |
| `electron/main/config/buildTimeConfig.ts` | 🟠 中 | 打包后密码登录、配置读取 |

### 1.2 验证码登录链路

| 文件 | 风险等级 | 必须验证项 |
|------|---------|-----------|
| `src/services/apiClient.ts` | 🟠 中 | 开发态验证码登录、打包后验证码登录 |
| `src/components/auth/PhoneAuthDialog.tsx` | 🟡 低 | 验证码登录 UI |

### 1.3 登录状态管理

| 文件 | 风险等级 | 必须验证项 |
|------|---------|-----------|
| `src/stores/authStore.ts` | 🟠 中 | 所有登录方式、登录状态持久化 |

### 1.4 配置读取

| 文件 | 风险等级 | 必须验证项 |
|------|---------|-----------|
| `electron/main/config/buildTimeConfig.ts` | 🔴 高 | 打包后密码登录、配置读取、asar 内文件读取 |

---

## 二、浏览器连接链路文件

### 2.1 连接流程

| 文件 | 风险等级 | 必须验证项 |
|------|---------|-----------|
| `electron/main/ipc/connection.ts` | 🔴 高 | 连接中控台、断开连接、stopAll |
| `electron/main/services/AccountSession.ts` | 🔴 高 | 连接中控台、浏览器生命周期、状态更新 |
| `electron/main/managers/BrowserSessionManager.ts` | 🔴 高 | 浏览器启动、窗口显示、Chrome 路径 |
| `electron/main/runtime/load-playwright.cjs` | 🔴 高 | 浏览器启动、playwright 加载 |

### 2.2 状态检测

| 文件 | 风险等级 | 必须验证项 |
|------|---------|-----------|
| `electron/main/services/StreamStateDetector.ts` | 🟠 中 | 直播状态检测、关播检测 |
| `electron/main/services/AccountScopedRuntimeManager.ts` | 🔴 高 | 状态管理、disconnectedEvent |

---

## 三、状态管理文件

| 文件 | 风险等级 | 必须验证项 |
|------|---------|-----------|
| `src/utils/TaskStateManager.ts` | 🔴 高 | stopAll、状态转换 |
| `electron/main/managers/AccountManager.ts` | 🔴 高 | 多账号管理、session 生命周期 |
| `src/pages/LiveControl/components/StatusCard.tsx` | 🟠 中 | UI 状态显示、连接/断开按钮 |

---

## 四、IPC 通道文件

| 文件 | 风险等级 | 必须验证项 |
|------|---------|-----------|
| `shared/ipcChannels.ts` | 🔴 高 | 所有 IPC 功能 |
| `electron/preload/index.ts` | 🔴 高 | 所有 IPC 功能、白名单 |
| `scripts/generateIpcWhitelist.ts` | 🟠 中 | IPC 白名单生成 |

---

## 五、应用生命周期文件

| 文件 | 风险等级 | 必须验证项 |
|------|---------|-----------|
| `electron/main/app.ts` | 🔴 高 | 应用启动、退出、窗口管理 |
| `electron/main/windowManager.ts` | 🟠 中 | 窗口创建、通信 |

---

## 六、打包配置文件

| 文件 | 风险等级 | 必须验证项 |
|------|---------|-----------|
| `electron-builder.json` | 🟠 中 | 打包结果、资源包含 |
| `package.json` (scripts) | 🟠 中 | 构建流程 |
| `scripts/generate-build-config.js` | 🟠 中 | 配置生成、打包后登录 |

---

## 七、平台特定文件

### 7.1 macOS 特定

| 文件 | 风险等级 | 必须验证项 |
|------|---------|-----------|
| `build/icon.icns` | 🟡 低 | macOS 图标显示 |

### 7.2 Windows 特定

| 文件 | 风险等级 | 必须验证项 |
|------|---------|-----------|
| `build/icon.ico` | 🟡 低 | Windows 图标显示 |
| `scripts/check-windows-build.js` | 🟠 中 | Windows 打包验证 |

---

## 八、改动准入流程

### 8.1 修改前确认

```
□ 确认修改的文件是否在上述清单中
□ 确认修改会影响哪些链路
□ 预估回归验证时间
□ 确认有足够时间完成回归验证
```

### 8.2 修改后验证

```
□ 根据文件清单执行对应的验证项
□ 记录验证结果
□ 发现问题立即回退，不要继续叠加修改
```

### 8.3 提交前检查

```
□ 修改描述清晰
□ 列出所有修改的文件
□ 列出已验证的项目
□ 标注未验证的项目（如有）
```

---

## 九、快速查询表

### 按功能查询

| 功能 | 高风险文件 |
|------|-----------|
| 密码登录 | `cloudAuthClient.ts`, `auth.ts`, `CloudAuthStorage.ts`, `buildTimeConfig.ts` |
| 验证码登录 | `apiClient.ts`, `PhoneAuthDialog.tsx` |
| 连接中控台 | `connection.ts`, `AccountSession.ts`, `BrowserSessionManager.ts` |
| 浏览器启动 | `load-playwright.cjs`, `BrowserSessionManager.ts` |
| 状态管理 | `TaskStateManager.ts`, `AccountScopedRuntimeManager.ts` |
| IPC 通信 | `ipcChannels.ts`, `preload/index.ts` |

### 按风险等级查询

| 风险等级 | 文件数 | 回归验证时间 |
|---------|-------|-------------|
| 🔴 高 | 15+ | 30+ 分钟 |
| 🟠 中 | 10+ | 15+ 分钟 |
| 🟡 低 | 5+ | 5+ 分钟 |

---

## 十、紧急修改流程

如果必须紧急修改高风险文件：

1. **最小化修改范围** - 只修改必要的代码
2. **添加详细日志** - 便于排查问题
3. **立即验证核心功能** - 登录 + 连接中控台
4. **记录修改原因** - 便于后续复盘
5. **尽快完成完整回归** - 在下一个工作日内完成

---

## 十一、日志添加规则

### 11.1 允许的日志

- ✅ 临时定点日志，用于排查特定问题
- ✅ 关键路径入口/出口日志
- ✅ 错误捕获日志

### 11.2 禁止的日志

- ❌ 在高频路径加入大量日志（如每次 API 请求、每次状态检测）
- ❌ 循环内的日志
- ❌ 生产环境不需要的调试日志

### 11.3 日志清理要求

- 调试完成后必须清理临时日志
- 保留的日志必须有明确用途（错误追踪、关键路径监控）
- 日志内容必须包含上下文（如 accountId、traceId）

---

## 十二、前端高风险链路说明

### 12.1 视为高风险的前端文件

以下前端文件涉及登录、中控台连接、状态切换，不按普通前端逻辑处理：

| 文件 | 高风险原因 |
|------|-----------|
| `src/pages/LiveControl/components/StatusCard.tsx` | 连接/断开中控台、状态显示 |
| `src/hooks/useOneClickStart.ts` | 一键开播、状态切换 |
| `src/stores/authStore.ts` | 登录状态管理 |
| `src/stores/liveControlStore.ts` | 中控台状态管理 |
| `src/components/auth/AuthDialog.tsx` | 密码登录入口 |
| `src/components/auth/PhoneAuthDialog.tsx` | 验证码登录入口 |

### 12.2 修改前端高风险链路的额外要求

1. 必须同时验证开发态和打包后
2. 必须验证状态转换的正确性
3. 必须验证错误处理的完整性
4. 修改前必须确认对主进程的影响
