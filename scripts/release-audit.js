#!/usr/bin/env node
/**
 * 发布前审计脚本 - Release Audit
 * 只做检查，不阻断构建，输出审计报告
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

function exec(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe', ...options }).trim();
  } catch (error) {
    if (options.ignoreError) return '';
    throw error;
  }
}

function printSection(title) {
  console.log(`\n${colors.cyan}${colors.bold}📋 ${title}${colors.reset}`);
  console.log('─'.repeat(60));
}

function printItem(label, value, status = 'info') {
  const color = status === 'ok' ? colors.green : status === 'warn' ? colors.yellow : status === 'error' ? colors.red : colors.reset;
  const icon = status === 'ok' ? '✅' : status === 'warn' ? '⚠️' : status === 'error' ? '❌' : '•';
  console.log(`${icon} ${label}: ${color}${value}${colors.reset}`);
}

// ==================== 审计项目 ====================
function auditVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    printItem('当前版本', packageJson.version || '未设置', packageJson.version ? 'ok' : 'error');
    return packageJson.version;
  } catch (error) {
    printItem('当前版本', '读取失败', 'error');
    return null;
  }
}

function auditRemote() {
  try {
    const remotes = exec('git remote -v');
    if (remotes) {
      console.log(remotes.split('\n').map(r => `   ${r}`).join('\n'));
    } else {
      printItem('Remote', '未配置', 'warn');
    }
  } catch (error) {
    printItem('Remote', '读取失败', 'error');
  }
}

function auditGitStatus() {
  try {
    const status = exec('git status --short');
    if (status === '') {
      printItem('Git 状态', '干净（无未提交修改）', 'ok');
    } else {
      printItem('Git 状态', '存在未提交修改', 'warn');
      console.log('   修改文件列表：');
      console.log(status.split('\n').map(s => `     ${s}`).join('\n'));
    }
  } catch (error) {
    printItem('Git 状态', '检查失败', 'error');
  }
}

function auditGitignore() {
  printSection('.gitignore 关键规则检查');

  const requiredRules = [
    'node_modules',
    'dist',
    'dist-electron',
    'release',
    'build',
    'out',
    '*.db',
    '*.sqlite',
    '*.sqlite3',
    '.env',
    '*.local'
  ];

  try {
    const gitignore = fs.readFileSync('.gitignore', 'utf-8');
    const lines = gitignore.split('\n').map(l => l.trim());

    for (const rule of requiredRules) {
      const exists = lines.some(l => l === rule || l === `${rule}/` || l === `/${rule}`);
      printItem(rule, exists ? '已配置' : '未配置', exists ? 'ok' : 'warn');
    }
  } catch (error) {
    printItem('.gitignore', '文件不存在', 'error');
  }
}

function auditTrackedFiles() {
  printSection('Git 跟踪文件检查');

  const forbiddenPatterns = [
    { pattern: /^release\//, name: 'release/' },
    { pattern: /^dist\//, name: 'dist/' },
    { pattern: /^dist-electron\//, name: 'dist-electron/' },
    { pattern: /^build\//, name: 'build/' },
    { pattern: /^out\//, name: 'out/' },
    { pattern: /\.db$/, name: '*.db' },
    { pattern: /\.sqlite$/, name: '*.sqlite' },
    { pattern: /\.sqlite3$/, name: '*.sqlite3' },
    { pattern: /^\.env/, name: '.env*' }
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
      printItem('禁止文件检查', '未发现被跟踪的禁止文件', 'ok');
    } else {
      printItem('禁止文件检查', `发现 ${violations.length} 个被跟踪的禁止文件`, 'error');
      for (const { file, pattern } of violations.slice(0, 10)) {
        console.log(`   ❌ ${file} (${pattern})`);
      }
      if (violations.length > 10) {
        console.log(`   ... 还有 ${violations.length - 10} 个文件`);
      }
    }
  } catch (error) {
    printItem('Git 跟踪文件', '检查失败', 'error');
  }
}

function auditApiConfig() {
  printSection('API 地址配置');

  // 检查环境变量
  const envApiUrl = process.env.VITE_AUTH_API_BASE_URL;
  if (envApiUrl) {
    const isLocal = envApiUrl.includes('localhost') || envApiUrl.includes('127.0.0.1');
    printItem('环境变量 VITE_AUTH_API_BASE_URL', envApiUrl, isLocal ? 'warn' : 'ok');
    if (isLocal) {
      console.log('   ⚠️  警告：当前配置为本地地址，发布时请设置为生产环境地址');
    }
  } else {
    printItem('环境变量 VITE_AUTH_API_BASE_URL', '未设置', 'warn');
  }

  // 检查代码中的默认配置
  try {
    const authApiBasePath = 'src/config/authApiBase.ts';
    if (fs.existsSync(authApiBasePath)) {
      const content = fs.readFileSync(authApiBasePath, 'utf-8');
      const match = content.match(/['"`](http[^'"`]+)['"`]/);
      if (match) {
        const defaultUrl = match[1];
        const isLocal = defaultUrl.includes('localhost') || defaultUrl.includes('127.0.0.1');
        printItem('代码默认地址', defaultUrl, isLocal ? 'info' : 'ok');
      }
    }
  } catch (error) {
    // 忽略
  }
}

function auditPublishConfig() {
  printSection('自动更新 Publish 配置');

  try {
    const builderConfig = JSON.parse(fs.readFileSync('electron-builder.json', 'utf-8'));
    const publish = builderConfig.publish;

    if (!publish) {
      printItem('Publish 配置', '未配置', 'error');
      return;
    }

    printItem('Provider', publish.provider || '未设置', publish.provider === 'github' ? 'ok' : 'warn');
    printItem('Owner', publish.owner || '未设置', publish.owner === 'Xiuer-Chinese' ? 'ok' : 'warn');
    printItem('Repo', publish.repo || '未设置', publish.repo === 'Xiuer-live-tools' ? 'ok' : 'warn');

    if (publish.provider === 'github' && publish.owner === 'Xiuer-Chinese' && publish.repo === 'Xiuer-live-tools') {
      console.log('\n   ✅ Publish 配置完全正确');
    } else {
      console.log('\n   ⚠️  Publish 配置与预期不符');
      console.log('   期望: provider=github, owner=Xiuer-Chinese, repo=Xiuer-live-tools');
    }
  } catch (error) {
    printItem('Publish 配置', '读取失败', 'error');
  }
}

function auditRecentCommits() {
  printSection('最近提交记录');

  try {
    const commits = exec('git log --oneline -n 5');
    console.log(commits.split('\n').map(c => `   ${c}`).join('\n'));
  } catch (error) {
    printItem('提交记录', '读取失败', 'error');
  }
}

// ==================== 主程序 ====================
function main() {
  console.log(`${colors.bold}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              📊 发布前审计报告 - Release Audit              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);

  printSection('基本信息');
  auditVersion();
  printItem('当前分支', exec('git branch --show-current') || '未知');
  printItem('审计时间', new Date().toLocaleString('zh-CN'));

  auditRemote();
  auditGitStatus();
  auditRecentCommits();
  auditGitignore();
  auditTrackedFiles();
  auditApiConfig();
  auditPublishConfig();

  // 总结
  console.log(`\n${colors.bold}════════════════════════════════════════════════════════════${colors.reset}\n`);
  console.log(`${colors.cyan}${colors.bold}💡 提示：此审计仅做检查，不会阻止构建。${colors.reset}`);
  console.log(`${colors.cyan}   如需强制检查，请运行: npm run release:guard${colors.reset}\n`);
}

main();
