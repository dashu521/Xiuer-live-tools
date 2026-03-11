# 打包失败根因诊断报告

**目标问题**：Windows 打包后 exe 双击无反应 / 启动即退出。  
**约束**：系统性根因定位，不修改源码；结论可验证。

---

## 将运行的命令清单

| 序号 | 命令 | 用途 |
|------|------|------|
| 1 | 读取 package.json、electron-builder.json、vite.config.ts、electron/main/index.ts、electron/main/app.ts | 一、入口与配置一致性扫描 |
| 2 | `npm run build` | 二、生产 build 复现 |
| 3 | `npm run dist`（或分步：`npm run dist:clean`；`npm run build`；`npx electron-builder --win --publish never`） | 二、electron-builder 打包复现 |
| 4 | `Get-ChildItem .\release\1.0.0\win-unpacked\resources -Recurse -Name` | 三、定位 win-unpacked 与 app.asar |
| 5 | `npx @electron/asar extract .\release\1.0.0\win-unpacked\resources\app.asar .\release\app.asar.extracted` | 三、解包 app.asar |
| 6 | `Get-ChildItem .\release\app.asar.extracted\dist-electron\main -Recurse -Name` 等 | 三、校验主进程/preload/renderer/runtime 文件 |
| 7 | `.\release\1.0.0\win-unpacked\TASI-live-Supertool.exe 2>&1 | Tee-Object -FilePath .\exe-out.txt` | 四、命令行启动 exe 捕获输出 |

---

## 一、入口与配置一致性扫描

### 1.1 Electron 主进程真实入口

| 层级 | 路径 | 来源 |
|------|------|------|
| **TS 入口** | `electron/main/index.ts` | vite.config.ts → electron({ main: { entry: 'electron/main/index.ts' } }) |
| **Build 后 JS 入口** | `dist-electron/main/index.js` | vite main build outDir: 'dist-electron/main' |
| **主逻辑 chunk** | `dist-electron/main/app-D4wLAQoM.js` | index.js 内容：`void Promise.resolve().then(() => require("./app-D4wLAQoM.js"))` |

**证据**：  
- `dist-electron/main/index.js` 第 5 行：`void Promise.resolve().then(() => require("./app-D4wLAQoM.js"));`  
- 即主进程加载链：`index.js` → `require("./app-D4wLAQoM.js")`。

### 1.2 package.json 与 extraMetadata.main

| 字段 | 值 | 一致性 |
|------|-----|--------|
| **package.json main** | `"dist-electron/main/index.js"` | ✓ |
| **electron-builder extraMetadata.main** | `"dist-electron/main/index.js"` | ✓ 一致 |

### 1.3 electron-builder：files / asar / asarUnpack / directories

| 配置项 | 值 |
|--------|-----|
| **files** | `["dist/**/*", "dist-electron/**/*", "electron/platformConfig.js", "node_modules/**/*", "package.json"]` |
| **asar** | `true` |
| **asarUnpack** | `["node_modules/playwright/**", "node_modules/playwright-extra/**", "node_modules/playwright-extra-plugin-stealth/**", "node_modules/puppeteer-extra-plugin-stealth/**"]` |
| **directories.output** | `"release/${version}"` |

**结论**：主进程、preload、renderer 均由 `dist-electron/**/*`、`dist/**/*` 打入 asar；未显式列出 `dist-electron/main/runtime/**`。

### 1.4 主进程、preload、renderer 实际加载路径

| 角色 | 实际加载路径 | 依据 |
|------|--------------|------|
| **主进程入口** | asar 内 `dist-electron/main/index.js` | package.json main |
| **主进程逻辑** | asar 内 `dist-electron/main/app-D4wLAQoM.js` | index.js 中 require("./app-D4wLAQoM.js") |
| **preload** | asar 内 `dist-electron/preload/index.js` | app.ts：`preload = path.join(__dirname, '../preload/index.js')`，__dirname 为 dist-electron/main |
| **renderer** | asar 内 `dist/index.html` | app.ts：`indexHtml = path.join(RENDERER_DIST, 'index.html')`，RENDERER_DIST = path.join(APP_ROOT, 'dist') |

---

## 二、构建与打包复现

- **本环境**：未执行 `npm run build` / `npm run dist`（终端/权限限制）。  
- **请在本机执行**：  
  1. `npm run build` — 记录完整 stdout/stderr。  
  2. `npm run dist` — 若失败，记录**第一个失败点**（first failing point）及完整错误堆栈。  
- **若 build 成功**：检查 `dist-electron/main/runtime/load-playwright.cjs` 是否存在（build 脚本中有复制该文件的 node -e 步骤）。

---

## 三、打包产物结构审计

### 3.1 win-unpacked 与 app.asar 定位

