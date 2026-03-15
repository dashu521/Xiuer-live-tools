/**
 * 简化的小号评论平台
 * 以普通观众身份登录平台，只用于发送评论
 * 不需要登录直播中控台
 */

import { Result } from '@praha/byethrow'
import type { Page } from 'playwright'
import type { PlatformError } from '#/errors/PlatformError'
import type { BrowserSession } from '#/managers/BrowserSessionManager'
import type { IPerformComment } from '../IPlatform'

export interface SimplePlatformConfig {
  /** 平台名称 */
  name: string
  /** 登录页面URL（观众端主站） */
  loginUrl: string
  /** 直播间页面URL模板，{roomId} 为直播间ID占位符 */
  liveRoomUrlTemplate: string
  /** 评论输入框选择器 */
  commentInputSelector: string
  /** 发送按钮选择器 */
  sendButtonSelector: string
  /** 登录状态检查选择器 */
  loggedInSelector: string
  /** 发送方式：点击按钮或回车 */
  sendMethod?: 'click' | 'enter'
}

/**
 * 通用的小号评论平台实现
 * 以普通观众身份登录，进入直播间发送弹幕
 */
export function createSimpleCommentPlatform(config: SimplePlatformConfig): IPerformComment & {
  connect(browserSession: BrowserSession): Promise<boolean>
  enterRoom(roomId: string): Promise<boolean>
  disconnect(): Promise<void>
} {
  let page: Page | null = null
  let _currentRoomId: string | null = null

  return {
    _isPerformComment: true as const,

    /**
     * 连接到平台（观众身份登录）
     * 不是连接直播中控台，而是登录平台主站
     */
    connect: async (browserSession: BrowserSession): Promise<boolean> => {
      const { page: p } = browserSession
      page = p

      try {
        // 先访问登录页面
        await page.goto(config.loginUrl, { waitUntil: 'networkidle' })

        // 检查是否已登录
        const isLoggedIn = await page
          .$(config.loggedInSelector)
          .then(el => !!el)
          .catch(() => false)

        if (isLoggedIn) {
          console.log(`[${config.name}] 已登录`)
          return true
        }

        // 需要登录，等待用户扫码/输入密码
        console.log(`[${config.name}] 等待用户登录...`)
        await page.waitForSelector(config.loggedInSelector, { timeout: 5 * 60 * 1000 })
        console.log(`[${config.name}] 登录成功`)
        return true
      } catch (error) {
        console.error(`[${config.name}] 登录失败:`, error)
        return false
      }
    },

    /**
     * 进入指定直播间
     */
    enterRoom: async (roomId: string): Promise<boolean> => {
      if (!page) return false

      try {
        const url = config.liveRoomUrlTemplate.replace('{roomId}', roomId)
        await page.goto(url, { waitUntil: 'networkidle' })

        // 等待页面加载完成（检查评论框是否存在）
        await page.waitForSelector(config.commentInputSelector, { timeout: 10000 })
        _currentRoomId = roomId
        console.log(`[${config.name}] 已进入直播间: ${roomId}`)
        return true
      } catch (error) {
        console.error(`[${config.name}] 进入直播间失败:`, error)
        return false
      }
    },

    /**
     * 发送评论
     */
    performComment: (message: string, _pinTop?: boolean) => {
      return Result.try({
        try: async () => {
          if (!page) {
            return false
          }

          try {
            // 找到评论输入框
            const input = await page.$(config.commentInputSelector)
            if (!input) {
              console.error(`[${config.name}] 未找到评论输入框`)
              return false
            }

            // 输入评论内容
            await input.fill(message)

            // 点击发送按钮
            const sendButton = await page.$(config.sendButtonSelector)
            if (sendButton) {
              await sendButton.click()
            } else {
              // 如果没有发送按钮，尝试按回车
              await input.press('Enter')
            }

            console.log(`[${config.name}] 发送评论：${message}`)
            return true
          } catch (error) {
            console.error(`[${config.name}] 发送评论失败:`, error)
            return false
          }
        },
        catch: err => {
          console.error(`[${config.name}] 发送评论异常:`, err)
          return new Error('发送评论失败')
        },
      }) as unknown as Result.ResultAsync<boolean, PlatformError>
    },

    /**
     * 获取评论任务所需的页面
     */
    getCommentPage: (): Page | null => page,

    /**
     * 断开连接
     */
    disconnect: async (): Promise<void> => {
      page = null
      _currentRoomId = null
    },
  }
}

