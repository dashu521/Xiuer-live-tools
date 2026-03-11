# 修复打包后 “Cannot find module 'bcryptjs'” 的变更与验证

## 一、引用与依赖情况

### 1. bcryptjs 引用位置（行号）

| 文件 | 行号 | 引用方式 |
|------|------|----------|
| `electron/main/services/AuthService.ts` | 1 | `import bcrypt from 'bcryptjs'` |
| `vite.config.ts` | 59, 90 | main/preload 的 `rollupOptions.external` 中含 `'bcryptjs'` |
| `package.json` | 32 | `dependencies.bcryptjs: "^2.4.3"` |

主进程加载顺序：`dist-electron/main/index.js` → 动态加载 `app-*.js` → `AuthService` → `require('bcryptjs')`。  
Vite 将 bcryptjs 标为 external，打包后为 `require('bcryptjs')`，运行时需从 **app 内的 node_modules** 解析。

### 2. 依赖配置

- **bcryptjs 已在 `package.json` 的 `dependencies`**（第 32 行），不是 devDependencies，无需移动。
- 未在项目中发现 npm workspace/monorepo；依赖应落在根目录 `node_modules`。

### 3. 为何打包后找不到

对当前 `release/1.0.0/win-unpacked/resources/app.asar` 解包后确认：

- **整个 app.asar 里没有 `node_modules` 目录**（不仅缺 bcryptjs）。
- 因此主进程在 asar 内执行 `require('bcryptjs')` 时，Node 无法在 app 目录下找到 `node_modules/bcryptjs`，报错 “Cannot find module 'bcryptjs'”。

可能原因（满足其一即可导致）：

1. **electron-builder 的 app 目录未包含 node_modules**
   - 若使用自定义 `files`，且构建时未在 app 目录执行 `npm install --production`，则 asar 中不会出现 node_modules。
2. **构建时项目根目录没有 node_modules**
   - 若在未执行 `npm install` 的环境（如部分 CI）中只运行 `electron-builder`，则 `files` 中的 `node_modules/**/*` 无内容可复制。
3. **未使用 npm prune --production**
   - 一般不会主动删掉 dependencies；更可能是上面两点导致根本没把 node_modules 打进 asar。

未改业务逻辑、未替换 bcryptjs，仅做依赖与打包配置层面的修复与验证说明。

---

## 二、已做的修复（仅配置/打包层面）

### 1. electron-builder.json

在 **不删除任何原有条目** 的前提下，在 `files` 中显式增加对 bcryptjs 的包含：

```diff
  "files": [
    "dist/**/*",
    "dist-electron/**/*",
    "dist-electron/main/runtime/**",
    "electron/platformConfig.js",
    "node_modules/**/*",
+   "node_modules/bcryptjs/**",
    "package.json"
  ],
```

目的：即便默认复制逻辑有遗漏，也强制把 `node_modules/bcryptjs` 打进 asar。

### 2. 未改动的部分

- **package.json**：bcryptjs 已在 `dependencies`，未改。
- **vite.config.ts**：未改；bcryptjs 仍为 external，保持 `require('bcryptjs')` 由 Node 在运行时解析。
- **业务代码**：未替换或修改 bcryptjs 使用方式。

---

## 三、打包时找不到的根因说明（为何 asar 里没有 node_modules）

- **npm prune --production / node_modules 裁剪**  
  若在 app 目录执行了 `npm install --production`，通常只会安装 `dependencies`，不会删掉 bcryptjs。当前现象是 **整个 node_modules 都不在 asar 里**，更像是 app 目录从未成功生成/复制 node_modules。

- **monorepo / workspace**  
  当前仓库为单包结构，依赖在根目录；未发现 workspace 导致依赖落在别处的情况。

- **build 产物里 require 路径被改写/外部化**  
  Vite 对 main 的配置里 bcryptjs 为 external，产物中为 `require('bcryptjs')`，解析依赖 Node 的 module 解析（从 app 根目录找 node_modules）。未发现路径被错误改写；问题在于 asar 内根本没有 node_modules。

结论：根因是 **打包得到的 app.asar 中没有包含 node_modules**。修复方向是保证 electron-builder 打包时 app 目录内存在 node_modules（且包含 bcryptjs），并已通过 `files` 显式加入 `node_modules/bcryptjs/**` 作为兜底。

---

## 四、强制保证打包产物包含 bcryptjs

- **electron-builder 的 files**  
  已包含 `node_modules/**/*` 和 `node_modules/bcryptjs/**`，从配置上应能复制 bcryptjs。

- **若 asar 解包后仍无 `node_modules/bcryptjs`**  
  1. 确认构建前在 **项目根目录** 执行过 `npm install`（或 `npm ci`），且 `node_modules/bcryptjs` 存在。  
  2. 确认未在构建前删除或排除整个 `node_modules`。  
  3. 若使用 CI，确认 electron-builder 使用的是已安装好依赖的目录，且 `files` 中包含 `node_modules/**/*` 与 `node_modules/bcryptjs/**`。

- **若 asar 内有 node_modules/bcryptjs 仍报 “Cannot find module 'bcryptjs'”**  
  属 require 解析上下文问题，可调试：  
  - 在主进程最早执行处打印 `module.paths` 或对 `require.resolve('bcryptjs')` 做 try/catch，确认解析起点是否在 app.asar 内、路径是否包含 asar 内 node_modules。

---

## 五、验证步骤（请在本机自动执行）

**前置**：关闭所有 TASI-live-Supertool 相关进程，避免占用 `release` 目录导致 dist:clean 失败。

1. **安装依赖**
   ```bash
   npm ci
   ```
   若无锁文件或需更新依赖，可用：
   ```bash
   npm install
   ```

2. **打包**
   ```bash
   npm run dist
   ```

3. **解包 asar**
   ```bash
   npx @electron/asar extract release/1.0.0/win-unpacked/resources/app.asar release/app.asar.extracted
   ```
   （路径按实际版本目录调整，如 `release/<version>/win-unpacked/...`。）

4. **验证 bcryptjs 是否存在**
   - 文件必须存在：  
     `release/app.asar.extracted/node_modules/bcryptjs/package.json`
   - 若不存在，说明 node_modules 仍未打进 asar，需检查构建环境与 electron-builder 行为（见上一节）。

5. **运行 exe**
   ```bash
   release\1.0.0\win-unpacked\TASI-live-Supertool.exe
   ```
   - 若不再出现 “Cannot find module 'bcryptjs'”，则修复有效。
   - 若仍报错，请提供：  
     - 解包后是否存在 `release/app.asar.extracted/node_modules/bcryptjs/`；  
     - 主进程内 `require.resolve('bcryptjs')` 或 `module.paths` 的打印结果（若已加调试）。

---

## 六、最终变更点汇总

| 项目 | 变更 |
|------|------|
| **package.json** | 无修改（bcryptjs 已在 dependencies） |
| **electron-builder.json** | `files` 中新增一项：`"node_modules/bcryptjs/**"` |
| **锁文件** | 无变更（未执行 npm install/ci 修改依赖树） |
| **验证** | 需在本机执行上述五步；当前环境因 release 目录被占用无法完成 dist，解包已确认修复前 asar 内无 node_modules |

完成上述验证后，若 bcryptjs 存在于 asar 且 exe 正常启动，即可视为修复完成。
