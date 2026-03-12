const path = require('path')

/**
 * macOS notarization hook for electron-builder.
 * Runs ONLY on darwin platform AND darwin target.
 * This script will EXIT IMMEDIATELY on non-Mac platforms.
 */
exports.default = async function notarizing(context) {
  // ========== 严格平台检查 ==========
  // 检查 1: 当前运行平台必须是 macOS
  if (process.platform !== 'darwin') {
    console.log('[notarize] SKIP: Not running on macOS (process.platform !== darwin)')
    return
  }

  // 检查 2: 构建目标必须是 darwin
  const { electronPlatformName, appOutDir, packager } = context
  if (electronPlatformName !== 'darwin') {
    console.log(`[notarize] SKIP: Build target is not macOS (electronPlatformName=${electronPlatformName})`)
    return
  }

  // 检查 3: 确保不是在 Windows 或 Linux 上交叉编译
  const buildTarget = process.env.ELECTRON_BUILDER_TARGETS || ''
  if (buildTarget && !buildTarget.includes('darwin') && !buildTarget.includes('mac')) {
    console.log(`[notarize] SKIP: ELECTRON_BUILDER_TARGETS=${buildTarget} does not include macOS`)
    return
  }

  // ========== Mac 签名和公证流程 ==========
  const appName = packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)
  const appBundleId = packager.appInfo.id

  console.log('')
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║  [notarize] macOS 签名与公证流程                                  ║')
  console.log('╠══════════════════════════════════════════════════════════════════╣')
  console.log(`║  应用路径: ${appPath}`)
  console.log(`║  Bundle ID: ${appBundleId}`)
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log('')

  // 检查 Apple 开发者环境变量
  const appleId = process.env.APPLE_ID
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD
  const teamId = process.env.APPLE_TEAM_ID

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('')
    console.log('╔══════════════════════════════════════════════════════════════════╗')
    console.log('║  [notarize] 跳过公证流程                                          ║')
    console.log('╠══════════════════════════════════════════════════════════════════╣')
    console.log('║  原因：未配置 Apple 开发者环境变量                                 ║')
    console.log('║                                                                  ║')
    console.log('║  当前构建类型：测试构建（未签名/未公证）                           ║')
    console.log('║  • 应用可以正常运行                                               ║')
    console.log('║  • 但 macOS Gatekeeper 会阻止运行                                 ║')
    console.log('║  • 用户需要右键"打开"或移除隔离属性                               ║')
    console.log('║                                                                  ║')
    console.log('║  如需正式发布构建（签名+公证），请配置：                          ║')
    console.log('║    export APPLE_ID="your-email@example.com"                       ║')
    console.log('║    export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"       ║')
    console.log('║    export APPLE_TEAM_ID="XXXXXXXXXX"                              ║')
    console.log('║                                                                  ║')
    console.log('║  详见：docs/RELEASE_SPECIFICATION.md                              ║')
    console.log('╚══════════════════════════════════════════════════════════════════╝')
    console.log('')
    return
  }

  // 执行公证
  try {
    const { notarize } = require('@electron/notarize')
    console.log(`[notarize] Start notarization for ${appPath}`)

    await notarize({
      tool: 'notarytool',
      appBundleId,
      appPath,
      appleId,
      appleIdPassword,
      teamId,
    })

    console.log('[notarize] Notarization completed successfully.')
  } catch (error) {
    console.error('[notarize] Notarization failed:', error.message)
    throw error
  }
}
