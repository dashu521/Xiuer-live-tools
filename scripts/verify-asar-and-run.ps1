# V1.0 打包验证：解压 app.asar、检查 playwright-extra、启动 exe 并输出前 30 行日志
# 以脚本所在目录向上定位到项目根（含 package.json），在 release\*\win-unpacked\resources 下查找 app.asar（优先最新版本号目录）

$ErrorActionPreference = "Stop"

# 向上定位项目根（含 package.json）
$ProjectRoot = $null
$dir = $PSScriptRoot
while ($dir) {
  if (Test-Path (Join-Path $dir "package.json")) {
    $ProjectRoot = $dir
    break
  }
  $dir = Split-Path $dir -Parent
}
if (-not $ProjectRoot) {
  Write-Host "FAIL: 未找到项目根（含 package.json），脚本目录: $PSScriptRoot"
  exit 1
}

$releaseDir = Join-Path $ProjectRoot "release"
$scannedPaths = [System.Collections.ArrayList]@()
$asars = [System.Collections.ArrayList]@()

# 在 release\*\win-unpacked\resources\app.asar 下查找（按版本目录）
$versionDirs = Get-ChildItem $releaseDir -Directory -ErrorAction SilentlyContinue
if ($versionDirs) {
  foreach ($v in $versionDirs) {
    $asarPath = Join-Path $releaseDir ($v.Name + "\win-unpacked\resources\app.asar")
    [void]$scannedPaths.Add($asarPath)
    if (Test-Path $asarPath) {
      [void]$asars.Add((Get-Item $asarPath))
    }
  }
}

# 按 LastWriteTime 倒序取最新（即优先最新版本/构建）
$asarsList = $asars | Sort-Object LastWriteTime -Descending
if (-not $asarsList -or $asarsList.Count -eq 0) {
  Write-Host "当前未生成 release 包，请先 npm run dist"
  Write-Host "实际扫描过的路径列表:"
  foreach ($p in $scannedPaths) { Write-Host "  $p" }
  exit 1
}
$AsarPath = $asarsList[0].FullName

# 由 asar 路径推导：解压到临时目录、exe 路径
$resourcesDir = Split-Path $AsarPath -Parent
$extractDir = Join-Path $resourcesDir "app.asar.extracted"
$winUnpackedDir = Split-Path $resourcesDir -Parent
$exePath = Join-Path $winUnpackedDir "TASI-live-Supertool.exe"

# 解压 app.asar 到临时目录
if (Test-Path $extractDir) { Remove-Item -Recurse -Force $extractDir }
npx --yes @electron/asar extract $AsarPath $extractDir

# 检查 node_modules/playwright-extra
$playwrightExtra = Join-Path $extractDir "node_modules\playwright-extra"
if (-not (Test-Path $playwrightExtra)) {
  Write-Host "FAIL: node_modules/playwright-extra does not exist in app.asar"
  exit 1
}
Write-Host "OK: node_modules/playwright-extra exists in app.asar"

# 启动 exe 并捕获前 30 行
if (-not (Test-Path $exePath)) { Write-Host "FAIL: exe not found at $exePath"; exit 1 }
$logFile = Join-Path $winUnpackedDir "startup-log.txt"
$proc = Start-Process -FilePath $exePath -WorkingDirectory $winUnpackedDir -PassThru -RedirectStandardOutput $logFile -RedirectStandardError ($logFile + ".err")
Start-Sleep -Seconds 8
if (Test-Path $logFile) { Get-Content $logFile -TotalCount 30 }
if (Test-Path ($logFile + ".err")) { Get-Content ($logFile + ".err") -TotalCount 30 }
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Write-Host "Done. First 30 lines above."
