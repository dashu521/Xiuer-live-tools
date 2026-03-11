#!/usr/bin/env node
/**
 * 安全版一键发布系统 - Publish Check Script
 * 第三阶段：检查最终发布结果
 *
 * 职责：
 * 1. 查询最近与当前版本 tag 相关的 GitHub Actions run
 * 2. 检查 Windows workflow 是否成功
 * 3. 检查 Release 中是否已有所有必要文件
 * 4. 输出最终发布结果
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

function logPass(message) {
  console.log(`${colors.green}✅ PASS${colors.reset} ${message}`);
}

function logFail(message) {
  console.log(`${colors.red}❌ FAIL${colors.reset} ${message}`);
}

function logWarn(message) {
  console.log(`${colors.yellow}⚠️  WARN${colors.reset} ${message}`);
}

function logInfo(message) {
  console.log(`${colors.blue}ℹ️  INFO${colors.reset} ${message}`);
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
    logFail(`读取 package.json 失败: ${error.message}`);
    process.exit(1);
  }
}

// 检查 GitHub Actions run 状态
function checkGitHubActions(tagName) {
  try {
    // 获取最近的 workflow runs
    const runsJson = exec(`gh run list --workflow="Build Windows" --json status,conclusion,headBranch,createdAt --limit 5`);
    const runs = JSON.parse(runsJson);

    // 查找与当前 tag 相关的 run
    const relevantRun = runs.find(run => run.headBranch === tagName);

    if (!relevantRun) {
      return { found: false, status: null, conclusion: null };
    }

    return {
      found: true,
      status: relevantRun.status,
      conclusion: relevantRun.conclusion
    };
  } catch (error) {
    return { found: false, status: null, conclusion: null, error: error.message };
  }
}

// 检查 GitHub Release 资产
function checkReleaseAssets(tagName) {
  try {
    const assetsJson = exec(`gh release view ${tagName} --json assets`);
    const data = JSON.parse(assetsJson);
    const assets = data.assets || [];

    const result = {
      windowsExe: false,
      windowsZip: false,
      latestYml: false,
      macDmg: false,
      latestMacYml: false,
      blockmap: false,
      assetNames: assets.map(a => a.name)
    };

    for (const asset of assets) {
      const name = asset.name;
      if (name.endsWith('.exe') && !name.includes('default') && !name.includes('elevate')) {
        result.windowsExe = true;
      }
      if (name.endsWith('.zip')) {
        result.windowsZip = true;
      }
      if (name === 'latest.yml') {
        result.latestYml = true;
      }
      if (name.endsWith('.dmg')) {
        result.macDmg = true;
      }
      if (name === 'latest-mac.yml') {
        result.latestMacYml = true;
      }
      if (name.endsWith('.blockmap')) {
        result.blockmap = true;
      }
    }

    return result;
  } catch (error) {
    return { error: error.message, assetNames: [] };
  }
}

// 主流程
async function main() {
  console.log(`${colors.bold}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           🚀 安全版一键发布系统 - 第三阶段                  ║');
  console.log('║                                                            ║');
  console.log('║  本阶段：检查最终发布结果                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);

  // 读取版本
  const version = getVersion();
  const tagName = `v${version}`;

  console.log(`${colors.cyan}${colors.bold}📋 检查版本: ${version}${colors.reset}\n`);

  // 检查 1: GitHub Actions 状态
  console.log(`${colors.cyan}检查 1/2: GitHub Actions Windows 构建状态${colors.reset}`);
  const actionsStatus = checkGitHubActions(tagName);

  if (!actionsStatus.found) {
    logWarn(`未找到 ${tagName} 的 GitHub Actions run`);
    logInfo('Windows 构建可能还在排队或尚未开始');
    logInfo('请稍后重试，或访问 GitHub Actions 页面查看');
  } else if (actionsStatus.status === 'in_progress') {
    logWarn(`Windows 构建进行中`);
    logInfo('请等待构建完成后再检查');
  } else if (actionsStatus.status === 'completed' && actionsStatus.conclusion === 'success') {
    logPass('Windows 构建成功');
  } else if (actionsStatus.status === 'completed' && actionsStatus.conclusion === 'failure') {
    logFail('Windows 构建失败');
    logInfo('请访问 GitHub Actions 查看详细日志');
  } else {
    logInfo(`Windows 构建状态: ${actionsStatus.status} / ${actionsStatus.conclusion}`);
  }

  // 检查 2: Release 资产
  console.log(`\n${colors.cyan}检查 2/2: GitHub Release 资产完整性${colors.reset}`);
  const assets = checkReleaseAssets(tagName);

  if (assets.error) {
    logFail(`无法获取 Release 资产: ${assets.error}`);
    console.log(`\n${colors.yellow}可能原因:${colors.reset}`);
    console.log('  - Release 尚未创建');
    console.log('  - 权限不足');
    console.log('  - 网络问题');
    process.exit(1);
  }

  console.log('\n资产检查结果:');

  // Windows 资产
  console.log(`\n${colors.bold}Windows:${colors.reset}`);
  if (assets.windowsExe) {
    logPass('Windows 安装包 (.exe)');
  } else {
    logFail('Windows 安装包 (.exe)');
  }

  if (assets.windowsZip) {
    logPass('Windows 便携版 (.zip)');
  } else {
    logFail('Windows 便携版 (.zip)');
  }

  if (assets.latestYml) {
    logPass('Windows 自动更新配置 (latest.yml)');
  } else {
    logFail('Windows 自动更新配置 (latest.yml)');
  }

  // Mac 资产
  console.log(`\n${colors.bold}macOS:${colors.reset}`);
  if (assets.macDmg) {
    logPass('macOS 安装包 (.dmg)');
  } else {
    logFail('macOS 安装包 (.dmg)');
  }

  if (assets.latestMacYml) {
    logPass('macOS 自动更新配置 (latest-mac.yml)');
  } else {
    logFail('macOS 自动更新配置 (latest-mac.yml)');
  }

  // 可选资产
  console.log(`\n${colors.bold}其他:${colors.reset}`);
  if (assets.blockmap) {
    logPass('差分更新文件 (.blockmap)');
  } else {
    logWarn('差分更新文件 (.blockmap) - 可选');
  }

  // 最终评估
  console.log(`\n${colors.bold}════════════════════════════════════════════════════════════${colors.reset}\n`);

  const windowsComplete = assets.windowsExe && assets.windowsZip && assets.latestYml;
  const macComplete = assets.macDmg && assets.latestMacYml;
  const autoUpdateReady = assets.latestYml && assets.latestMacYml;

  if (windowsComplete && macComplete) {
    console.log(`${colors.green}${colors.bold}🎉 发布完整！${colors.reset}\n`);

    console.log(`${colors.cyan}${colors.bold}📊 发布摘要${colors.reset}`);
    console.log(`  Windows: ✅ 已发布`);
    console.log(`  macOS: ✅ 已发布`);
    console.log(`  自动更新: ${autoUpdateReady ? '✅ 可用' : '⚠️  不完整'}\n`);

    console.log(`${colors.cyan}${colors.bold}🔗 Release URL${colors.reset}`);
    console.log(`  https://github.com/Xiuer-Chinese/Xiuer-live-tools/releases/tag/${tagName}\n`);

    console.log(`${colors.green}✅ 所有检查通过，发布完成！${colors.reset}\n`);
  } else if (windowsComplete && !macComplete) {
    console.log(`${colors.yellow}${colors.bold}⚠️  发布部分完成${colors.reset}\n`);

    console.log(`${colors.cyan}${colors.bold}📊 发布摘要${colors.reset}`);
    console.log(`  Windows: ✅ 已发布`);
    console.log(`  macOS: ❌ 缺失`);
    console.log(`  自动更新: ❌ 不完整\n`);

    console.log(`${colors.yellow}建议操作:${colors.reset}`);
    console.log('  1. 本地构建 Mac: npm run release:mac');
    console.log('  2. 上传 Mac: npm run release:upload:mac');
    console.log('  3. 重新检查: npm run publish:check\n');
  } else if (!windowsComplete && macComplete) {
    console.log(`${colors.yellow}${colors.bold}⚠️  发布部分完成${colors.reset}\n`);

    console.log(`${colors.cyan}${colors.bold}📊 发布摘要${colors.reset}`);
    console.log(`  Windows: ❌ 缺失`);
    console.log(`  macOS: ✅ 已发布`);
    console.log(`  自动更新: ❌ 不完整\n`);

    console.log(`${colors.yellow}建议操作:${colors.reset}`);
    console.log('  1. 等待 Windows CI 构建完成');
    console.log('  2. 检查 Actions: https://github.com/Xiuer-Chinese/Xiuer-live-tools/actions');
    console.log('  3. 重新检查: npm run publish:check\n');
  } else {
    console.log(`${colors.red}${colors.bold}❌ 发布不完整${colors.reset}\n`);

    console.log(`${colors.cyan}${colors.bold}📊 发布摘要${colors.reset}`);
    console.log(`  Windows: ❌ 缺失`);
    console.log(`  macOS: ❌ 缺失`);
    console.log(`  自动更新: ❌ 不可用\n`);

    console.log(`${colors.yellow}建议操作:${colors.reset}`);
    console.log('  1. 检查 GitHub Actions 状态');
    console.log('  2. 检查本地构建是否成功');
    console.log('  3. 重新执行发布流程\n');
  }

  // 显示所有资产
  if (assets.assetNames.length > 0) {
    console.log(`${colors.cyan}${colors.bold}📁 Release 中的文件:${colors.reset}`);
    for (const name of assets.assetNames) {
      console.log(`  - ${name}`);
    }
    console.log('');
  }
}

main().catch(err => {
  console.error(`${colors.red}执行出错:${colors.reset}`, err);
  process.exit(1);
});
