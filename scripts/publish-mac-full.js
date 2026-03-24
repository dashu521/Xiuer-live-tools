#!/usr/bin/env node
/**
 * Mac 一键全自动发布
 * 
 * 功能：
 * 1. 本地构建 macOS
 * 2. 上传 GitHub Release
 * 3. 同步到 OSS/CDN
 * 4. 验证 CDN 下载地址
 * 
 * 执行流程：
 * A. npm run release:mac (构建)
 * B. npm run upload:mac (GitHub Release)
 * C. npm run upload:mac:oss (OSS/CDN)
 * D. npm run verify:mac:cdn (验证)
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

function log(message, type = 'info') {
  const color = type === 'success' ? colors.green : type === 'warning' ? colors.yellow : type === 'error' ? colors.red : colors.blue;
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, total, title) {
  console.log(`\n${colors.bold}${colors.cyan}════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  步骤 ${step}/${total}: ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}════════════════════════════════════════════════════════════${colors.reset}\n`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'inherit', ...options });
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

// 检查 GitHub Release 是否存在
function checkReleaseExists(tag) {
  try {
    execSync(`gh release view ${tag}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// 主函数
function main() {
  console.log(`${colors.bold}`);
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║              🚀 Mac 一键全自动发布流程                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);
  
  try {
    // 获取版本
    const version = getVersion();
    const tag = `v${version}`;
    
    log(`发布版本: ${tag}`, 'success');
    
    // 检查 GitHub Release 是否存在
    log('\n检查 GitHub Release...', 'info');
    if (!checkReleaseExists(tag)) {
      log(`❌ GitHub Release ${tag} 不存在`, 'error');
      log('\n请先创建 Release:', 'info');
      log(`  git tag ${tag}`, 'cyan');
      log(`  git push origin ${tag}`, 'cyan');
      log('\n或等待 Windows CI 完成后再执行此命令', 'info');
      process.exit(1);
    }
    log(`✅ GitHub Release ${tag} 存在`, 'success');
    
    const totalSteps = 4;
    
    // 步骤 1: 构建 macOS
    logStep(1, totalSteps, '本地构建 macOS');
    try {
      exec('npm run release:mac');
      log('✅ macOS 构建完成', 'success');
    } catch (error) {
      log('❌ macOS 构建失败', 'error');
      process.exit(1);
    }
    
    // 步骤 2: 上传 GitHub Release
    logStep(2, totalSteps, '上传 GitHub Release');
    try {
      exec('npm run upload:mac');
      log('✅ GitHub Release 上传完成', 'success');
    } catch (error) {
      log('❌ GitHub Release 上传失败', 'error');
      process.exit(1);
    }
    
    // 步骤 3: 同步到 OSS/CDN
    logStep(3, totalSteps, '同步到 OSS/CDN');
    try {
      exec('npm run upload:mac:oss');
      log('✅ OSS/CDN 同步完成', 'success');
    } catch (error) {
      log('❌ OSS/CDN 同步失败', 'error');
      process.exit(1);
    }
    
    // 步骤 4: 验证 CDN 下载地址
    logStep(4, totalSteps, '验证 CDN 下载地址');
    try {
      exec('npm run verify:mac:cdn');
      log('✅ CDN 验证完成', 'success');
    } catch (error) {
      log('❌ CDN 验证失败', 'error');
      process.exit(1);
    }
    
    // 最终成功输出
    console.log(`\n${colors.green}${colors.bold}╔══════════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.green}${colors.bold}║              ✅ Mac 一键发布全部完成！                           ║${colors.reset}`);
    console.log(`${colors.green}${colors.bold}╚══════════════════════════════════════════════════════════════════╝${colors.reset}\n`);
    
    log('发布摘要:', 'info');
    log(`  版本: ${tag}`, 'info');
    log(`  GitHub Release: https://github.com/dashu521/Xiuer-live-tools/releases/tag/${tag}`, 'cyan');
    log(`  CDN 下载地址: https://download.xiuer.work/releases/latest/`, 'cyan');
    
    log('\n已发布文件:', 'info');
    log('  ✓ latest-mac.yml', 'success');
    log('  ✓ Xiuer-Live-Assistant_*_macos_arm64.dmg', 'success');
    log('  ✓ Xiuer-Live-Assistant_*_macos_x64.dmg', 'success');
    
    log('\n✅ 所有步骤成功完成！', 'success');
    
  } catch (error) {
    log(`\n❌ 发布失败: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();
