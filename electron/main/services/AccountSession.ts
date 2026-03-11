import { Result } from '@praha/byethrow'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { TaskNotSupportedError } from '#/errors/AppError'
import { emitter } from '#/event/eventBus'
import { createLogger } from '#/logger'
import {
  type BrowserSession,
  browserManager,
  type StorageState,
} from '#/managers/BrowserSessionManager'
import { platformFactory } from '#/platforms'
import {
  type IPlatform,
  isCommentListener,
  isPerformComment,
  isPerformPopup,
  isPinComment,
} from '#/platforms/IPlatform'
import { StreamStateDetector } from '#/services/StreamStateDetector'
import { createAutoCommentTask } from '#/tasks/AutoCommentTask'
import { createAutoPopupTask } from '#/tasks/AutoPopupTask'
import { createCommentListenerTask } from '#/tasks/CommentListenerTask'
import type { ITask } from '#/tasks/ITask'
import { createPinCommentTask } from '#/tasks/PinCommentTask'
import { createSendBatchMessageTask } from '#/tasks/SendBatchMessageTask'
import { createSubAccountInteractionTask } from '#/tasks/SubAccountInteractionTask'
import windowManager from '#/windowManager'

export class AccountSession {
  private platform: IPlatform
  private browserSession: BrowserSession | null = null
  private activeTasks: Map<LiveControlTask['type'], ITask> = new Map()
  private streamStateDetector: StreamStateDetector
  // 【修复】添加标记防止重复触发 disconnect
  private isDisconnecting = false
  private isDisconnected = false

  constructor(
    platformName: LiveControlPlatform,
    private account: Account,
    private logger = createLogger(`@${account.name}`),
  ) {
    this.platform = new platformFactory[platformName]()
    this.streamStateDetector = new StreamStateDetector(
      this.platform,
      this.browserSession,
      this.account.id,
      this.logger.scope('StreamState'),
    )
  }

  async connect(config: {
    headless?: boolean
    storageState?: string
  }): Promise<{ needsLogin: boolean }> {
    try {
      // 确保 headless 默认值为 false，避免 undefined 导致浏览器无法弹出
      const headless = config.headless ?? false
      this.logger.info(`[连接] 使用headless模式: ${headless}`)
      let storageState: StorageState
      if (config.storageState) {
        this.logger.info('检测到已保存登录状态')
        storageState = JSON.parse(config.storageState)
      }

      this.browserSession = await browserManager.createSession(headless, storageState)
      this.streamStateDetector.updateBrowserSession(this.browserSession)

      const needsLogin = await this.ensureAuthenticated(this.browserSession, headless)

      const state = JSON.stringify(await this.browserSession.context.storageState())

      // 登录成功之后马上先保存一次登录状态，确保后续发生意外后不用重新登录
      windowManager.send(IPC_CHANNELS.chrome.saveState, this.account.id, state)

      // 此时可以确保正在中控台页面，获取用户名
      // 获取用户名不应该和连接中控台的行为冲突
      this.platform
        .getAccountName(this.browserSession)
        .then(accountName => {
          this.logger.info(`成功获取用户名：${accountName}`)
          windowManager.send(IPC_CHANNELS.tasks.liveControl.notifyAccountName, {
            ok: true,
            accountId: this.account.id,
            accountName,
          })
        })
        .catch(error => {
          this.logger.error('获取用户名失败:', error)
          // 不中断连接流程，使用默认名称继续
          windowManager.send(IPC_CHANNELS.tasks.liveControl.notifyAccountName, {
            ok: true,
            accountId: this.account.id,
            accountName: `${this.account.name}(未获取)`,
          })
        })

      // 连接成功后，启动直播状态检测轮询
      this.streamStateDetector.start()

      // 【修复】浏览器被外部主动关闭时的处理
      // 添加验证机制，确保只有当前会话有效时才触发断开
      this.browserSession.page.on('close', () => {
        // 如果已经在断开中或已断开，不重复触发
        if (this.isDisconnecting || this.isDisconnected) {
          this.logger.info(
            `[page-close] 账号 ${this.account.id} 已经在断开中或已断开，忽略重复事件`,
          )
          return
        }
        // 验证 browserSession 仍然存在且匹配
        if (this.browserSession?.page) {
          this.logger.info(`[page-close] 账号 ${this.account.id} 页面关闭，触发断开连接`)
          emitter.emit('page-closed', { accountId: this.account.id })
        }
      })
      // 【修复】连接成功后进行健康检查，确保直播状态检测可以正常工作
      this.logger.info('[健康检查] 验证直播状态检测功能...')
      const healthCheck = await this.verifyConnectionHealth()
      if (!healthCheck.healthy) {
        this.logger.error(`[健康检查] 失败: ${healthCheck.reason}`)
        throw new Error(`连接健康检查失败: ${healthCheck.reason}`)
      }
      this.logger.success('[健康检查] 通过，直播状态检测功能正常')

      this.logger.success('成功与中控台建立连接')

      return { needsLogin }
    } catch (error) {
      const message = this.formatConnectError(error)
      this.logger.error('连接直播控制台失败：', error)
      throw new Error(message)
    }
  }

