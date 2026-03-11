# Electron 打包诊断报告：exe 打不开/无反应/启动即退出

**目标问题**：打包生成的 Windows 可执行程序（exe）双击打不开/无反应（或启动即退出）。  
**约束**：只诊断不乱改；结论需有证据（文件路径、配置、产物树、日志片段）。

---

## 你将运行的命令清单

| 序号 | 命令 | 用途 |
|------|------|------|
| 1 | `npm run build` | 复现生产构建（含 tsc、vite build、复制 runtime） |
| 2 | `npm run dist` | 复现完整打包（dist:clean + build + electron-builder --win） |
| 3 | `Get-ChildItem -Path ".\release\1.0.0\win-unpacked\resources" -Recurse -Name \| Select-Object -First 50` | 查看 win-unpacked 下 resources 结构 |
| 4 | `npx @electron/asar extract .\release\1.0.0\win-unpacked\resources\app.asar .\release\app.asar.out` | 解压 app.asar 校验内部文件 |
| 5 | `.\release\1.0.0\win-unpacked\TASI-live-Supertool.exe 2>&1 \| Tee-Object -FilePath .\exe-stdout-stderr.txt` | 命令行启动 exe 并捕获控制台输出 |
| 6 | 查看 `%APPDATA%\TASI-live-Supertool\logs\`（若存在） | electron-log 文件日志 |

---

## 1) 仓库结构扫描

### 1.1 入口与配置文件位置

| 项目 | 路径 |
|------|------|
| **Main 进程入口** | `electron/main/index.ts` → 构建后 `dist-electron/main/index.js` |
| **Main 业务入口** | `electron/main/app.ts` → 构建后打入 `dist-electron/main/app-*.js` |
| **Renderer 入口** | Vite 默认 `index.html` + React → 构建后 `dist/index.html` |
| **Preload** | `electron/preload/index.ts` → 构建后 `dist-electron/preload/index.js` |
| **打包配置** | `electron-builder.json`（与 package.json 同级） |
| **Vite 配置** | `vite.config.ts`（vite-plugin-electron 配置在内） |

### 1.2 package.json 关键字段

- **main**：`"dist-electron/main/index.js"`  
- **scripts 与打包相关**：  
  - `"build": "tsc && vite build && node -e \"const fs=require('fs'); const p='dist-electron/main/runtime'; fs.mkdirSync(p,{recursive:true}); fs.copyFileSync('electron/main/runtime/load-playwright.cjs', p+'/load-playwright.cjs')\""`  
  - `"dist:clean": "node -e \"require('fs').rmSync('release',{recursive:true,force:true})\""`  
  - `"dist": "npm run dist:clean && npm run build && electron-builder --win --publish never"`  
- **debug.env**：`VITE_DEV_SERVER_URL: "http://127.0.0.1:7777/"`（仅开发用，不参与生产打包环境变量）

### 1.3 electron-builder 关键配置

- **appId**：`com.tasi.livesupertool`  
- **productName**：`TASI-live-Supertool`  
- **asar**：`true`  
- **asarUnpack**：`node_modules/playwright/**`、`node_modules/playwright-extra/**`、`node_modules/playwright-extra-plugin-stealth/**`、`node_modules/puppeteer-extra-plugin-stealth/**`  
- **directories.output**：`release/${version}`  
- **files**：`dist/**/*`、`dist-electron/**/*`、`electron/platformConfig.js`、`node_modules/**/*`、`package.json`  
- **extraMetadata.main**：`dist-electron/main/index.js`  
- **win.target**：`nsis`、`zip`（arch x64）

---

## 2) 复现构建与打包

- **拟执行命令**：`npm run build`，随后 `npm run dist`（PowerShell 下请用 `;` 连接或分两条执行，避免 `&&` 解析问题）。  
- **本环境未实际执行**：因终端/权限限制未在本次会话中跑完 build/dist。  
- **若打包失败**：请记录第一条报错（first failing point）、完整 stderr/stdout 与错误堆栈，便于精确定位。

---

## 3) 产物结构与入口一致性校验

### 3.1 win-unpacked 位置与 exe

- **路径**：`release/1.0.0/win-unpacked/`  
- **exe**：`release/1.0.0/win-unpacked/TASI-live-Supertool.exe`  
- **app 资源**：`release/1.0.0/win-unpacked/resources/app.asar`（无 app.asar.unpacked 时，仅 asar）

### 3.2 主进程实际加载链

- **package.json main** → `dist-electron/main/index.js`  
- **index.js 内容**（`dist-electron/main/index.js`）：  
  `void Promise.resolve().then(() => require("./app-D4wLAQoM.js"));`  
- 即主进程加载：`dist-electron/main/index.js` → `dist-electron/main/app-*.js`。  
- **结论**：入口链正确；需保证 **app.asar 内** 存在 `dist-electron/main/index.js` 与 `dist-electron/main/app-*.js`（由 files 配置打入）。

### 3.3 Renderer 与 loadURL/loadFile

- **源码**（`electron/main/app.ts` 151–157 行）：  
  - 若 `VITE_DEV_SERVER_URL` 存在 → `win.loadURL(VITE_DEV_SERVER_URL)`（开发）；  
  - 否则 → `win.loadFile(indexHtml)`，其中 `indexHtml = path.join(RENDERER_DIST, 'index.html')`，`RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')`。  
