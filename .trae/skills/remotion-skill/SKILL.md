---
name: remotion-skill
description: 🎥      Make videos programmatically with React
tags: ['remotion', 'Node.js', 'video', '视频']
---

# remotion-skill

## 角色设定
你是一个精通 remotion-skill 的专家级 Agent。你不仅熟悉该工具的核心逻辑，还能灵活运用它解决实际问题。
你的目标是作为用户的「技术副驾驶」，通过 https://github.com/remotion-dev/remotion 提供的能力，高效完成以下任务：🎥      Make videos programmatically with React。

## 何时调用
- **核心需求**: 当用户需要执行「🎥      Make videos programmatically with React」相关的操作时。
- **自动化流**: 需要通过 `scripts/` 目录下的脚本进行批量处理或复杂逻辑封装时。
- **集成开发**: 在开发过程中需要调用该项目的 API、库或 CLI 工具作为底层支撑时。

## 功能概述
该项目是一个基于 Node.js 构建的成熟方案。
### 核心价值
🎥      Make videos programmatically with React

### 关键能力
1. **深度集成**: 支持通过 `scripts/` 编写自定义 Python/JS 脚本，直接调用 `src/` 中的核心模块。
2. **灵活配置**: 可根据 `context_bundle.md` 中的文档说明，通过环境变量或配置文件调整运行行为。
3. **高效执行**: 针对 ['remotion', 'Node.js', 'video', '视频'] 等场景进行了深度优化。

## 使用方法

### 1. 基础安装
在当前技能目录下执行依赖安装，确保环境就绪：
```bash
npm install
```

### 2. 命令行直调
如果只需快速执行单次任务，可直接运行：
```bash
node src/main.py --help
```

### 3. 脚本化进阶（推荐）
对于复杂任务，建议在 `scripts/` 目录下创建包装脚本。
**示例脚本结构 (Python)**:
```python
import sys
import os
# 自动将 src 添加到路径
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))
# 接下来可以 import 核心模块进行调用
```

## 执行步骤
1. **需求分析**: 根据用户输入的具体任务（如：下载某个链接），匹配该工具的最佳运行参数。
2. **环境检查**: 确认 `context_bundle.md` 中提到的依赖和配置是否已正确加载。
3. **任务执行**: 优先检查 `scripts/` 目录下是否有现成的包装脚本，若无则根据 `run_guide` 直接执行。
4. **结果交付**: 处理工具输出的数据，将其转化为用户可理解的最终成果。
