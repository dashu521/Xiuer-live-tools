'use strict'
const path = require('node:path')

let chromium = null

/**
 * 获取 unpacked node_modules 路径（打包环境）
 */
function getUnpackedNodeModulesPath() {
  try {
    const electron = require('electron')
    if (electron.app?.isPackaged && process.resourcesPath) {
      return path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
    }
  } catch (_e) {
    // 不在 Electron 环境中
  }
  return null
}

/**
 * 从指定路径加载模块
 */
function loadModule(moduleName, basePath) {
  if (basePath) {
    const fullPath = path.join(basePath, moduleName)
    console.log(`[load-playwright] Loading ${moduleName} from: ${fullPath}`)
    return require(fullPath)
  }
  console.log(`[load-playwright] Loading ${moduleName} from default location`)
  return require(moduleName)
}

try {
  const unpackedPath = getUnpackedNodeModulesPath()
  const isPackaged = !!unpackedPath

  console.log(`[load-playwright] Environment: ${isPackaged ? 'packaged' : 'development'}`)
  if (unpackedPath) {
    console.log(`[load-playwright] Unpacked path: ${unpackedPath}`)
  }

  // 直接使用 playwright-core，不使用 playwright-extra
  // 因为 playwright-extra 的 stealth 插件在 macOS 上有依赖问题
  console.log('[load-playwright] Loading playwright-core...')
  const playwrightCore = loadModule('playwright-core', unpackedPath)

  if (!playwrightCore || !playwrightCore.chromium) {
    throw new Error('playwright-core.chromium is undefined')
  }

  chromium = playwrightCore.chromium
  console.log('[load-playwright] playwright-core loaded successfully')
  console.log('[load-playwright] Note: Running without stealth plugin')

} catch (error) {
  console.error('[load-playwright] Failed to load playwright-core:', error.message)
  console.error('[load-playwright] Stack:', error.stack)
}

module.exports = { chromium }
