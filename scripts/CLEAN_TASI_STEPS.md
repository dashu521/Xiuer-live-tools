# Windows：强制清理 TASI 残留进程 + 诊断证据（逐条复制运行）

**要求：以管理员身份运行 PowerShell**  
右键「Windows PowerShell」→「以管理员身份运行」，再在项目根目录执行：`cd "d:\Windsurf-test\oba-live-tool-main\CURSOR\oba-live-tool-main"`（或你的实际路径）。

---

## 步骤 0：确认管理员权限

```powershell
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Host "请以管理员身份运行 PowerShell" -ForegroundColor Red; exit 1 }
Write-Host "已确认：当前为管理员。" -ForegroundColor Green
```

---

## 步骤 1：用 taskkill /F /T 结束所有 TASI 相关进程

```powershell
$procs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "*TASI*" }
if ($procs) { $procs | ForEach-Object { taskkill /F /PID $_.Id /T } } else { Write-Host "当前无 TASI 进程。" }
```

若某 PID 提示「拒绝访问」，记下该 PID，执行步骤 2 查看该进程的 Owner/SessionId/CommandLine。

---

## 步骤 2（可选）：若 taskkill 失败，输出诊断信息

把下面命令里的 `12345` 换成失败的 PID，再执行：

```powershell
$pid = 12345
$cim = Get-CimInstance Win32_Process -Filter "ProcessId=$pid"
if ($cim) { $o = $cim.GetOwner(); Write-Host "SessionId: $($cim.SessionId) Owner: $($o.Domain)\$($o.User)"; Write-Host "CommandLine: $($cim.CommandLine)" }
```

---

## 步骤 3：清理后验证（应无输出）

```powershell
Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "*TASI*" } | Format-Table Id, ProcessName -AutoSize
```

若此处有输出，说明仍有残留，回到步骤 1 或步骤 2 处理。

---

## 步骤 4：运行 win-unpacked 的 exe 一次，等待 3 秒

**请把路径改成你的实际 release 路径。**

```powershell
$exe = Resolve-Path ".\release\1.0.0\win-unpacked\TASI-live-Supertool.exe"
Start-Process -FilePath $exe -PassThru | Tee-Object -Variable p
Write-Host "已启动 PID: $($p.Id)，等待 3 秒..."
Start-Sleep -Seconds 3
```

---

## 步骤 5：读取并输出 %TEMP%\tasi-window-debug.txt

```powershell
$debugPath = "$env:TEMP\tasi-window-debug.txt"
if (Test-Path $debugPath) {
  Write-Host "--- tasi-window-debug.txt 内容 ---"
  Get-Content $debugPath -Raw
} else {
  Write-Host "文件不存在: $debugPath"
  Write-Host "TEMP 下以 tasi 为前缀的文件:"
  Get-ChildItem $env:TEMP -Filter "tasi*" -ErrorAction SilentlyContinue | Select-Object Name, LastWriteTime
}
```

若文件不存在，上面会列出 `%TEMP%` 下所有以 `tasi` 开头的文件名，便于判断是否写到了别处。
