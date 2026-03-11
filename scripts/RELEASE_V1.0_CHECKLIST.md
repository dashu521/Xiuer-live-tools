# V1.0 发布清单（GitHub + Gitee Release）

## 前置

- 仓库根目录：`D:\Windsurf-test\oba-live-tool-main\CURSOR\oba-live-tool-main`
- 验收：`git rev-parse HEAD` 与 `git rev-parse v1.0` 一致；产物名含 `TASI-live-Supertool`、`V1.0`、`win-x64`

## STEP 1：确认工程与打包方案（已完成）

- **类型**：Electron + Vite/React
- **打包**：electron-builder（Windows：NSIS + zip）
- **产物**：`TASI-live-Supertool_V1.0_win-x64.exe`（Installer）、`TASI-live-Supertool_V1.0_win-x64.zip`（Portable）

## STEP 2：发布元信息（已完成）

- `package.json`：`version` 1.0.0、`productName` TASI-live-Supertool
- `electron-builder.json`：`appId` com.tasi.livesupertool、`productName`、Windows `artifactName`、win target 含 nsis + zip
- 图标：`public/favicon.ico`（已存在）

## STEP 3：本地打包（需本机执行）

若本机未安装 **Visual Studio**（含「使用 C++ 的桌面开发」），`better-sqlite3` 会编译失败，请先安装 VS 或 [VS Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) 后再执行：

```powershell
cd "D:\Windsurf-test\oba-live-tool-main\CURSOR\oba-live-tool-main"
npm install
npm run build
npm run dist
```

**验收：**

```powershell
dir release\1.0.0
```

预期存在：

- `TASI-live-Supertool_V1.0_win-x64.exe`
- `TASI-live-Supertool_V1.0_win-x64.zip`

（以及 NSIS 中间文件等，可忽略。）记录两文件大小备用。

## STEP 4：Release 说明（已完成）

- 路径：`RELEASE_NOTES_V1.0.md`（根目录）

## STEP 5：GitHub Release

1. 打开：https://github.com/Xiuer-Chinese/Tasi-live-tool/releases/new
2. **Tag**：选择已有 `v1.0`（或输入 `v1.0`）
3. **Release title**：`TASI-live-Supertool V1.0`
4. **Description**：粘贴 `RELEASE_NOTES_V1.0.md` 内容（或精简版）
5. **上传附件**：
   - `TASI-live-Supertool_V1.0_win-x64.exe`
   - `TASI-live-Supertool_V1.0_win-x64.zip`
6. 发布后得到 URL：`https://github.com/Xiuer-Chinese/Tasi-live-tool/releases/tag/v1.0`

## STEP 6：Gitee Release

1. 打开：https://gitee.com/Xiuer/tasi-live-supertool/releases/new
2. **Tag**：选择/输入 `v1.0`
3. **发布标题**：`TASI-live-Supertool V1.0`
4. **发布说明**：同 GitHub（粘贴 `RELEASE_NOTES_V1.0.md` 或精简版）
5. **上传附件**：同上两个文件（.exe + .zip）
6. 发布后得到 URL：`https://gitee.com/Xiuer/tasi-live-supertool/releases/tag/v1.0`

## 验收（最后输出）

- `git rev-parse HEAD` 与 `git rev-parse v1.0` 一致
- 产物文件名含：TASI-live-Supertool、V1.0、win-x64
- GitHub / Gitee Release 页均可下载上述 .exe 与 .zip

**最终产物列表与下载方式：**

| 文件 | 说明 | 下载 |
|------|------|------|
| TASI-live-Supertool_V1.0_win-x64.exe | Windows 安装包（NSIS） | GitHub / Gitee Release 附件 |
| TASI-live-Supertool_V1.0_win-x64.zip | Windows 绿色版（Portable） | GitHub / Gitee Release 附件 |
