# ============================================================
# Windows：强制清理 TASI-live-Supertool 残留进程 + 生成诊断证据
# 请以管理员身份运行 PowerShell，然后逐块复制执行。
# ============================================================

# ---------- 步骤 0：确认管理员权限 ----------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "【错误】请右键 PowerShell -> 以管理员身份运行，然后重新执行。" -ForegroundColor Red
  exit 1
}
Write-Host "已确认：当前为管理员。" -ForegroundColor Green

# ---------- 步骤 1：列出并强制结束所有 TASI 相关进程（taskkill /F /T） ----------
Write-Host "`n--- 步骤 1：查找 TASI 相关进程 ---" -ForegroundColor Cyan
$procs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "*TASI*" }
if (-not $procs) {
  Write-Host "当前无 TASI 相关进程，跳过结束。" -ForegroundColor Yellow
} else {
  $procs | Format-Table Id, ProcessName, Path -AutoSize
  foreach ($p in $procs) {
    Write-Host "执行 taskkill /F /PID $($p.Id) /T ..." -ForegroundColor Gray
    $result = & taskkill /F /PID $p.Id /T 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-Host "  taskkill 失败: $result" -ForegroundColor Red
    } else {
      Write-Host "  已结束 PID $($p.Id) 及其子进程。" -ForegroundColor Green
    }
  }
}

# ---------- 步骤 2：若仍有进程，输出 Owner / SessionId / CommandLine 便于判断拒绝访问 ----------
Start-Sleep -Seconds 1
$remaining = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "*TASI*" }
if ($remaining) {
  Write-Host "`n--- 步骤 2：仍有残留，输出诊断信息 ---" -ForegroundColor Cyan
  foreach ($r in $remaining) {
    Write-Host "PID: $($r.Id)  Name: $($r.ProcessName)" -ForegroundColor Yellow
    try {
      $cim = Get-CimInstance Win32_Process -Filter "ProcessId=$($r.Id)" -ErrorAction Stop
      if ($cim) {
        $owner = $cim.GetOwner()
        Write-Host "  SessionId: $($cim.SessionId)  Owner: $($owner.User)\$($owner.Domain)"
        Write-Host "  CommandLine: $($cim.CommandLine)"
      }
    } catch {
      Write-Host "  无法获取 CIM 信息: $_"
    }
    Write-Host "可尝试手动: taskkill /F /PID $($r.Id) /T" -ForegroundColor Gray
  }
} else {
  Write-Host "`n步骤 2：无残留，跳过诊断输出。" -ForegroundColor Green
}

# ---------- 步骤 3：再次验证，确保系统中不存在任何 TASI 相关进程 ----------
Write-Host "`n--- 步骤 3：清理后验证 ---" -ForegroundColor Cyan
$check = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "*TASI*" }
if ($check) {
  Write-Host "验证失败：仍存在 TASI 进程: $($check.Id -join ', ')" -ForegroundColor Red
  exit 1
}
Write-Host "验证通过：系统中不存在任何 TASI-live-Supertool 相关进程。" -ForegroundColor Green

# ---------- 步骤 4：运行 win-unpacked 的 exe 一次，等待 3 秒 ----------
$exePath = Join-Path $PSScriptRoot "..\release\1.0.0\win-unpacked\TASI-live-Supertool.exe"
if (-not (Test-Path $exePath)) {
  Write-Host "`n【错误】未找到 exe，请先 npm run dist。当前路径: $exePath" -ForegroundColor Red
  exit 1
}
Write-Host "`n--- 步骤 4：启动 exe，等待 3 秒 ---" -ForegroundColor Cyan
$p = Start-Process -FilePath $exePath -PassThru
Write-Host "已启动 PID: $($p.Id)" -ForegroundColor Green
Start-Sleep -Seconds 3

# ---------- 步骤 5：读取并输出 %TEMP%\tasi-window-debug.txt ----------
Write-Host "`n--- 步骤 5：诊断证据文件 ---" -ForegroundColor Cyan
$debugPath = Join-Path $env:TEMP "tasi-window-debug.txt"
if (Test-Path $debugPath) {
  Write-Host "文件存在: $debugPath" -ForegroundColor Green
  Get-Content $debugPath -Raw
} else {
  Write-Host "文件不存在: $debugPath" -ForegroundColor Yellow
  Write-Host "TEMP 下以 tasi 为前缀的文件:" -ForegroundColor Gray
  Get-ChildItem $env:TEMP -Filter "tasi*" -ErrorAction SilentlyContinue | Format-Table Name, LastWriteTime -AutoSize
  if (-not (Get-ChildItem $env:TEMP -Filter "tasi*" -ErrorAction SilentlyContinue)) {
    Write-Host "  (无)" -ForegroundColor Gray
  }
}

Write-Host "`n--- 完成 ---" -ForegroundColor Green
