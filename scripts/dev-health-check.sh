#!/bin/bash

# 开发环境健康检查脚本
# 用法: ./scripts/dev-health-check.sh

echo "🔍 开发环境健康检查"
echo "===================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查1: Git 状态
echo -e "\n📦 检查 Git 状态..."
if [ -d ".git" ]; then
    UNCOMMITTED=$(git status --porcelain | wc -l)
    if [ $UNCOMMITTED -gt 0 ]; then
        echo -e "${YELLOW}⚠️  有 $UNCOMMITTED 个未提交的修改${NC}"
        echo "建议: 运行 'git add . && git commit -m \"your message\"'"
    else
        echo -e "${GREEN}✅ 工作区干净，所有修改已提交${NC}"
    fi
else
    echo -e "${RED}❌ 不是 Git 仓库${NC}"
fi

# 检查2: Vite 缓存
echo -e "\n🚀 检查 Vite 缓存..."
if [ -d "node_modules/.vite" ]; then
    CACHE_SIZE=$(du -sh node_modules/.vite 2>/dev/null | cut -f1)
    echo -e "${YELLOW}⚠️  Vite 缓存存在 ($CACHE_SIZE)${NC}"
    echo "建议: 如遇到奇怪问题，运行 'rm -rf node_modules/.vite'"
else
    echo -e "${GREEN}✅ Vite 缓存已清理${NC}"
fi

# 检查3: 开发服务器
echo -e "\n🖥️  检查开发服务器..."
VITE_PID=$(lsof -i :5173 2>/dev/null | grep LISTEN | awk '{print $2}' | head -1)
if [ -n "$VITE_PID" ]; then
    echo -e "${GREEN}✅ Vite 开发服务器运行中 (PID: $VITE_PID)${NC}"
else
    echo -e "${YELLOW}⚠️  Vite 开发服务器未运行${NC}"
    echo "建议: 运行 'npm run dev' 启动开发服务器"
fi

# 检查4: 未保存的修改
echo -e "\n💾 检查编辑器未保存文件..."
# 检查常见的编辑器临时文件
UNSAVED=0
for pattern in "*.swp" "*.swo" "*~" ".#*"; do
    count=$(find . -name "$pattern" -type f 2>/dev/null | wc -l)
    UNSAVED=$((UNSAVED + count))
done

if [ $UNSAVED -gt 0 ]; then
    echo -e "${YELLOW}⚠️  发现 $UNSAVED 个编辑器临时文件${NC}"
    echo "建议: 在编辑器中保存所有文件"
else
    echo -e "${GREEN}✅ 没有未保存的文件${NC}"
fi

# 检查5: 项目依赖
echo -e "\n📋 检查项目依赖..."
if [ -d "node_modules" ]; then
    MODULES_COUNT=$(ls node_modules | wc -l)
    echo -e "${GREEN}✅ node_modules 存在 ($MODULES_COUNT 个包)${NC}"
else
    echo -e "${RED}❌ node_modules 不存在${NC}"
    echo "建议: 运行 'npm install' 安装依赖"
fi

echo -e "\n===================="
echo "✨ 检查完成"
echo ""
echo "💡 提示: 定期运行此检查可避免环境问题"
echo "   快捷键: Cmd+Shift+P → 'Tasks: Run Task' → 'dev-health-check'"
