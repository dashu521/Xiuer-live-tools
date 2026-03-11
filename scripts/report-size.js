const fs = require('node:fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB (${bytes} bytes)`
}

function collectFileEntries(rootDir) {
  const entries = []
  const stack = [rootDir]
  while (stack.length > 0) {
    const current = stack.pop()
    const list = fs.readdirSync(current, { withFileTypes: true })
    for (const dirent of list) {
      const full = path.join(current, dirent.name)
      if (dirent.isDirectory()) {
        stack.push(full)
      } else {
        const stat = fs.statSync(full)
        entries.push({ path: full, size: stat.size })
      }
    }
  }
  return entries
}

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return null
  return process.argv[idx + 1] || ''
}

function appendReport(reportPath, content) {
  fs.appendFileSync(reportPath, content, 'utf8')
}

function ensureHeading(reportPath) {
  if (!fs.existsSync(reportPath)) return
  const text = fs.readFileSync(reportPath, 'utf8')
  if (text.includes('## 八、自动化体积报告')) return
  appendReport(reportPath, '\n---\n\n## 八、自动化体积报告\n')
}

const root = path.join(__dirname, '..')
const pkg = readJson(path.join(root, 'package.json'))
const version = pkg.version
const releaseDir = path.join(root, 'release', version)
const resourcesDir = path.join(releaseDir, 'win-unpacked', 'resources')
const reportPath = path.join(root, 'docs', 'INSTALLER_SIZE_REDUCTION_REPORT.md')
const tag = getArgValue('--tag') || 'dist'

if (!fs.existsSync(releaseDir)) {
  console.error('release 目录不存在:', releaseDir)
  process.exit(1)
}

if (!fs.existsSync(resourcesDir)) {
  console.error('resources 目录不存在:', resourcesDir)
  process.exit(1)
}

const exeCandidates = fs
  .readdirSync(releaseDir)
  .filter(
    (name) =>
      name.toLowerCase().endsWith('.exe') &&
      !name.includes('blockmap') &&
      !name.toLowerCase().includes('uninstaller'),
  )

const exeName =
  exeCandidates.find((n) => /TASI-live-Supertool_.*win-x64\.exe$/i.test(n)) ||
  exeCandidates[0]

if (!exeName) {
  console.error('未找到 .exe 产物，目录:', releaseDir)
  process.exit(1)
}

const exePath = path.join(releaseDir, exeName)
const exeSize = fs.statSync(exePath).size

const entries = collectFileEntries(resourcesDir)
const resourcesSize = entries.reduce((sum, e) => sum + e.size, 0)

const appAsarPath = path.join(resourcesDir, 'app.asar')
const appAsarSize = fs.existsSync(appAsarPath) ? fs.statSync(appAsarPath).size : 0

const appAsarUnpackedPrefix = ['app.asar.unpacked', '']
const appAsarUnpackedSize = entries.reduce((sum, e) => {
  const rel = path.relative(resourcesDir, e.path)
  if (rel.startsWith(appAsarUnpackedPrefix.join(path.sep))) return sum + e.size
  return sum
}, 0)

const dirSizes = new Map()
const pkgSizes = new Map()

for (const entry of entries) {
  const rel = path.relative(resourcesDir, entry.path)
  let dir = path.dirname(rel)
  while (dir && dir !== '.') {
    dirSizes.set(dir, (dirSizes.get(dir) || 0) + entry.size)
    dir = path.dirname(dir)
  }

  const parts = rel.split(path.sep)
  const nmIndex = parts.indexOf('node_modules')
  if (nmIndex !== -1) {
    const first = parts[nmIndex + 1]
    if (first) {
      const pkgName = first.startsWith('@')
        ? `${first}/${parts[nmIndex + 2] || ''}`
        : first
      if (pkgName && !pkgName.endsWith('/')) {
        pkgSizes.set(pkgName, (pkgSizes.get(pkgName) || 0) + entry.size)
      }
    }
  }
}

const topFiles = entries
  .map((e) => ({
    path: path.relative(resourcesDir, e.path),
    size: e.size,
  }))
  .sort((a, b) => b.size - a.size)
  .slice(0, 30)

const topDirs = Array.from(dirSizes.entries())
  .map(([dir, size]) => ({ path: dir, size }))
  .sort((a, b) => b.size - a.size)
  .slice(0, 30)

const topPkgs = Array.from(pkgSizes.entries())
  .map(([pkg, size]) => ({ pkg, size }))
  .sort((a, b) => b.size - a.size)
  .slice(0, 30)

const timestamp = new Date().toISOString()
let gitHash = 'unknown'
try {
  gitHash = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim()
} catch (_) {}

const lines = []
lines.push(`\n### Auto Report (${tag})\n`)
lines.push(`- **时间戳**：${timestamp}`)
lines.push(`- **git commit**：\`${gitHash}\``)
lines.push(`- **产物**：\`${exeName}\``)
lines.push(`- **exe**：${formatBytes(exeSize)}`)
lines.push(`- **resources**：${formatBytes(resourcesSize)}`)
lines.push(`- **app.asar**：${formatBytes(appAsarSize)}`)
lines.push(`- **app.asar.unpacked**：${formatBytes(appAsarUnpackedSize)}\n`)

lines.push('#### Top 30 files (resources)\n')
lines.push('| 排名 | 路径 | 大小 (bytes) |')
lines.push('|------|------|--------------|')
topFiles.forEach((item, idx) => {
  lines.push(`| ${idx + 1} | \`${item.path}\` | ${item.size} |`)
})

lines.push('\n#### Top 30 directories (resources)\n')
lines.push('| 排名 | 目录 | 大小 (bytes) |')
lines.push('|------|------|--------------|')
topDirs.forEach((item, idx) => {
  lines.push(`| ${idx + 1} | \`${item.path}\` | ${item.size} |`)
})

lines.push('\n#### Top 30 node_modules packages (app.asar.unpacked)\n')
lines.push('| 排名 | 包名 | 大小 (bytes) |')
lines.push('|------|------|--------------|')
topPkgs.forEach((item, idx) => {
  lines.push(`| ${idx + 1} | \`${item.pkg}\` | ${item.size} |`)
})

ensureHeading(reportPath)
appendReport(reportPath, lines.join('\n') + '\n')

console.log(lines.join('\n'))
