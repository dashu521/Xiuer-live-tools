#!/usr/bin/env node

const { buildStatus } = require('./release-status')
const { colors, execWithOutput, ensureMacOssSynced } = require('./release-utils')

function logPass(message) {
  console.log(`${colors.green}✅ PASS${colors.reset} ${message}`)
}

function logWarn(message) {
  console.log(`${colors.yellow}⚠️  WARN${colors.reset} ${message}`)
}

function logInfo(message) {
  console.log(`${colors.blue}ℹ️  INFO${colors.reset} ${message}`)
}

function main() {
  console.log(`${colors.bold}`)
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║            🧭 发布编排脚本                                 ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(`${colors.reset}\n`)

  const status = buildStatus()

  if (!status.release.exists) {
    logWarn('Release 尚不存在，请先执行 npm run release:open')
    process.exit(1)
  }

  if (status.windows.run.found && status.windows.run.status === 'in_progress') {
    logInfo(`Windows 构建仍在进行中: ${status.windows.run.url}`)
  } else if (status.windows.run.found && status.windows.run.conclusion === 'success') {
    logPass('Windows 构建已完成')
  } else {
    logWarn('尚未检测到成功的 Windows 构建')
  }

  if (!status.mac.releaseAssetsReady) {
    if (status.mac.localArtifactsReady) {
      logInfo('检测到本地 mac 产物，开始上传到 GitHub Release...')
      execWithOutput('npm run upload:mac')
    } else {
      logWarn('本地 mac 产物未就绪，请先执行 npm run release:mac')
    }
  } else {
    logPass('mac Release 资产已齐全')
  }

  const refreshed = buildStatus()

  if (refreshed.mac.releaseAssetsReady && !refreshed.mac.cdnReady) {
    logInfo('mac CDN 尚未同步，开始触发 Upload Mac to OSS...')
    ensureMacOssSynced(refreshed.version, message => logInfo(message))
  } else if (refreshed.mac.cdnReady) {
    logPass('mac CDN 已同步')
  }

  console.log(`\n${colors.cyan}➡️  NEXT${colors.reset} 运行 npm run publish:verify 做纯验收检查`)
}

main()
