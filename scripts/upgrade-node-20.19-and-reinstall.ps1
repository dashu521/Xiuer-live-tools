# 进入项目目录，用 nvm 切到 Node 20.19.0，清理并重装依赖
$ErrorActionPreference = "Stop"
Set-Location "D:\Windsurf-test\oba-live-tool-main\CURSOR\oba-live-tool-main"

Write-Host "1) nvm 安装并切换到 Node 20.19.0 ..."
nvm install 20.19.0
nvm use 20.19.0

Write-Host "`n2) 清理旧依赖 ..."
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm cache verify

Write-Host "`n3) 当前 Node/npm 版本："
node -v
npm -v

Write-Host "`n4) npm install ..."
npm install

Write-Host "`n完成。"
