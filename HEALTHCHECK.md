# 项目健康体检报告（Architecture + Build + Security + Stability）

**检查日期**: 2025-01-31  
**范围**: 架构边界、构建与打包、Electron 安全基线、稳定性与可观测性、代码质量守门员

---

## 结论

**总体评级: Yellow（可接受，建议按优先级修复）**

- 架构边界清晰，渲染进程未直接访问 Node/FS/child_process；主进程业务与 IPC 分离良好。
- 构建与打包脚本完整，electron-builder 与 asarUnpack 配置合理；主进程 external 与 asar 解压一致。
- 主窗口安全配置正确（contextIsolation、nodeIntegration、preload 白名单）；存在 **P0**：`open-win` 子窗口启用 nodeIntegration 且未使用。
- 已有 crash 写入临时文件、second-instance 与 ready-to-show；存在重复注册 crash 与调试端口常开等问题。
- 已有 Biome 与 TypeScript strict；缺少顶层 `lint` / `typecheck` / `smoke:electron` 脚本。

---

## 发现的问题（按优先级）

### P0（必须修复）

| 问题 | 证据 | 修复建议 |
|------|------|----------|
| **open-win 子窗口启用 nodeIntegration + contextIsolation: false** | `electron/main/app.ts` 第 374–388 行：`ipcMain.handle('open-win', ...)` 创建的 BrowserWindow 使用 `nodeIntegration: true`, `contextIsolation: false`。且该 channel 未被渲染进程调用（死代码），但一旦被使用会带来严重安全风险。 | **最小改动**：删除 `open-win` 的 IPC 处理及对应的 `ipcMain.handle('open-win', ...)` 整段（约 374–388 行）；若需保留“新窗口”能力，改为与主窗口相同的 webPreferences（nodeIntegration: false, contextIsolation: true）并走白名单 preload。 |

### P1（建议尽快修复）

| 问题 | 证据 | 修复建议 |
|------|------|----------|
| **主进程 crash 处理器重复注册** | `electron/main/index.ts` 第 36–41 行注册 `uncaughtException` / `unhandledRejection`；`electron/main/app.ts` 第 275–301 行再次注册并增加 dialog 与 logger。两处都会执行，导致重复写文件与重复弹窗。 | **最小改动**：在 `index.ts` 中移除 `uncaughtException` / `unhandledRejection` 的注册，仅保留 `app.ts` 中的一套（写文件 + logger + 可选的 dialog），避免重复。 |
| **remote-debugging-port 在生产环境开启** | `electron/main/app.ts` 第 80 行：`app.commandLine.appendSwitch('remote-debugging-port', '9222')` 无条件执行，打包后仍可被外部连接。 | **最小改动**：仅开发时开启，例如 `if (!app.isPackaged) { app.commandLine.appendSwitch('remote-debugging-port', '9222') }`。 |
| **窗口调试日志常驻写盘** | `electron/main/app.ts` 第 93–97 行 `logWindowDebug` 每次调用都 `appendFileSync(TASI_DEBUG_PATH, ...)`，无环境开关。 | **最小改动**：仅当 `process.env.TASI_DEBUG === '1'`（或类似）时写入；否则直接 return，不创建文件。 |
| **缺少顶层 lint / typecheck 脚本** | `package.json` 仅有 `lint-staged` 中调用 `biome check`，无独立 `npm run lint` / `npm run typecheck`，CI 或本地守门不便。 | **最小改动**：在 `package.json` 的 `scripts` 中增加：`"lint": "biome check ."`，`"typecheck": "tsc --noEmit"`（若需区分 electron 与 node 可后续用 tsconfig 引用）。 |

### P2（可选优化）

| 问题 | 证据 | 修复建议 |
|------|------|----------|
| **主进程 external 含 bufferutil / utf-8-validate** | `vite.config.ts` 第 54–56 行：主进程 rollupOptions.external 包含 `bufferutil`、`utf-8-validate`。二者为 ws 的可选原生依赖，项目可能未安装，打包后 require 可能报错。 | **最小改动**：从主进程 external 中移除 `bufferutil`、`utf-8-validate`（若未在 main 中直接 require）；若确需保留，需在 dist:check 或打包前校验其已安装。 |
| **auth IPC 通道未纳入 ipcChannels 白名单** | `shared/ipcChannels.ts` 未包含 `auth:*`；preload `auth.ts` 与 main `ipc/auth.ts` 使用 `auth:register` 等。类型与白名单不统一。 | **最小改动**：在 `shared/ipcChannels.ts` 中增加 `auth` 相关 channel 常量，并在 `shared/electron-api.d.ts` 的 IpcChannels 中补充对应类型，保持与主进程/ preload 一致。 |
| **BrowserWindow 未显式设置 sandbox** | `electron/main/app.ts` 主窗口 webPreferences 未写 `sandbox`。Electron 默认 renderer 为 sandbox: true，但显式写出更利于审计。 | **最小改动**：在主窗口 webPreferences 中增加 `sandbox: true`（与当前默认一致，仅文档化）。 |
| **Crash logger 不可通过环境关闭** | 当前 crash 写文件与弹窗无环境变量控制，不利于自动化或静默环境。 | **最小改动**：通过 `process.env.TASI_CRASH_LOG !== '0'` 决定是否写文件；`process.env.TASI_CRASH_DIALOG === '1'` 决定是否 `dialog.showErrorBox`（默认生产可只写文件不弹窗，或按需配置）。 |

