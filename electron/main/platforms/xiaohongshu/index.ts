import { Result } from '@praha/byethrow'
import type { Page } from 'playwright'
import type { BrowserSession } from '#/managers/BrowserSessionManager'
import {
  comment,
  connect,
  ensurePage,
  getAccountName,
  getAllGoodsIdsFromScroller,
  getAllGoodsMetaFromScroller,
  getItemFromVirtualScroller,
  openUrlByElement,
  scanGoodsKnowledgeFromItem,
  toggleButton,
} from '../helper'
import type {
  ICommentListener,
  IPerformComment,
  IPerformPopup,
  IPlatform,
  IPopupGoodsScanner,
} from '../IPlatform'
import { XiaohongshuCommentListener } from './commentListener'
import { REGEXPS, SELECTORS, TEXTS, URLS } from './constant'
import { xiaohongshuElementFinder as elementFinder } from './elment-finder'

const PLATFORM_NAME = '小红书' as const

/**
 * 小红书（千帆）
 */
export class XiaohongshuPlatform
  implements IPlatform, IPerformPopup, IPerformComment, ICommentListener, IPopupGoodsScanner
{
  readonly _isCommentListener = true
  readonly _isPerformComment = true
  readonly _isPerformPopup = true
  readonly _isPopupGoodsScanner = true
  private mainPage: Page | null = null
  private commentListener: XiaohongshuCommentListener | null = null
  private accountName = ''

  async connect(browserSession: BrowserSession) {
    const { page } = browserSession
    const isConnected = await connect(page, {
      isInLiveControlSelector: SELECTORS.IN_LIVE_CONTROL,
      liveControlUrl: URLS.LIVE_CONTROL_PAGE,
      loginUrlRegex: REGEXPS.LOGIN_PAGE,
    })

    if (isConnected) {
      // 小红书反爬，直接用 goto 进入中控台加载不出元素
      const newPage = await openUrlByElement(page, URLS.LIVE_CONTROL_PAGE)
      await page.close()
      browserSession.page = newPage
      this.mainPage = newPage
    }
    return isConnected
  }

  async login(browserSession: BrowserSession): Promise<void> {
    const { page } = browserSession
    if (!REGEXPS.LOGIN_PAGE.test(page.url())) {
      await page.goto(URLS.LOGIN_PAGE)
    }
    await page.waitForSelector(SELECTORS.LOGGED_IN, {
      timeout: 0,
    })
  }

  async getAccountName(session: BrowserSession) {
    const accountName = await getAccountName(session.page, SELECTORS.ACCOUNT_NAME)
    if (accountName?.endsWith('的店')) {
      this.accountName = accountName.slice(0, -2)
    }
    return this.accountName
  }

  async isLive(session: BrowserSession): Promise<boolean> {
    try {
      // 使用传入的 session.page，不使用缓存的 this.mainPage
      const page = session.page
      if (!page) {
        return false
      }
      const commentTextareaSelector = elementFinder.commentInput?.TEXTAREA
      const commentTextarea = commentTextareaSelector
        ? await page.$(commentTextareaSelector).catch(() => null)
        : null
      // 小红书：检测评论输入框是否存在且可用
      if (commentTextarea) {
        const isDisabled = await commentTextarea.isDisabled().catch(() => true)
        return !isDisabled
      }
      return false
    } catch (_error) {
      return false
    }
  }

  disconnect(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async performPopup(id: number, signal?: AbortSignal) {
    return Result.pipe(
      ensurePage(this.mainPage),
      Result.andThen(page => getItemFromVirtualScroller(page, elementFinder, id)),
      Result.andThen(item => elementFinder.getPopUpButtonFromGoodsItem(item)),
      Result.andThen(btn =>
        toggleButton(btn, TEXTS.POPUP_BUTTON, TEXTS.POPUP_BUTTON_CANCLE, signal),
      ),
    )
  }

  async performComment(message: string) {
    return Result.pipe(
      ensurePage(this.mainPage),
      Result.andThen(page => comment(page, elementFinder, message, false)),
    )
  }

  async scanPopupGoodsIds() {
    return Result.pipe(
      ensurePage(this.mainPage),
      Result.andThen(page => getAllGoodsIdsFromScroller(page, elementFinder)),
    )
  }

  async scanPopupGoodsMeta() {
    return Result.pipe(
      ensurePage(this.mainPage),
      Result.andThen(page => getAllGoodsMetaFromScroller(page, elementFinder)),
    )
  }

  async scanPopupGoodsKnowledge(goodsId: number) {
    return Result.pipe(
      ensurePage(this.mainPage),
      Result.andThen(async page => {
        const itemResult = await getItemFromVirtualScroller(page, elementFinder, goodsId)
        if (Result.isFailure(itemResult)) {
          return itemResult
        }
        return await scanGoodsKnowledgeFromItem(page, itemResult.value, elementFinder, goodsId)
      }),
    )
  }

  async startCommentListener(onComment: (comment: LiveMessage) => void): Promise<void> {
    const page = ensurePage(this.mainPage)
    if (Result.isFailure(page)) {
      throw page.error
    }
    this.commentListener = new XiaohongshuCommentListener(page.value)
    this.commentListener.setAccountName(this.accountName)
    await this.commentListener.startCommentListener(onComment)
  }

  stopCommentListener(): void {
    this.commentListener?.stopCommentListener()
  }

  getCommentListenerPage(): Page {
    if (!this.commentListener) {
      throw new Error('Comment listener not started')
    }
    return this.commentListener.getCommentListenerPage()
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
