#!/usr/bin/env node
/**
 * 构建产物分析脚本
 * 用于分析打包后的文件体积，帮助优化构建输出
 */

const fs = require('fs')
const path = require('path')

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
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

function getDirSize(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return 0
  }

  let size = 0
  const files = fs.readdirSync(dirPath)

  for (const file of files) {
    const filePath = path.join(dirPath, file)
    const stats = fs.statSync(filePath)

    if (stats.isDirectory()) {
      size += getDirSize(filePath)
    } else {
      size += stats.size
    }
  }

  return size
}

function getFileSize(filePath) {
  if (!fs.existsSync(filePath)) {
    return 0
  }
  return fs.statSync(filePath).size
}

function analyzeDirectory(dirPath, options = {}) {
  const { maxDepth = 2, currentDepth = 0, prefix = '' } = options

  if (currentDepth > maxDepth || !fs.existsSync(dirPath)) {
    return []
  }

  const items = fs.readdirSync(dirPath)
  const results = []

  for (const item of items) {
    const itemPath = path.join(dirPath, item)
    const stats = fs.statSync(itemPath)
    const size = stats.isDirectory() ? getDirSize(itemPath) : stats.size

    results.push({
      name: item,
      path: itemPath,
      size,
      isDirectory: stats.isDirectory(),
      depth: currentDepth,
    })

    if (stats.isDirectory() && currentDepth < maxDepth) {
      const subItems = analyzeDirectory(itemPath, {
        maxDepth,
        currentDepth: currentDepth + 1,
        prefix: prefix + '  ',
      })
      results.push(...subItems)
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
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`)
}

function printSizeItem(name, size, isDirectory = false, depth = 0) {
  const indent = '  '.repeat(depth)
  const icon = isDirectory ? '📁' : '📄'
  let sizeColor = colors.green

  if (size > 10 * 1024 * 1024) {
    // > 10MB
    sizeColor = colors.red
  } else if (size > 1024 * 1024) {
    // > 1MB
    sizeColor = colors.yellow
  }

  console.log(`${indent}${icon} ${name}: ${sizeColor}${formatSize(size)}${colors.reset}`)
}

// 主分析流程
console.log(`${colors.bright}${colors.green}`)
console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║           TASI-live-Supertool 构建产物分析工具               ║')
console.log('╚══════════════════════════════════════════════════════════════╝')
console.log(`${colors.reset}`)

// 1. 分析 dist 目录
printSection('📦 渲染进程构建产物 (dist)')
const distPath = path.join(process.cwd(), 'dist')
if (fs.existsSync(distPath)) {
  const distSize = getDirSize(distPath)
  printSizeItem('dist', distSize, true)

  // 分析 assets 目录
  const assetsPath = path.join(distPath, 'assets')
  if (fs.existsSync(assetsPath)) {
    const assetsItems = analyzeDirectory(assetsPath, { maxDepth: 2 })
    console.log(`\n${colors.dim}  资源文件详情:${colors.reset}`)

    for (const item of assetsItems.filter((i) => i.depth === 0)) {
      printSizeItem(item.name, item.size, item.isDirectory, 1)

      // 显示子目录内容
      if (item.isDirectory) {
        const subItems = assetsItems.filter((i) => i.path.startsWith(item.path) && i.depth === 1)
        for (const subItem of subItems.slice(0, 5)) {
          printSizeItem(subItem.name, subItem.size, subItem.isDirectory, 2)
        }
        if (subItems.length > 5) {
          console.log(`${'    '.repeat(2)}${colors.dim}... 还有 ${subItems.length - 5} 项${colors.reset}`)
        }
      }
    }
  }

  // 分析 HTML 文件
  const htmlFiles = fs.readdirSync(distPath).filter((f) => f.endsWith('.html'))
  if (htmlFiles.length > 0) {
    console.log(`\n${colors.dim}  HTML 文件:${colors.reset}`)
    for (const file of htmlFiles) {
      const size = getFileSize(path.join(distPath, file))
      printSizeItem(file, size, false, 1)
    }
  }
} else {
  console.log(`${colors.red}  ⚠️ dist 目录不存在${colors.reset}`)
}

// 2. 分析 dist-electron 目录
printSection('🔧 Electron 主进程构建产物 (dist-electron)')
const distElectronPath = path.join(process.cwd(), 'dist-electron')
if (fs.existsSync(distElectronPath)) {
  const distElectronSize = getDirSize(distElectronPath)
  printSizeItem('dist-electron', distElectronSize, true)

  const electronItems = analyzeDirectory(distElectronPath, { maxDepth: 2 })
  for (const item of electronItems.filter((i) => i.depth === 0)) {
    printSizeItem(item.name, item.size, item.isDirectory, 1)
  }
} else {
  console.log(`${colors.red}  ⚠️ dist-electron 目录不存在${colors.reset}`)
}

// 3. 分析 release 目录
printSection('🚀 发行包 (release)')
const releasePath = path.join(process.cwd(), 'release')
if (fs.existsSync(releasePath)) {
  const versions = fs.readdirSync(releasePath).filter((f) => {
    const stat = fs.statSync(path.join(releasePath, f))
    return stat.isDirectory()
  })

  if (versions.length > 0) {
    for (const version of versions) {
      const versionPath = path.join(releasePath, version)
      const versionSize = getDirSize(versionPath)
      printSizeItem(version, versionSize, true)

      // 分析安装包
      const files = fs.readdirSync(versionPath)
      const installFiles = files.filter((f) =>
        /\.(exe|dmg|zip|AppImage|deb|rpm|msi|nsis\.7z)$/i.test(f),
      )

      if (installFiles.length > 0) {
        console.log(`\n${colors.dim}    安装包:${colors.reset}`)
        for (const file of installFiles) {
          const size = getFileSize(path.join(versionPath, file))
          printSizeItem(file, size, false, 2)
        }
      }

      // 分析 ASAR 文件
      const asarPath = path.join(versionPath, 'win-unpacked', 'resources', 'app.asar')
      if (fs.existsSync(asarPath)) {
        const asarSize = getFileSize(asarPath)
        console.log(`\n${colors.dim}    ASAR 文件:${colors.reset}`)
        printSizeItem('app.asar', asarSize, false, 2)
      }
    }
  } else {
    console.log(`${colors.yellow}  ℹ️ 暂无发行版本${colors.reset}`)
  }
} else {
  console.log(`${colors.yellow}  ℹ️ release 目录不存在${colors.reset}`)
}

// 4. 总体统计
printSection('📊 总体统计')
const distSize = fs.existsSync(distPath) ? getDirSize(distPath) : 0
const distElectronSize = fs.existsSync(distElectronPath) ? getDirSize(distElectronPath) : 0
const totalBuildSize = distSize + distElectronSize

console.log(`  渲染进程 (dist):        ${colors.cyan}${formatSize(distSize)}${colors.reset}`)
console.log(`  主进程 (dist-electron): ${colors.cyan}${formatSize(distElectronSize)}${colors.reset}`)
console.log(`  ${colors.bright}构建产物总计:           ${colors.green}${formatSize(totalBuildSize)}${colors.reset}`)

// 5. 优化建议
printSection('💡 优化建议')

const suggestions = []

if (distSize > 50 * 1024 * 1024) {
  suggestions.push({
    level: 'warning',
    message: '渲染进程体积超过 50MB，建议检查是否有未优化的图片或重复依赖',
  })
}

if (distElectronSize > 20 * 1024 * 1024) {
  suggestions.push({
    level: 'warning',
    message: '主进程体积超过 20MB，建议检查是否打包了不必要的依赖',
  })
}

// 检查是否有 source map 文件
const hasSourceMap =
  fs.existsSync(distPath) &&
  fs.readdirSync(distPath, { recursive: true }).some((f) => String(f).endsWith('.map'))

if (hasSourceMap) {
  suggestions.push({
    level: 'info',
    message: '检测到 source map 文件，生产环境建议禁用以减小体积',
  })
}

// 检查 node_modules 是否被打包
const hasNodeModulesInDist =
  fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'node_modules'))

if (hasNodeModulesInDist) {
  suggestions.push({
    level: 'error',
    message: 'dist 目录包含 node_modules，请检查构建配置',
  })
}

if (suggestions.length === 0) {
  console.log(`${colors.green}  ✓ 构建产物看起来正常，暂无优化建议${colors.reset}`)
} else {
  for (const suggestion of suggestions) {
    const icon = suggestion.level === 'error' ? '❌' : suggestion.level === 'warning' ? '⚠️' : 'ℹ️'
    const color =
      suggestion.level === 'error' ? colors.red : suggestion.level === 'warning' ? colors.yellow : colors.blue
    console.log(`  ${icon} ${color}${suggestion.message}${colors.reset}`)
  }
}

// 6. Chunk 分析
printSection('📦 Chunk 文件分析')
const jsAssetsPath = path.join(distPath, 'assets', 'js')
if (fs.existsSync(jsAssetsPath)) {
  const jsFiles = fs
    .readdirSync(jsAssetsPath)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({
      name: f,
      size: getFileSize(path.join(jsAssetsPath, f)),
    }))
    .sort((a, b) => b.size - a.size)

  if (jsFiles.length > 0) {
    console.log(`  ${colors.dim}JavaScript 文件 (按大小排序):${colors.reset}\n`)
    for (const file of jsFiles.slice(0, 10)) {
      let sizeColor = colors.green
      if (file.size > 1024 * 1024) {
        sizeColor = colors.yellow
      }
      if (file.size > 5 * 1024 * 1024) {
        sizeColor = colors.red
      }
      console.log(`    📄 ${file.name}: ${sizeColor}${formatSize(file.size)}${colors.reset}`)
    }
    if (jsFiles.length > 10) {
      console.log(`\n    ${colors.dim}... 还有 ${jsFiles.length - 10} 个文件${colors.reset}`)
    }
  }
}

// Vendor chunk 分析
const vendorPath = path.join(distPath, 'assets', 'vendor')
if (fs.existsSync(vendorPath)) {
  const vendorFiles = fs
    .readdirSync(vendorPath)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({
      name: f,
      size: getFileSize(path.join(vendorPath, f)),
    }))
    .sort((a, b) => b.size - a.size)

  if (vendorFiles.length > 0) {
    console.log(`\n  ${colors.dim}Vendor Chunk 文件:${colors.reset}\n`)
    for (const file of vendorFiles) {
      console.log(`    📦 ${file.name}: ${colors.cyan}${formatSize(file.size)}${colors.reset}`)
    }
  }
}

console.log(`\n${colors.bright}${colors.green}✓ 分析完成${colors.reset}\n`)
