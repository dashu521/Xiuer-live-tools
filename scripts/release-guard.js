#!/usr/bin/env node
/**
 * 发布防事故系统 - Release Guard
 * 在发布前执行高风险检查，发现问题直接阻止构建
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
  bold: '\x1b[1m'
};

let hasError = false;

function log(title, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  const color = status === 'PASS' ? colors.green : status === 'FAIL' ? colors.red : colors.yellow;
  console.log(`${icon} ${color}${colors.bold}[${status}]${colors.reset} ${title}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

function exec(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe', ...options }).trim();
  } catch (error) {
    if (options.ignoreError) return '';
    throw error;
  }
}

// ==================== 1. Git 检查 ====================
function checkGit() {
  console.log(`\n${colors.blue}${colors.bold}🔍 Git 检查${colors.reset}\n`);

  // 1.1 检查当前分支
  try {
    const branch = exec('git branch --show-current');
    if (branch === 'main') {
      log('当前分支是 main', 'PASS');
    } else {
      log('当前分支必须是 main', 'FAIL', `当前分支: ${branch}`);
      hasError = true;
    }
  } catch (error) {
    log('无法获取当前分支', 'FAIL', error.message);
    hasError = true;
  }

  // 1.2 检查 git status 是否干净
  try {
    const status = exec('git status --porcelain');
    if (status === '') {
      log('Git 工作区干净', 'PASS');
    } else {
      log('Git 工作区存在未提交修改', 'FAIL', '请执行 git status 查看详情');
      hasError = true;
    }
  } catch (error) {
    log('无法检查 Git 状态', 'FAIL', error.message);
    hasError = true;
  }

  // 1.3 检查 remote 数量
  try {
    const remotes = exec('git remote').split('\n').filter(r => r.trim());
    if (remotes.length === 1 && remotes[0] === 'origin') {
      log('Remote 配置正确（仅 origin）', 'PASS');
    } else {
      log('Remote 配置错误', 'FAIL', `发现 ${remotes.length} 个 remote: ${remotes.join(', ')}`);
      hasError = true;
    }
  } catch (error) {
    log('无法检查 remote', 'FAIL', error.message);
    hasError = true;
  }

  // 1.4 检查 origin URL
  try {
    const originUrl = exec('git remote get-url origin');
    const expectedUrl = 'https://github.com/Xiuer-Chinese/Xiuer-live-tools.git';
    if (originUrl === expectedUrl) {
      log('Origin URL 正确', 'PASS');
    } else {
      log('Origin URL 错误', 'FAIL', `期望: ${expectedUrl}\n   实际: ${originUrl}`);
      hasError = true;
    }
  } catch (error) {
    log('无法获取 origin URL', 'FAIL', error.message);
    hasError = true;
  }
}

// ==================== 2. Git 跟踪文件检查 ====================
function checkTrackedFiles() {
  console.log(`\n${colors.blue}${colors.bold}🔍 Git 跟踪文件检查${colors.reset}\n`);

  const forbiddenPatterns = [
    { pattern: /^release\//, name: 'release/' },
    { pattern: /^dist\//, name: 'dist/' },
    { pattern: /^dist-electron\//, name: 'dist-electron/' },
    { pattern: /^build\//, name: 'build/' },
    { pattern: /^out\//, name: 'out/' },
    { pattern: /\.db$/, name: '*.db' },
    { pattern: /\.sqlite$/, name: '*.sqlite' },
    { pattern: /\.sqlite3$/, name: '*.sqlite3' },
    { pattern: /^\.env$/, name: '.env' }
  ];

  try {
    const trackedFiles = exec('git ls-files').split('\n').filter(f => f.trim());
    const violations = [];

    for (const file of trackedFiles) {
      for (const { pattern, name } of forbiddenPatterns) {
        if (pattern.test(file)) {
          violations.push({ file, pattern: name });
          break;
        }
      }
    }

    if (violations.length === 0) {
      log('未发现被跟踪的禁止文件', 'PASS');
    } else {
      log('发现被 Git 跟踪的禁止文件', 'FAIL');
      for (const { file, pattern } of violations.slice(0, 10)) {
        console.log(`   ❌ ${file} (${pattern})`);
      }
      if (violations.length > 10) {
        console.log(`   ... 还有 ${violations.length - 10} 个文件`);
      }
      hasError = true;
    }
  } catch (error) {
    log('无法检查跟踪文件', 'FAIL', error.message);
    hasError = true;
  }
}

// ==================== 3. 配置检查 ====================
function checkConfig() {
  console.log(`\n${colors.blue}${colors.bold}🔍 配置检查${colors.reset}\n`);

  // 3.1 检查 package.json version
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    if (packageJson.version) {
      log(`package.json version: ${packageJson.version}`, 'PASS');
    } else {
      log('package.json 缺少 version 字段', 'FAIL');
      hasError = true;
    }
  } catch (error) {
    log('无法读取 package.json', 'FAIL', error.message);
    hasError = true;
  }

  // 3.2 检查 electron-builder.json publish 配置
  try {
    const builderConfig = JSON.parse(fs.readFileSync('electron-builder.json', 'utf-8'));
    const publish = builderConfig.publish;

    if (!publish) {
      log('electron-builder.json 缺少 publish 配置', 'FAIL');
      hasError = true;
    } else if (publish.provider !== 'github') {
      log('electron-builder.json publish.provider 必须是 github', 'FAIL', `实际: ${publish.provider}`);
      hasError = true;
    } else if (publish.owner !== 'Xiuer-Chinese') {
      log('electron-builder.json publish.owner 错误', 'FAIL', `期望: Xiuer-Chinese, 实际: ${publish.owner}`);
      hasError = true;
    } else if (publish.repo !== 'Xiuer-live-tools') {
      log('electron-builder.json publish.repo 错误', 'FAIL', `期望: Xiuer-live-tools, 实际: ${publish.repo}`);
      hasError = true;
    } else {
      log('electron-builder.json publish 配置正确', 'PASS');
    }
  } catch (error) {
    log('无法读取 electron-builder.json', 'FAIL', error.message);
    hasError = true;
  }
}

// ==================== 4. 环境变量检查 ====================
function checkEnv() {
  console.log(`\n${colors.blue}${colors.bold}🔍 环境变量检查${colors.reset}\n`);

  const apiBaseUrl = process.env.VITE_AUTH_API_BASE_URL;

  if (!apiBaseUrl) {
    log('VITE_AUTH_API_BASE_URL 未设置', 'FAIL', '发布时必须设置生产环境 API 地址');
    hasError = true;
    return;
  }

  if (apiBaseUrl.includes('localhost') || apiBaseUrl.includes('127.0.0.1')) {
    log('VITE_AUTH_API_BASE_URL 包含本地地址', 'FAIL', `当前值: ${apiBaseUrl}`);
    hasError = true;
  } else {
    log(`VITE_AUTH_API_BASE_URL: ${apiBaseUrl}`, 'PASS');
  }
}

// ==================== 5. 高风险内容扫描 ====================
function scanHighRiskContent() {
  console.log(`\n${colors.blue}${colors.bold}🔍 高风险内容扫描${colors.reset}\n`);

  const scanDirs = ['src', 'electron', 'shared', 'scripts'];
  const riskPatterns = [
    { pattern: /http:\/\/localhost/, name: 'http://localhost' },
    { pattern: /127\.0\.0\.1/, name: '127.0.0.1' },
    { pattern: /test_users\.db/, name: 'test_users.db' },
    { pattern: /auth-api\/data\//, name: 'auth-api/data/' },
    { pattern: /17701259200/, name: '17701259200' }
  ];

  const findings = [];
  const scannedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.cjs', '.mjs'];

  function scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const { pattern, name } of riskPatterns) {
          if (pattern.test(line)) {
            findings.push({
              file: filePath,
              line: i + 1,
              content: line.trim().substring(0, 80),
              risk: name
            });
          }
        }
      }
    } catch (error) {
      // 跳过无法读取的文件
    }
  }

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // 跳过 node_modules 和 .git
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          scanDir(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (scannedExtensions.includes(ext)) {
          scanFile(fullPath);
        }
      }
    }
  }

  for (const dir of scanDirs) {
    scanDir(dir);
  }

  if (findings.length === 0) {
    log('未发现高风险内容', 'PASS');
  } else {
    log('发现高风险内容', 'FAIL');
    for (const finding of findings.slice(0, 15)) {
      console.log(`   ❌ ${finding.file}:${finding.line}`);
      console.log(`      [${finding.risk}] ${finding.content}`);
    }
    if (findings.length > 15) {
      console.log(`   ... 还有 ${findings.length - 15} 处`);
    }
    hasError = true;
  }
}

// ==================== 主程序 ====================
function main() {
  console.log(`${colors.bold}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           🛡️  发布防事故系统 - Release Guard                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);

  checkGit();
  checkTrackedFiles();
  checkConfig();
  checkEnv();
  scanHighRiskContent();

  console.log(`\n${colors.bold}════════════════════════════════════════════════════════════${colors.reset}\n`);

  if (hasError) {
    console.log(`${colors.red}${colors.bold}❌ 检查失败！请修复上述问题后再尝试发布。${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}✅ 所有检查通过！可以安全发布。${colors.reset}\n`);
    process.exit(0);
  }
}

main();
