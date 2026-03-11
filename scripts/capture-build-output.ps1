# 在项目根目录执行，将 npm run build 的完整输出保存到 build-output.txt
Set-Location $PSScriptRoot\..

$outPath = "build-output.txt"
Write-Host "Running: npm run build 2>&1 | Tee-Object -FilePath $outPath"
npm run build 2>&1 | Tee-Object -FilePath $outPath
Write-Host "`nOutput saved to $outPath. Last 50 lines:"
Get-Content $outPath -Tail 50
