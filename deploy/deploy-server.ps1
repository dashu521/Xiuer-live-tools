# 读取脚本并去除 CRLF，再通过 SSH 在远程执行
$scriptPath = Join-Path $PSScriptRoot "remote-auth-api.sh"
$content = Get-Content $scriptPath -Raw
$content = $content -replace "`r`n", "`n" -replace "`r", "`n"
$content | ssh aliyun-auth "bash -s"
