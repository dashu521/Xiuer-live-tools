# One-click pack: kill processes, retry remove release, npm run dist, verify and run exe
$ErrorActionPreference = "Stop"

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
  Write-Host 'FAIL: Project root not found (no package.json). Script dir:' $PSScriptRoot
  exit 1
}
Set-Location $ProjectRoot

Write-Host 'Closing TASI-live-Supertool.exe, electron.exe, node.exe...'
$prevErr = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
taskkill /F /IM TASI-live-Supertool.exe 2>$null | Out-Null
taskkill /F /IM electron.exe 2>$null | Out-Null
taskkill /F /IM node.exe 2>$null | Out-Null
$ErrorActionPreference = $prevErr
Start-Sleep -Seconds 2

$releasePath = Join-Path $ProjectRoot "release"
$maxRetries = 5
$retryDelay = 1
for ($i = 1; $i -le $maxRetries; $i++) {
  if (-not (Test-Path $releasePath)) { break }
  Write-Host "Removing release (attempt $i/$maxRetries)..."
  try {
    Remove-Item -Recurse -Force $releasePath -ErrorAction Stop
    break
  } catch {
    if ($i -eq $maxRetries) {
      Write-Host 'FAIL: Cannot remove release. Close apps using it or restart, then run again.'
      exit 1
    }
    Start-Sleep -Seconds $retryDelay
  }
}

Write-Host 'Running npm run dist...'
npm run dist
if ($LASTEXITCODE -ne 0) {
  Write-Host "FAIL: npm run dist failed. Exit code: $LASTEXITCODE"
  exit $LASTEXITCODE
}

$verifyScript = Join-Path $PSScriptRoot "verify-asar-and-run.ps1"
Write-Host 'Running verify-asar-and-run.ps1...'
& $verifyScript
exit $LASTEXITCODE
