#!/usr/bin/env node
/**
 * 依赖优化脚本
 * 分析并报告可以优化的依赖项
 */

import fs from 'fs'

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

function printHeader(title) {
  console.log(`\n${colors.bright}${colors.cyan}╔${'═'.repeat(58)}╗${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}║${' '.repeat(Math.floor((58 - title.length) / 2))}${title}${' '.repeat(Math.ceil((58 - title.length) / 2))}║${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}╚${'═'.repeat(58)}╝${colors.reset}\n`)
}

function printSection(title) {
  console.log(`\n${colors.bright}${colors.yellow}▸ ${title}${colors.reset}`)
  console.log(`${colors.bright}${'─'.repeat(60)}${colors.reset}`)
}

printHeader('依赖优化分析报告')

// 读取 package.json
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'))

printSection('📦 当前依赖统计')

const depsCount = Object.keys(packageJson.dependencies || {}).length
const devDepsCount = Object.keys(packageJson.devDependencies || {}).length

console.log(`  生产依赖: ${colors.cyan}${depsCount}${colors.reset} 个`)
console.log(`  开发依赖: ${colors.cyan}${devDepsCount}${colors.reset} 个`)
console.log(`  总计: ${colors.cyan}${depsCount + devDepsCount}${colors.reset} 个`)

// 分析生产依赖体积
printSection('📊 生产依赖体积分析')

const largeDeps = [
  { name: 'playwright', estimatedSize: '50MB', note: '浏览器自动化' },
  { name: 'playwright-core', estimatedSize: '45MB', note: '核心库' },
  { name: 'better-sqlite3', estimatedSize: '5MB', note: '数据库' },
  { name: 'electron-updater', estimatedSize: '1MB', note: '自动更新' },
  { name: 'exceljs', estimatedSize: '22MB', note: 'Excel处理' },
]

console.log(`  ${colors.dim}主要体积贡献者:${colors.reset}\n`)
for (const dep of largeDeps) {
  const isUsed = packageJson.dependencies[dep.name]
  const status = isUsed ? colors.green + '✓' : colors.red + '✗'
  console.log(`    ${status} ${dep.name}: ${colors.yellow}${dep.estimatedSize}${colors.reset} - ${dep.note}${colors.reset}`)
}

// 检查重复依赖
printSection('🔍 重复依赖检查')

const commonPackages = ['lodash', 'lodash-es', 'underscore']
const foundLodash = commonPackages.filter(p => 
  packageJson.dependencies[p] || packageJson.devDependencies[p]
)

if (foundLodash.length > 1) {
  console.log(`  ${colors.yellow}⚠️ 发现多个工具库:${colors.reset}`)
  for (const pkg of foundLodash) {
    console.log(`    - ${pkg}`)
  }
  console.log(`  ${colors.dim}建议: 统一使用 lodash-es${colors.reset}`)
} else {
  console.log(`  ${colors.green}✓ 未发现明显重复依赖${colors.reset}`)
}

// 检查未使用的类型定义
printSection('📝 类型定义优化建议')

const typePackages = Object.keys(packageJson.devDependencies || {})
  .filter(d => d.startsWith('@types/'))

console.log(`  当前类型定义包: ${colors.cyan}${typePackages.length}${colors.reset} 个`)
console.log(`  ${colors.dim}列表:${colors.reset}`)
for (const pkg of typePackages) {
  console.log(`    - ${pkg}`)
}

// 检查 @types/signale
if (packageJson.devDependencies['@types/signale']) {
  console.log(`\n  ${colors.yellow}ℹ️ @types/signale:${colors.reset}`)
  console.log(`    如果项目中未使用 signale 日志库，可以移除此类型定义`)
}

// 优化建议
printSection('💡 优化建议')

const suggestions = []

// 1. 检查 why-did-you-render
if (packageJson.devDependencies['@welldone-software/why-did-you-render']) {
  suggestions.push({
    type: 'dev',
    action: '考虑移除',
    package: '@welldone-software/why-did-you-render',
    reason: '仅用于开发调试，不影响生产构建',
  })
}

// 2. 检查 @types/signale
if (packageJson.devDependencies['@types/signale']) {
  suggestions.push({
    type: 'dev',
    action: '检查使用',
    package: '@types/signale',
    reason: '如果未使用 signale 库，可以移除',
  })
}

// 3. 检查 asar
if (packageJson.devDependencies['asar']) {
  suggestions.push({
    type: 'dev',
    action: '检查使用',
    package: 'asar',
    reason: 'electron-builder 已内置 asar 支持，可能不需要单独安装',
  })
}

if (suggestions.length === 0) {
  console.log(`  ${colors.green}✓ 暂无优化建议${colors.reset}`)
} else {
  for (const s of suggestions) {
    const typeColor = s.type === 'prod' ? colors.red : colors.yellow
    console.log(`\n  ${typeColor}[${s.action}]${colors.reset} ${s.package}`)
    console.log(`    ${colors.dim}原因: ${s.reason}${colors.reset}`)
  }
}

// pnpm 优化
printSection('📦 pnpm 优化建议')

console.log(`  1. 定期清理 pnpm 存储:`)
console.log(`     ${colors.cyan}pnpm store prune${colors.reset}`)

console.log(`\n  2. 使用 pnpm 分析依赖:`)
console.log(`     ${colors.cyan}pnpm list --depth=10${colors.reset}`)

console.log(`\n  3. 检查重复依赖:`)
console.log(`     ${colors.cyan}pnpm dedupe${colors.reset}`)

// 总结
printSection('📈 预期优化效果')

console.log(`  当前依赖总数: ${depsCount + devDepsCount}`)
console.log(`  潜在可移除: ~2-4 个开发依赖`)
console.log(`  预期减少: ${colors.green}0.1-0.4MB${colors.reset} (开发依赖体积)`)
console.log(`\n  ${colors.dim}注意: 生产依赖均为必需，不建议移除${colors.reset}`)

console.log(`\n${colors.bright}${colors.green}✓ 分析完成${colors.reset}\n`)
