# 打包与验证：本机操作步骤

当出现 **app.asar 被占用导致打包失败** 或需要确认 **playwright-extra 是否已打进 app.asar** 时，按以下步骤在本机执行。

---

## 1. 确认并结束占用 app.asar 的进程

- **确认占用**：在资源管理器中尝试删除或重命名  
  `release\<版本>\win-unpacked\resources\app.asar`，若提示“文件正在被使用”，说明被占用。
- **结束进程**：
  - 打开 **任务管理器**（Ctrl+Shift+Esc），在“进程”中结束 **TASI-live-Supertool** 或 **Electron** 相关进程；
  - 或在 PowerShell 中执行：
    ```powershell
    Get-Process | Where-Object { $_.Path -like "*win-unpacked*" -or $_.ProcessName -like "*TASI*" } | Stop-Process -Force
    ```
- 若仍占用，可先执行下一步的 **干净打包**（会删除整个 `release` 目录），再重新打包。

---

## 2. 干净打包（避免旧产物干扰）

在项目根目录执行（会先删除 `release` 再构建并打包）：

```powershell
cd "<项目根目录>"
npm run dist
```

`dist` 已配置为先执行 `dist:clean`（删除 `release`），再执行 `npm run build` 与 `electron-builder --win --publish never`，因此不会受旧 app.asar 或 win-unpacked 干扰。

---

## 3. 仅清理 release 再打包（可选）

若只想清掉旧包再打，不改变 `dist` 逻辑，可单独执行：

```powershell
npm run dist:clean
npm run build
npm run dist
```

注意：单独执行 `npm run dist` 时已包含 `dist:clean`，通常无需再单独跑 `dist:clean`。

---

## 4. 用验证脚本检查 playwright-extra 是否在 app.asar 中

在**任意工作目录**下执行（以脚本路径为准，不依赖当前目录）：

```powershell
& "<项目根目录>\scripts\verify-asar-and-run.ps1"
```

脚本会：

- 以脚本所在目录为基准解析项目根，在 `release` 下**自动查找最新的 app.asar**（不依赖版本号目录）；
- 解压该 app.asar 并检查是否存在 `node_modules/playwright-extra`；
- 若存在则输出 `OK: node_modules/playwright-extra exists in app.asar`，并尝试启动 `win-unpacked\TASI-live-Supertool.exe` 并输出前 30 行启动日志；
- 若不存在则报错并退出。

若未生成过 release 包，会提示：**当前未生成 release 包，请先 npm run dist**，并输出已扫描的 release 路径。

---

## 5. 快速自检清单

| 步骤 | 操作 | 目的 |
|------|------|------|
| 1 | 结束占用 app.asar 的进程（任务管理器或 PowerShell） | 避免打包时文件被占用 |
| 2 | 在项目根执行 `npm run dist` | 干净打包（先删 release 再构建+打包） |
| 3 | 执行 `scripts\verify-asar-and-run.ps1` | 确认 playwright-extra 在 app.asar 中并查看启动日志 |

完成以上步骤后，若验证脚本输出 `OK: node_modules/playwright-extra exists in app.asar`，则 V1.0 打包与运行期依赖已就绪。
