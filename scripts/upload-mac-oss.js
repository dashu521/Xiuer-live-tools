#!/usr/bin/env node
/**
 * Mac 产物自动上传到阿里云 OSS/CDN
 * 
 * 功能：
 * 1. 读取 package.json 当前 version
 * 2. 自动定位 release/<version>/ 目录中的 macOS 产物
 * 3. 检查阿里云 AccessKey 环境变量
 * 4. 使用 ossutil 上传文件到 OSS releases/latest/ 目录
 * 5. 支持覆盖已有文件，避免重复失败
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
    /latest-mac\.yml$/
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

// 检查环境变量
function checkEnvironment() {
  const required = [
    'ALIYUN_ACCESS_KEY_ID',
    'ALIYUN_ACCESS_KEY_SECRET'
  ];
  
  const missing = [];
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    log('\n❌ 缺少必需的环境变量:', 'error');
    for (const key of missing) {
      log(`   - ${key}`, 'error');
    }
    log('\n请设置环境变量后重试:', 'info');
    log('  export ALIYUN_ACCESS_KEY_ID=your_access_key_id', 'cyan');
    log('  export ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret', 'cyan');
    process.exit(1);
  }
  
  return {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
    bucket: process.env.ALIYUN_OSS_BUCKET || 'xiuer-live-tools-download',
    region: process.env.ALIYUN_OSS_REGION || 'oss-cn-hangzhou',
    prefix: process.env.ALIYUN_OSS_PREFIX || 'releases/latest'
  };
}

// 检查 ossutil 是否存在
function checkOssutil() {
  const ossutilPath = path.join(process.cwd(), 'ossutil');
  if (fs.existsSync(ossutilPath)) {
    return ossutilPath;
  }
  
  try {
    exec('which ossutil');
    return 'ossutil';
  } catch {
    log('\n❌ 未找到 ossutil', 'error');
    log('请确保 ossutil 在当前目录或系统 PATH 中', 'info');
    process.exit(1);
  }
}

// 配置 ossutil
function configureOssutil(ossutilPath, config) {
  log('\n配置 ossutil...', 'info');
  try {
    exec(`${ossutilPath} config -e ${config.region}.aliyuncs.com -i "${config.accessKeyId}" -k "${config.accessKeySecret}" -L CH`);
    log('✅ ossutil 配置成功', 'success');
  } catch (error) {
    throw new Error(`ossutil 配置失败: ${error.message}`);
  }
}

// 主函数
function main() {
  console.log(`${colors.bold}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        ☁️  Mac 产物自动上传到 OSS/CDN                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);
  
  try {
    // 1. 获取版本
    const version = getVersion();
    log(`当前版本: v${version}`, 'success');
    
    const releaseDir = path.join('release', version);
    
    // 2. 检查环境变量
    const config = checkEnvironment();
    log(`OSS Bucket: ${config.bucket}`, 'info');
    log(`OSS Region: ${config.region}`, 'info');
    log(`上传路径: ${config.prefix}/`, 'info');
    
    // 3. 查找产物文件
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
    
    // 4. 检查 ossutil
    const ossutilPath = checkOssutil();
    log(`\n使用 ossutil: ${ossutilPath}`, 'info');
    
    // 5. 配置 ossutil
    configureOssutil(ossutilPath, config);
    
    // 6. 上传文件
    const ossPath = `oss://${config.bucket}/${config.prefix}/`;
    log(`\n开始上传到 OSS...`, 'info');
    log(`目标路径: ${ossPath}`, 'info');
    
    for (const file of artifacts) {
      const fileName = path.basename(file);
      log(`\n上传: ${fileName}`, 'info');
      
      try {
        exec(`${ossutilPath} cp "${file}" "${ossPath}${fileName}" -f`);
        log(`  ✅ 成功`, 'success');
      } catch (error) {
        log(`  ❌ 失败: ${error.message}`, 'error');
        process.exit(1);
      }
    }
    
    // 7. 输出结果
    console.log(`\n${colors.green}${colors.bold}════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}${colors.bold}  ✅ Mac 产物 OSS 上传完成！版本: ${version}${colors.reset}`);
    console.log(`${colors.green}${colors.bold}════════════════════════════════════════════════════════════${colors.reset}\n`);
    
    log('OSS 下载地址:', 'info');
    log(`  https://${config.bucket}.${config.region}.aliyuncs.com/${config.prefix}/latest-mac.yml`, 'cyan');
    log(`  https://download.xiuer.work/${config.prefix}/latest-mac.yml`, 'cyan');
    
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