- **构建产物**（`dist-electron/main/app-D4wLAQoM.js` 约 29327、29382、29386 行）：  
  - `VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL`  
  - `if (VITE_DEV_SERVER_URL) { win.loadURL(VITE_DEV_SERVER_URL); } else { win.loadFile(indexHtml); }`  
- **结论**：生产环境未设置 `VITE_DEV_SERVER_URL` 时走 `loadFile(indexHtml)`，不会指向 localhost；renderer 路径依赖 `APP_ROOT`（见下）和 asar 内是否存在 `dist/index.html`。

### 3.4 APP_ROOT 与 __dirname

- **构建产物**（`dist-electron/main/app-D4wLAQoM.js` 约 29323–29324、29339–29340 行）：  
  - `__dirname$1 = path.dirname(fileURLToPath(require("url").pathToFileURL(__filename).href))`  
  - `process.env.APP_ROOT = path.join(__dirname$1, "../..")`  
  - `preload = path.join(__dirname$1, "../preload/index.js")`  
  - `indexHtml = path.join(RENDERER_DIST, "index.html")`，`RENDERER_DIST = path.join(APP_ROOT, "dist")`  
- 在 asar 内运行时，`__filename` 指向 `.../app.asar/dist-electron/main/app-*.js`，故 `APP_ROOT` = app.asar 根目录，`indexHtml` = asar 内 `dist/index.html`，路径逻辑正确。  
- **前提**：asar 内须存在 `dist/index.html`、`dist-electron/main/index.js`、`dist-electron/main/app-*.js`、`dist-electron/preload/index.js`。

### 3.5 关键缺失校验（证据）

- **当前仓库 `dist-electron/main/` 目录列表**（构建产物，非 asar 内）：  
  - 仅有：`index.js`、`index.js.map`、`app-D4wLAQoM.js`、`app-D4wLAQoM.js.map`、`dev-D3Iv9CfB.js`、`dev-D3Iv9CfB.js.map`  
  - **未发现**：`runtime/` 目录及 `runtime/load-playwright.cjs`  
- **主进程对 runtime 的依赖**（`dist-electron/main/app-D4wLAQoM.js` 约 21595 行）：  
  - `const { chromium } = require(path$1.join(__dirname, "runtime", "load-playwright.cjs"));`  
- 该行为 **模块顶层同步 require**：一旦 `app-D4wLAQoM.js` 被加载（即 `index.js` 的 `require("./app-D4wLAQoM.js")` 执行），立即执行；若 `dist-electron/main/runtime/load-playwright.cjs` 在打包后的 app.asar 中不存在，Node 会抛出 `Cannot find module '.../runtime/load-playwright.cjs'`，主进程在创建窗口或写日志前即崩溃。