---

## 证据与配置摘要

### A. 架构边界

**目录结构（关键部分）**

- `electron/main/`：主进程入口 `index.ts`、`app.ts`，IPC 在 `ipc/`，业务在 `services/`、`tasks/`、`managers/`、`platforms/`。
- `electron/preload/`：`index.ts`（暴露 `ipcRenderer` 白名单）、`auth.ts`（暴露 `authAPI`）。
- `src/`：渲染进程（React），无 `node:` / `require('fs')` / `require('child_process')` 等用法。
- `shared/`：`ipcChannels.ts`、`electron-api.d.ts` 等共享类型与 channel 常量。

**边界结论**

- UI（`src/`）不直接访问 Node/FS/child_process，仅通过 preload 暴露的 `ipcRenderer` / `authAPI` 与主进程通信。
- 主进程：入口仅做 require 重定向与 crash 注册，业务在 `app.ts` 及 ipc/services/tasks 中，边界清晰。

**边界图（文字版）**

```
┌─────────────────────────────────────────────────────────────────┐
│  Renderer (src/)                                                 │
│  - React UI only                                                 │
│  - 仅通过 window.ipcRenderer / window.authAPI 与主进程通信        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ contextBridge 白名单
┌───────────────────────────▼─────────────────────────────────────┐
│  Preload (electron/preload/)                                     │
│  - index.ts: expose ipcRenderer (invoke/send/on, 限定 IpcChannels)│
│  - auth.ts: expose authAPI (auth:* invoke/on)                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ IPC (channel 白名单，见 shared/ipcChannels)
┌───────────────────────────▼─────────────────────────────────────┐
│  Main (electron/main/)                                           │
│  - index.ts: unpacked require 重定向 + crash 写文件 + import app  │
│  - app.ts: 窗口/托盘/部分 IPC（app:*, open-win）                  │
│  - ipc/*: 各模块 typedIpcMainHandle/On（IpcChannels）             │
│  - services/, tasks/, managers/, platforms/: 业务逻辑             │
└─────────────────────────────────────────────────────────────────┘
```

---

### B. 构建与打包可重复性

**与 build/dist 相关的 scripts（package.json）**

- `"build": "tsc && vite build && node -e \"...\"`（含复制 `load-playwright.cjs` 到 `dist-electron/main/runtime`）
- `"build-exe": "npm run build && electron-builder --publish never"`
- `"dist:clean": "node -e \"require('fs').rmSync('release',{recursive:true,force:true})\""`
- `"dist:check": "node scripts/dist-check-appdir.js"`
- `"dist": "npm run dist:clean && npm run build && npm run dist:check && electron-builder --win --publish never"`

**electron-builder 配置（electron-builder.json）**

