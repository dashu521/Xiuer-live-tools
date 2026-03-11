const path = require('path')

/**
 * macOS notarization hook for electron-builder.
 * Runs only on darwin and only when required env vars are provided.
 */
exports.default = async function notarizing(context) {
  if (process.platform !== 'darwin') {
    return
  }

  const { electronPlatformName, appOutDir, packager } = context
  if (electronPlatformName !== 'darwin') {
    return
  }

  const appName = packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)
  const appBundleId = packager.appInfo.id

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

  console.log('[notarize] Notarization completed.')
}
