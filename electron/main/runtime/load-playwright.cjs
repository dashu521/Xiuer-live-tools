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
 * 尝试从指定路径加载 playwright-core
 * @returns {{ success: boolean, module?: any, path?: string, error?: string }}
 */
function tryLoadPlaywrightCore(modulePath, label) {
  try {
    console.log(`[load-playwright] [${label}] Trying: ${modulePath}`)
    const mod = require(modulePath)
    if (mod && mod.chromium) {
      console.log(`[load-playwright] [${label}] SUCCESS: ${modulePath}`)
      return { success: true, module: mod, path: modulePath }
    } else {
      console.log(`[load-playwright] [${label}] FAILED: chromium is undefined`)
      return { success: false, error: 'chromium is undefined' }
    }
  } catch (e) {
    console.log(`[load-playwright] [${label}] FAILED: ${e.message}`)
    return { success: false, error: e.message }
  }
}

/**
 * 多路径 fallback 加载 playwright-core
 */
function loadPlaywrightCoreWithFallback() {
  const isWindows = process.platform === 'win32'
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

  console.log(`[load-playwright] ========== 模块加载（多路径 fallback）==========`)

  // 方式 1：默认 require（macOS 正常）
  const defaultResult = tryLoadPlaywrightCore('playwright-core', 'DEFAULT')
  if (defaultResult.success) {
    return defaultResult.module
  }

  // 方式 2：基于 process.cwd() 的 node_modules 路径（Windows fallback）
  const cwdPath = path.join(process.cwd(), 'node_modules', 'playwright-core')
  const cwdResult = tryLoadPlaywrightCore(cwdPath, 'CWD')
  if (cwdResult.success) {
    return cwdResult.module
  }

  // 方式 3：基于 __dirname 回溯项目根目录后的 node_modules 路径
  // __dirname = dist-electron/main/runtime
  // 需要向上 3 级到项目根目录
  const projectRoot = path.resolve(__dirname, '..', '..', '..')
  const dirnamePath = path.join(projectRoot, 'node_modules', 'playwright-core')
  const dirnameResult = tryLoadPlaywrightCore(dirnamePath, 'DIRNAME')
  if (dirnameResult.success) {
    return dirnameResult.module
  }

  // 方式 4：打包环境下的 unpacked 路径
  if (unpackedPath) {
    const unpackedModulePath = path.join(unpackedPath, 'playwright-core')
    const unpackedResult = tryLoadPlaywrightCore(unpackedModulePath, 'UNPACKED')
    if (unpackedResult.success) {
      return unpackedResult.module
    }
  }

  // 所有方式都失败
  console.error(`[load-playwright] ========== 所有加载方式均失败 ==========`)
  throw new Error(`Cannot load playwright-core from any path. Tried:
  1. DEFAULT: require('playwright-core')
  2. CWD: ${cwdPath}
  3. DIRNAME: ${dirnamePath}
  ${unpackedPath ? `4. UNPACKED: ${path.join(unpackedPath, 'playwright-core')}` : ''}`)
}

try {
  const playwrightCore = loadPlaywrightCoreWithFallback()

  if (!playwrightCore || !playwrightCore.chromium) {
    throw new Error('playwright-core.chromium is undefined')
  }

  chromium = playwrightCore.chromium
  console.log('[load-playwright] ========== 加载成功 ==========')
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
