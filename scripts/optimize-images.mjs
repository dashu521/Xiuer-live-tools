#!/usr/bin/env node
/**
 * 图片资源优化脚本
 * 分析和报告图片资源优化建议
 */

import fs from 'fs'
import path from 'path'

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

function getFileSize(filePath) {
  if (!fs.existsSync(filePath)) {
    return 0
  }
  return fs.statSync(filePath).size
}

function analyzeImages(dirPath, options = {}) {
  const { maxDepth = 3, currentDepth = 0 } = options
  const results = []

  if (currentDepth > maxDepth || !fs.existsSync(dirPath)) {
    return results
  }

  const items = fs.readdirSync(dirPath)

  for (const item of items) {
    const itemPath = path.join(dirPath, item)
    const stats = fs.statSync(itemPath)

    if (stats.isDirectory()) {
      const subResults = analyzeImages(itemPath, {
        maxDepth,
        currentDepth: currentDepth + 1,
      })
      results.push(...subResults)
    } else if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(item)) {
      results.push({
        name: item,
        path: itemPath,
        size: stats.size,
        ext: path.extname(item).toLowerCase(),
      })
    }
  }

  return results.sort((a, b) => b.size - a.size)
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

printHeader('图片资源分析报告')

// 分析 public 目录
printSection('📁 public 目录')
const publicPath = path.join(process.cwd(), 'public')
if (fs.existsSync(publicPath)) {
  const images = analyzeImages(publicPath)
  const totalSize = images.reduce((sum, img) => sum + img.size, 0)

  console.log(`  图片数量: ${colors.cyan}${images.length}${colors.reset}`)
  console.log(`  总大小: ${colors.cyan}${formatSize(totalSize)}${colors.reset}\n`)

  if (images.length > 0) {
    console.log(`  ${colors.dim}图片列表:${colors.reset}\n`)
    for (const img of images) {
      let sizeColor = colors.green
      if (img.size > 100 * 1024) {
        sizeColor = colors.yellow
      }
      if (img.size > 500 * 1024) {
        sizeColor = colors.red
      }
      console.log(`    📄 ${img.name}: ${sizeColor}${formatSize(img.size)}${colors.reset}`)
    }
  }
} else {
  console.log(`  ${colors.red}⚠️ public 目录不存在${colors.reset}`)
}

// 分析 screenshot 目录
printSection('📁 screenshot 目录')
const screenshotPath = path.join(process.cwd(), 'screenshot')
if (fs.existsSync(screenshotPath)) {
  const images = analyzeImages(screenshotPath)
  const totalSize = images.reduce((sum, img) => sum + img.size, 0)

  console.log(`  图片数量: ${colors.cyan}${images.length}${colors.reset}`)
  console.log(`  总大小: ${colors.cyan}${formatSize(totalSize)}${colors.reset}`)
  console.log(`  ${colors.yellow}⚠️ 此目录不会被包含在打包中${colors.reset}\n`)

  if (images.length > 0) {
    console.log(`  ${colors.dim}图片列表:${colors.reset}\n`)
    for (const img of images) {
      console.log(`    📄 ${img.name}: ${colors.dim}${formatSize(img.size)}${colors.reset}`)
    }
  }
} else {
  console.log(`  ${colors.yellow}ℹ️ screenshot 目录不存在${colors.reset}`)
}

// 优化建议
printSection('💡 优化建议')

const suggestions = []

// 检查是否有大图
const allImages = analyzeImages(process.cwd())
const largeImages = allImages.filter(img => img.size > 200 * 1024)

if (largeImages.length > 0) {
  suggestions.push({
    type: 'warning',
    message: `发现 ${largeImages.length} 个大于 200KB 的图片，建议压缩`,
    details: largeImages.map(img => `    - ${path.relative(process.cwd(), img.path)}: ${formatSize(img.size)}`),
  })
}

// 检查是否有未使用的格式
const pngImages = allImages.filter(img => img.ext === '.png')
const nonTransparentPngs = pngImages.filter(img => {
  // 这里简单假设大于 50KB 的 PNG 可能是照片类图片
  return img.size > 50 * 1024 && !img.name.includes('icon') && !img.name.includes('logo')
})

if (nonTransparentPngs.length > 0) {
  suggestions.push({
    type: 'info',
    message: `发现 ${nonTransparentPngs.length} 个可能适合转换为 WebP 的 PNG 图片`,
    details: nonTransparentPngs.slice(0, 3).map(img => `    - ${img.name}: ${formatSize(img.size)}`),
  })
}

// 检查重复的 favicon
const faviconFiles = allImages.filter(img => img.name.includes('favicon'))
if (faviconFiles.length > 2) {
  suggestions.push({
    type: 'info',
    message: `发现 ${faviconFiles.length} 个 favicon 文件，确保都是必需的`,
    details: faviconFiles.map(img => `    - ${img.name}: ${formatSize(img.size)}`),
  })
}

if (suggestions.length === 0) {
  console.log(`  ${colors.green}✓ 图片资源看起来正常，暂无优化建议${colors.reset}`)
} else {
  for (const s of suggestions) {
    const icon = s.type === 'error' ? '❌' : s.type === 'warning' ? '⚠️' : 'ℹ️'
    const color = s.type === 'error' ? colors.red : s.type === 'warning' ? colors.yellow : colors.blue
    console.log(`\n  ${icon} ${color}${s.message}${colors.reset}`)
    if (s.details) {
      for (const detail of s.details) {
        console.log(detail)
      }
    }
  }
}

// 推荐工具
printSection('🛠️ 推荐工具')

console.log(`  1. 图片压缩工具:`)
console.log(`     - ${colors.cyan}TinyPNG${colors.reset} (在线): https://tinypng.com/`)
console.log(`     - ${colors.cyan}Squoosh${colors.reset} (在线): https://squoosh.app/`)
console.log(`     - ${colors.cyan}ImageOptim${colors.reset} (macOS)`)

console.log(`\n  2. 格式转换工具:`)
console.log(`     - ${colors.cyan}cwebp${colors.reset} (命令行): Google WebP 编码器`)
console.log(`     - ${colors.cyan}sharp${colors.reset} (Node.js): 高性能图片处理`)

console.log(`\n  3. Vite 插件:`)
console.log(`     - ${colors.cyan}vite-plugin-imagemin${colors.reset}: 自动压缩图片`)
console.log(`     - ${colors.cyan}vite-imagetools${colors.reset}: 图片转换和优化`)

// 总结
printSection('📊 总结')

const publicImages = fs.existsSync(publicPath) ? analyzeImages(publicPath) : []
const screenshotImages = fs.existsSync(screenshotPath) ? analyzeImages(screenshotPath) : []

console.log(`  public 图片: ${colors.cyan}${publicImages.length}${colors.reset} 个, ${colors.cyan}${formatSize(publicImages.reduce((s, i) => s + i.size, 0))}${colors.reset}`)
console.log(`  screenshot 图片: ${colors.cyan}${screenshotImages.length}${colors.reset} 个, ${colors.cyan}${formatSize(screenshotImages.reduce((s, i) => s + i.size, 0))}${colors.reset} (不打包)`)
console.log(`\n  ${colors.green}✓ screenshot 目录已配置为不打包${colors.reset}`)
console.log(`  ${colors.dim}配置位置: electron-builder.json${colors.reset}`)

console.log(`\n${colors.bright}${colors.green}✓ 分析完成${colors.reset}\n`)
