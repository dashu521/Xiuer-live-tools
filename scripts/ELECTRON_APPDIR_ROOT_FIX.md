# Electron 主进程依赖环境根因修复说明

## 一、electron-builder 实际使用的 appDir

- **打包入口目录**：electron-builder 默认以**项目根目录**（执行 `npm run dist` 时的当前工作目录）为 app 目录。
- **显式指定**：已在 `electron-builder.json` 的 `directories` 中增加 `"app": "."`，与默认一致，避免歧义。
- **校验输出**：执行 `npm run dist:check`（或 `npm run dist` 时会自动执行）会输出：
  - **AppDir (cwd)**：实际使用的 app 目录路径；
  - **node_modules 存在**：该目录下是否真实存在 `node_modules/`；
  - **node_modules/bcryptjs/package.json 存在**：主进程 external 依赖是否可被 Node 解析。

示例（本机）：
```
--- electron-builder appDir 校验 ---
AppDir (cwd): D:\Windsurf-test\oba-live-tool-main\CURSOR\oba-live-tool-main
node_modules 存在: true
node_modules/bcryptjs/package.json 存在: true
-----------------------------------
校验通过，继续打包。
```

---

## 二、已做的根因级修改

| 项目 | 变更 |
|------|------|
| **electron-builder.json** | `directories` 中增加 `"app": "."`，显式指定 appDir 为项目根；从 `files` 中移除 `"node_modules/bcryptjs/**"`，保留 `"node_modules/**/*"`，让依赖整体进入 asar。 |
| **package.json** | 新增脚本 `"dist:check": "node scripts/dist-check-appdir.js"`；`dist` 在 electron-builder 前增加 `npm run dist:check`，缺失则中断打包。 |
| **scripts/dist-check-appdir.js** | 打包前校验：检查 appDir 下 `node_modules` 及 `node_modules/bcryptjs/package.json` 是否存在，不存在则 process.exit(1)。 |

---

## 三、验证步骤（需在本机执行）

**前置**：关闭所有 TASI-live-Supertool 相关进程，避免 `release` 被占用导致 `dist:clean` 失败。

1. **安装依赖**  
   `npm install` 或 `npm ci`

2. **打包**  
   `npm run dist`  
   （会依次：dist:clean → build → dist:check → electron-builder）

3. **解包 app.asar**  
   `npx @electron/asar extract release/1.0.0/win-unpacked/resources/app.asar release/app.asar.extracted`  
   （路径按实际版本调整）

4. **必须验证以下路径存在**  
   - `release/app.asar.extracted/node_modules/bcryptjs/package.json`  
   - `release/app.asar.extracted/node_modules/` 不为空

5. **运行 exe**  
   `release\1.0.0\win-unpacked\TASI-live-Supertool.exe`  
   确认不再出现 “Cannot find module 'bcryptjs'”。

---

## 四、约束与说明

- 未修改业务代码，未替换 bcryptjs。
- 未在 `files` 中点名单个依赖作为最终方案，依赖整体通过 `node_modules/**/*` 进入 asar。
- 本次为主进程依赖环境的一次性根因修复：显式 appDir + 打包前校验 + 移除治标项。
