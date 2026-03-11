#!/usr/bin/env node
/**
 * Mac 产物自动上传到 GitHub Release
 * 
 * 功能：
 * 1. 读取 package.json 当前 version
 * 2. 自动定位 release/<version>/ 目录中的 macOS 产物
 * 3. 检查对应 tag 的 GitHub Release 是否存在
 * 4. 使用 gh release upload 自动上传这些文件到对应 Release
 * 5. 支持 --clobber，避免重复上传失败
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

// 查找 Mac 产物文件
function findMacArtifacts(releaseDir) {
  const artifacts = [];
  
  if (!fs.existsSync(releaseDir)) {
    throw new Error(`Release 目录不存在: ${releaseDir}`);
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
            artifacts.push(fullPath);
            break;
          }
        }
      }
    }
  }
  
  scanDir(releaseDir);
  return artifacts;
}

// 检查 GitHub Release 是否存在
function checkReleaseExists(tag) {
  try {
    exec(`gh release view ${tag}`);
    return true;
  } catch {
    return false;
  }
}

// 主函数
function main() {
  console.log(`${colors.bold}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        🍎 Mac 产物自动上传到 GitHub Release                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);
  
  try {
    // 1. 获取版本
    const version = getVersion();
    log(`当前版本: v${version}`, 'success');
    
    const tag = `v${version}`;
    const releaseDir = path.join('release', version);
    
    // 2. 查找产物文件
    log(`\n扫描目录: ${releaseDir}`, 'info');
    const artifacts = findMacArtifacts(releaseDir);
    
    if (artifacts.length === 0) {
      log('未找到 Mac 产物文件', 'error');
      log('请确保已运行: npm run release:mac', 'info');
      process.exit(1);
    }
    
    log(`找到 ${artifacts.length} 个产物文件:`, 'success');
    for (const file of artifacts) {
      const stats = fs.statSync(file);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      log(`  - ${path.basename(file)} (${sizeMB} MB)`, 'info');
    }
    
    // 3. 检查 Release 是否存在
    log(`\n检查 GitHub Release: ${tag}`, 'info');
    if (!checkReleaseExists(tag)) {
      log(`Release ${tag} 不存在`, 'error');
      log('请先创建 Release 或推送 tag:', 'info');
      log(`  git tag ${tag}`, 'info');
      log(`  git push origin ${tag}`, 'info');
      process.exit(1);
    }
    log(`Release ${tag} 存在`, 'success');
    
    // 4. 上传文件
    log(`\n开始上传...`, 'info');
    
    for (const file of artifacts) {
      const fileName = path.basename(file);
      log(`上传: ${fileName}`, 'info');
      
      try {
        exec(`gh release upload ${tag} "${file}" --clobber`);
        log(`  ✅ 成功`, 'success');
      } catch (error) {
        log(`  ❌ 失败: ${error.message}`, 'error');
      }
    }
    
    // 5. 输出结果
    console.log(`\n${colors.green}${colors.bold}════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}${colors.bold}  ✅ Mac 产物上传完成！版本: ${version}${colors.reset}`);
    console.log(`${colors.green}${colors.bold}════════════════════════════════════════════════════════════${colors.reset}\n`);
    
    log('Release URL:', 'info');
    log(`  https://github.com/Xiuer-Chinese/Xiuer-live-tools/releases/tag/${tag}`, 'cyan');
    
    log('\n已上传文件:', 'info');
    for (const file of artifacts) {
      log(`  ✓ ${path.basename(file)}`, 'success');
    }
    
  } catch (error) {
    log(`\n❌ 错误: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();
