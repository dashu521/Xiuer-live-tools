#!/usr/bin/env node
/**
 * 安全版一键发布系统 - Publish Script
 * 第一阶段：发布准备（冻结前检查 + 本地 mac 构建）
 *
 * 职责：
 * 1. 读取 package.json 当前 version
 * 2. 执行 npm run release:audit
 * 3. 检查 VITE_AUTH_API_BASE_URL
 * 4. 执行 npm run release:guard
 * 5. 执行 npm run release（构建 macOS）
 * 6. 执行 npm run release:notes
 * 7. 校验本地 mac 产物
 * 8. 输出下一步建议
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

let step = 0;
let hasError = false;

function logStep(title) {
  step++;
  console.log(`\n${colors.cyan}${colors.bold}═══ Step ${step}: ${title} ═══${colors.reset}\n`);
}

function logPass(message) {
  console.log(`${colors.green}✅ PASS${colors.reset} ${message}`);
}

function logFail(message) {
  hasError = true;
  console.log(`${colors.red}❌ FAIL${colors.reset} ${message}`);
}

function logWarn(message) {
  console.log(`${colors.yellow}⚠️  WARN${colors.reset} ${message}`);
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

function execWithOutput(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'inherit', ...options });
  } catch (error) {
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

// 检查环境变量
function checkEnv() {
  const apiBaseUrl = process.env.VITE_AUTH_API_BASE_URL;

  if (!apiBaseUrl) {
    logFail('VITE_AUTH_API_BASE_URL 未设置');
    logInfo('生产 API 地址: http://121.41.179.197:8000');
    logInfo(`\n${colors.yellow}请设置环境变量后重新运行:${colors.reset}`);
    logInfo('  export VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000');
    return false;
  }

  if (
    apiBaseUrl.includes('localhost') ||
    apiBaseUrl.includes('127.0.0.1') ||
    (apiBaseUrl !== 'http://121.41.179.197:8000' && !apiBaseUrl.startsWith('https://'))
  ) {
    logFail('VITE_AUTH_API_BASE_URL 必须是允许的生产地址');
    logInfo(`当前值: ${apiBaseUrl}`);
    logInfo(`\n${colors.yellow}请设置为生产地址:${colors.reset}`);
    logInfo('  export VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000');
    return false;
  }

  logPass(`API 地址: ${apiBaseUrl}`);
  return true;
}

// 查找 Mac 产物
function findMacArtifacts(releaseDir) {
  const artifacts = [];

  if (!fs.existsSync(releaseDir)) {
    return artifacts;
  }

  const patterns = [
    /_macos_arm64\.dmg$/,
    /_macos_x64\.dmg$/,
    /latest-mac\.yml$/,
    /\.blockmap$/
  ];

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile()) {
        for (const pattern of patterns) {
          if (pattern.test(entry.name)) {
            artifacts.push({
              path: fullPath,
              name: entry.name,
              size: (fs.statSync(fullPath).size / 1024 / 1024).toFixed(2)
            });
            break;
          }
        }
      }
    }
  }

  scanDir(releaseDir);
  return artifacts;
}

// 主流程
async function main() {
  console.log(`${colors.bold}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           🚀 安全版一键发布系统 - 第一阶段                  ║');
  console.log('║                                                            ║');
  console.log('║  本阶段：准备发布，不创建 tag，不写 GitHub Release         ║');
  console.log('║                                                            ║');
  console.log('║  构建类型说明：                                            ║');
  console.log('║  • 若未配置 Apple 开发者证书 → 生成测试构建（未签名）      ║');
  console.log('║  • 若已配置 Apple 开发者证书 → 生成正式发布构建（已签名）  ║');
  console.log('║  • 详见 docs/RELEASE_SPECIFICATION.md                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);

  // Step 1: 读取版本
  logStep('读取版本信息');
  const version = getVersion();
  logPass(`当前版本: ${version}`);
  logInfo(`Tag 名称: v${version}`);

  // Step 2: 检查环境变量
  logStep('检查环境变量');
  if (!checkEnv()) {
    process.exit(1);
  }

  // Step 3: 执行 release:audit
  logStep('执行发布审计 (release:audit)');
  try {
    execWithOutput('npm run release:audit');
    logPass('审计完成');
  } catch (error) {
    logWarn('审计发现问题，请查看上方输出');
  }

  // Step 4: 执行 release:guard
  logStep('执行阻断检查 (release:guard)');
  try {
    execWithOutput('npm run release:guard');
    logPass('阻断检查通过');
  } catch (error) {
    logFail('阻断检查未通过，请修复上述问题');
    process.exit(1);
  }

  // Step 5: 执行 release（构建 macOS）
  logStep('构建 macOS 安装包 (release)');
  logInfo('开始构建，这可能需要几分钟...');
  try {
    execWithOutput('npm run release');
    logPass('macOS 构建完成');
  } catch (error) {
    logFail('macOS 构建失败');
    process.exit(1);
  }

  // Step 6: 执行 release:notes
  logStep('生成 Release Notes');
  try {
    execWithOutput('npm run release:notes');
    logPass('Release Notes 生成完成');
  } catch (error) {
    logWarn('Release Notes 生成失败，可稍后手动生成');
  }

  // Step 7: 检查构建产物
  logStep('检查构建产物');
  const releaseDir = `release/${version}`;
  const macArtifacts = findMacArtifacts(releaseDir);

  if (macArtifacts.length === 0) {
    logFail('未找到 Mac 构建产物');
    process.exit(1);
  }

  logPass(`找到 ${macArtifacts.length} 个 Mac 产物:`);
  for (const artifact of macArtifacts) {
    logInfo(`  - ${artifact.name} (${artifact.size} MB)`);
  }

  // 最终输出
  console.log(`\n${colors.bold}════════════════════════════════════════════════════════════${colors.reset}\n`);

  if (hasError) {
    console.log(`${colors.red}${colors.bold}【PUBLISH PREP FAIL】${colors.reset}`);
    console.log(`${colors.red}存在错误，请修复后重试${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}【PUBLISH PREP PASS】${colors.reset}\n`);

    console.log(`${colors.cyan}${colors.bold}📋 发布准备摘要${colors.reset}`);
    console.log(`  当前版本: ${version}`);
    console.log(`  Tag 名称: v${version}`);
    console.log(`  Mac 产物: ${macArtifacts.length} 个文件`);
    for (const artifact of macArtifacts) {
      console.log(`    - ${artifact.name}`);
    }
    console.log(`  Release Notes: release-notes/v${version}.md`);
    console.log(`  GitHub Release: 待创建（confirm 阶段自动建立 draft）\n`);

    console.log(`${colors.green}${colors.bold}✅ 可以进入 confirm 阶段${colors.reset}\n`);

    logNext('执行以下命令完成发布:');
    console.log(`  ${colors.cyan}npm run publish:confirm${colors.reset}\n`);

    console.log(`${colors.yellow}⚠️  注意：confirm 将执行以下操作:${colors.reset}`);
    console.log('  1. 检查 git 工作区是否干净');
    console.log('  2. 检查 tag 是否不存在');
    console.log('  3. 创建并推送 tag');
    console.log('  4. 创建 draft GitHub Release');
    console.log('  5. 触发 GitHub Actions Windows 构建\n');

    logNext('tag 推出后，建议并行执行:');
    console.log(`  ${colors.cyan}npm run publish:orchestrate${colors.reset}`);
    console.log(`  ${colors.cyan}npm run publish:verify${colors.reset}\n`);
  }
}

main().catch(err => {
  console.error(`${colors.red}执行出错:${colors.reset}`, err);
  process.exit(1);
});
