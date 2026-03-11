#!/bin/bash

# 开发环境启动脚本
# 使用前请确保已安装 Node.js (https://nodejs.org/)

echo "=========================================="
echo "秀儿直播助手 - 开发环境启动脚本"
echo "=========================================="

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js"
    echo ""
    echo "请先安装 Node.js:"
    echo "  方法 1 (推荐): 访问 https://nodejs.org/ 下载安装包"
    echo "  方法 2: 使用 Homebrew: brew install node"
    echo "  方法 3: 使用 NVM: nvm install 20"
    echo ""
    exit 1
fi

# 检查 npm 是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到 npm"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"
echo "✅ npm 版本: $(npm -v)"
echo ""

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
fi

echo "🚀 启动开发服务器..."
echo ""
npm run dev
