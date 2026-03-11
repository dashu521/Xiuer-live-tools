# UI 只换皮不换骨 — 改造清单

**模式**：在不触碰业务与 IPC 的前提下，升级 UI 视觉与布局。  
**约束**：业务与 IPC 边界文件仅允许改外观/容器（样式、布局、动效），不可改逻辑、事件绑定、数据流。

---

## 1) 渲染进程入口与路由结构

### 入口文件

| 文件 | 作用 |
|------|------|
| `index.html` | HTML 壳：`#root`、`<script src="/src/main.tsx">`、title、favicon、viewport |
| `src/main.tsx` | React 挂载：`RouterProvider`、`ElectronErrorBoundary`、主题从 localStorage 恢复、`postMessage('removeLoading')` |
| `src/App.tsx` | 根布局：`AuthProvider` → `AppContent`；内含全局 IPC 监听 `_useGlobalIpcListener`、主布局（Header + Sidebar + `<Outlet />` + LogDisplayer）、右键菜单（dev）、UpdateDialog、Toaster |

### 路由结构（react-router，HashRouter）

- **根**：`path: '/'`，`element: <App />`
  - **子路由**：
    - `path: '/'` → **LiveControl**（中控台首页）
    - `path: '/auto-message'` → **AutoMessage**
    - `path: '/auto-popup'` → **AutoPopUp**
    - `path: '/settings'` → **Settings**
    - `path: '/ai-chat'` → **AIChat**
    - `path: 'auto-reply'` → **AutoReply**
    - `path: '/auto-reply/settings'` → **AutoReplySettings**
    - `path: '/forgot'`、`path: '/forgot-password'` → **ForgotPassword**

**改造说明**：入口与路由仅允许改样式/容器（如 App 的 main 区域 padding、圆角、背景）；不增删路由、不改变 `Outlet` 位置与子路由映射。

---

## 2) 与业务交互的边界点（不可改逻辑，只可改外观/容器）

以下为 **ipcRenderer 调用封装** 或 **API / services 在 renderer 的调用入口**。这些文件视为“逻辑禁区”，仅允许改样式、布局、动效、文案展示方式，不得改调用参数、channel、状态更新逻辑、条件分支。

### 2.1 IPC 封装与监听入口

| 位置 | 说明 |
|------|------|
| `src/hooks/useIpc.ts` | 封装 `window.ipcRenderer`，导出 `useIpcListener`；直接依赖 `window.ipcRenderer.on`。 |
| `src/App.tsx` | 全局 IPC 监听：`useIpcListener` 注册 showComment、disconnectedEvent、stoppedEvent、listenerStopped、saveState、notifyAccountName、streamStateChanged、notifyUpdate；以及 `window.ipcRenderer.invoke(account.switch)`、`chrome.toggleDevTools`。 |
| `src/components/common/LogDisplayer.tsx` | `useIpcListener(IPC_CHANNELS.log, ...)` 接收主进程日志。 |
| `src/components/update/UpdateDialog.tsx` | `useIpcListener` 监听 downloadProgress、updateDownloaded、updateError；`invoke(updater.quitAndInstall)`。 |

### 2.2 直接调用 ipcRenderer.invoke / ipcRenderer.on 的组件与 hooks

| 文件 | 调用类型 | 说明 |
|------|----------|------|
| `src/hooks/useTaskControl.ts` | invoke | liveControl connect、autoMessage/autoPopUp start/stop |
| `src/hooks/useTaskManager.ts` | invoke | 任务相关 IPC |
| `src/hooks/useAutoReply.ts` | invoke | autoReply sendReply、aiChat normalChat、pinComment |
| `src/hooks/useAutoPopUp.ts` | invoke | autoPopUp registerShortcuts、updateConfig、unregisterShortcuts |
| `src/hooks/useUpdate.ts` | invoke | updater checkUpdate、startDownload、quitAndInstall |
| `src/components/common/HideToTrayTipDialog.tsx` | invoke | app.setHideToTrayTipDismissed |
| `src/components/ai-chat/APIKeyDialog.tsx` | invoke | tasks.aiChat.testApiKey |
| `src/pages/LiveControl/components/StatusCard.tsx` | invoke | liveControl.connect、disconnect |
| `src/pages/SettingsPage/components/AccountSetting.tsx` | invoke | liveControl.disconnect |
| `src/pages/SettingsPage/components/BrowserSetting.tsx` | invoke | chrome.selectPath、getPath |
| `src/pages/SettingsPage/components/OtherSetting.tsx` | invoke | app.getHideToTrayTipDismissed、setHideToTrayTipDismissed、openLogFolder、openExternal、openLogFolder |
| `src/pages/AutoMessage/components/MessagesOneKey.tsx` | invoke | 发言相关 |
| `src/pages/AutoReply/components/CommentList.tsx` | invoke | 评论/回复相关 |
| `src/pages/AutoReply/components/PreviewList.tsx` | invoke | 预览相关 |
| `src/pages/AIChat/components/ChatBox.tsx` | on + invoke | 流式/错误监听 + aiChat.chat |

