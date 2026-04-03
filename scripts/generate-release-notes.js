#!/usr/bin/env node
/**
 * 自动生成 Release Notes
 *
 * 功能：
 * 1. 读取 package.json 版本
 * 2. 获取最近 tag 到 HEAD 的提交记录
 * 3. 按提交前缀自动分组
 * 4. 生成中文 Markdown 文件
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, type = 'info') {
  const color = type === 'success' ? colors.green : type === 'warning' ? colors.yellow : type === 'error' ? colors.red : colors.blue;
  console.log(`${color}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe', ...options }).trim();
  } catch (error) {
    if (options.ignoreError) return '';
    throw error;
  }
}

// 读取 package.json 版本
function getVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    return packageJson.version;
  } catch (error) {
    throw new Error(`读取 package.json 失败: ${error.message}`);
  }
}

// 获取最近的 tag
function getLatestTag() {
  try {
    return exec('git describe --tags --abbrev=0');
  } catch {
    return null;
  }
}

// 获取提交记录
function getCommits(sinceTag = null) {
  const range = sinceTag ? `${sinceTag}..HEAD` : 'HEAD';
  try {
    const output = exec(`git log ${range} --pretty=format:"%H|%s|%b---END---"`);
    if (!output) return [];

    return output.split('---END---')
      .map(block => block.trim())
      .filter(block => block)
      .map(block => {
        const lines = block.split('\n');
        const firstLine = lines[0];
        const parts = firstLine.split('|');
        if (parts.length < 2) return null;

        return {
          hash: parts[0].substring(0, 7),
          subject: parts[1],
          body: parts.slice(2).join('\n')
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// 解析提交类型
function parseCommitType(subject) {
  const patterns = [
    { prefix: /^feat(\(.+\))?:/i, type: 'feat', label: '新增功能' },
    { prefix: /^fix(\(.+\))?:/i, type: 'fix', label: '问题修复' },
    { prefix: /^perf(\(.+\))?:/i, type: 'perf', label: '优化调整' },
    { prefix: /^refactor(\(.+\))?:/i, type: 'refactor', label: '优化调整' },
    { prefix: /^chore(\(.+\))?:/i, type: 'chore', label: '构建与发布' },
    { prefix: /^build(\(.+\))?:/i, type: 'build', label: '构建与发布' },
    { prefix: /^ci(\(.+\))?:/i, type: 'ci', label: '构建与发布' },
    { prefix: /^docs(\(.+\))?:/i, type: 'docs', label: '文档更新' },
    { prefix: /^test(\(.+\))?:/i, type: 'test', label: '测试相关' },
    { prefix: /^style(\(.+\))?:/i, type: 'style', label: '代码格式' }
  ];

  for (const pattern of patterns) {
    if (pattern.prefix.test(subject)) {
      return { type: pattern.type, label: pattern.label };
    }
  }

  return { type: 'other', label: '其他改动' };
}

// 清理提交信息
function cleanSubject(subject) {
  // 移除前缀
  return subject
    .replace(/^(feat|fix|perf|refactor|chore|build|ci|docs|test|style)(\(.+\))?:\s*/i, '')
    .trim();
}

// 生成分类后的提交列表
function categorizeCommits(commits) {
  const categories = {
    '新增功能': [],
    '问题修复': [],
    '优化调整': [],
    '构建与发布': [],
    '文档更新': [],
    '测试相关': [],
    '代码格式': [],
    '其他改动': []
  };

  for (const commit of commits) {
    const { label } = parseCommitType(commit.subject);
    const cleanMessage = cleanSubject(commit.subject);

    if (cleanMessage) {
      categories[label].push({
        hash: commit.hash,
        message: cleanMessage
      });
    }
  }

  return categories;
}

