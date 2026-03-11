# Pre-Release Check (read-only)
# Run from repo root: .\scripts\pre-release-check.ps1
# Does NOT commit, tag, or push. Use for CI or local one-shot check.

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host "=== Pre-Release Check (read-only) ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "--- 1) Git status ---" -ForegroundColor Yellow
git status --porcelain
$dirty = git status --porcelain 2>$null
if ($dirty) {
    Write-Host "Note: You have uncommitted changes. Commit before tagging/release." -ForegroundColor Magenta
} else {
    Write-Host "Working tree clean." -ForegroundColor Green
}
Write-Host ""

Write-Host "--- 2) Branch & latest commit ---" -ForegroundColor Yellow
git branch -v
git log -1 --oneline
Write-Host ""

Write-Host "--- 3) package.json version ---" -ForegroundColor Yellow
$pkg = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
Write-Host "version: $($pkg.version)  productName: $($pkg.productName)"
Write-Host ""

Write-Host "--- 4) npm run build ---" -ForegroundColor Yellow
npm run build 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build FAILED (exit $LASTEXITCODE). Fix before release." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "Build OK." -ForegroundColor Green
Write-Host ""

Write-Host "--- 5) release/ directory ---" -ForegroundColor Yellow
$releaseDir = Join-Path $root "release"
if (Test-Path $releaseDir) {
    Get-ChildItem $releaseDir -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  $($_.Name)/"
        $sub = Join-Path $releaseDir $_.Name
        if (Test-Path $sub -PathType Container) {
            Get-ChildItem $sub -File -ErrorAction SilentlyContinue | Select-Object -First 20 | ForEach-Object { Write-Host "    $($_.Name)" }
        }
    }
} else {
    Write-Host "  (release/ not found - run 'npm run dist' to generate)"
}
Write-Host ""

Write-Host "=== Pre-Release Check done ===" -ForegroundColor Cyan
Write-Host "Next: commit changes, tag (e.g. v1.0.0), run 'npm run dist', push, then create Release page. See RELEASE_PRE_FLIGHT_REPORT.md"