| 项目 | 路径 | 存在性 |
|------|------|--------|
| **win-unpacked 目录** | `release/1.0.0/win-unpacked/` | ✓ 存在 |
| **exe** | `release/1.0.0/win-unpacked/TASI-live-Supertool.exe` | ✓ 存在 |
| **resources** | `release/1.0.0/win-unpacked/resources/` | ✓ 存在 |
| **app.asar** | `release/1.0.0/win-unpacked/resources/app.asar` | ✓ 存在 |

### 3.2 解包 app.asar 后需校验的文件

| 文件 | 预期路径（asar 内） | 校验方式 |
|------|---------------------|----------|
| 主进程入口 | `dist-electron/main/index.js` | 解包后列出 `app.asar.extracted/dist-electron/main/` |
| 主进程逻辑 | `dist-electron/main/app-D4wLAQoM.js` | 同上 |
| preload | `dist-electron/preload/index.js` | 列出 `app.asar.extracted/dist-electron/preload/` |
| renderer | `dist/index.html` | 列出 `app.asar.extracted/dist/` |
| **runtime（主进程 require）** | `dist-electron/main/runtime/load-playwright.cjs` | 列出 `app.asar.extracted/dist-electron/main/runtime/` |

### 3.3 当前构建产物（未解包 asar）的审计结果

- **本地 `dist-electron/main/` 目录列表**（构建产物，非 asar 内）：  
  - 存在：`index.js`、`index.js.map`、`app-D4wLAQoM.js`、`app-D4wLAQoM.js.map`、`dev-D3Iv9CfB.js`、`dev-D3Iv9CfB.js.map`  
  - **不存在**：`runtime/` 目录及 `runtime/load-playwright.cjs`  

- **主进程对 runtime 的依赖**（`dist-electron/main/app-D4wLAQoM.js` 第 21595 行）：  
  - `const { chromium } = require(path$1.join(__dirname, "runtime", "load-playwright.cjs"));`  
  - 该行为**模块顶层同步 require**，在 `app-D4wLAQoM.js` 被加载时立即执行。

- **推论**：  
  - 若打包时 `dist-electron/main/runtime/load-playwright.cjs` 不存在（build 未执行复制步骤或复制失败），则 electron-builder 打入 asar 的 `dist-electron/**/*` 中**不包含** `dist-electron/main/runtime/load-playwright.cjs`。  
  - 运行时主进程加载 `app-D4wLAQoM.js` 后执行该 require，会抛出 `Cannot find module '.../runtime/load-playwright.cjs'`，进程在创建窗口或写日志前退出。

