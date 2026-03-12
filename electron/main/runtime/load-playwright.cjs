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

  console.log(`[load-playwright] ========== 环境信息 ==========`)
  console.log(`[load-playwright] Environment: ${isPackaged ? 'packaged' : 'development'}`)
  console.log(`[load-playwright] Platform: ${process.platform}`)
  console.log(`[load-playwright] Arch: ${process.arch}`)
  console.log(`[load-playwright] Node version: ${process.version}`)
  console.log(`[load-playwright] cwd: ${process.cwd()}`)
  console.log(`[load-playwright] __dirname: ${__dirname}`)
  if (unpackedPath) {
    console.log(`[load-playwright] Unpacked path: ${unpackedPath}`)
  }

  // 尝试解析 playwright-core 路径
  console.log(`[load-playwright] ========== 模块解析 ==========`)
  try {
    const resolvedPath = require.resolve('playwright-core')
    console.log(`[load-playwright] require.resolve('playwright-core') = ${resolvedPath}`)
  } catch (resolveError) {
    console.error(`[load-playwright] require.resolve('playwright-core') FAILED: ${resolveError.message}`)
  }

  // 直接使用 playwright-core，不使用 playwright-extra
  // 因为 playwright-extra 的 stealth 插件在 macOS 上有依赖问题
  console.log(`[load-playwright] ========== 加载模块 ==========`)
  console.log('[load-playwright] Loading playwright-core...')
  const playwrightCore = loadModule('playwright-core', unpackedPath)

  if (!playwrightCore || !playwrightCore.chromium) {
    throw new Error('playwright-core.chromium is undefined')
  }

  chromium = playwrightCore.chromium
  console.log('[load-playwright] playwright-core loaded successfully')
  console.log('[load-playwright] Note: Running without stealth plugin')

} catch (error) {
  console.error(`[load-playwright] ========== 加载失败 ==========`)
  console.error(`[load-playwright] Error message: ${error.message}`)
  console.error(`[load-playwright] Error name: ${error.name}`)
  console.error(`[load-playwright] Error code: ${error.code}`)
  console.error(`[load-playwright] Stack: ${error.stack}`)
  console.error(`[load-playwright] Platform: ${process.platform}`)
  console.error(`[load-playwright] cwd: ${process.cwd()}`)
  console.error(`[load-playwright] __dirname: ${__dirname}`)
}

module.exports = { chromium }
