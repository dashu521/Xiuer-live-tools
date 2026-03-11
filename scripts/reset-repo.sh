#!/bin/bash
# 删除并重建 GitHub 仓库以清空 Actions 历史
# 警告：这会清空 Stars、Issues、PRs 等所有仓库数据！

set -euo pipefail

OWNER="Xiuer-Chinese"
REPO="XIUER"

echo "=== ⚠️ 警告：此操作将永久删除仓库 $OWNER/$REPO ==="
echo "包括：Stars、Issues、PRs、Actions 历史、Wiki 等所有数据"
echo ""
echo "本地代码已备份在: $(pwd)"
echo ""
echo "30 秒后开始删除，按 Ctrl+C 取消..."
sleep 30

echo ""
echo "=== 步骤 1: 删除旧仓库 ==="
curl -X DELETE \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$OWNER/$REPO" 2>/dev/null || echo "删除请求已发送"

echo "等待 5 秒..."
sleep 5

echo ""
echo "=== 步骤 2: 创建新仓库 ==="
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d "{\"name\":\"$REPO\",\"private\":false,\"description\":\"秀儿直播助手 - 专业直播带货助手工具\"}" \
  "https://api.github.com/user/repos" 2>/dev/null || echo "创建请求已发送"

echo "等待 5 秒..."
sleep 5

echo ""
echo "=== 步骤 3: 推送代码到新仓库 ==="
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$OWNER/$REPO.git"
git push -u origin HEAD --force
git push origin --tags

echo ""
echo "=== ✅ 完成 ==="
echo "新仓库地址: https://github.com/$OWNER/$REPO"
echo "Actions 历史已清空，新的构建将从头开始"
