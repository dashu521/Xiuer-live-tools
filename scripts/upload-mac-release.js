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
const YAML = require('yaml');

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

function fail(message) {
  log(`\n❌ ${message}`, 'error');
  process.exit(1);
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

function validateLocalMacArtifacts(version, artifacts) {
  const latestYmlPath = artifacts.find(file => path.basename(file) === 'latest-mac.yml');
  if (!latestYmlPath) {
    throw new Error('缺少 latest-mac.yml，本次 mac 产物不完整');
  }

  const latestYml = YAML.parse(fs.readFileSync(latestYmlPath, 'utf-8'));
  const expectedArm64 = `Xiuer-Live-Assistant_${version}_macos_arm64.dmg`;
  const expectedX64 = `Xiuer-Live-Assistant_${version}_macos_x64.dmg`;

  if (latestYml.version !== version) {
    throw new Error(`latest-mac.yml 版本不匹配: 期望 ${version}, 实际 ${latestYml.version || '空'}`);
  }

  const fileNames = Array.isArray(latestYml.files) ? latestYml.files.map(file => file.url) : [];
  if (!fileNames.includes(expectedArm64) || !fileNames.includes(expectedX64)) {
    throw new Error(`latest-mac.yml 未声明当前版本的双架构 dmg: ${expectedArm64}, ${expectedX64}`);
  }

  const artifactNames = artifacts.map(file => path.basename(file));
  if (!artifactNames.includes(expectedArm64)) {
    throw new Error(`本地缺少 arm64 安装包: ${expectedArm64}`);
  }
  if (!artifactNames.includes(expectedX64)) {
    throw new Error(`本地缺少 x64 安装包: ${expectedX64}`);
  }

  return {
    latestYmlPath,
    expectedArm64,
    expectedX64,
  };
}

function ensureReleaseAssetsPresent(tag, expectedFiles) {
  const assetsJson = exec(`gh release view ${tag} --json assets`);
  const data = JSON.parse(assetsJson);
  const assetNames = new Set((data.assets || []).map(asset => asset.name));
  const missing = expectedFiles.filter(name => !assetNames.has(name));
  if (missing.length > 0) {
    throw new Error(`GitHub Release 仍缺少文件: ${missing.join(', ')}`);
  }
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
      fail('未找到 Mac 产物文件，请先运行 npm run release:mac');
    }
    
    log(`找到 ${artifacts.length} 个产物文件:`, 'success');
    for (const file of artifacts) {
      const stats = fs.statSync(file);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      log(`  - ${path.basename(file)} (${sizeMB} MB)`, 'info');
    }

    const { expectedArm64, expectedX64 } = validateLocalMacArtifacts(version, artifacts);
    log('\n本地 mac 产物版本校验通过', 'success');
    
    // 3. 检查 Release 是否存在
    log(`\n检查 GitHub Release: ${tag}`, 'info');
    if (!checkReleaseExists(tag)) {
      fail(`Release ${tag} 不存在，请先创建 Release 或推送 tag`);
    }
    log(`Release ${tag} 存在`, 'success');
    
    // 4. 上传文件
    log(`\n开始上传...`, 'info');
    
    const uploadFailures = [];
    for (const file of artifacts) {
      const fileName = path.basename(file);
      log(`上传: ${fileName}`, 'info');
      
      try {
        exec(`gh release upload ${tag} "${file}" --clobber`);
        log(`  ✅ 成功`, 'success');
      } catch (error) {
        log(`  ❌ 失败: ${error.message}`, 'error');
        uploadFailures.push(fileName);
      }
    }

    if (uploadFailures.length > 0) {
      fail(`以下文件上传失败: ${uploadFailures.join(', ')}`);
    }

    ensureReleaseAssetsPresent(tag, ['latest-mac.yml', expectedArm64, expectedX64]);
    log('GitHub Release 文件完整性复核通过', 'success');
    
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
    fail(error.message);
  }
}

main();