### 2.3 API / services 在 renderer 的调用入口

| 位置 | 说明 |
|------|------|
| `src/stores/authStore.ts` | 调用 `window.authAPI`：login、register、logout、getCurrentUser 等（authAPI 内部走 IPC 或 Mock）。 |
| `src/hooks/useAuth.ts` | 调用 `window.authAPI.checkFeatureAccess`。 |
| `src/components/auth/AuthGuard.tsx` | 调用 `window.authAPI.checkFeatureAccess`、`requiresAuthentication`。 |
| `src/services/MockAuthService.ts` | 渲染进程内 Mock 认证实现，被 authStore 在 __useMock 时使用。 |

### 2.4 使用业务状态但无直接 IPC 的“边界组件”

以下组件通过 hooks 或 store 与业务状态强绑定，**只可改外观/容器**，不可改数据流与业务条件：

- `src/components/common/Sidebar.tsx`：使用 `useCurrentAutoMessage`、`useCurrentAutoPopUp`、`useAutoReply`、`useCurrentLiveControl`，tab 列表与 platform 过滤为业务逻辑。
- `src/components/common/Header.tsx`：使用 `useAuthStore`、`useTheme`，派发 `auth:user-center`、`auth:required` 事件。
- `src/components/common/AccountSwitcher.tsx`：账号切换 UI，与 useAccounts 等状态绑定。
- `src/components/common/ElectronErrorBoundary.tsx`：错误兜底，含 ipcRenderer 相关判断文案。

**改造原则**：上述所有“边界点”文件内，仅允许修改 className、style、布局结构（flex/grid）、主题变量使用方式、图标与文案的视觉呈现；不得增删/修改 `invoke`/`on` 的 channel 与参数、不得修改 hooks 的调用顺序与条件、不得修改 authStore/authAPI 的调用逻辑。

---

## 3) 当前页面/模块与优先级

| 页面/模块 | 路径 | 类型 | 优先级说明 |
|-----------|------|------|------------|
| **中控台（LiveControl）** | `/`，`src/pages/LiveControl/` | 首页 | **核心**：首屏，必须优先美化（InstructionsCard、PlatformSelect、StatusCard 等）。 |
| **自动发言（AutoMessage）** | `/auto-message`，`src/pages/AutoMessage/` | 功能页 | **核心**：高频使用，列表与编辑区布局与视觉优先。 |
| **自动弹窗（AutoPopUp）** | `/auto-popup`，`src/pages/AutoPopUp/` | 功能页 | **核心**：商品列表、快捷方式等主界面。 |
| **自动回复（AutoReply）** | `/auto-reply`，`src/pages/AutoReply/` | 功能页 | **核心**：评论列表、预览、设置入口。 |
| **AI 助手（AIChat）** | `/ai-chat`，`src/pages/AIChat/` | 功能页 | **核心**：对话区、输入框、消息气泡。 |
| **应用设置（Settings）** | `/settings`，`src/pages/SettingsPage/` | 设置页 | **核心**：账号/浏览器/更新/其他等 Tab，整体风格需与主流程一致。 |
| **自动回复设置（AutoReplySettings）** | `/auto-reply/settings`，`src/pages/AutoReply/AutoReplySettings/` | 子设置 | **次要**：可延后，与 AutoReply 风格统一即可。 |
| **忘记密码（ForgotPassword）** | `/forgot`、`/forgot-password` | 单页 | **次要**：可延后。 |
| **登录/认证相关** | 弹窗与 Guard | AuthDialog、AuthGuard、UserCenter、AuthProvider | **核心**：登录入口与权限提示的视觉需统一。 |

**建议顺序**：LiveControl → 公共壳（Header、Sidebar、主内容区、LogDisplayer）→ AutoMessage / AutoPopUp / AutoReply / AIChat → Settings → AutoReplySettings、ForgotPassword、Auth 弹窗。

---

## 4) 允许修改目录白名单 与 禁止修改目录黑名单

### 允许修改目录/文件白名单（仅限样式与布局，不碰业务逻辑）

