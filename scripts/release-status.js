#!/usr/bin/env node

const {
  colors,
  getVersion,
  getTagName,
  getReleaseAssets,
  getBuildWindowsStatus,
  checkMacCdnSync,
  getLocalMacArtifacts,
  summarizeReleaseAssets,
} = require('./release-utils')

function buildStatus() {
  const version = getVersion()
  const tagName = getTagName(version)
  const release = getReleaseAssets(tagName)
  const windowsRun = getBuildWindowsStatus(tagName)
  const macCdn = checkMacCdnSync()
  const localMacArtifacts = getLocalMacArtifacts(version)
  const assetSummary = summarizeReleaseAssets(release.assetNames)

  const windows = {
    run: windowsRun,
    releaseAssetsReady:
      assetSummary.windowsExe && assetSummary.windowsZip && assetSummary.latestYml,
  }

  const mac = {
    localArtifactsReady: localMacArtifacts.length >= 5,
    releaseAssetsReady: assetSummary.macDmg && assetSummary.latestMacYml,
    cdnReady: macCdn.ok,
    cdnError: macCdn.error,
  }

  return {
    version,
    tagName,
    release,
    localMacArtifacts,
    windows,
    mac,
    assetSummary,
    autoUpdateReady:
      assetSummary.latestYml && assetSummary.latestMacYml && macCdn.ok && windows.releaseAssetsReady,
  }
}

function main() {
  const status = buildStatus()

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(status, null, 2))
    return
  }

  console.log(`${colors.bold}`)
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║                📊 发布状态总览                            ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(`${colors.reset}\n`)

  console.log(`版本: ${status.version}`)
  console.log(`Tag: ${status.tagName}`)
  console.log(`Release: ${status.release.exists ? '已存在' : '不存在'}`)
  if (status.release.url) {
    console.log(`Release URL: ${status.release.url}`)
  }
  console.log(`Windows 构建: ${status.windows.run.found ? `${status.windows.run.status}/${status.windows.run.conclusion || 'pending'}` : '未找到'}`)
  console.log(`Windows 资产: ${status.windows.releaseAssetsReady ? '完整' : '未完整'}`)
  console.log(`mac 本地产物: ${status.mac.localArtifactsReady ? '已就绪' : '未就绪'}`)
  console.log(`mac Release 资产: ${status.mac.releaseAssetsReady ? '完整' : '未完整'}`)
  console.log(`mac CDN: ${status.mac.cdnReady ? '已同步' : '未同步'}`)
  console.log(`自动更新: ${status.autoUpdateReady ? '可用' : '未完整'}`)
}

if (require.main === module) {
  main()
}

module.exports = {
  buildStatus,
}
