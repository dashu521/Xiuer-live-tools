import path from 'node:path'
import { app } from 'electron'
import type playwright from 'playwright'
import { createLogger } from '#/logger'
import { findChromium } from '#/utils/checkChrome'

const logger = createLogger('BrowserSessionManager')

// 加载 playwright-extra（带 stealth 插件）
let chromium: typeof import('playwright').chromium | null = null
try {
  const fs = require('fs') as typeof import('fs')
  
  // 可能的路径列表（按优先级）
  const possiblePaths = [
    path.join(__dirname, 'runtime', 'load-playwright.cjs'),           // __dirname = dist-electron/main
    path.join(__dirname, '../runtime', 'load-playwright.cjs'),        // __dirname = dist-electron/main/managers
    path.join(__dirname, 'main/runtime', 'load-playwright.cjs'),      // __dirname = dist-electron
  ]
  
  let loadPath: string | null = null
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      loadPath = p
      break
    }
  }
  
  if (!loadPath) {
    throw new Error(`Cannot find load-playwright.cjs in any of: ${possiblePaths.join(', ')}`)
  }
  
  logger.debug(`Loading playwright from: ${loadPath}`)
  logger.debug(`__dirname: ${__dirname}`)
  
  const loaded = require(loadPath) as { chromium: typeof import('playwright').chromium }
  chromium = loaded.chromium
  if (!chromium) {
    logger.error('playwright-extra loaded but chromium is undefined')
  } else {
    logger.info('playwright-extra loaded successfully')
  }
} catch (error) {
  logger.error('Failed to load playwright-extra:', error)
}

export interface BrowserSession {
  browser: playwright.Browser
  context: playwright.BrowserContext
  page: playwright.Page
}

export interface BrowserConfig {
  headless?: boolean
  storageState?: string
}

export type StorageState = playwright.BrowserContextOptions['storageState']

class BrowserSessionManager {
  private chromePath: string | null = null

  public setChromePath(path: string) {
    this.chromePath = path
  }

  private async getChromePathOrDefault() {
    if (!this.chromePath) {
      this.chromePath = await findChromium()
    }
    return this.chromePath
  }

  private async createBrowser(headless = true) {
    console.log(`[BrowserPopup] [BrowserSessionManager] createBrowser() called with headless=${headless}`)
    logger.info(`[Browser] createBrowser called with headless=${headless}`)
    if (!chromium) {
      const errorMsg = 'playwright-extra 未能正确加载，无法启动浏览器'
      console.error(`[BrowserPopup] [BrowserSessionManager] chromium is null or undefined`)
      logger.error(errorMsg)
      throw new Error(errorMsg)
    }

    if (typeof chromium.launch !== 'function') {
      const errorMsg = `chromium.launch 不是函数，chromium 类型: ${typeof chromium}, 属性: ${Object.keys(chromium).join(', ')}`
      console.error(`[BrowserPopup] [BrowserSessionManager] chromium.launch is not a function`)
      logger.error(errorMsg)
      throw new Error(errorMsg)
    }

    const execPath = await this.getChromePathOrDefault()
    console.log(`[BrowserPopup] [BrowserSessionManager] Chrome path: ${execPath}`)
    logger.info(`Launching browser: headless=${headless}, execPath=${execPath}`)

    // 无头模式下使用减内存启动参数，降低多账号并存时的内存占用
    const args = headless
      ? [
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--no-first-run',
          '--mute-audio',
          '--hide-scrollbars',
        ]
      : []

    try {
      console.log(`[BrowserPopup] [BrowserSessionManager] Calling chromium.launch()`)
      const browser = await chromium.launch({
        headless,
        executablePath: execPath,
        args,
      })
      console.log(`[BrowserPopup] [BrowserSessionManager] Browser launched successfully, isConnected: ${browser.isConnected()}`)
      logger.info('Browser launched successfully')
      return browser
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message || error.name || error.toString()
          : typeof error === 'string'
            ? error
            : JSON.stringify(error)
      console.error(`[BrowserPopup] [BrowserSessionManager] chromium.launch() failed: ${errorMessage}`)
      const errorStack = error instanceof Error ? error.stack : undefined
      logger.error(`Failed to launch browser: ${errorMessage}`)
      if (errorStack) {
        logger.error(`Stack trace: ${errorStack}`)
      }
      throw new Error(`浏览器启动失败: ${errorMessage}`)
    }
  }

  public async createSession(
    headless = true,
    storageState?: StorageState,
  ): Promise<BrowserSession> {
    console.log(`[BrowserPopup] [BrowserSessionManager] createSession() called with headless=${headless}`)
    const browser = await this.createBrowser(headless)
    console.log(`[BrowserPopup] [BrowserSessionManager] Browser created, creating context...`)
    const context = await browser.newContext({
      viewport: null,
      storageState,
    })
    console.log(`[BrowserPopup] [BrowserSessionManager] Context created, creating page...`)
    const page = await context.newPage()
    console.log(`[BrowserPopup] [BrowserSessionManager] Page created, session ready`)
    return { browser, context, page }
  }
}

export const browserManager = new BrowserSessionManager()