- `asar: true`，`asarUnpack`: better-sqlite3, playwright, playwright-extra, playwright-extra-plugin-stealth, puppeteer-extra-plugin-stealth。
- `directories.output`: `release/${version}`。
- `files`: dist/**/*, dist-electron/**/*, dist-electron/main/runtime/**, electron/platformConfig.js, package.json。
- `extraMetadata.main`: dist-electron/main/index.js（与 package.json main 一致）。

**Vite 主进程构建 external（vite.config.ts 第 49–59 行）**

- 当前 external：playwright, playwright-extra, playwright-extra-plugin-stealth, puppeteer-extra-plugin-stealth, **bufferutil**, **utf-8-validate**, better-sqlite3, electron-updater。
- **风险项**：bufferutil、utf-8-validate 为可选依赖，主进程未直接 require 时可从 external 移除，避免打包后缺失。

**最小 Smoke Test 建议**

- 目标：打包后启动 exe，约 3 秒内确认主进程存活且窗口创建。
- 实现方式（最小可开关日志）：
  - 在 `electron/main/app.ts` 中，已有 `logWindowDebug(phase)` 写 `TASI_DEBUG_PATH`；建议改为仅当 `process.env.TASI_DEBUG === '1'` 时写入。
  - 已提供最小实现：`scripts/smoke-electron.js`。  
- 在 `package.json` 的 `scripts` 中增加：`"smoke:electron": "node scripts/smoke-electron.js"`。  
- 行为：在 `release/<version>/` 下找 exe，spawn 后约 3.5 秒内每 200ms 检查主进程 PID 是否存活（`process.kill(pid, 0)`），通过则 kill 进程并 exit 0。  
- 可选：`TASI_DEBUG=1` 时主进程写窗口日志；smoke 脚本在 `TASI_DEBUG=1` 且未设 `TASI_SMOKE_SILENT=1` 时会读 `%TEMP%\tasi-window-debug.txt` 检查是否含 `ready-to-show`。  
- 主进程窗口调试日志需可开关：在 `app.ts` 的 `logWindowDebug` 中仅当 `process.env.TASI_DEBUG === '1'` 时写入（见 P1）。

---

### C. Electron 安全基线

**主窗口（electron/main/app.ts 第 135–151 行）**

- `contextIsolation: true` ✓  
- `nodeIntegration: false` ✓  
- `preload` 指定，preload 仅暴露 `ipcRenderer`（IpcChannels 类型）+ `authAPI` ✓  
- `webSecurity: app.isPackaged` ✓  
- 未显式 `sandbox`（当前默认 true，P2 建议显式写出）

**open-win 子窗口（同上，第 374–388 行）**

- `nodeIntegration: true` ✗  
- `contextIsolation: false` ✗  
- 未使用 preload 白名单 → **P0**，建议删除或改为与主窗口一致的安全配置。

**IPC**

- 主流程使用 `typedIpcMainHandle` / `typedIpcMainOn`，channel 来自 `IpcChannels`，无动态任意 channel。
- 例外：`app.ts` 内直接 `ipcMain.handle('app:...')`、`ipcMain.handle('open-win', ...)`；auth 在 `ipc/auth.ts` 使用 `auth:*`，未在 ipcChannels 中列出（P2 建议统一进白名单）。

---

### D. 稳定性与可观测性

- **Crash logger**：存在。`index.ts` 与 `app.ts` 均注册 `uncaughtException` / `unhandledRejection`，写 `TASI_CRASH_PATH`；`app.ts` 还弹窗与 logger。建议只保留一处（P1）。
- **无窗口保护**：存在。`app.requestSingleInstanceLock()` + `app.on('second-instance', ...)` 会聚焦或重建窗口；主窗口 `show: false` + `win.once('ready-to-show', () => win?.show())`。
- **调试代码建议**：  
  - `app.commandLine.appendSwitch('remote-debugging-port', '9222')` → 仅开发时开启（P1）。  
  - `logWindowDebug` → 用环境变量开关（P1）。  
  - 保留 crash 写文件与 logger，可选通过环境变量控制写文件/弹窗（P2）。

---

### E. 代码质量守门员

- **Lint**：已使用 Biome（`biome.json`），`lint-staged` 中 `biome check --write ...`；无顶层 `npm run lint` → 建议加 `"lint": "biome check ."`（P1）。
- **Typecheck**：`tsconfig.json` 含 `strict: true`；无顶层 `npm run typecheck` → 建议加 `"typecheck": "tsc --noEmit"`（P1）。
- **最小新增脚本建议**：  
  - `npm run lint`  
  - `npm run typecheck`  
  - `npm run smoke:electron`（见 B 节，需新增 `scripts/smoke-electron.js` 并在 package.json 中声明）。

---

## 可执行改进清单（按优先级）

1. **P0**：删除或加固 `open-win` 子窗口（见上表）。
2. **P1**：移除 `index.ts` 中重复的 crash 注册，仅保留 `app.ts` 中一套。
3. **P1**：`remote-debugging-port` 仅在不打包时添加。
4. **P1**：`logWindowDebug` 仅在 `process.env.TASI_DEBUG === '1'` 时写文件。
5. **P1**：在 package.json 增加 `lint`、`typecheck` 脚本。
6. **P2**：主进程 external 中视情况移除 bufferutil/utf-8-validate；或打包前校验。
7. **P2**：将 auth 相关 channel 纳入 `ipcChannels.ts` 与 `electron-api.d.ts`。
8. **P2**：主窗口 webPreferences 显式 `sandbox: true`；crash 行为可通过环境变量配置。
9. **可选**：已新增 `scripts/smoke-electron.js`；在 package.json 中增加 `"smoke:electron": "node scripts/smoke-electron.js"` 即可用 `npm run smoke:electron` 做打包后 3 秒 smoke test。

以上均为最小可执行改动，不要求大重构。