**建议**：在本机执行  
`npx @electron/asar extract .\release\1.0.0\win-unpacked\resources\app.asar .\release\app.asar.extracted`  
后检查 `.\release\app.asar.extracted\dist-electron\main\runtime\` 是否存在 `load-playwright.cjs`。若不存在，即验证根因。

---

## 四、运行时崩溃定位

### 4.1 命令行启动 exe 捕获输出

- **命令**（PowerShell，项目根目录）：  
  `.\release\1.0.0\win-unpacked\TASI-live-Supertool.exe 2>&1 | Tee-Object -FilePath .\exe-out.txt`  
- **若主进程在 require 阶段崩溃**：通常无业务日志，可能仅有 Node/Electron 的 require 错误（是否输出到 stderr 视环境而定）。

### 4.2 判断类型与证据

| 类型 | 判断 | 证据链 |
|------|------|--------|
| **A. 主进程未执行** | 极低 | 若有 exe 且双击有进程启动再退出，说明主进程有执行。 |
| **B. 主进程执行但在 require 阶段崩溃** | **高** | 1）主进程入口为 index.js → require("./app-D4wLAQoM.js")；2）app-D4wLAQoM.js 顶层有 `require(path.join(__dirname, "runtime", "load-playwright.cjs"))`；3）当前 dist-electron/main 下无 runtime/ 目录；4）若 asar 内也无该文件，则 require 抛出 MODULE_NOT_FOUND，进程在 app.whenReady()、createWindow()、logStartupInfo() 之前退出 → 无窗口、无业务日志。 |
| **C. 主进程正常，renderer 加载失败** | 低 | 需主进程已通过 require 并执行到 createWindow()；若为 B，则不会到达此处。 |

### 4.3 证据小结

- **文件证据**：`dist-electron/main/app-D4wLAQoM.js` 第 21595 行存在  
  `const { chromium } = require(path$1.join(__dirname, "runtime", "load-playwright.cjs"));`  
- **产物证据**：当前 `dist-electron/main/` 下**无** `runtime/load-playwright.cjs`。  
- **逻辑证据**：该 require 在模块顶层，加载 `app-D4wLAQoM.js` 时立即执行；若文件缺失，Node 抛出异常，主进程退出，表现为 exe 无反应/启动即退出。

---

## 五、最终诊断结论

### 5.1 Root Cause（按概率排序，每条带证据链）

**1. 【高】打包产物中缺少 `dist-electron/main/runtime/load-playwright.cjs`**

- **证据链**：  
  - 主进程加载链：`dist-electron/main/index.js` → `require("./app-D4wLAQoM.js")`（index.js 第 5 行）。  
  - `dist-electron/main/app-D4wLAQoM.js` 第 21595 行：`const { chromium } = require(path$1.join(__dirname, "runtime", "load-playwright.cjs"));`（顶层同步 require）。  
  - 当前仓库 `dist-electron/main/` 下列表**无** `runtime/` 目录，即**无** `runtime/load-playwright.cjs`。  
  - package.json 的 build 脚本包含复制步骤：`node -e "const fs=require('fs'); const p='dist-electron/main/runtime'; fs.mkdirSync(p,{recursive:true}); fs.copyFileSync('electron/main/runtime/load-playwright.cjs', p+'/load-playwright.cjs')"`。若该步骤未执行或失败，则打包时 `dist-electron/**/*` 中不包含此文件，asar 内缺失。  
- **结论**：主进程在加载 app  chunk 时立即 require 该文件，文件缺失导致 MODULE_NOT_FOUND，进程在未创建窗口、未写业务日志前退出，符合“exe 双击无反应/启动即退出”。

**2. 【中】单实例锁导致第二次启动直接退出**

- **证据链**：  
  - `electron/main/app.ts` 第 88–91 行：`if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }`  
- **结论**：仅影响“第二次及以后双击”；若第一次就无反应，则以根因 1 为主。

**3. 【低】生产环境误设 VITE_DEV_SERVER_URL**

- **证据链**：  
  - app.ts 第 151–157 行：若 `VITE_DEV_SERVER_URL` 存在则 `win.loadURL(VITE_DEV_SERVER_URL)`，否则 `win.loadFile(indexHtml)`。  
  - electron-builder 默认不注入该变量。  
- **结论**：除非 CI/本机显式注入，否则概率低；且若为根因 1，进程在到达 loadURL/loadFile 前已退出。

---

### 5.2 最小修复方案

**目标**：保证打包后的 app.asar 中**一定存在** `dist-electron/main/runtime/load-playwright.cjs`，且主进程不再在该 require 上未捕获崩溃。

| 修改 | 文件 | 位置/字段 | 修改内容 | 根因级理由 |
|------|------|------------|----------|------------|
| **1** | **package.json** | scripts.build | 确认 build 脚本包含复制 `electron/main/runtime/load-playwright.cjs` → `dist-electron/main/runtime/load-playwright.cjs` 的 node -e 步骤，且无引号/转义错误导致未执行。 | 根因：asar 内缺该文件；该文件仅能由 build 阶段复制产生，electron-builder 只打包已有文件。 |
| **2** | **electron-builder.json** | files | 在 files 中**显式增加**一项：`"dist-electron/main/runtime/**"`（或至少 `"dist-electron/main/runtime/load-playwright.cjs"`）。 | 根因级加固：避免 files 的 glob 或打包顺序导致 runtime 被遗漏；显式声明可被审计。 |
| **3（可选）** | **electron/main/managers/BrowserSessionManager.ts** | 顶层 require | 将 `require(path.join(__dirname, 'runtime', 'load-playwright.cjs'))` 改为 try/catch，失败时写入 userData 下诊断文件（如 `main-load-playwright-error.txt`）再 rethrow，便于后续排查。 | 非根因修复，仅便于验证与排查。 |

---

### 5.3 验证步骤（修完如何确认真的好了）

1. **清理后重新打包**  
   - 执行：`npm run dist`（或分步：`npm run dist:clean` → `npm run build` → `npx electron-builder --win --publish never`）。  
   - 若 PowerShell 报 `&&` 错误，改用分步或 `;` 连接。

2. **校验 build 产物**  
   - 执行：`Get-ChildItem .\dist-electron\main\runtime`  
   - **预期**：存在 `load-playwright.cjs`。

3. **校验 asar 内文件**  
   - 执行：`npx @electron/asar extract .\release\1.0.0\win-unpacked\resources\app.asar .\release\app.asar.extracted`  
   - 执行：`Get-ChildItem .\release\app.asar.extracted\dist-electron\main\runtime`  
   - **预期**：存在 `load-playwright.cjs`。

4. **运行 exe**  
   - 关闭所有已运行的 TASI-live-Supertool 进程后，双击  
     `release\1.0.0\win-unpacked\TASI-live-Supertool.exe`  
   - 或命令行：`.\release\1.0.0\win-unpacked\TASI-live-Supertool.exe 2>&1 | Tee-Object -FilePath .\exe-out.txt`  
   - **预期**：窗口正常出现，无闪退；若有 exe-out.txt，无 MODULE_NOT_FOUND 类错误。

5. **日志（可选）**  
   - 查看 `%APPDATA%\TASI-live-Supertool\logs\` 是否有 main 进程启动日志，确认主进程已执行到 logger。

---

**报告结束。** 在给出本报告前未修改任何源码；根因与最小修复方案均基于入口链、构建产物与 require 路径的证据链，可依上述验证步骤在本机复核。