  /**
   * 【新增】验证连接健康状态
   * 确保直播状态检测可以正常工作，避免"假连接"状态
   */
  private async verifyConnectionHealth(): Promise<{ healthy: boolean; reason?: string }> {
    try {
      // 验证浏览器会话是否存在
      if (!this.browserSession?.page) {
        return { healthy: false, reason: '浏览器页面不存在' }
      }

      // 验证页面是否可以访问（尝试获取页面标题）
      try {
        const title = await this.browserSession.page.title()
        this.logger.info(`[健康检查] 页面标题: ${title}`)
      } catch (_e) {
        return { healthy: false, reason: '无法访问页面，页面可能已关闭或加载失败' }
      }

      // 验证直播状态检测功能是否可用
      // 尝试调用一次 isLive 检测，确保平台方法可以正常执行
      try {
        const isLive = await this.platform.isLive(this.browserSession)
        this.logger.info(`[健康检查] 直播状态检测成功，当前状态: ${isLive ? '直播中' : '未直播'}`)
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e)
        return { healthy: false, reason: `直播状态检测失败: ${errorMsg}` }
      }

      return { healthy: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return { healthy: false, reason: `健康检查异常: ${errorMsg}` }
    }
  }

  disconnect() {
    // 【修复】防止重复执行 disconnect
    if (this.isDisconnecting || this.isDisconnected) {
      this.logger.info(`[disconnect] 账号 ${this.account.id} 已经在断开中或已断开，跳过`)
      return
    }

    this.isDisconnecting = true
    this.isDisconnected = true
    const accountId = this.account.id
    this.logger.warn('与中控台断开连接')

    try {
      // 停止直播状态检测
      this.streamStateDetector.stop()
      this.streamStateDetector.setState('offline')

      // 通过程序关闭浏览器（并非多余的操作，因为 MacOS 的 context 关闭时不会关闭浏览器进程）
      if (this.browserSession?.browser) {
        this.browserSession.browser.close().catch(e => this.logger.error('无法关闭浏览器：', e))
      }

      this.browserSession = null
      this.streamStateDetector.updateBrowserSession(null)

      // 关闭所有正在进行的任务（任一 task.stop() 可能因页面已关闭而抛错，故放 try 内）
      Array.from(this.activeTasks.values()).forEach(task => {
        try {
          task.stop()
        } catch (e) {
          this.logger.warn('[disconnect] 停止任务时出错（可忽略）:', e)
        }
      })
      this.activeTasks.clear()

      this.logger.info(`[disconnect] 账号 ${accountId} 断开连接完成`)
    } catch (error) {
      this.logger.error(`[disconnect] 账号 ${accountId} 断开连接时出错:`, error)
    } finally {
      // 【关键】无论 try/catch 是否抛错，都通知渲染层，否则前端不会停止「自动回复/自动发言」等任务
      windowManager.send(IPC_CHANNELS.tasks.liveControl.disconnectedEvent, accountId)
      this.isDisconnecting = false
    }
  }

  private async ensureAuthenticated(session: BrowserSession, headless = true): Promise<boolean> {
    this.browserSession = session
    this.streamStateDetector.updateBrowserSession(session)
    const isConnected = await this.platform.connect(this.browserSession)
    // 未登录，需要等待登录
    if (!isConnected) {
      // 无头模式，需要先关闭原先的无头模式，启用有头模式给用户登录
      if (headless) {
        await this.browserSession.browser.close()
        this.logger.info('需要登录，请在打开的浏览器中登录')
        this.browserSession = await browserManager.createSession(false)
      }
      // 等待登录
      await this.platform.login(this.browserSession)
      // 保存登录状态
      const storageState = await this.browserSession.context.storageState()
      // 无头模式，需要先关闭当前的有头模式，重新打开无头模式
      if (headless) {
        await this.browserSession.browser.close()
        this.logger.info('登录成功，浏览器将继续以无头模式运行')
        this.browserSession = await browserManager.createSession(headless, storageState)
        this.streamStateDetector.updateBrowserSession(this.browserSession)
      }
      await this.ensureAuthenticated(this.browserSession, headless)
      return true // 需要登录
    }
    return false // 不需要登录
  }