**结论**：  
- 若打包时未执行 build 中的 “复制 runtime” 步骤，或 electron-builder 未把 `dist-electron/main/runtime/` 打进 asar，则 **app.asar 内缺少 `dist-electron/main/runtime/load-playwright.cjs`**，会导致主进程在加载 app  chunk 时立即崩溃，表现为 exe 无反应/启动即退出。

---

## 4) 运行时崩溃/退出原因捕获

### 4.1 命令行启动 exe 捕获输出

- **建议命令**（PowerShell，在项目根执行）：  
  `.\release\1.0.0\win-unpacked\TASI-live-Supertool.exe 2>&1 | Tee-Object -FilePath .\exe-stdout-stderr.txt`  
- 若主进程在 require 阶段崩溃，通常 **无正常业务日志**，仅可能有 Node/Electron 的 require 错误（是否输出到 stderr 取决于环境）。

### 4.2 日志入口

- **electron-log**（`electron/main/logger.ts`）：使用 `electron-log`，默认会写文件。  
- **常见路径**（Windows）：`%APPDATA%\TASI-live-Supertool\logs\`（或 electron-log 默认 userData/logs）。  
- 若主进程在 **第一次 require**（如 `load-playwright.cjs`）就崩溃，**尚未执行到 `app.whenReady()` 或 `createLogger` 使用处**，则可能没有任何 log 文件或仅有极少量输出。  
- **证据链（主进程未执行/立即崩溃）**：  
  1. exe 双击无窗口、无反应或闪退；  
  2. 命令行运行无正常业务输出；  
  3. `app.asar` 内缺少 `dist-electron/main/runtime/load-playwright.cjs`，且主进程入口链会加载 `app-D4wLAQoM.js`，其顶层有 `require(path.join(__dirname, "runtime", "load-playwright.cjs"))`；  
  4. 故崩溃点：**加载 app-*.js 时执行到该 require 即抛出 MODULE_NOT_FOUND**。

### 4.3 其他可能原因（次要）

- **单实例锁**（`electron/main/app.ts` 88–91 行）：`if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }`  
  - 若已有一实例在运行（或僵尸进程未释放锁），再次双击 exe 会直接退出，表现为“无反应”。可通过任务管理器确认是否已有 `TASI-live-Supertool.exe` 或残留进程。

---

## 5) 根因结论 + 最小修复方案

### 5.1 Root Cause（按概率排序）

1. **【高】打包产物中缺少 `dist-electron/main/runtime/load-playwright.cjs`**  
   - **证据**：  
     - 当前 `dist-electron/main/` 下列表无 `runtime/` 目录（见 3.5）。  
     - `dist-electron/main/app-D4wLAQoM.js` 第 21595 行存在顶层：  
       `const { chromium } = require(path$1.join(__dirname, "runtime", "load-playwright.cjs"));`  
     - 主进程加载顺序：`index.js` → `require("./app-D4wLAQoM.js")` → 执行到该 require 时若文件不存在则抛错退出。  
   - **结论**：主进程在未打开窗口、未写业务日志前即因 MODULE_NOT_FOUND 崩溃，符合“exe 打不开/无反应/启动即退出”。

2. **【中】单实例锁导致第二次启动直接退出**  
   - **证据**：`electron/main/app.ts` 88–91 行，`!app.requestSingleInstanceLock()` 时 `process.exit(0)`。  
   - **结论**：仅影响“第二次双击”；若第一次就无反应，则以此条为辅。

3. **【低】生产环境误设 VITE_DEV_SERVER_URL**  
   - **证据**：代码与构建产物中均以 `process.env.VITE_DEV_SERVER_URL` 分支；electron-builder 默认不注入该变量。  
   - **结论**：除非 CI/本机环境显式注入，否则概率低。

### 5.2 Fix Plan（最小改动集）

- **目标**：保证打包后的 app.asar 中一定存在 `dist-electron/main/runtime/load-playwright.cjs`，且主进程不再在未捕获的 require 上崩溃（可选加固）。

**修改 1：确保 build 后一定复制 runtime（已存在则保持）**  
- **文件**：`package.json`  
- **当前**：`"build": "tsc && vite build && node -e \"const fs=require('fs'); const p='dist-electron/main/runtime'; fs.mkdirSync(p,{recursive:true}); fs.copyFileSync('electron/main/runtime/load-playwright.cjs', p+'/load-playwright.cjs')\""`  
- **操作**：确认该段存在且可执行（无引号/转义错误）。若从未执行过完整 `npm run build`，需先在本机执行一次，再执行 `npm run dist`，以生成 `dist-electron/main/runtime/load-playwright.cjs`。

**修改 2（推荐）：electron-builder 显式包含 runtime**  
- **文件**：`electron-builder.json`  
- **在 `files` 中增加**（或确认已有覆盖）：  
  - `"dist-electron/main/runtime/**"` 或至少 `"dist-electron/main/runtime/load-playwright.cjs"`  
- **原因**：避免因 files 的 glob 或打包顺序导致 `runtime/` 被遗漏。

**修改 3（可选）：主进程对 load-playwright 的 require 做容错（便于后续诊断）**  
- **文件**：`electron/main/managers/BrowserSessionManager.ts`  
- **当前**：顶层 `const { chromium } = require(path.join(__dirname, 'runtime', 'load-playwright.cjs'))`  
- **操作**：可改为 try/catch：若 require 失败，将错误写入 userData 下某诊断文件（如 `main-load-playwright-error.txt`），再 rethrow；或延迟 require 到首次 `createSession` 时并给出明确错误提示。  
- **说明**：此为加固/诊断用，非必须；最小修复仅 1+2 即可。

### 5.3 Verification Steps（修复后执行）

1. **清理后重新构建与打包**  
   - `npm run dist`  
   - 若使用 PowerShell，且脚本中用 `&&` 导致报错，可改为分步：  
     - `npm run dist:clean`  
     - `npm run build`  
     - `npx electron-builder --win --publish never`

2. **校验产物**  
   - 构建后：  
     - `Get-ChildItem .\dist-electron\main\runtime`  
     - 应存在 `load-playwright.cjs`  
   - 打包后解压 asar：  
     - `npx @electron/asar extract .\release\1.0.0\win-unpacked\resources\app.asar .\release\app.asar.out`  
     - `Get-ChildItem .\release\app.asar.out\dist-electron\main\runtime`  
     - 应存在 `load-playwright.cjs`

3. **运行 exe**  
   - 关闭所有已运行的 TASI-live-Supertool 进程后，双击  
     `release\1.0.0\win-unpacked\TASI-live-Supertool.exe`  
   - 或命令行：  
     `.\release\1.0.0\win-unpacked\TASI-live-Supertool.exe 2>&1 | Tee-Object -FilePath .\exe-out.txt`  
   - 预期：窗口正常出现，无闪退。

4. **日志（可选）**  
   - 查看 `%APPDATA%\TASI-live-Supertool\logs\` 是否有最新 main 进程日志，确认启动流程已执行到 logger。

---

## 附录：TEMP DIAGNOSTIC PATCH（可选，可回滚）

若需进一步确认“主进程是否执行到 app 逻辑”，可在 **不改变业务逻辑** 的前提下增加最小写文件诊断：

- **文件**：`electron/main/index.ts`  
- **在** `void import('./app')` **之前** 增加（仅用于诊断）：  
  - 使用 `require('fs').writeFileSync(require('path').join(require('electron').app.getPath('userData'), 'main-started.txt'), new Date().toISOString())`  
  - 注意：此时 `app` 可能尚未 ready，若报错可改为写固定路径（如 `process.env.TEMP` 下文件）。  
- **验证**：打包运行 exe 后，检查 userData 或 TEMP 下是否生成该文件；有则说明主进程至少执行到该行。  
- **回滚**：删除上述几行即可。

---

**报告结束。** 请按上述命令清单在本机执行构建/打包/解压/运行，并根据结果对照本报告中的证据与修复方案进行验证。
