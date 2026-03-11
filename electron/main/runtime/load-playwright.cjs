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

  // 方案：先加载 playwright-core，然后用 addExtra 包装
  // 这样可以绕过 playwright-extra 内部的模块查找逻辑

  // 1. 加载 playwright-core（使用完整路径）
  console.log('[load-playwright] Step 1: Loading playwright-core...')
  const playwrightCore = loadModule('playwright-core', unpackedPath)

  if (!playwrightCore || !playwrightCore.chromium) {
    throw new Error('playwright-core.chromium is undefined')
  }
  console.log('[load-playwright] playwright-core loaded successfully')

  // 2. 加载 playwright-extra 并使用 addExtra 包装 playwright-core.chromium
  console.log('[load-playwright] Step 2: Loading playwright-extra and wrapping chromium...')
  const playwrightExtra = loadModule('playwright-extra', unpackedPath)

  // 使用 addExtra 方法包装已加载的 chromium（这是官方推荐的方式）
  if (typeof playwrightExtra.addExtra === 'function') {
    chromium = playwrightExtra.addExtra(playwrightCore.chromium)
    console.log('[load-playwright] Used addExtra to wrap playwright-core.chromium')
  } else {
    // 回退：直接使用 playwright-core 的 chromium（没有 extra 功能）
    console.warn(
      '[load-playwright] addExtra not available, using playwright-core.chromium directly',
    )
    chromium = playwrightCore.chromium
  }

  // 3. 加载并应用 stealth 插件
  console.log('[load-playwright] Step 3: Loading stealth plugin...')
  const stealthModule = loadModule('puppeteer-extra-plugin-stealth', unpackedPath)
  const stealth = stealthModule.default || stealthModule

  if (stealth && chromium && typeof chromium.use === 'function') {
    chromium.use(stealth())
    console.log('[load-playwright] stealth plugin applied successfully')
  } else {
    console.warn('[load-playwright] Could not apply stealth plugin (chromium.use not available)')
  }

  console.log('[load-playwright] All modules loaded successfully')
} catch (error) {
  console.error('[load-playwright] Failed to load modules:', error.message)
  console.error('[load-playwright] Stack:', error.stack)

  // 尝试回退到纯 playwright-core（没有 stealth）
  try {
    const unpackedPath = getUnpackedNodeModulesPath()
    console.log('[load-playwright] Attempting fallback to pure playwright-core...')
    const playwrightCore = loadModule('playwright-core', unpackedPath)
    if (playwrightCore?.chromium) {
      chromium = playwrightCore.chromium
      console.log(
        '[load-playwright] Fallback successful: using playwright-core.chromium without stealth',
      )
    }
  } catch (fallbackError) {
    console.error('[load-playwright] Fallback also failed:', fallbackError.message)
  }
}

module.exports = { chromium }
