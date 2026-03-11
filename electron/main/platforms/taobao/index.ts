import { Result } from '@praha/byethrow'
import type { Page } from 'playwright'
import { PageNotFoundError } from '#/errors/PlatformError'
import type { BrowserSession } from '#/managers/BrowserSessionManager'
import { sleep } from '#/utils'
import {
  comment,
  connect,
  ensurePage,
  getItemFromVirtualScroller,
  openUrlByElement,
} from '../helper'
import type { ICommentListener, IPerformComment, IPerformPopup, IPlatform } from '../IPlatform'
import { TaobaoCommentListener } from './commentListener'
import { REGEXPS, SELECTORS, URLS } from './constant'
import { taobaoElementFinder as elementFinder } from './element-finder'

const PLATFORM_NAME = '淘宝' as const

/**
 * 淘宝
 */
export class TaobaoPlatform implements IPlatform, IPerformPopup, IPerformComment, ICommentListener {
  readonly _isCommentListener = true
  readonly _isPerformComment = true
  readonly _isPerformPopup = true
  private mainPage: Page | null = null
  private commentListener: TaobaoCommentListener | null = null

  async connect(session: BrowserSession): Promise<boolean> {
    const { page } = session
    const isAccessed = await connect(page, {
      liveControlUrl: URLS.LIVE_LIST, // 直播计划页面
      isInLiveControlSelector: SELECTORS.IN_LIVE_LIST,
      loginUrlRegex: REGEXPS.LOGIN_PAGE,
    })

    if (!isAccessed) {
      return false
    }

    // 淘宝需要在直播计划中获取到直播间 id，再通过 id 进入中控台
    try {
      const liveIdWrapper = await session.page.waitForSelector(SELECTORS.LIVE_ID, {
        timeout: 5000,
      })
      const liveId = await liveIdWrapper.textContent()
      const liveControlUrl = `${URLS.LIVE_CONTROL_WITH_ID}${liveId}`
      await session.page.goto(liveControlUrl)
    } catch {
      throw new Error('找不到直播间 ID，请确认是否正在直播')
    }

    // 淘宝会弹出莫名其妙的引导界面，按 ESC 关闭
    const driverOverlay = SELECTORS.overlays.DRIVER
    await page.waitForSelector(driverOverlay, { timeout: 3000 }).catch(() => null)
    while (await page.$(driverOverlay)) {
      await page.press('body', 'Escape')
      await sleep(500)
    }

    this.mainPage = page

    return true
  }

  async login(session: BrowserSession): Promise<void> {
    if (!REGEXPS.LOGIN_PAGE.test(session.page.url())) {
      await session.page.goto(URLS.LOGIN_PAGE)
    }

    await session.page.waitForSelector(SELECTORS.IN_LIVE_LIST, {
      timeout: 0,
    })
  }

  async getAccountName(session: BrowserSession): Promise<string> {
    // 需要前往首页获取
    const homePage = await openUrlByElement(session.page, URLS.HOME_PAGE)
    session.page.bringToFront()

    try {
      // 等待页面加载完成，最多等待 10 秒
      await homePage
        .waitForLoadState('networkidle', { timeout: 10000 })
        .catch(() => homePage.waitForTimeout(3000)) // 如果 networkidle 超时，至少等待 3 秒

      // 尝试多种选择器查找用户名
      const selectors = SELECTORS.ACCOUNT_NAME.split(', ')
      let accountName = ''

      for (const selector of selectors) {
        try {
          const element = await homePage.waitForSelector(selector.trim(), { timeout: 3000 })
          if (element) {
            const text = await element.textContent()
            if (text?.trim()) {
              accountName = text.trim()
              break // 找到有效的用户名，跳出循环
            }
          }
        } catch (_error) {}
      }

      // 如果还是没找到，尝试从页面标题或其他位置获取
      if (!accountName || !accountName.trim()) {
        console.warn('[淘宝平台] 未找到用户名元素，尝试备用方案...')
        // 尝试从页面标题获取
        const pageTitle = await homePage.title()
        if (pageTitle.includes('淘宝直播')) {
          accountName = '淘宝主播' // 默认名称
        }
      }

      return accountName.trim() || '未知用户'
    } catch (error) {
      console.error('[淘宝平台] 获取用户名时发生错误:', error)
      throw new Error(`获取用户名失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      // 延迟关闭页面，确保数据已读取
      setTimeout(() => homePage.close().catch(() => {}), 500)
    }
  }

  async isLive(_session: BrowserSession): Promise<boolean> {
    try {
      if (!this.mainPage) {
        return false
      }
      const commentTextareaSelector = elementFinder.commentInput?.TEXTAREA
      const commentTextarea = commentTextareaSelector
        ? await this.mainPage.$(commentTextareaSelector).catch(() => null)
        : null
      // 淘宝：如果能访问中控台页面，说明正在直播
      // 因为 connect() 中已经检查过，找不到 liveId 会抛出错误
      // 进一步检查：评论输入框是否存在
      return commentTextarea !== null
    } catch (_error) {
      return false
    }
  }

  disconnect(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async performPopup(id: number) {
    return Result.pipe(
      ensurePage(this.mainPage),
      Result.andThen(page => getItemFromVirtualScroller(page, elementFinder, id)),
      Result.andThen(item => elementFinder.getPopUpButtonFromGoodsItem(item)),
      Result.inspect(btn => btn.dispatchEvent('click')),
      Result.andThen(_ => Result.succeed()),
    )
  }

  async performComment(message: string) {
    return Result.pipe(
      ensurePage(this.mainPage),
      Result.andThen(page => comment(page, elementFinder, message, false)),
    )
  }

  startCommentListener(
    onComment: (comment: LiveMessage) => void,
    source: CommentListenerConfig['source'],
  ): void | Promise<void> {
    if (source !== 'taobao') {
      throw new Error('淘宝评论监听器只能用于淘宝平台')
    }
    if (!this.mainPage) {
      throw new PageNotFoundError()
    }
    this.commentListener = new TaobaoCommentListener(this.mainPage, onComment)
    this.commentListener.start()
  }

  stopCommentListener(): void {
    this.commentListener?.stop()
  }

  getCommentListenerPage(): Page {
    if (!this.commentListener) {
      throw new PageNotFoundError()
    }
    return this.commentListener.getPage()
  }

  getPopupPage() {
    return this.mainPage
  }

  getCommentPage() {
    return this.mainPage
  }

  get platformName() {
    return PLATFORM_NAME
  }
}
