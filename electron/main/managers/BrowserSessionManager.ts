import path from 'node:path'
import { app } from 'electron'
import type playwright from 'playwright'
import { createLogger } from '#/logger'
import { findChromium } from '#/utils/checkChrome'

const logger = createLogger('BrowserSessionManager')

// 加载 playwright-extra（带 stealth 插件）
let chromium: typeof import('playwright').chromium | null = null
try {
  // 打包后 __dirname = app.asar/dist-electron/main/managers
  // runtime 目录在 dist-electron/main/runtime，需要 ../runtime
  const loadPath = path.join(__dirname, '../runtime', 'load-playwright.cjs')
  logger.debug(`Loading playwright from: ${loadPath}`)
  logger.debug(`app.isPackaged: ${app?.isPackaged}, resourcesPath: ${process.resourcesPath}`)
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
    logger.info(`[Browser] createBrowser called with headless=${headless}`)
    if (!chromium) {
      const errorMsg = 'playwright-extra 未能正确加载，无法启动浏览器'
      logger.error(errorMsg)
      throw new Error(errorMsg)
    }

    // 检查 chromium.launch 是否为函数
    if (typeof chromium.launch !== 'function') {
      const errorMsg = `chromium.launch 不是函数，chromium 类型: ${typeof chromium}, 属性: ${Object.keys(chromium).join(', ')}`
      logger.error(errorMsg)
      throw new Error(errorMsg)
    }

    const execPath = await this.getChromePathOrDefault()
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
      const browser = await chromium.launch({
        headless,
        executablePath: execPath,
        args,
      })
      logger.info('Browser launched successfully')
      return browser
    } catch (error) {
      // 详细记录错误信息
      const errorMessage =
        error instanceof Error
          ? error.message || error.name || error.toString()
          : typeof error === 'string'
            ? error
            : JSON.stringify(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      logger.error(`Failed to launch browser: ${errorMessage}`)
      if (errorStack) {
        logger.error(`Stack trace: ${errorStack}`)
      }
      // 重新抛出带有详细消息的错误
      throw new Error(`浏览器启动失败: ${errorMessage}`)
    }
  }

  public async createSession(
    headless = true,
    storageState?: StorageState,
  ): Promise<BrowserSession> {
    const browser = await this.createBrowser(headless)
    const context = await browser.newContext({
      viewport: null, // 显式设置 null，关闭固定视口
      storageState,
    })
    const page = await context.newPage()
    return { browser, context, page }
  }
}

export const browserManager = new BrowserSessionManager()
