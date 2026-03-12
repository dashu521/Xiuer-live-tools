/**
 * 账号会话管理
 * 
 * @see docs/live-control-lifecycle-spec.md 中控台与直播状态管理总规范
 * 
 * 核心规则：
 * - 停止所有任务 ≠ 断开中控台连接
 * - 结束直播 ≠ 断开中控台连接
 * - 断开中控台连接 ≠ 关闭浏览器
 * - 关播不停止 StreamStateDetector
 */

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
import { accountRuntimeManager } from '#/services/AccountScopedRuntimeManager'
import { createAutoCommentTask } from '#/tasks/AutoCommentTask'
import { createAutoPopupTask } from '#/tasks/AutoPopupTask'
import { createCommentListenerTask } from '#/tasks/CommentListenerTask'
import type { ITask } from '#/tasks/ITask'
import { createPinCommentTask } from '#/tasks/PinCommentTask'
import { createSendBatchMessageTask } from '#/tasks/SendBatchMessageTask'
import { createSubAccountInteractionTask } from '#/tasks/SubAccountInteractionTask'
import windowManager from '#/windowManager'
import { taskRuntimeMonitor } from '#/services/TaskRuntimeMonitor'

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
    // 【核心修复】设置直播结束回调 - 当检测到关播时只停止任务，不断开中控台
    this.streamStateDetector.setOnStreamEndedCallback((reason: string) => {
      this.logger.info(`[StreamState] Stream ended callback triggered: ${reason}`)
      // 关播时只停止任务，不断开中控台，不关闭浏览器，不发送 disconnectedEvent
      this.stopForStreamEnded(reason)
    })
  }

  async connect(config: {
    headless?: boolean
    storageState?: string
  }): Promise<{ needsLogin: boolean }> {
    try {
      const headless = config.headless ?? false
      console.log(`[BrowserPopup] [AccountSession] connect() called`, {
        accountId: this.account.id,
        headless,
        hasStorageState: !!config.storageState,
      })
      this.logger.info(`[连接] 使用headless模式: ${headless}`)
      let storageState: StorageState
      if (config.storageState) {
        this.logger.info('检测到已保存登录状态')
        storageState = JSON.parse(config.storageState)
      }

      console.log(`[BrowserPopup] [AccountSession] Calling browserManager.createSession()`)
      this.browserSession = await browserManager.createSession(headless, storageState)
      console.log(`[BrowserPopup] [AccountSession] createSession() returned, browser exists: ${!!this.browserSession?.browser}`)
      this.streamStateDetector.updateBrowserSession(this.browserSession)

      console.log(`[BrowserPopup] [AccountSession] Calling ensureAuthenticated()`)
      const needsLogin = await this.ensureAuthenticated(this.browserSession, headless)
      console.log(`[BrowserPopup] [AccountSession] ensureAuthenticated() returned, needsLogin: ${needsLogin}`)

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
          emitter.emit('page-closed', { accountId: this.account.id, reason: '页面已关闭' })
        }
      })

      // 【修复】监听浏览器进程断开事件（兜底机制）
      // 当浏览器被强制关闭或崩溃时，page.on('close') 可能无法触发
      this.browserSession.browser.on('disconnected', () => {
        // 如果已经在断开中或已断开，不重复触发
        if (this.isDisconnecting || this.isDisconnected) {
          this.logger.info(
            `[browser-disconnected] 账号 ${this.account.id} 已经在断开中或已断开，忽略重复事件`,
          )
          return
        }
        this.logger.warn(`[browser-disconnected] 账号 ${this.account.id} 浏览器进程已断开`)
        emitter.emit('page-closed', { accountId: this.account.id, reason: '浏览器已被关闭' })
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

  /**
   * 停止所有任务并更新状态
   * @param reason 原因
   * @param closeBrowser 是否关闭浏览器
   * @param sendDisconnectEvent 是否发送 disconnectedEvent（关播时不发送，断开中控台时发送）
   * @param stopDetector 是否停止 StreamStateDetector（关播时 false，断开中控台时 true）
   */
  private stopTasksAndUpdateState(
    reason: string, 
    closeBrowser: boolean, 
    sendDisconnectEvent: boolean,
    stopDetector: boolean = false
  ) {
    const accountId = this.account.id
    
    try {
      // 【关键修复】只有明确要求停止 detector 时才停止（断开中控台时）
      // 关播时必须保持 detector 活跃，以支持后续再次开播检测
      if (stopDetector) {
        this.logger.info(`[disconnect][${accountId}] >>> Step 1a: stopping streamStateDetector (stopDetector=true)`)
        this.streamStateDetector.stop()
      } else {
        this.logger.info(`[disconnect][${accountId}] >>> Step 1a: NOT stopping streamStateDetector (stopDetector=false), keeping for re-detection`)
      }
      // 只更新状态，不停止 detector
      this.streamStateDetector.setState('offline')

      // 关闭浏览器
      if (closeBrowser && this.browserSession?.browser) {
        this.logger.info(`[disconnect][${accountId}] >>> Step 2: closing browser`)
        this.browserSession.browser.close().catch(e => this.logger.error('无法关闭浏览器：', e))
        this.browserSession = null
        this.streamStateDetector.updateBrowserSession(null)
      } else {
        this.logger.info(`[disconnect][${accountId}] >>> Step 2: NOT closing browser`)
      }

      // 关闭所有任务
      this.logger.info(`[disconnect][${accountId}] >>> Step 3: stopping ${this.activeTasks.size} active tasks`)
      Array.from(this.activeTasks.values()).forEach((task, index) => {
        const taskType = Array.from(this.activeTasks.keys())[index]
        this.logger.info(`[disconnect][${accountId}] >>> Stopping task ${index + 1}/${this.activeTasks.size}: ${taskType}`)
        try {
          task.stop()
        } catch (e) {
          this.logger.warn(`[disconnect][${accountId}] >>> Task ${taskType} stop error (ignored):`, e)
        }
      })
      this.activeTasks.clear()
      this.logger.info(`[disconnect][${accountId}] >>> Step 4: activeTasks cleared`)

    } catch (error) {
      this.logger.error(`[disconnect][${accountId}] error:`, error)
    }

    // 同步到 RuntimeManager
    accountRuntimeManager.setStreamState(accountId, 'offline')

    // 根据参数决定发送什么事件
    if (sendDisconnectEvent) {
      // 断开中控台：发送 disconnectedEvent
      console.log(`[DisconnectedEvent] SOURCE: AccountSession.stopTasksAndUpdateState, accountId: ${accountId}, reason: ${reason}`)
      this.logger.info(`[disconnect][${accountId}] >>> Step 5: sending disconnectedEvent`)
      windowManager.send(IPC_CHANNELS.tasks.liveControl.disconnectedEvent, accountId, reason)
      accountRuntimeManager.setDisconnected(accountId)
    } else {
      // 关播：只发送 streamStateChanged
      this.logger.info(`[disconnect][${accountId}] >>> Step 5: sending streamStateChanged (stream ended, not disconnected)`)
      windowManager.send(IPC_CHANNELS.tasks.liveControl.streamStateChanged, accountId, 'offline')
    }
  }

  /**
   * 关播时调用：只停止任务，不断开中控台，不关闭浏览器，不发送 disconnectedEvent
   */
  stopForStreamEnded(reason: string) {
    const accountId = this.account.id
    if (this.isDisconnecting) {
      this.logger.info(`[stopForStreamEnded] 账号 ${accountId} 已在处理中，跳过`)
      return
    }
    this.isDisconnecting = true
    
    this.logger.warn(`[stopForStreamEnded][${accountId}] START, reason: ${reason}`)
    // 【关键】关播时保持 detector 活跃，支持再次开播检测
    this.stopTasksAndUpdateState(reason, false, false, false) 
    
    this.isDisconnecting = false
    this.logger.warn(`[stopForStreamEnded][${accountId}] END`)
  }

  /**
   * 断开中控台：停止任务，更新状态，发送 disconnectedEvent
   * 
   * @param reason 断开原因
   * @param options.closeBrowser 是否关闭浏览器（默认 false，只有浏览器实际关闭时才传 true）
   */
  disconnect(reason?: string, options?: { closeBrowser?: boolean }) {
    // 【修复】默认不关闭浏览器，只有明确要求时才关闭
    const shouldCloseBrowser = options?.closeBrowser ?? false
    const accountId = this.account.id
    
    if (this.isDisconnecting || this.isDisconnected) {
      this.logger.info(`[disconnect] 账号 ${accountId} 已经在断开中或已断开，跳过`)
      return
    }

    this.isDisconnecting = true
    this.isDisconnected = true
    const disconnectReason = reason || '与中控台断开连接'
    
    this.logger.warn(`[disconnect][${accountId}] START disconnect, reason: ${disconnectReason}, closeBrowser: ${shouldCloseBrowser}`)
    this.logger.warn(`[disconnect][${accountId}] activeTasks count: ${this.activeTasks.size}`)
    
    // 断开中控台时停止 detector
    this.stopTasksAndUpdateState(disconnectReason, shouldCloseBrowser, true, true)
    
    this.isDisconnecting = false
    this.logger.warn(`[disconnect][${accountId}] END`)
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
      // 【修复】登录后 page 可能被替换，需要更新 streamStateDetector
      this.streamStateDetector.updateBrowserSession(this.browserSession)
      // 保存登录状态
      const storageState = await this.browserSession.context.storageState()
      // 无头模式，需要先关闭当前的有头模式，重新打开无头模式
      if (headless) {
        await this.browserSession.browser.close()
        this.logger.info('登录成功，浏览器将继续以无头模式运行')
        this.browserSession = await browserManager.createSession(headless, storageState)
        this.streamStateDetector.updateBrowserSession(this.browserSession)
      }
      // 【修复】递归调用后返回结果，确保 needsLogin 状态正确
      return await this.ensureAuthenticated(this.browserSession, headless)
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
    
    // 注册到运行时监控
    taskRuntimeMonitor.registerTask(this.account.id, task.type)
    
    // 任务停止时从任务列表中移除
    newTask.value.addStopListener(() => {
      this.activeTasks.delete(task.type)
      taskRuntimeMonitor.unregisterTask(`${this.account.id}:${task.type}`)
    })
    await newTask.value.start()
    this.activeTasks.set(task.type, newTask.value)
    
    // 输出当前统计
    const stats = taskRuntimeMonitor.getStatistics()
    this.logger.info(`[startTask][${this.account.id}] Task ${task.type} started, running tasks: ${stats.runningTasks}, timers: ${stats.activeTimers}, listeners: ${stats.activeListeners}`)
    
    return Result.succeed()
  }

  public stopTask(taskType: LiveControlTask['type']) {
    const task = this.activeTasks.get(taskType)
    if (task) {
      this.logger.info(`[stopTask][${this.account.id}] Stopping task ${taskType}...`)
      task.stop()
      
      // 输出清理后的统计
      const stats = taskRuntimeMonitor.getStatistics()
      this.logger.info(`[stopTask][${this.account.id}] Task ${taskType} stopped, running tasks: ${stats.runningTasks}, timers: ${stats.activeTimers}, listeners: ${stats.activeListeners}`)
    } else {
      this.logger.warn('[stopTask] 无法停止任务：未找到正在运行中的任务')
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

export function makeTask<T extends LiveControlTask>(
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
