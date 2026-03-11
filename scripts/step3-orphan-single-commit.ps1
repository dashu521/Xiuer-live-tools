# 方案 A - STEP 3：orphan 分支生成唯一提交（请在项目根目录执行）
$ErrorActionPreference = "Stop"
Set-Location (git rev-parse --show-toplevel)

git checkout --orphan orphan-master
git add -A
git commit -m "chore: initial single commit (v1.0)"
git branch -D master
git branch -m master
git tag -f v1.0

Write-Host "STEP 3 done. master 仅剩 1 个提交，本地 tag v1.0 已指向该提交。"
