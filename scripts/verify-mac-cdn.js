#!/usr/bin/env node
/**
 * Mac 产物 CDN 下载地址自动验证
 * 
 * 功能：
 * 1. 读取 package.json 当前 version
 * 2. 自动构造 CDN 下载地址
 * 3. 使用 curl 检查所有地址是否 HTTP 200
 * 4. 验证文件大小和版本号
 */

const { execSync } = require('child_process');
const fs = require('fs');
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

// 构造验证地址列表
function getVerifyUrls(version) {
  const baseUrl = 'https://download.xiuer.work/releases/latest';
  return [
    {
      name: 'latest-mac.yml',
      url: `${baseUrl}/latest-mac.yml`,
      type: 'yml'
    },
    {
      name: `Xiuer-Live-Assistant_${version}_macos_arm64.dmg`,
      url: `${baseUrl}/Xiuer-Live-Assistant_${version}_macos_arm64.dmg`,
      type: 'dmg'
    },
    {
      name: `Xiuer-Live-Assistant_${version}_macos_x64.dmg`,
      url: `${baseUrl}/Xiuer-Live-Assistant_${version}_macos_x64.dmg`,
      type: 'dmg'
    }
  ];
}

function fetchText(url) {
  return exec(`curl -s "${url}" 2>&1`);
}

function parseLatestMacYml(content) {
  try {
    return YAML.parse(content);
  } catch (error) {
    throw new Error(`latest-mac.yml 解析失败: ${error.message}`);
  }
}

function validateLatestMacMetadata(version, metadata) {
  const expectedArm64 = `Xiuer-Live-Assistant_${version}_macos_arm64.dmg`;
  const expectedX64 = `Xiuer-Live-Assistant_${version}_macos_x64.dmg`;

  if (!metadata || typeof metadata !== 'object') {
    throw new Error('latest-mac.yml 内容为空或格式非法');
  }

  if (metadata.version !== version) {
    throw new Error(`latest-mac.yml 版本不匹配: 期望 ${version}, 实际 ${metadata.version || '空'}`);
  }

  if (!Array.isArray(metadata.files) || metadata.files.length < 2) {
    throw new Error('latest-mac.yml files 字段缺失或不完整');
  }

  const fileNames = metadata.files.map(file => file.url);
  if (!fileNames.includes(expectedArm64)) {
    throw new Error(`latest-mac.yml 缺少 arm64 产物: ${expectedArm64}`);
  }
  if (!fileNames.includes(expectedX64)) {
    throw new Error(`latest-mac.yml 缺少 x64 产物: ${expectedX64}`);
  }

  const invalidFile = metadata.files.find(file => !file.sha512 || !file.size);
  if (invalidFile) {
    throw new Error(`latest-mac.yml 存在缺少 sha512/size 的文件项: ${invalidFile.url || 'unknown'}`);
  }

  if (metadata.path && ![expectedArm64, expectedX64].includes(metadata.path)) {
    throw new Error(`latest-mac.yml path 字段异常: ${metadata.path}`);
  }

  return { expectedArm64, expectedX64 };
}

// 验证单个 URL
function verifyUrl(item) {
  log(`\n验证: ${item.name}`, 'info');
  log(`  URL: ${item.url}`, 'cyan');
  
  try {
    // 使用 curl -I 获取响应头
    const output = exec(`curl -sI "${item.url}" 2>&1`);
    
    // 检查 HTTP 状态码
    const statusMatch = output.match(/HTTP\/(?:\d+(?:\.\d+)?)\s+(\d+)/i);
    if (!statusMatch) {
      log(`  ❌ 无法获取 HTTP 状态码`, 'error');
      return { success: false, item, error: '无法获取 HTTP 状态码' };
    }
    
    const statusCode = parseInt(statusMatch[1], 10);
    
    if (statusCode !== 200) {
      log(`  ❌ HTTP ${statusCode}`, 'error');
      return { success: false, item, error: `HTTP ${statusCode}` };
    }
    
    // 获取文件大小
    const contentLengthMatch = output.match(/content-length:\s*(\d+)/i);
    let size = null;
    if (contentLengthMatch) {
      size = parseInt(contentLengthMatch[1], 10);
      const sizeMB = (size / 1024 / 1024).toFixed(2);
      log(`  ✅ HTTP 200 (大小: ${sizeMB} MB)`, 'success');
    } else {
      log(`  ✅ HTTP 200`, 'success');
    }
    
    // 如果是 yml 文件，验证内容
    if (item.type === 'yml') {
      try {
        const content = exec(`curl -s "${item.url}" 2>&1`);
        const versionMatch = content.match(/version:\s*(.+)/);
        if (versionMatch) {
          const ymlVersion = versionMatch[1].trim();
          log(`  📄 版本号: ${ymlVersion}`, 'info');
        }
      } catch (e) {
        // 忽略内容验证错误
      }
    }
    
    return { success: true, item, size };
  } catch (error) {
    log(`  ❌ 验证失败: ${error.message}`, 'error');
    return { success: false, item, error: error.message };
  }
}

// 主函数
function main() {
  console.log(`${colors.bold}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        🔍 Mac 产物 CDN 下载地址自动验证                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);
  
  try {
    // 1. 获取版本
    const version = getVersion();
    log(`当前版本: v${version}`, 'success');
    
    // 2. 先校验 latest-mac.yml 元数据和当前版本一致
    const latestMacUrl = 'https://download.xiuer.work/releases/latest/latest-mac.yml';
    const latestMacContent = fetchText(latestMacUrl);
    const latestMacMetadata = parseLatestMacYml(latestMacContent);
    const { expectedArm64, expectedX64 } = validateLatestMacMetadata(version, latestMacMetadata);

    log('\nlatest-mac.yml 元数据校验通过:', 'success');
    log(`  版本号: ${latestMacMetadata.version}`, 'info');
    log(`  path: ${latestMacMetadata.path}`, 'info');
    log(`  files: ${expectedArm64}, ${expectedX64}`, 'info');

    // 3. 获取验证地址列表
    const urls = getVerifyUrls(version);
    log(`\n需要验证 ${urls.length} 个地址:`, 'info');
    
    // 4. 逐个验证
    const results = [];
    for (const item of urls) {
      const result = verifyUrl(item);
      results.push(result);
    }
    
    // 5. 统计结果
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    console.log(`\n${colors.bold}════════════════════════════════════════════════════════════${colors.reset}`);
    log(`验证完成: ${successCount} 成功, ${failCount} 失败`, failCount > 0 ? 'error' : 'success');
    console.log(`${colors.bold}════════════════════════════════════════════════════════════${colors.reset}\n`);
    
    // 6. 输出详细结果
    if (successCount > 0) {
      log('✅ 验证通过的地址:', 'success');
      for (const result of results.filter(r => r.success)) {
        log(`  ✓ ${result.item.name}`, 'success');
      }
    }
    
    if (failCount > 0) {
      log('\n❌ 验证失败的地址:', 'error');
      for (const result of results.filter(r => !r.success)) {
        log(`  ✗ ${result.item.name}`, 'error');
        log(`    错误: ${result.error}`, 'error');
      }
    }
    
    // 7. 最终判定
    if (failCount > 0) {
      fail('CDN 验证未通过，请检查 OSS 上传与 latest-mac.yml 是否已同步到当前版本');
    } else {
      log('\n✅ 所有 CDN 地址验证通过！', 'success');
      log('\n📥 下载地址:', 'info');
      for (const item of urls) {
        log(`  ${item.url}`, 'cyan');
      }
    }
    
  } catch (error) {
    fail(error.message);
  }
}

main();
