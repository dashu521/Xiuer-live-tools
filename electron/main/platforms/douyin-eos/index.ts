import { Result } from '@praha/byethrow'
import type { Page } from 'playwright'
import type { BrowserSession } from '#/managers/BrowserSessionManager'
import {
  comment,
  connect,
  ensurePage,
  getAccountName,
  getItemFromVirtualScroller,
  toggleButton,
} from '../helper'
import type { IPerformComment, IPerformPopup, IPlatform } from '../IPlatform'
import { REGEXPS, SELECTORS, TEXTS, URLS } from './constant'
import { douyinEosElementFinder as elementFinder } from './element-finder'

const PLATFORM_NAME = '抖音团购' as const

/**
 * 抖音团购
 */
export class DouyinEosPlatform implements IPlatform, IPerformPopup, IPerformComment {
  readonly _isPerformComment = true
  readonly _isPerformPopup = true
  public mainPage: Page | null = null

  async connect(browserSession: BrowserSession) {
    const { page } = browserSession
    const isConnected = await connect(page, {
      isInLiveControlSelector: SELECTORS.IN_LIVE_CONTROL,
      liveControlUrl: URLS.LIVE_CONTROL,
      loginUrlRegex: REGEXPS.LOGIN_PAGE,
    })
    if (isConnected) {
      this.mainPage = page
    }
    return isConnected
  }

  async login(browserSession: BrowserSession) {
    if (!REGEXPS.LOGIN_PAGE.test(browserSession.page.url())) {
      await browserSession.page.goto(URLS.LOGIN_PAGE)
    }
    await browserSession.page.waitForSelector(SELECTORS.LOGGED_IN, {
      timeout: 0,
    })
  }

  async getAccountName(session: BrowserSession) {
    const accountName = await getAccountName(session.page, SELECTORS.ACCOUNT_NAME)
    return accountName ?? ''
  }

  async isLive(_session: BrowserSession): Promise<boolean> {
    // 抖音团购和抖店共用相同的检测逻辑
    try {
      if (!this.mainPage) {
        return false
      }
      const commentTextareaSelector = elementFinder.commentInput?.TEXTAREA
      const commentTextarea = commentTextareaSelector
        ? await this.mainPage.$(commentTextareaSelector).catch(() => null)
        : null
      // 检测评论输入框是否存在且可用
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
      Result.andThen(popupBtn =>
        toggleButton(popupBtn, TEXTS.POPUP_BUTTON, TEXTS.POPUP_BUTTON_CANCLE, signal),
      ),
    )
  }

  async performComment(message: string) {
    return Result.pipe(
      ensurePage(this.mainPage),
      Result.andThen(page => comment(page, elementFinder, message, false)),
    )
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