/**
 * 抖音观众平台配置
 */
export const DouyinViewerConfig: SimplePlatformConfig = {
  name: '抖音',
  loginUrl: 'https://www.douyin.com/',
  liveRoomUrlTemplate: 'https://live.douyin.com/{roomId}',
  commentInputSelector:
    '[data-e2e="comment-input"] textarea, ' +
    '[data-e2e="comment-input"] input, ' +
    '[data-e2e="comment-input"] [contenteditable="true"], ' +
    '.comment-input textarea, ' +
    '.comment-input input, ' +
    '.comment-input [contenteditable="true"], ' +
    '[placeholder*="说点什么"], ' +
    '[placeholder*="发弹幕"], ' +
    '[placeholder*="聊点什么"], ' +
    'textarea[placeholder], ' +
    'input[placeholder], ' +
    '.chat-input textarea, ' +
    '.chat-input input, ' +
    '[class*="chat-input"], ' +
    '[class*="ChatInput"] textarea, ' +
    '[class*="ChatInput"] input, ' +
    '.live-chat-input, ' +
    'div[class*="input"] textarea, ' +
    'div[class*="input"] input, ' +
    '[role="textbox"], ' +
    'div[contenteditable="true"]',
  sendButtonSelector:
    '[data-e2e="comment-submit"], .comment-submit, button[class*="send"], [class*="submit-btn"]',
  loggedInSelector: '.avatar img, [data-e2e="user-avatar"], .user-info img, [class*="avatar"]',
  sendMethod: 'click',
}

/**
 * 小红书观众平台配置
 */
export const XiaohongshuViewerConfig: SimplePlatformConfig = {
  name: '小红书',
  loginUrl: 'https://www.xiaohongshu.com/',
  liveRoomUrlTemplate: 'https://www.xiaohongshu.com/live/{roomId}',
  commentInputSelector:
    '.live-comment-input textarea, [placeholder*="说点什么"], [placeholder*="发弹幕"]',
  sendButtonSelector: '.live-comment-submit, .send-btn, [class*="send"]',
  loggedInSelector: '.user-avatar, .avatar, [class*="avatar"]',
  sendMethod: 'click',
}

/**
 * 视频号观众平台配置
 */
export const WechatChannelViewerConfig: SimplePlatformConfig = {
  name: '视频号',
  loginUrl: 'https://channels.weixin.qq.com/',
  liveRoomUrlTemplate: 'https://channels.weixin.qq.com/live/{roomId}',
  commentInputSelector:
    '.comment-input textarea, [placeholder*="发表评论"], [placeholder*="发弹幕"]',
  sendButtonSelector: '.comment-submit, .send-button',
  loggedInSelector: '.user-info, .avatar',
  sendMethod: 'enter',
}

/**
 * 小号观众端平台配置映射（主进程 SubAccountManager 使用）
 */
export const SUB_ACCOUNT_PLATFORM_CONFIGS: Record<LiveControlPlatform, SimplePlatformConfig> = {
  douyin: DouyinViewerConfig,
  buyin: {
    ...DouyinViewerConfig,
    name: '巨量百应',
  },
  xiaohongshu: XiaohongshuViewerConfig,
  wxchannel: WechatChannelViewerConfig,
  taobao: {
    name: '淘宝直播',
    loginUrl: 'https://www.taobao.com/',
    liveRoomUrlTemplate: 'https://market.m.taobao.com/app/live/{roomId}',
    commentInputSelector: '.comment-input textarea, [placeholder*="说点什么"]',
    sendButtonSelector: '.comment-submit, .send-btn',
    loggedInSelector: '.site-nav-user img, .avatar, [class*="user-avatar"]',
    sendMethod: 'click',
  },
  eos: DouyinViewerConfig,
  pgy: {
    ...XiaohongshuViewerConfig,
    name: '小红书拼购',
  },
  kuaishou: {
    name: '快手',
    loginUrl: 'https://www.kuaishou.com/',
    liveRoomUrlTemplate: 'https://www.kuaishou.com/live/{roomId}',
    commentInputSelector: '.comment-input textarea, [placeholder*="说点什么"]',
    sendButtonSelector: '.comment-submit, .send-btn',
    loggedInSelector: '.avatar, .user-avatar',
    sendMethod: 'click',
  },
  dev: {
    ...DouyinViewerConfig,
    name: 'Dev',
  },
}
