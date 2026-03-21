#!/usr/bin/env node
/**
 * Windows 构建前验证脚本
 * 在构建前检查所有可能导致构建失败的配置问题
 */

const fs = require('fs');
const path = require('path');

const errors = [];
const warnings = [];

console.log('========================================');
console.log('Windows 构建前验证');
console.log('========================================\n');

// 1. 检查图标文件格式
console.log('[1/5] 检查图标文件...');
const icoFile = path.join(__dirname, '../public/favicon.ico');
const pngFile = path.join(__dirname, '../public/icon.png');

if (!fs.existsSync(icoFile)) {
  errors.push('❌ 缺少 favicon.ico 文件 (NSIS 需要)');
} else {
  console.log('  ✅ favicon.ico 存在');
}

if (!fs.existsSync(pngFile)) {
  warnings.push('⚠️ 缺少 icon.png 文件 (Mac 需要)');
} else {
  console.log('  ✅ icon.png 存在');
}

// 2. 检查 electron-builder.json 配置
console.log('\n[2/5] 检查 electron-builder.json...');
const builderConfigPath = path.join(__dirname, '../electron-builder.json');
const builderConfig = JSON.parse(fs.readFileSync(builderConfigPath, 'utf-8'));

// 检查 NSIS 图标配置
if (builderConfig.nsis) {
  if (builderConfig.nsis.installerIcon?.endsWith('.png')) {
    errors.push('❌ nsis.installerIcon 使用了 .png 格式，必须是 .ico');
  } else if (builderConfig.nsis.installerIcon?.endsWith('.ico')) {
    console.log('  ✅ installerIcon 格式正确 (.ico)');
  }

  if (builderConfig.nsis.uninstallerIcon?.endsWith('.png')) {
    errors.push('❌ nsis.uninstallerIcon 使用了 .png 格式，必须是 .ico');
  } else if (builderConfig.nsis.uninstallerIcon?.endsWith('.ico')) {
    console.log('  ✅ uninstallerIcon 格式正确 (.ico)');
  }
}

// 检查 win 配置
if (builderConfig.win) {
  if (builderConfig.win.signDlls !== undefined) {
    errors.push('❌ win.signDlls 是无效配置项，请移除');
  } else {
    console.log('  ✅ win 配置无无效项');
  }
}

// 3. 检查 app.ts 路径配置
console.log('\n[3/5] 检查主进程路径配置...');
const appTsPath = path.join(__dirname, '../electron/main/app.ts');
const appTsContent = fs.readFileSync(appTsPath, 'utf-8');

if (appTsContent.includes("app.asar.unpacked', 'dist'")) {
  errors.push('❌ RENDERER_DIST 使用了 app.asar.unpacked/dist，应该是 app.asar/dist');
} else if (appTsContent.includes("app.asar', 'dist'")) {
  console.log('  ✅ RENDERER_DIST 路径配置正确');
}

if (appTsContent.includes("on('crashed'")) {
  warnings.push('⚠️ 使用了废弃的 crashed 事件，建议改用 render-process-gone');
}

// 4. 检查环境变量
console.log('\n[4/5] 检查环境变量...');
const requiredEnvVars = ['VITE_AUTH_API_BASE_URL', 'AUTH_STORAGE_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    errors.push(`❌ 环境变量 ${envVar} 未设置`);
  } else {
    console.log(`  ✅ ${envVar} 已设置`);
  }
}

if (process.env.VITE_AUTH_API_BASE_URL?.includes('localhost') || process.env.VITE_AUTH_API_BASE_URL?.includes('127.0.0.1')) {
  errors.push(`❌ VITE_AUTH_API_BASE_URL 不能为本地地址: ${process.env.VITE_AUTH_API_BASE_URL}`);
}

// 5. 检查 package.json 脚本
console.log('\n[5/5] 检查 package.json 脚本...');
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

const requiredScripts = ['dist:win', 'dist:mac', 'build', 'dist:clean'];
for (const script of requiredScripts) {
  if (!packageJson.scripts[script]) {
    errors.push(`❌ 缺少脚本: ${script}`);
  } else {
    console.log(`  ✅ 脚本 ${script} 存在`);
  }
}

// 输出结果
console.log('\n========================================');
console.log('验证结果');
console.log('========================================');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ 所有检查通过，可以进行 Windows 构建');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log('\n❌ 错误 (必须修复):');
    errors.forEach(e => console.log(`  ${e}`));
  }
  if (warnings.length > 0) {
    console.log('\n⚠️ 警告 (建议修复):');
    warnings.forEach(w => console.log(`  ${w}`));
  }
  
  if (errors.length > 0) {
    console.log('\n❌ 验证失败，请修复错误后再构建');
    process.exit(1);
  } else {
    console.log('\n⚠️ 验证通过，但存在警告');
    process.exit(0);
  }
}
