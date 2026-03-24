#!/usr/bin/env node
/**
 * 构建环境检查脚本
 * 检查当前机器是否具备构建条件，以及可以执行哪种构建类型
 *
 * 规则：先复现，再判断
 * - 不仅凭 checklist 下结论
 * - 明确区分测试构建和正式发布构建
 */

const { execSync } = require('child_process')
const fs = require('fs')

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
}

function log(title, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️' : 'ℹ️'
  const color = status === 'PASS' ? colors.green : status === 'FAIL' ? colors.red : status === 'WARN' ? colors.yellow : colors.cyan
  console.log(`${icon} ${color}${colors.bold}[${status}]${colors.reset} ${title}`)
  if (details) {
    console.log(`   ${details}`)
  }
}

function exec(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe', ...options }).trim()
  } catch (error) {
    if (options.ignoreError) return ''
    throw error
  }
}

// ==================== 检查项目 ====================

function checkNodejs() {
  try {
    const version = exec('node --version')
    log('Node.js', 'PASS', version)
    return true
  } catch {
    log('Node.js', 'FAIL', '未安装或不在 PATH 中')
    return false
  }
}

function checkNpm() {
  try {
    const version = exec('npm --version')
    log('npm', 'PASS', version)
    return true
  } catch {
    log('npm', 'FAIL', '未安装或不在 PATH 中')
    return false
  }
}

function checkGit() {
  try {
    const version = exec('git --version')
    log('Git', 'PASS', version)
    return true
  } catch {
    log('Git', 'FAIL', '未安装或不在 PATH 中')
    return false
  }
}

function checkPlatform() {
  const platform = process.platform
  if (platform === 'darwin') {
    try {
      const release = exec('sw_vers -productVersion')
      const arch = exec('uname -m')
      log('操作系统', 'PASS', `macOS ${release} (${arch})`)
      return { ok: true, platform: 'macos', release, arch }
    } catch {
      log('操作系统', 'PASS', 'macOS')
      return { ok: true, platform: 'macos' }
    }
  } else if (platform === 'win32') {
    log('操作系统', 'WARN', 'Windows（推荐在 GitHub Actions 上构建）')
    return { ok: true, platform: 'windows' }
  } else {
    log('操作系统', 'WARN', `${platform}（未测试）`)
    return { ok: true, platform }
  }
}

function checkXcode() {
  try {
    const version = exec('xcode-select -p', { ignoreError: true })
    if (version) {
      log('Xcode 命令行工具', 'PASS', '已安装')
      return { installed: true, optional: true }
    }
  } catch {
    // ignore
  }
  log('Xcode 命令行工具', 'INFO', '未安装（测试构建不需要，正式发布建议安装）')
  return { installed: false, optional: true }
}

function checkCertificates() {
  try {
    const identities = exec('security find-identity -v -p codesigning', { ignoreError: true })
    const validIdentities = identities.split('\n').filter(line => line.includes('valid identities found'))
    const countMatch = validIdentities[0]?.match(/(\d+) valid identities? found/)
    const count = countMatch ? parseInt(countMatch[1]) : 0

    if (count > 0) {
      log('代码签名证书', 'PASS', `找到 ${count} 个有效证书`)
      return { hasCertificate: true, count }
    }
  } catch {
    // ignore
  }
  log('代码签名证书', 'INFO', '未找到（测试构建不需要，正式发布需要）')
  return { hasCertificate: false }
}

function checkAppleEnv() {
  const appleId = process.env.APPLE_ID
  const applePassword = process.env.APPLE_APP_SPECIFIC_PASSWORD
  const teamId = process.env.APPLE_TEAM_ID

  if (appleId && applePassword && teamId) {
    log('Apple 开发者环境变量', 'PASS', '已配置')
    return { configured: true }
  }

  const missing = []
  if (!appleId) missing.push('APPLE_ID')
  if (!applePassword) missing.push('APPLE_APP_SPECIFIC_PASSWORD')
  if (!teamId) missing.push('APPLE_TEAM_ID')

  log('Apple 开发者环境变量', 'INFO', `未配置: ${missing.join(', ')}`)
  return { configured: false, missing }
}

function checkProjectDeps() {
  if (!fs.existsSync('node_modules')) {
    log('项目依赖', 'FAIL', 'node_modules 不存在，请先运行 npm install')
    return false
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
    log('项目依赖', 'PASS', `版本: ${packageJson.version}`)
    return true
  } catch {
    log('项目依赖', 'WARN', '无法读取 package.json')
    return true
  }
}

// ==================== 主程序 ====================

