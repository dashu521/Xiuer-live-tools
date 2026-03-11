#!/bin/bash

# 跨平台打包脚本 - 使用 Parallels Desktop 同时打包 macOS 和 Windows
# 使用方法: npm run dist:all
#
# 前置条件:
# 1. 在 Parallels Desktop 中配置共享文件夹:
#    - 虚拟机 → 配置 → 选项 → 共享 → 共享文件夹
#    - 添加 Mac 上的项目文件夹: /Users/xiuer/TRAE-CN/tasi-live-supertool
#    - 记住分配的盘符(通常是 Z: 或 P:)
# 2. 在 Windows 虚拟机中安装 Node.js
# 3. 在 Windows 中进入共享文件夹，运行: npm install

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  开始跨平台打包 (macOS + Windows)      ${NC}"
echo -e "${BLUE}========================================${NC}"

# ==================== 配置区域 ====================
VM_NAME="Windows 11"                    # 虚拟机名称
VM_SHARED_DRIVE="P:"                    # 共享文件夹盘符 (根据你的配置修改)
VM_PROJECT_PATH="${VM_SHARED_DRIVE}"     # Windows 中的项目路径 (共享文件夹直接映射到 P:)
MAC_PROJECT_PATH="/Users/xiuer/TRAE-CN/tasi-live-supertool"
# ==================================================

echo -e "${YELLOW}配置信息:${NC}"
echo "  虚拟机名称: $VM_NAME"
echo "  共享盘符: $VM_SHARED_DRIVE"
echo "  Windows 项目路径: $VM_PROJECT_PATH"
echo ""

# 检查 Parallels 是否安装
if ! command -v prlctl &> /dev/null; then
    echo -e "${RED}错误: 未找到 prlctl 命令，请确保 Parallels Desktop 已安装${NC}"
    exit 1
fi

# 检查虚拟机是否存在
if ! prlctl list --all | grep -q "$VM_NAME"; then
    echo -e "${RED}错误: 未找到虚拟机 '$VM_NAME'${NC}"
    echo -e "${YELLOW}可用虚拟机列表:${NC}"
    prlctl list --all
    exit 1
fi

# 步骤 1: 在 macOS 上打包
echo -e "\n${YELLOW}[1/3] 在 macOS 上打包...${NC}"
cd "$MAC_PROJECT_PATH"
npm run dist:mac
echo -e "${GREEN}✓ macOS 打包完成${NC}"

# 步骤 2: 检查 Windows 虚拟机状态
echo -e "\n${YELLOW}[2/3] 检查 Windows 虚拟机...${NC}"
VM_STATUS=$(prlctl list "$VM_NAME" --output status | tail -1 | tr -d ' ')

if [ "$VM_STATUS" != "running" ]; then
    echo "虚拟机未运行，正在启动..."
    prlctl start "$VM_NAME"
    echo "等待虚拟机启动 (30秒)..."
    sleep 30
else
    echo "虚拟机已在运行 ✓"
fi

# 测试共享文件夹是否可访问
echo "测试共享文件夹访问..."
if ! prlctl exec "$VM_NAME" cmd /c "dir ${VM_SHARED_DRIVE}\\" > /dev/null 2>&1; then
    echo -e "${RED}错误: 无法访问共享文件夹 ${VM_SHARED_DRIVE}${NC}"
    echo -e "${YELLOW}请检查:${NC}"
    echo "  1. 在 Parallels 中配置共享文件夹"
    echo "  2. 确认盘符正确 (当前设置: $VM_SHARED_DRIVE)"
    echo "  3. 在 Windows 资源管理器中查看共享文件夹盘符"
    exit 1
fi
echo -e "${GREEN}✓ 共享文件夹可访问${NC}"

# 步骤 3: 在 Windows 虚拟机中执行打包
echo -e "\n${YELLOW}[3/3] 在 Windows 虚拟机中打包...${NC}"

# 检查 Windows 中的 node_modules 是否存在
echo "检查 Windows 环境..."
if ! prlctl exec "$VM_NAME" cmd /c "if exist ${VM_PROJECT_PATH}\\node_modules echo exists" | grep -q "exists"; then
    echo -e "${YELLOW}警告: Windows 中未找到 node_modules${NC}"
    echo "请在 Windows 中先运行 npm install:"
    echo "  1. 打开 Windows 资源管理器，进入 ${VM_SHARED_DRIVE}"
    echo "  2. 打开 CMD 或 PowerShell"
    echo "  3. 运行: npm install"
    exit 1
fi

# 在 Windows 中执行打包
echo "开始 Windows 打包..."
prlctl exec "$VM_NAME" cmd /c "cd /d ${VM_PROJECT_PATH} && npm run dist:win"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Windows 打包完成${NC}"
else
    echo -e "${RED}✗ Windows 打包失败${NC}"
    exit 1
fi

# 完成
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}  跨平台打包全部完成！                  ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}输出位置:${NC}"
echo "  macOS:   ${MAC_PROJECT_PATH}/release/\${version}/mac/"
echo "  Windows: ${MAC_PROJECT_PATH}/release/\${version}/win/"
echo ""
echo -e "${YELLOW}提示: Windows 打包结果通过共享文件夹自动同步到 Mac${NC}"
