/**
 * ============================================================================
 * 测试平台实现（DevPlatform）
 * ============================================================================
 *
 * 【重要说明】
 * - 此文件实现测试平台（platform === 'dev'）的所有功能
 * - 使用 Mock 数据模拟真实平台行为，用于功能验证和开发调试
 * - 生产环境不会使用此平台（用户无法选择 'dev' 平台）
 *
 * 【存档说明】
 * - 此文件是"可复现的稳定版本"的一部分，包含测试代码
 * - 测试平台通过平台选择机制隔离，不会在生产环境启用
 * - 如需在生产环境禁用，请确保平台选择列表不包含 'dev'
 * ============================================================================
 */

import { Result } from '@praha/byethrow'
import type { Page } from 'playwright'
import { UnexpectedError } from '#/errors/AppError'
import { PageNotFoundError, type PlatformError } from '#/errors/PlatformError'
import { createLogger } from '#/logger'
import type { BrowserSession } from '#/managers/BrowserSessionManager'
import { getRandomDouyinLiveMessage } from '#/utils'
import { comment, ensurePage, getItemFromVirtualScroller, toggleButton } from '../helper'
import type { ICommentListener, IPerformComment, IPerformPopup, IPlatform } from '../IPlatform'
import { devElementFinder as elementFinder } from './element-finder'

const PLATFORM_NAME = '测试平台' as const

export class DevPlatform implements IPlatform, IPerformComment, IPerformPopup, ICommentListener {
  readonly _isPerformPopup = true
  readonly _isPerformComment = true
  readonly _isCommentListener = true

  private listenerTimer: ReturnType<typeof setInterval> | null = null
  private mainPage: Page | null = null
  private readonly logger = createLogger('DevPlatform')
  private documentWritten = false

  startCommentListener(onComment: (comment: DouyinLiveMessage) => void) {
    const result = randomResult(
      new UnexpectedError({ description: '打开监听评论时发生的错误' }),
      0.1,
    )
    if (Result.isFailure(result)) {
      throw result.error
    }

    this.listenerTimer = setInterval(() => {
      const message = getRandomDouyinLiveMessage()
      onComment(message)
    }, 1000)
  }

  stopCommentListener(): void {
    if (this.listenerTimer) {
      clearInterval(this.listenerTimer)
      this.listenerTimer = null
    }
  }

  async performPopup(id: number, signal?: AbortSignal) {
    console.log(`-----------------讲解商品ID: ${id}`)
    return Result.pipe(
      ensurePage(this.mainPage),
      Result.andThen(page => getItemFromVirtualScroller(page, elementFinder, id)),
      Result.andThen(item => elementFinder.getPopUpButtonFromGoodsItem(item)),
      Result.andThen(popupBtn => toggleButton(popupBtn, '讲解', '取消讲解', signal)),
    )
  }

  getPopupPage() {
    return this.mainPage
  }

  async performComment(message: string) {
    return Result.pipe(
      ensurePage(this.mainPage),
      Result.andThen(page => comment(page, elementFinder, message, false)),
    )
  }

  getCommentPage() {
    return this.mainPage
  }

  get platformName() {
    return PLATFORM_NAME
  }

  getCommentListenerPage() {
    if (!this.mainPage) {
      throw new PageNotFoundError()
    }
    return this.mainPage
  }

  async connect(browserSession: BrowserSession) {
    // await _browserSession.page.close()
    // await _browserSession.page.waitForSelector('#id', { timeout: 100 })
    // const result = randomResult(new UnexpectedError({ description: '连接中控台触发的错误' }), 0.1)
    // if (Result.isFailure(result)) {
    //   throw result.error
    // }
    if (!this.documentWritten) {
      await browserSession.page.setContent((await import('./dev.html?raw')).default)
      this.documentWritten = true
    }
    const isConnect = await Promise.race([
      browserSession.page.waitForSelector('.top-nav').then(() => true), // 中控台
      browserSession.page.waitForSelector('.login-form__btn-submit').then(() => false), // 登录
    ])
    if (isConnect) {
      this.mainPage = browserSession.page
    }
    return isConnect
  }

  async login(browserSession: BrowserSession) {
    const { page } = browserSession
    await page.waitForSelector('.top-nav')
    // return Result.unwrap(randomResult(new UnexpectedError({ description: '登录时发生意外' })))
  }

  async getAccountName(session: BrowserSession) {
    const accountName = await session.page.$('.user-profile span').then(el => el?.textContent())
    return accountName ?? ''
  }

  async isLive(session: BrowserSession): Promise<boolean> {
    try {
      // 检测 dev.html 中的 isLive 状态
      const isLive = await session.page.evaluate(() => {
        // 检查 Vue 应用中的 isLive 状态（dev.html 使用 Vue）
        // 通过检查状态指示器的文本内容
        const statusIndicator = document.querySelector('.status-indicator')
        if (statusIndicator) {
          const text = statusIndicator.textContent || ''
          return text.includes('On Air')
        }
        // 检查是否有"结束直播"按钮（存在说明正在直播）
        const buttons = Array.from(document.querySelectorAll('button'))
        const stopButton = buttons.find(btn => btn.textContent?.includes('结束直播'))
        if (stopButton) {
          return true
        }
        // 检查是否有"开始直播"按钮（存在说明未开播）
        const startButton = buttons.find(btn => btn.textContent?.includes('开始直播'))
        if (startButton) {
          return false
        }
        // 检查视频区域是否有遮罩（有关播遮罩说明未开播）
        const overlay = document.querySelector('.video-monitor .absolute.inset-0.bg-black')
        if (overlay) {
          return false
        }
        // 默认返回 false（保守策略）
        return false
      })
      return isLive
    } catch (error) {
      this.logger.error('Failed to detect live status:', error)
      return false
    }
  }

  async disconnect() {
    this.logger.info('disconnect')
  }
}

function randomResult(error: PlatformError, p = 0.5) {
  const randomNumber = Math.random()
  if (randomNumber <= p) {
    return Result.fail(error)
  }
  return Result.succeed()
}
