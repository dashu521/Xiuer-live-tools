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
    console.warn(
      '[notarize] Skip notarization: APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID is not fully configured.',
    )
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