- `index.html` — 仅 title、meta、favicon、根节点 class/id 等静态壳。
- `src/main.tsx` — 仅根容器 className/style，不改 Provider 与路由挂载逻辑。
- `src/App.tsx` — 仅布局结构（flex/grid）、className、style、main 区域圆角/阴影/padding；不增删 `_useGlobalIpcListener`、不改 IPC channel/参数、不改 Outlet 与路由子节点。
- `src/index.css` — 全局样式、Tailwind 与 theme 引用。
- `src/App.css` — 仅 App 相关样式。
- `src/styles/theme.css` — 主题变量（颜色、阴影、圆角等）。
- `src/styles/design-tokens.ts` — 设计令牌数值与结构（颜色、字体、间距等），不删字段只可扩展或改值。
- `src/components/ui/**` — 所有 shadcn/ui 风格基础组件（button、card、input、dialog、tabs 等）：仅样式与 DOM 结构，不改 props 契约与事件名。
- `src/components/common/` — 仅各组件内部与样式/布局相关的部分：
  - `Header.tsx`、`Sidebar.tsx`、`Title.tsx`、`AccountSwitcher.tsx`、`LogDisplayer.tsx`、`HideToTrayTipDialog.tsx`、`HtmlRenderer.tsx`、`TaskButton.tsx`、`ValidateNumberInput.tsx`、`ElectronErrorBoundary.tsx`：仅视觉与布局；不改 IPC/状态/hooks 调用逻辑。
- `src/components/auth/` — `AuthDialog.tsx`、`AuthGuard.tsx`、`AuthProvider.tsx`、`AuthStyles.tsx`、`UserCenter.tsx`：仅样式与布局；不改 authAPI/authStore 调用与权限逻辑。
- `src/components/ai-chat/` — `AIModelInfo.tsx`、`APIKeyDialog.tsx`：仅外观与容器；不改 invoke/testApiKey 等逻辑。
- `src/components/update/UpdateDialog.tsx` — 仅样式与布局；不改 useIpcListener 与 quitAndInstall。
- `src/pages/**/*.tsx`、`src/pages/**/*.css` — 各页面及其子组件的样式、布局、主题变量使用；不改该页内对 hooks/ipcRenderer/authAPI 的调用与数据流。
- `src/components/icons/` — 图标组件仅限样式与尺寸，不改变导出与使用方式。
- `public/` — favicon、静态资源替换，不删必要资源。

### 禁止修改目录/文件黑名单（逻辑与数据流不可动）

- `src/hooks/useIpc.ts` — IPC 封装，**禁止改**。
- `src/hooks/use*.ts`（除 `use-mobile.tsx`、`useTheme.ts` 中与“主题键”相关的部分可微调）— 凡包含 `invoke`、`on`、authAPI、业务状态更新的，**禁止改逻辑**；若仅改“从 store 取的值如何用于样式”（如取 theme 名做 class），可允许。
- `src/stores/authStore.ts` — **禁止改**。
- `src/services/MockAuthService.ts` — **禁止改**。
- `src/tasks/**` — TaskManager、autoReplyTask、autoPopupTask、autoSpeakTask 等，**禁止改**。
- `src/utils/stopAllLiveTasks.ts`、`src/utils/taskGate.ts`、`src/utils/events.ts` 等 — **禁止改**。
- `src/router/index.tsx` — 路由表与 element 映射，**禁止改**。
- `shared/` — ipcChannels、electron-api、types 等，**禁止改**。
- `electron/` — **禁止改**（主进程与 preload 非 UI 范围）。

**说明**：白名单内“仅样式/布局”的文件若含有 IPC/auth 调用，只允许改其所在组件的样式与布局，不得改调用本身。

---

## 5) 改造分支建议

- **建议**：在现有功能分支 `dev-after-electron-fix` 上**不要**直接做大面积 UI 改版，以免与正在进行的修复混在一起。
- **推荐**：新建分支 **`ui-refresh-v1`**，从 `dev-after-electron-fix` 拉取后，在 `ui-refresh-v1` 上仅做“只换皮不换骨”的 UI 改造（白名单内改样式/主题/布局，黑名单与边界点逻辑不动）。改造完成后再通过 PR 合并回 `dev-after-electron-fix` 或目标发布分支。

**操作示例**：

```bash
git checkout dev-after-electron-fix
git pull
git checkout -b ui-refresh-v1
# 此后仅在白名单内改样式/布局，提交到 ui-refresh-v1
```

---

## 总结

| 项目 | 内容 |
|------|------|
| 入口 | `index.html` → `main.tsx` → `App.tsx`，路由为 HashRouter 子路由。 |
| 边界点 | 见第 2 节：useIpc、App 全局监听、各页/组件内 invoke/on、authStore/authAPI/AuthGuard。这些位置只改外观/容器。 |
| 核心页 | LiveControl、AutoMessage、AutoPopUp、AutoReply、AIChat、Settings、登录/认证相关。 |
| 次要页 | AutoReplySettings、ForgotPassword。 |
| 白名单 | 入口 HTML/TSX、全局样式、theme、design-tokens、components/ui、components/common、components/auth、components/ai-chat、components/update、pages 下样式与布局、icons、public。 |
| 黑名单 | hooks 逻辑、stores、services、tasks、utils、router、shared、electron。 |
| 分支 | 建议新建 `ui-refresh-v1` 做 UI 换皮，再合并回主开发分支。 |

输出完成，不直接改代码；后续改造请严格按白名单/黑名单与“只改外观/容器”执行。