function main() {
  console.log(`${colors.bold}`)
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║           🔍 构建环境检查                                   ║')
  console.log('║         区分测试构建 vs 正式发布构建                        ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(`${colors.reset}`)

  console.log(`\n${colors.cyan}${colors.bold}📋 基础环境检查${colors.reset}\n`)

  const nodeOk = checkNodejs()
  const npmOk = checkNpm()
  const gitOk = checkGit()
  const platform = checkPlatform()
  const depsOk = checkProjectDeps()

  const basicOk = nodeOk && npmOk && gitOk && platform.ok && depsOk

  console.log(`\n${colors.cyan}${colors.bold}📋 macOS 签名/公证检查（仅 macOS 相关）${colors.reset}\n`)

  const xcode = checkXcode()
  const certs = checkCertificates()
  const appleEnv = checkAppleEnv()

  // 总结
  console.log(`\n${colors.bold}════════════════════════════════════════════════════════════${colors.reset}\n`)

  console.log(`${colors.cyan}${colors.bold}📊 检查结果摘要${colors.reset}\n`)

  // 测试构建能力
  console.log(`${colors.bold}A. 本地测试构建能力${colors.reset}`)
  if (basicOk && platform.platform === 'macos') {
    console.log(`   ${colors.green}✅ 可以进行测试构建${colors.reset}`)
    console.log(`      • 无需 Apple 开发者证书`)
    console.log(`      • 生成未签名应用`)
    console.log(`      • 运行时需要右键"打开"或移除隔离属性`)
    console.log(`      • 命令: npm run build && npx electron-builder --mac --publish never`)
  } else if (platform.platform !== 'macos') {
    console.log(`   ${colors.yellow}⚠️  当前不是 macOS 系统${colors.reset}`)
    console.log(`      • macOS 应用只能在 macOS 上构建`)
    console.log(`      • 请在 macOS 机器上执行测试构建`)
  } else {
    console.log(`   ${colors.red}❌ 基础环境不满足${colors.reset}`)
    console.log(`      • 请修复上述 FAIL 项目`)
  }

  // 正式发布构建能力
  console.log(`\n${colors.bold}B. 正式发布构建能力${colors.reset}`)
  const canReleaseBuild = basicOk && platform.platform === 'macos' && certs.hasCertificate && appleEnv.configured
  if (canReleaseBuild) {
    console.log(`   ${colors.green}✅ 可以进行正式发布构建${colors.reset}`)
    console.log(`      • 应用将被签名和公证`)
    console.log(`      • 用户可正常安装运行`)
    console.log(`      • 支持自动更新功能`)
    console.log(`      • 命令: npm run release:mac`)
  } else {
    console.log(`   ${colors.yellow}⚠️  暂不具备正式发布条件${colors.reset}`)
    if (!certs.hasCertificate) {
      console.log(`      • 缺少: Apple Developer ID 证书`)
      console.log(`        获取方式: developer.apple.com → Certificates`)
    }
    if (!appleEnv.configured) {
      console.log(`      • 缺少: Apple 开发者环境变量`)
      console.log(`        需配置: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID`)
    }
    console.log(`      • 可以先进行测试构建，详见 A 部分`)
  }

  // 历史构建复现建议
  console.log(`\n${colors.cyan}${colors.bold}📝 历史构建复现建议${colors.reset}\n`)
  console.log(`如果这台 Mac 之前成功构建过，请尝试复现：`)
  console.log(`   export VITE_AUTH_API_BASE_URL=https://auth.xiuer.work`)
  console.log(`   export AUTH_STORAGE_SECRET=$(openssl rand -hex 32)`)
  console.log(`   npm run build`)
  console.log(`   npx electron-builder --mac --publish never`)
  console.log(`\n如果成功生成 .app 或 .dmg，说明测试构建能力正常。`)

  // 文档链接
  console.log(`\n${colors.cyan}${colors.bold}📚 相关文档${colors.reset}\n`)
  console.log(`   • 完整规范: docs/RELEASE_SPECIFICATION.md`)
  console.log(`   • 发布流程: docs/RELEASE_PROCESS.md`)

  console.log(`\n${colors.bold}════════════════════════════════════════════════════════════${colors.reset}\n`)

  // 最终结论
  if (basicOk && platform.platform === 'macos') {
    console.log(`${colors.green}${colors.bold}✅ 结论：这台 Mac 可以用于测试构建${colors.reset}`)
    if (canReleaseBuild) {
      console.log(`${colors.green}${colors.bold}✅ 结论：这台 Mac 也可以用于正式发布构建${colors.reset}`)
    } else {
      console.log(`${colors.yellow}${colors.bold}⚠️  结论：正式发布需要配置 Apple 开发者证书${colors.reset}`)
    }
  } else {
    console.log(`${colors.red}${colors.bold}❌ 结论：请先修复基础环境问题${colors.reset}`)
  }

  console.log('')
}

main()