  private formatConnectError(error: unknown) {
    // 处理浏览器被关闭的情况
    if (error instanceof Error) {
      const errorMessage = error.message || error.name || ''
      // 浏览器被用户关闭
      if (
        errorMessage.includes('Target page, context or browser has been closed') ||
        errorMessage.includes('browser has been closed') ||
        errorMessage.includes('page has been closed')
      ) {
        return '浏览器已被关闭，连接已取消'
      }
      // 连接超时
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        return '连接超时，请检查网络后重试'
      }
      // 导航失败
      if (errorMessage.includes('net::') || errorMessage.includes('Navigation failed')) {
        return '网络连接失败，请检查网络后重试'
      }
    }

    const baseMessage =
      error instanceof Error
        ? error.message || error.name
        : typeof error === 'string'
          ? error
          : error
            ? JSON.stringify(error)
            : '连接直播控制台失败'
    const details: string[] = []
    try {
      if (this.platform?.platformName) {
        details.push(`platform=${this.platform.platformName}`)
      }
      const url = this.browserSession?.page?.url()
      if (url) details.push(`url=${url}`)
    } catch {
      // ignore
    }
    return details.length ? `${baseMessage} (${details.join(', ')})` : baseMessage
  }

  public async startTask(task: LiveControlTask): Result.ResultAsync<void, Error> {
    const newTask = makeTask(task, this.platform, this.account, this.logger)
    if (Result.isFailure(newTask)) {
      return newTask
    }
    // 任务停止时从任务列表中移除
    newTask.value.addStopListener(() => {
      this.activeTasks.delete(task.type)
    })
    await newTask.value.start()
    this.activeTasks.set(task.type, newTask.value)
    return Result.succeed()
  }

  public stopTask(taskType: LiveControlTask['type']) {
    const task = this.activeTasks.get(taskType)
    if (task) {
      task.stop()
    } else {
      this.logger.warn('无法停止任务：未找到正在运行中的任务')
    }
  }

  public updateTaskConfig<T extends LiveControlTask>(
    type: T['type'],
    config: Partial<T['config']>,
  ): Result.Result<void, Error> {
    const task = this.activeTasks.get(type)
    if (task?.updateConfig) {
      return task.updateConfig(config)
    }
    return Result.fail(new TaskNotSupportedError({ taskName: `update-${type}` }))
  }

  /**
   * 获取当前页面 URL
   * 用于小号互动功能自动获取直播间链接
   */
  public getCurrentUrl(): string | null {
    try {
      if (this.browserSession?.page) {
        return this.browserSession.page.url()
      }
      return null
    } catch (error) {
      this.logger.error('获取当前页面 URL 失败:', error)
      return null
    }
  }

  /**
   * 获取直播间 URL（用于小号互动）
   * 如果主账号在中控台页面，会尝试从中控台提取直播间链接
   */
  public async getLiveRoomUrl(): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      if (!this.browserSession?.page) {
        return { success: false, error: '浏览器页面不存在' }
      }

      const page = this.browserSession.page
      const currentUrl = page.url()

      // 1. 如果当前 URL 已经是直播间页面，直接返回
      const isLiveRoomUrl =
        (currentUrl.includes('live.douyin.com') ||
          currentUrl.includes('live.kuaishou.com') ||
          (currentUrl.includes('/live/') && !currentUrl.includes('dashboard'))) &&
        !currentUrl.includes('dashboard') &&
        !currentUrl.includes('control') &&
        !currentUrl.includes('compass')

      if (isLiveRoomUrl) {
        this.logger.info(`当前已是直播间页面: ${currentUrl}`)
        return { success: true, url: currentUrl }
      }

      // 2. 如果是巨量百应中控台，尝试提取直播间 ID
      if (currentUrl.includes('buyin.jinritemai.com') || currentUrl.includes('douyin.com')) {
        const liveRoomUrl = await this.extractLiveRoomUrlFromPage(page)
        if (liveRoomUrl) {
          this.logger.info(`从中控台提取到直播间 URL: ${liveRoomUrl}`)
          return { success: true, url: liveRoomUrl }
        }
      }

      return { success: false, error: '当前不在直播间页面，也无法从中控台提取直播间链接' }
    } catch (error) {
      this.logger.error('获取直播间 URL 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取直播间 URL 失败',
      }
    }
  }

  /**
   * 从页面中提取直播间 URL
   * 通过多种方式获取直播间 ID
   */
  private async extractLiveRoomUrlFromPage(
    page: import('playwright').Page,
  ): Promise<string | null> {
    try {
      // 方法1：从页面 DOM 中查找直播间链接
      const liveLink = await page.$('a[href*="live.douyin.com"]')
      if (liveLink) {
        const href = await liveLink.getAttribute('href')
        if (href) {
          this.logger.info('从页面 DOM 中找到直播间链接')
          return href
        }
      }

      // 方法2：从页面 URL 参数中提取
      const currentUrl = page.url()
      const urlObj = new URL(currentUrl)
      const roomIdFromParams =
        urlObj.searchParams.get('room_id') ||
        urlObj.searchParams.get('roomId') ||
        urlObj.searchParams.get('live_room_id')
      if (roomIdFromParams) {
        this.logger.info('从 URL 参数中提取到直播间 ID:', roomIdFromParams)
        return `https://live.douyin.com/${roomIdFromParams}`
      }

      // 方法3：从页面 JavaScript 变量中提取
      const roomIdFromJs = await page.evaluate(() => {
        // 尝试从全局变量中获取
        const win = window as unknown as Record<string, unknown>
        const possiblePaths = [
          '__INITIAL_STATE__?.room?.id',
          '__INITIAL_STATE__?.roomId',
          'roomInfo?.roomId',
          '__NEXT_DATA__?.props?.pageProps?.roomId',
        ]
        for (const path of possiblePaths) {
          try {
            const value = path.split('.').reduce((obj: unknown, key: string) => {
              if (obj && typeof obj === 'object') {
                return (obj as Record<string, unknown>)[key.replace('?', '')]
              }
              return undefined
            }, win)
            if (typeof value === 'string' || typeof value === 'number') {
              return String(value)
            }
          } catch {
            // 忽略路径错误
          }
        }
        return null
      })
      if (roomIdFromJs) {
        this.logger.info('从页面 JS 变量中提取到直播间 ID:', roomIdFromJs)
        return `https://live.douyin.com/${roomIdFromJs}`
      }

      // 方法4：监听网络请求获取直播间 ID（等待页面刷新或用户操作）
      return new Promise(resolve => {
        let resolved = false
        const timeout = 3000 // 3秒超时

        const cleanup = () => {
          if (!resolved) {
            resolved = true
            page.off('response', handleResponse)
            resolve(null)
          }
        }

        const handleResponse = async (response: import('playwright').Response) => {
          if (resolved) return

          const url = response.url()
          // 监听包含 room_id 的 API 响应
          if (
            url.includes('promotions_v2') ||
            url.includes('room_id') ||
            url.includes('live/info')
          ) {
            try {
              const data = await response.json()
              const roomId = data?.data?.room_id || data?.room_id
              if (roomId) {
                resolved = true
                page.off('response', handleResponse)
                this.logger.info('从网络请求中提取到直播间 ID:', roomId)
                resolve(`https://live.douyin.com/${roomId}`)
              }
            } catch {
              // 忽略解析错误
            }
          }
        }

        page.on('response', handleResponse)
        setTimeout(cleanup, timeout)
      })
    } catch (error) {
      this.logger.error('提取直播间 URL 失败:', error)
      return null
    }
  }
}

function makeTask<T extends LiveControlTask>(
  task: T,
  platform: IPlatform,
  account: Account,
  logger: ReturnType<typeof createLogger>,
): Result.Result<ITask, Error> {
  if (task.type === 'auto-popup' && isPerformPopup(platform)) {
    return createAutoPopupTask(platform, task.config, account, logger)
  }
  if (task.type === 'auto-comment' && isPerformComment(platform)) {
    return createAutoCommentTask(platform, task.config, account, logger)
  }
  if (task.type === 'send-batch-messages' && isPerformComment(platform)) {
    return createSendBatchMessageTask(platform, task.config, logger)
  }
  if (task.type === 'comment-listener' && isCommentListener(platform)) {
    return createCommentListenerTask(platform, task.config, account, logger)
  }
  if (task.type === 'pin-comment' && isPinComment(platform)) {
    return createPinCommentTask(platform, task.config.comment, account.id, logger)
  }
  if (task.type === 'sub-account-interaction') {
    // 小号互动任务不需要主账号的平台支持，使用小号管理器
    return createSubAccountInteractionTask(task.config, account, logger)
  }
  return Result.fail(
    new TaskNotSupportedError({
      taskName: task.type,
      targetName: platform.platformName,
    }),
  )
}
