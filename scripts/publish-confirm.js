#!/usr/bin/env node
/**
 * 安全版一键发布系统 - Publish Confirm Script
 * 第二阶段：确认并推送 tag（安全确认点）
 *
 * 职责：
 * 1. 再次读取 package.json version
 * 2. 检查 git 工作区是否干净
 * 3. 检查当前 tag 是否不存在
 * 4. 创建 tag：vX.X.X
 * 5. push main
 * 6. push tag
 * 7. 创建 / 更新 draft GitHub Release
 * 8. 输出触发结果和下一步指引
 */

const { execSync } = require('child_process');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

const VALID_REPO_SLUGS = ['Xiuer-Chinese/Xiuer-live-tools', 'dashu521/Xiuer-live-tools'];

function logPass(message) {
  console.log(`${colors.green}✅ PASS${colors.reset} ${message}`);
}

function logFail(message) {
  console.log(`${colors.red}❌ FAIL${colors.reset} ${message}`);
}

function logInfo(message) {
  console.log(`${colors.blue}ℹ️  INFO${colors.reset} ${message}`);
}

function logNext(message) {
  console.log(`${colors.cyan}➡️  NEXT${colors.reset} ${message}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe', ...options }).trim();
  } catch (error) {
    if (options.ignoreError) return '';
    throw error;
  }
}

function getRepoWebUrl() {
  const originUrl = exec('git remote get-url origin', { ignoreError: true });
  const matchedSlug = VALID_REPO_SLUGS.find(slug => originUrl.includes(slug)) || VALID_REPO_SLUGS[0];
  return `https://github.com/${matchedSlug}`;
}

// 读取 package.json 版本
function getVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    return packageJson.version;
  } catch (error) {
    logFail(`读取 package.json 失败: ${error.message}`);
    process.exit(1);
  }
}

// 主流程
async function main() {
  console.log(`${colors.bold}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           🚀 安全版一键发布系统 - 第二阶段                  ║');
  console.log('║                                                            ║');
  console.log('║  本阶段：确认并推送 tag（不可撤销操作）                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);

  // 读取版本
  const version = getVersion();
  const tagName = `v${version}`;

  console.log(`${colors.yellow}${colors.bold}⚠️  安全确认${colors.reset}\n`);
  console.log(`即将执行以下操作：`);
  console.log(`  1. 检查 git 工作区是否干净`);
  console.log(`  2. 检查 tag ${tagName} 是否不存在`);
  console.log(`  3. 创建 tag: ${tagName}`);
  console.log(`  4. 推送 main 分支`);
  console.log(`  5. 推送 tag: ${tagName}`);
  console.log(`  6. 创建 / 更新 draft GitHub Release`);
  console.log(`  7. 触发 GitHub Actions Windows 构建\n`);

  // 检查 1: git 工作区是否干净
  console.log(`${colors.cyan}检查 1/3: Git 工作区状态${colors.reset}`);
  const gitStatus = exec('git status --porcelain');
  if (gitStatus !== '') {
    logFail('Git 工作区存在未提交修改');
    console.log('\n未提交的文件:');
    console.log(gitStatus);
    console.log(`\n${colors.yellow}请先执行:${colors.reset}`);
    console.log('  git add .');
    console.log(`  git commit -m "chore: prepare release v${version}"`);
    process.exit(1);
  }
  logPass('Git 工作区干净');

  // 检查 2: 当前分支是否为 main
  console.log(`\n${colors.cyan}检查 2/3: 当前分支${colors.reset}`);
  const branch = exec('git branch --show-current');
  if (branch !== 'main') {
    logFail(`当前分支不是 main，当前: ${branch}`);
    process.exit(1);
  }
  logPass('当前分支: main');

  // 检查 3: tag 是否不存在
  console.log(`\n${colors.cyan}检查 3/3: Tag 是否存在${colors.reset}`);
  try {
    exec(`git rev-parse ${tagName}`);
    logFail(`Tag ${tagName} 已存在`);
    console.log(`\n${colors.yellow}如需重新发布，请先删除现有 tag:${colors.reset}`);
    console.log(`  git tag -d ${tagName}`);
    console.log(`  git push origin :refs/tags/${tagName}`);
    process.exit(1);
  } catch {
    logPass(`Tag ${tagName} 可用`);
  }

  // 所有检查通过，开始执行
  console.log(`\n${colors.green}${colors.bold}✅ 所有检查通过，开始执行...${colors.reset}\n`);

  // 步骤 1: 推送 main
  console.log(`${colors.cyan}步骤 1/3: 推送 main 分支${colors.reset}`);
  try {
    exec('git push origin main');
    logPass('main 分支推送成功');
  } catch (error) {
    logFail('main 分支推送失败');
    process.exit(1);
  }

  // 步骤 2: 创建 tag
  console.log(`\n${colors.cyan}步骤 2/3: 创建 tag${colors.reset}`);
  try {
    exec(`git tag ${tagName}`);
    logPass(`Tag ${tagName} 创建成功`);
  } catch (error) {
    logFail(`Tag ${tagName} 创建失败`);
    process.exit(1);
  }

  // 步骤 3: 推送 tag
  console.log(`\n${colors.cyan}步骤 3/3: 推送 tag${colors.reset}`);
  try {
    exec(`git push origin ${tagName}`);
    logPass(`Tag ${tagName} 推送成功`);
  } catch (error) {
    logFail(`Tag ${tagName} 推送失败`);
    console.log(`\n${colors.yellow}尝试手动推送:${colors.reset}`);
    console.log(`  git push origin ${tagName}`);
    process.exit(1);
  }

  // 步骤 4: 创建 / 更新 draft Release
  console.log(`\n${colors.cyan}步骤 4/4: 创建 / 更新 draft Release${colors.reset}`);
  try {
    exec('node scripts/release-open.js');
    logPass(`Draft Release ${tagName} 已就绪`);
  } catch (error) {
    logFail(`Draft Release ${tagName} 创建失败`);
    process.exit(1);
  }

  // 最终输出
  console.log(`\n${colors.bold}════════════════════════════════════════════════════════════${colors.reset}\n`);
  console.log(`${colors.green}${colors.bold}🎉 发布确认完成！${colors.reset}\n`);

  console.log(`${colors.cyan}${colors.bold}📋 发布摘要${colors.reset}`);
  console.log(`  Tag 名称: ${tagName}`);
  console.log(`  Push 状态: ✅ 成功`);
  console.log(`  Draft Release: ✅ 已创建\n`);

  console.log(`${colors.cyan}${colors.bold}🔄 GitHub Actions 状态${colors.reset}`);
  console.log(`  Windows 构建已触发`);
  console.log(`  查看地址: ${getRepoWebUrl()}/actions\n`);

  logNext('tag 推出后，可立即开始并行编排:');
  console.log(`  ${colors.cyan}npm run publish:orchestrate${colors.reset}\n`);

  logNext('等待关键动作完成后，执行纯验收检查:');
  console.log(`  ${colors.cyan}npm run publish:verify${colors.reset}\n`);

  console.log(`${colors.yellow}⚠️  注意:${colors.reset}`);
  console.log('  - Windows 构建通常需要 5-10 分钟');
  console.log('  - Draft Release 已创建，Windows / mac 资产可汇总到同一处');
  console.log('  - publish:orchestrate 会补触发缺失动作');
  console.log('  - publish:verify 是纯检查脚本，不会做任何写操作\n');
}

main().catch(err => {
  console.error(`${colors.red}执行出错:${colors.reset}`, err);
  process.exit(1);
});
