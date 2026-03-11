# 在 Windows 11 上安装 nvm-windows 并切换到 Node 20.11.1

## 1) 下载 nvm-setup.exe（Windows Installer）

- **官方发布页**：https://github.com/coreybutler/nvm-windows/releases  
- **直接下载（1.2.2 最新版）**：  
  https://github.com/coreybutler/nvm-windows/releases/download/1.2.2/nvm-setup.exe  

在浏览器中打开上述链接即可下载 `nvm-setup.exe`。

## 2) 安装

- 双击运行 `nvm-setup.exe`。
- 安装时**保持默认路径**：
  - **NVM_HOME**：默认一般为 `C:\Users\<用户名>\AppData\Roaming\nvm`
  - **NVM_SYMLINK**：默认一般为 `C:\Program Files\nodejs`
- 按向导完成安装。

## 3) 重启终端

- **关闭所有**已打开的 PowerShell、CMD、VS Code/Cursor 集成终端窗口。
- 重新打开 **PowerShell**（或 Cursor 里“新建终端”）。

## 4) 在新 PowerShell 中执行并贴出输出

在**新打开的 PowerShell** 中逐条执行：

```powershell
nvm version
nvm install 20.11.1
nvm use 20.11.1
node -v
npm -v
```

**预期输出示例：**

- `nvm version`：`1.2.2`（或你安装的版本号）
- `nvm install 20.11.1`：下载并安装 Node 20.11.1，最后提示安装成功
- `nvm use 20.11.1`：`Now using node v20.11.1`
- `node -v`：`v20.11.1`
- `npm -v`：对应 npm 版本号（如 `10.2.4`）

若某一步报错，请把**完整报错**原样贴回。