// 生成首发版本说明
function generateFirstReleaseNotes(version) {
  const allCommits = getCommits(null);
  const categories = categorizeCommits(allCommits);

  return `# 秀儿直播助手 v${version} - 首发版本

## 🎉 首发说明

秀儿直播助手 v${version} 正式发布！这是一个专为直播带货从业者设计的高效工具集。

## 📦 核心功能

- **多平台支持**：抖音小店、巨量百应、抖音团购、小红书、视频号、快手小店、淘宝直播
- **智能消息管理**：自动发言、快捷键弹窗、置顶管理
- **AI 自动回复**：接入 DeepSeek、OpenRouter、硅基流动等主流 AI 服务
- **商品自动讲解**：智能商品弹窗，提升转化率
- **多账号管理**：支持多组账号配置，数据隔离

${generateCategorySections(categories)}

## 💻 系统要求

- **macOS**: 11 及以上（Intel / Apple Silicon）
- **Windows**: 10 及以上
- **浏览器**: Chrome 或 Edge 最新版本

## 📥 安装包

| 平台 | 文件名 | 说明 |
|------|--------|------|
| macOS Intel | 秀儿直播助手_${version}_macos_x64.dmg | Intel 芯片 Mac |
| macOS Apple Silicon | 秀儿直播助手_${version}_macos_arm64.dmg | M1/M2/M3 芯片 Mac |
| Windows | 秀儿直播助手_${version}_win-x64.exe | Windows 安装程序 |
| Windows | 秀儿直播助手_${version}_win-x64.zip | Windows 便携版 |

## 🔗 相关链接

- 官方网站: https://xiuer.work
- 技术支持: support@xiuer.work
- GitHub: https://github.com/Xiuer-Chinese/Xiuer-live-tools

---

**发布日期**: ${new Date().toLocaleDateString('zh-CN')}
`;
}

// 生成常规版本说明
function generateReleaseNotes(version, sinceTag, commits) {
  const categories = categorizeCommits(commits);

  return `# 秀儿直播助手 v${version}

## 📋 更新概览

本次更新包含以下改进：

${generateCategorySections(categories)}

## 💻 系统要求

- **macOS**: 11 及以上（Intel / Apple Silicon）
- **Windows**: 10 及以上

## 📥 安装包

| 平台 | 文件名 |
|------|--------|
| macOS Intel | 秀儿直播助手_${version}_macos_x64.dmg |
| macOS Apple Silicon | 秀儿直播助手_${version}_macos_arm64.dmg |
| Windows | 秀儿直播助手_${version}_win-x64.exe |
| Windows | 秀儿直播助手_${version}_win-x64.zip |

## 📝 提交统计

- 基于 tag: \`${sinceTag}\`
- 提交数量: ${commits.length} 个

---

**发布日期**: ${new Date().toLocaleDateString('zh-CN')}
`;
}

// 生成分类章节
function generateCategorySections(categories) {
  const sections = [];
  const order = ['新增功能', '问题修复', '优化调整', '构建与发布', '文档更新', '测试相关', '代码格式', '其他改动'];

  for (const label of order) {
    const items = categories[label];
    if (items.length > 0) {
      sections.push(`### ${label}\n`);
      for (const item of items) {
        sections.push(`- ${item.message} (\`${item.hash}\`)`);
      }
      sections.push('');
    }
  }

  return sections.join('\n');
}

// 主函数
function main() {
  console.log(`${colors.bold}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           📝 自动生成 Release Notes                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);

  try {
    // 1. 获取版本
    const version = getVersion();
    log(`当前版本: v${version}`, 'success');

    // 2. 获取最近 tag
    const latestTag = getLatestTag();

    let commits;
    let output;

    if (!latestTag) {
      log('未找到历史 tag，生成首发版本说明', 'warning');
      commits = getCommits(null);
      output = generateFirstReleaseNotes(version);
    } else {
      log(`最近 tag: ${latestTag}`, 'success');
      commits = getCommits(latestTag);

      if (commits.length === 0) {
        log('自上次 tag 以来没有新提交', 'warning');
        output = `# 秀儿直播助手 v${version}\n\n## 📋 更新概览\n\n本次为维护版本，主要包含依赖更新和内部优化。\n\n**发布日期**: ${new Date().toLocaleDateString('zh-CN')}\n`;
      } else {
        log(`收集到 ${commits.length} 个提交`, 'success');
        output = generateReleaseNotes(version, latestTag, commits);
      }
    }

    // 3. 确保目录存在
    const outputDir = 'release-notes';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 4. 写入文件
    const outputFile = path.join(outputDir, `v${version}.md`);
    fs.writeFileSync(outputFile, output, 'utf-8');

    log(`\n✅ Release Notes 已生成: ${outputFile}`, 'success');

    // 5. 显示预览
    console.log(`\n${colors.cyan}预览:${colors.reset}\n`);
    console.log(output.substring(0, 500) + '...\n');

    // 6. 输出使用建议
    console.log(`${colors.yellow}使用建议:${colors.reset}`);
    console.log(`  1. 查看完整内容: cat ${outputFile}`);
    console.log(`  2. 复制到 GitHub Release 页面`);
    console.log(`  3. 或执行: gh release edit v${version} --notes-file ${outputFile}`);

  } catch (error) {
    log(`\n❌ 错误: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();
