#!/bin/bash

echo "=========================================="
echo "Node.js 安装与项目启动脚本"
echo "=========================================="

# 检查是否已安装 Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js 已安装: $(node -v)"
    echo "✅ npm 已安装: $(npm -v)"
    echo ""
    echo "🚀 直接启动项目..."
    cd /Users/mac/Qoder/gitee/tasi-live-supertool
    npm run dev
    exit 0
fi

echo "⚠️  未检测到 Node.js，开始自动安装..."
echo ""

# 创建临时目录
TEMP_DIR="/tmp/node-install-$$"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# 下载 Node.js macOS 安装包
echo "📥 正在下载 Node.js v20.11.1 LTS..."
curl -o node.pkg "https://nodejs.org/dist/v20.11.1/node-v20.11.1.pkg"

if [ ! -f "node.pkg" ]; then
    echo "❌ 下载失败，请手动访问 https://nodejs.org/ 下载安装"
    exit 1
fi

echo "📦 下载完成，开始安装..."
echo "⚠️  需要管理员权限，请输入密码..."
sudo installer -pkg node.pkg -target /

if [ $? -ne 0 ]; then
    echo "❌ 安装失败"
    exit 1
fi

# 清理临时文件
rm -f node.pkg

echo ""
echo "✅ Node.js 安装成功！"
echo ""

# 重新加载 shell 配置
echo "🔄 重新加载环境变量..."
source ~/.zshrc 2>/dev/null || source ~/.bash_profile 2>/dev/null || true

# 验证安装
if command -v node &> /dev/null; then
    echo "✅ Node.js: $(node -v)"
    echo "✅ npm: $(npm -v)"
    echo ""
    echo "🚀 启动项目..."
    cd /Users/mac/Qoder/gitee/tasi-live-supertool
    npm run dev
else
    echo "⚠️  环境变量未立即生效，请手动执行："
    echo "   source ~/.zshrc"
    echo "   cd /Users/mac/Qoder/gitee/tasi-live-supertool"
    echo "   npm run dev"
fi
