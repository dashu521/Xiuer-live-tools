---
name: "github-skill-forge"
description: "将任意 GitHub 仓库转换为标准化技能包。Invoke when user wants to convert a GitHub repository into a skill, or when user provides a GitHub URL and asks to 'forge', 'convert', or 'install' it as a skill."
---

# GitHub Skill Forge

GitHub Skill Forge 是一个"制造技能的技能"。它能将任意 GitHub 仓库转换为标准化技能，是扩展 AI Agent 能力的核心工具。

## 功能特性

- **全程云端 (Zero-Clone)**：直接通过 GitHub API 扫描仓库，无需将代码克隆到本地
- **核心提取 (Smart RAG)**：自动挑选最核心的代码逻辑和文档，打包成 AI 专用上下文文件
- **镜像加速**：内置多组 API 镜像站，支持自动轮换和多线程抓取
- **质量初筛**：自动识别项目的 Stars 数和活跃度

## 使用方法

### 方式 1：终端执行

```bash
# 基础锻造命令
python .trae/skills/github-skill-forge/scripts/forge.py "https://github.com/用户名/仓库名"

# 强制执行（针对 Star 数低的项目）
python .trae/skills/github-skill-forge/scripts/forge.py "https://github.com/用户名/仓库名" --force
```

### 方式 2：对话唤醒

直接在对话框中说：
> "帮我把这个仓库转成技能：https://github.com/用户名/仓库名"

AI 会自动识别并调用 forge.py 脚本完成所有工作。

## 输出位置

生成的技能包将保存在：`.trae/skills/<仓库名>/` 目录下

## 配置说明

- **GitHub Token**：在 `.trae/skills/github-skill-forge/.env` 中配置，可提高访问频率限制
- **镜像站**：可在 `scripts/forge.py` 中自定义 `api_mirrors` 列表

## 常见问题

**Q: 报错 403 频率限制？**
A: 配置 GitHub Personal Access Token 到 .env 文件

**Q: 网络连接超时？**
A: 工具会自动尝试换线，请检查本地网络代理配置
