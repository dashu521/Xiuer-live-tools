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
import { accountRuntimeManager } from '#/services/AccountScopedRuntimeManager'
import { type ReconnectReason, reconnectManager } from '#/services/ReconnectManager'
import { StreamStateDetector } from '#/services/StreamStateDetector'
import { taskRuntimeMonitor } from '#/services/TaskRuntimeMonitor'
import { createAutoCommentTask } from '#/tasks/AutoCommentTask'
import { createAutoPopupTask } from '#/tasks/AutoPopupTask'
import { createCommentListenerTask } from '#/tasks/CommentListenerTask'
import type { ITask } from '#/tasks/ITask'
import { createPinCommentTask } from '#/tasks/PinCommentTask'
import { createSendBatchMessageTask } from '#/tasks/SendBatchMessageTask'
import { createSubAccountInteractionTask } from '#/tasks/SubAccountInteractionTask'
import windowManager from '#/windowManager'

const BROWSER_LAUNCH_TIMEOUT_MS = 30_000
const LOGIN_TIMEOUT_MS = 180_000
const SESSION_VERIFY_TIMEOUT_MS = 20_000

export class AccountSession {
  private platform: IPlatform
  private browserSession: BrowserSession | null = null
  private activeTasks: Map<LiveControlTask['type'], ITask> = new Map()
  private streamStateDetector: StreamStateDetector
  // 【修复】添加标记防止重复触发 disconnect
  private isDisconnecting = false
  private isDisconnected = false
  private isWaitingForLogin = false

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

  private emitConnectionState(
    connectState: Partial<{
      status: 'disconnected' | 'connecting' | 'connected' | 'error'
      phase:
        | 'idle'
        | 'preparing'
        | 'launching_browser'
        | 'waiting_for_login'
        | 'verifying_session'
        | 'streaming'
        | 'tasks_running'
        | 'error'
      error: string | null
      session: string | null
      lastVerifiedAt: number | null
    }>,
  ) {
    windowManager.send(IPC_CHANNELS.tasks.liveControl.stateChanged, {
      accountId: this.account.id,
      connectState,
    })
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null

    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), timeoutMs)
        }),
      ])
    } finally {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }

  async connect(config: {
    headless?: boolean
    storageState?: string
  }): Promise<{ needsLogin: boolean }> {
    try {
      this.isDisconnecting = false
      this.isDisconnected = false
      this.isWaitingForLogin = false
      const headless = config.headless ?? false
      console.log('[BrowserPopup] [AccountSession] connect() called', {
        accountId: this.account.id,
        headless,
        hasStorageState: !!config.storageState,
      })
      this.emitConnectionState({
        status: 'connecting',
        phase: 'preparing',
        error: null,
        session: null,
        lastVerifiedAt: null,
      })
      this.logger.info(`[连接] 使用headless模式: ${headless}`)
      let storageState: StorageState
      if (config.storageState) {
        this.logger.info('检测到已保存登录状态')
        storageState = JSON.parse(config.storageState)
      }

      console.log('[BrowserPopup] [AccountSession] Calling browserManager.createSession()')
      this.emitConnectionState({
        status: 'connecting',
        phase: 'launching_browser',
        error: null,
      })
      this.browserSession = await this.withTimeout(
        browserManager.createSession(headless, storageState),
        BROWSER_LAUNCH_TIMEOUT_MS,
        '启动浏览器超时，请重试',
      )
      console.log(
        `[BrowserPopup] [AccountSession] createSession() returned, browser exists: ${!!this.browserSession?.browser}`,
      )
      this.streamStateDetector.updateBrowserSession(this.browserSession)

      console.log('[BrowserPopup] [AccountSession] Calling ensureAuthenticated()')
      const needsLogin = await this.ensureAuthenticated(this.browserSession, headless)
      console.log(
        `[BrowserPopup] [AccountSession] ensureAuthenticated() returned, needsLogin: ${needsLogin}`,
      )

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

      // 【P0-2 场景D】登录态失效检测 - 监听页面导航
      // 当页面跳转到登录页时，识别为 auth_expired，禁止自动重连
      this.browserSession.page.on('framenavigated', async frame => {
        // 只处理主框架
        if (!frame.parentFrame()) {
          const url = frame.url()
          if (this.isAuthExpired(url)) {
            this.logger.warn(`[auth-check] 检测到登录页跳转，登录态失效，URL: ${url}`)
            emitter.emit('page-closed', { accountId: this.account.id, reason: 'auth_expired' })
          }
        }
      })

      // 【修复】浏览器被外部主动关闭时的处理
      // 添加验证机制，确保只有当前会话有效时才触发断开
      // 【P0-2】区分用户主动关闭和页面崩溃，触发不同重连策略
      this.browserSession.page.on('close', () => {
        if (this.isDisconnecting || this.isDisconnected) {
          this.logger.info(
            `[page-close] 账号 ${this.account.id} 已经在断开中或已断开，忽略重复事件`,
          )
          return
        }
        if (this.browserSession?.page) {
          this.logger.info(`[page-close] 账号 ${this.account.id} 页面关闭`)
          // 【P0-2】判断是用户主动关闭还是异常关闭
          // 如果是用户主动关闭浏览器窗口，reason = 'browser_closed'（禁止重连）
          // 如果是页面崩溃/异常，reason = 'page_crash'（允许重连）
          const closeReason = this.detectCloseReason('page')
          emitter.emit('page-closed', { accountId: this.account.id, reason: closeReason })
        }
      })

      this.browserSession.browser.on('disconnected', () => {
        if (this.isDisconnecting || this.isDisconnected) {
          this.logger.info(
            `[browser-disconnected] 账号 ${this.account.id} 已经在断开中或已断开，忽略重复事件`,
          )
          return
        }
        this.logger.warn(`[browser-disconnected] 账号 ${this.account.id} 浏览器进程已断开`)
        // 【P0-2】浏览器进程断开通常是崩溃或异常
        emitter.emit('page-closed', { accountId: this.account.id, reason: 'page_crash' })
      })
      // 【修复】连接成功后进行健康检查，确保直播状态检测可以正常工作
      this.emitConnectionState({
        status: 'connecting',
        phase: 'verifying_session',
        error: null,
      })
      this.logger.info('[健康检查] 验证直播状态检测功能...')
      const healthCheck = await this.verifyConnectionHealth()
      if (!healthCheck.healthy) {
        this.logger.error(`[健康检查] 失败: ${healthCheck.reason}`)
        throw new Error(`连接健康检查失败: ${healthCheck.reason}`)
      }
      this.logger.success('[健康检查] 通过，直播状态检测功能正常')

      this.emitConnectionState({
        status: 'connected',
        phase: 'streaming',
        error: null,
        lastVerifiedAt: Date.now(),
      })
      this.logger.success('成功与中控台建立连接')

      return { needsLogin }
    } catch (error) {
      const message = this.formatConnectError(error)
      this.logger.error('连接直播控制台失败：', error)
      this.emitConnectionState({
        status: 'error',
        phase: 'error',
        error: message,
        session: null,
        lastVerifiedAt: null,
      })
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
    stopDetector = false,
  ) {
    const accountId = this.account.id

    try {
      // 【关键修复】只有明确要求停止 detector 时才停止（断开中控台时）
      // 关播时必须保持 detector 活跃，以支持后续再次开播检测
      if (stopDetector) {
        this.logger.info(
          `[disconnect][${accountId}] >>> Step 1a: stopping streamStateDetector (stopDetector=true)`,
        )
        this.streamStateDetector.stop()
      } else {
        this.logger.info(
          `[disconnect][${accountId}] >>> Step 1a: NOT stopping streamStateDetector (stopDetector=false), keeping for re-detection`,
        )
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
      this.logger.info(
        `[disconnect][${accountId}] >>> Step 3: stopping ${this.activeTasks.size} active tasks`,
      )
      Array.from(this.activeTasks.values()).forEach((task, index) => {
        const taskType = Array.from(this.activeTasks.keys())[index]
        this.logger.info(
          `[disconnect][${accountId}] >>> Stopping task ${index + 1}/${this.activeTasks.size}: ${taskType}`,
        )
        try {
          task.stop()
        } catch (e) {
          this.logger.warn(
            `[disconnect][${accountId}] >>> Task ${taskType} stop error (ignored):`,
            e,
          )
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
      const shouldEmitErrorState =
        !!reason &&
        !reason.includes('用户主动断开') &&
        !reason.includes('重新连接') &&
        !reason.includes('browser has been closed') &&
        !reason.includes('应用退出')

      // 断开中控台：发送 disconnectedEvent
      this.logger.info(`[disconnect][${accountId}] >>> Step 5: sending disconnectedEvent`)
      this.emitConnectionState({
        status: shouldEmitErrorState ? 'error' : 'disconnected',
        phase: shouldEmitErrorState ? 'error' : 'idle',
        error: reason || null,
        session: null,
        lastVerifiedAt: null,
      })
      windowManager.send(IPC_CHANNELS.tasks.liveControl.disconnectedEvent, accountId, reason)
      accountRuntimeManager.setDisconnected(accountId)
    } else {
      // 关播：只发送 streamStateChanged
      this.logger.info(
        `[disconnect][${accountId}] >>> Step 5: sending streamStateChanged (stream ended, not disconnected)`,
      )
      windowManager.send(IPC_CHANNELS.tasks.liveControl.streamStateChanged, accountId, 'offline')
    }
  }

  /**
   * 关播时调用：只停止任务，不断开中控台，不关闭浏览器，不发送 disconnectedEvent
   *
   * 【P0-1 防护机制】三重防护确保 StreamStateDetector 不被意外停止
   * 符合规范§4.4：关播不停止 StreamStateDetector
   */
  stopForStreamEnded(reason: string) {
    const accountId = this.account.id

    // 【防护1】检查是否已在处理中，防止重复触发
    if (this.isDisconnecting) {
      this.logger.info(`[stopForStreamEnded] 账号 ${accountId} 已在处理中，跳过`)
      return
    }

    // 【防护2】前置检查：确认 detector 正在运行
    if (!this.streamStateDetector.isRunning) {
      this.logger.warn('[stopForStreamEnded] Detector 未运行，尝试重启')
      const restarted = this.streamStateDetector.keepAlive()
      if (!restarted) {
        this.logger.error('[stopForStreamEnded] Detector 重启失败，中止关播处理')
        return
      }
    }

    this.isDisconnecting = true
    this.logger.warn(`[stopForStreamEnded][${accountId}] START, reason: ${reason}`)

    // 【关键】关播时保持 detector 活跃，支持再次开播检测
    // 参数：reason, closeBrowser=false, sendDisconnectEvent=false, stopDetector=false
    this.stopTasksAndUpdateState(reason, false, false, false)

    // 【防护3】后置检查：确认 detector 仍在运行
    if (!this.streamStateDetector.isRunning) {
      this.logger.error('[stopForStreamEnded] Detector 意外停止，立即重启')
      this.streamStateDetector.keepAlive()
    } else {
      this.logger.info('[stopForStreamEnded] Detector 运行正常，继续监控直播状态')
    }

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
    const shouldCloseBrowser = options?.closeBrowser ?? false
    const accountId = this.account.id

    if (this.isDisconnecting || this.isDisconnected) {
      this.logger.info(`[disconnect] 账号 ${accountId} 已经在断开中或已断开，跳过`)
      return
    }

    // 在等待登录阶段，非致命断开不发送 disconnectedEvent
    const isFatalDisconnect =
      reason?.includes('browser has been closed') ||
      reason?.includes('应用退出') ||
      shouldCloseBrowser

    if (this.isWaitingForLogin && !isFatalDisconnect) {
      this.logger.info(
        `[disconnect][${accountId}] 等待登录阶段，忽略非致命断开: ${reason || '无原因'}`,
      )
      this.isWaitingForLogin = false
      return
    }

    this.isDisconnecting = true
    this.isDisconnected = true
    this.isWaitingForLogin = false
    const disconnectReason = reason || '与中控台断开连接'

    this.logger.warn(
      `[disconnect][${accountId}] START disconnect, reason: ${disconnectReason}, closeBrowser: ${shouldCloseBrowser}`,
    )
    this.logger.warn(`[disconnect][${accountId}] activeTasks count: ${this.activeTasks.size}`)

    // 断开中控台时停止 detector
    this.stopTasksAndUpdateState(disconnectReason, shouldCloseBrowser, true, true)

    this.isDisconnecting = false
    this.logger.warn(`[disconnect][${accountId}] END`)
  }

  private async ensureAuthenticated(
    session: BrowserSession,
    headless = true,
    loginRequired = false,
  ): Promise<boolean> {
    this.browserSession = session
    this.streamStateDetector.updateBrowserSession(session)
    this.emitConnectionState({
      status: 'connecting',
      phase: 'verifying_session',
      error: null,
    })
    const isConnected = await this.withTimeout(
      this.platform.connect(this.browserSession),
      SESSION_VERIFY_TIMEOUT_MS,
      '连接校验超时，请重试',
    )
    // 未登录，需要等待登录
    if (!isConnected) {
      // 【修复】标记正在等待登录
      this.isWaitingForLogin = true
      this.logger.info('[ensureAuthenticated] 设置 isWaitingForLogin = true')

      // 无头模式，需要先关闭原先的无头模式，启用有头模式给用户登录
      if (headless) {
        await this.browserSession.browser.close()
        this.logger.info('需要登录，请在打开的浏览器中登录')
        this.emitConnectionState({
          status: 'connecting',
          phase: 'launching_browser',
          error: null,
        })
        this.browserSession = await this.withTimeout(
          browserManager.createSession(false),
          BROWSER_LAUNCH_TIMEOUT_MS,
          '启动登录浏览器超时，请重试',
        )
      }
      this.emitConnectionState({
        status: 'connecting',
        phase: 'waiting_for_login',
        error: null,
      })
      // 等待登录
      await this.withTimeout(
        this.platform.login(this.browserSession),
        LOGIN_TIMEOUT_MS,
        '登录超时，请检查是否已完成扫码登录',
      )

      // 【修复】登录成功，清除等待登录标记
      this.isWaitingForLogin = false
      this.logger.info('[ensureAuthenticated] 设置 isWaitingForLogin = false（登录成功）')

      // 【修复】登录后 page 可能被替换，需要更新 streamStateDetector
      this.streamStateDetector.updateBrowserSession(this.browserSession)
      // 保存登录状态
      const storageState = await this.browserSession.context.storageState()
      // 无头模式，需要先关闭当前的有头模式，重新打开无头模式
      if (headless) {
        await this.browserSession.browser.close()
        this.logger.info('登录成功，浏览器将继续以无头模式运行')
        this.emitConnectionState({
          status: 'connecting',
          phase: 'launching_browser',
          error: null,
        })
        this.browserSession = await this.withTimeout(
          browserManager.createSession(headless, storageState),
          BROWSER_LAUNCH_TIMEOUT_MS,
          '恢复无头浏览器超时，请重试',
        )
        this.streamStateDetector.updateBrowserSession(this.browserSession)
      }
      // 【修复】递归调用后返回结果，确保 needsLogin 状态正确
      return await this.ensureAuthenticated(this.browserSession, headless, true)
    }
    return loginRequired
  }

  private formatConnectError(error: unknown) {
    if (error instanceof Error) {
      const errorMessage = error.message || error.name || ''
      if (
        errorMessage.includes('Target page, context or browser has been closed') ||
        errorMessage.includes('browser has been closed') ||
        errorMessage.includes('page has been closed')
      ) {
        return 'browser has been closed'
      }
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        return '连接超时，请检查网络后重试'
      }
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
    const existingTask = this.activeTasks.get(task.type)
    if (existingTask) {
      if (existingTask.isRunning()) {
        this.logger.info(
          `[startTask][${this.account.id}] Task ${task.type} already running, reusing existing instance`,
        )
        if (task.config && existingTask.updateConfig) {
          const updateResult = existingTask.updateConfig(task.config as never)
          if (Result.isFailure(updateResult)) {
            return updateResult
          }
        }
        return Result.succeed()
      }

      this.logger.warn(
        `[startTask][${this.account.id}] Found stale task instance for ${task.type}, replacing it`,
      )
      this.activeTasks.delete(task.type)
    }

    const newTask = makeTask(task, this.platform, this.account, this.logger)
    if (Result.isFailure(newTask)) {
      return newTask
    }

    // 【P0修复】先启动任务，确认真正运行成功后才登记到 activeTasks
    await newTask.value.start()

    // 【P0修复】显式确认任务真实运行中，才允许登记 activeTasks
    if (!newTask.value.isRunning()) {
      this.logger.error(
        `[startTask][${this.account.id}] Task ${task.type} failed to start: isRunning() returned false after start()`,
      )
      return Result.fail(new Error(`任务 ${task.type} 启动失败：任务未进入运行状态`))
    }

    // 注册到运行时监控
    taskRuntimeMonitor.registerTask(this.account.id, task.type)

    // 任务停止时从任务列表中移除
    newTask.value.addStopListener(() => {
      this.activeTasks.delete(task.type)
      taskRuntimeMonitor.unregisterTask(`${this.account.id}:${task.type}`)
    })

    // 【P0修复】确认任务真正运行后才登记到 activeTasks
    this.activeTasks.set(task.type, newTask.value)

    // 输出当前统计
    const stats = taskRuntimeMonitor.getStatistics()
    this.logger.info(
      `[startTask][${this.account.id}] Task ${task.type} started successfully, running tasks: ${stats.runningTasks}, timers: ${stats.activeTimers}, listeners: ${stats.activeListeners}`,
    )

    return Result.succeed()
  }

  public stopTask(taskType: LiveControlTask['type']) {
    const task = this.activeTasks.get(taskType)
    if (task) {
      // 【Phase 2B-2】幂等性检查：如果任务已经停止，不再重复调用 stop
      if (!task.isRunning()) {
        this.logger.info(
          `[stopTask][${this.account.id}] Task ${taskType} is already stopped (isRunning=false), skipping stop call`,
        )
        // 确保从 activeTasks 中移除（防止残留）
        this.activeTasks.delete(taskType)
        return
      }

      this.logger.info(`[stopTask][${this.account.id}] Stopping task ${taskType}...`)
      task.stop()

      // 输出清理后的统计
      const stats = taskRuntimeMonitor.getStatistics()
      this.logger.info(
        `[stopTask][${this.account.id}] Task ${taskType} stopped, running tasks: ${stats.runningTasks}, timers: ${stats.activeTimers}, listeners: ${stats.activeListeners}`,
      )
    } else {
      // 【Phase 2B-2】幂等性：任务不存在视为已停止，不报错
      this.logger.info(
        `[stopTask][${this.account.id}] Task ${taskType} not found in activeTasks, considering already stopped`,
      )
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
      const isLiveRoomUrl = this.isSupportedLiveRoomUrl(currentUrl)

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

      return {
        success: false,
        error: '当前不在直播间页面，也无法提取到真实可访问的直播间链接',
      }
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
      const candidateUrls = new Set<string>()
      const pushCandidate = (value?: string | null) => {
        const normalized = this.normalizeLiveRoomUrl(value, page.url())
        if (normalized) {
          candidateUrls.add(normalized)
        }
      }

      // 方法1：当前 URL / URL 参数里已经有网页直播 ID
      const currentUrl = page.url()
      pushCandidate(currentUrl)

      const urlObj = new URL(currentUrl)
      for (const key of ['web_rid', 'webRid', 'webcast_id', 'webcastId']) {
        const webcastId = urlObj.searchParams.get(key)
        if (webcastId) {
          pushCandidate(this.buildDouyinLiveUrl(webcastId))
        }
      }

      // 方法2：从 DOM 中收集真实链接，优先使用页面上已有的直播间跳转地址
      const pageSignals = await page.evaluate(() => {
        const hrefs = Array.from(document.querySelectorAll('a[href]'))
          .map(anchor => anchor.getAttribute('href') || anchor.getAttribute('data-href') || '')
          .filter(Boolean)

        const scriptText = Array.from(document.querySelectorAll('script'))
          .map(script => script.textContent || '')
          .filter(Boolean)
          .join('\n')

        return { hrefs, scriptText }
      })

      pageSignals.hrefs.forEach(href => pushCandidate(href))

      // 方法3：从 HTML / 内联脚本中提取真实直播 URL 或网页直播 ID
      const pageContent = `${(await page.content()).replace(/\\\//g, '/')}\n${pageSignals.scriptText}`

      const directLiveUrlMatches = pageContent.match(
        /https?:\/\/live\.douyin\.com\/[A-Za-z0-9_-]+/g,
      )
      directLiveUrlMatches?.forEach(match => pushCandidate(match))

      const protocolLessLiveUrlMatches = pageContent.match(
        /(?<!https?:\/\/)live\.douyin\.com\/[A-Za-z0-9_-]+/g,
      )
      protocolLessLiveUrlMatches?.forEach(match => pushCandidate(match))

      for (const pattern of [
        /"(?:web_rid|webRid|webcast_id|webcastId)"\s*:\s*"([A-Za-z0-9_-]+)"/g,
        /(?:web_rid|webRid|webcast_id|webcastId)\s*[:=]\s*"([A-Za-z0-9_-]+)"/g,
      ]) {
        for (const match of pageContent.matchAll(pattern)) {
          pushCandidate(this.buildDouyinLiveUrl(match[1]))
        }
      }

      // 只接受真实可访问的网页直播地址，不再把 room_id 直接拼成 live.douyin.com/{id}
      for (const candidate of candidateUrls) {
        if (this.isSupportedLiveRoomUrl(candidate)) {
          this.logger.info(`识别到直播间链接候选: ${candidate}`)
          return candidate
        }
      }

      this.logger.warn(
        `未从页面中提取到真实直播间 URL；已跳过 room_id 直拼逻辑，候选数=${candidateUrls.size}`,
      )
      return null
    } catch (error) {
      this.logger.error('提取直播间 URL 失败:', error)
      return null
    }
  }

  private buildDouyinLiveUrl(webcastId: string): string {
    return `https://live.douyin.com/${webcastId}`
  }

  private normalizeLiveRoomUrl(rawUrl?: string | null, baseUrl?: string): string | null {
    if (!rawUrl) return null

    let value = rawUrl.trim()
    if (!value) return null

    if (value.startsWith('//')) {
      value = `https:${value}`
    } else if (/^(live\.douyin\.com|live\.kuaishou\.com)\//i.test(value)) {
      value = `https://${value}`
    }

    try {
      const url = baseUrl ? new URL(value, baseUrl) : new URL(value)
      if (!['http:', 'https:'].includes(url.protocol)) return null
      url.hash = ''
      return url.toString()
    } catch {
      return null
    }
  }

  private isSupportedLiveRoomUrl(rawUrl: string): boolean {
    try {
      const url = new URL(rawUrl)
      const href = url.toString()
      const host = url.hostname.toLowerCase()
      const path = url.pathname.replace(/\/+$/, '')

      if (
        href.includes('dashboard') ||
        href.includes('control') ||
        href.includes('compass') ||
        href.includes('buyin.jinritemai.com')
      ) {
        return false
      }

      if (host === 'live.douyin.com' || host === 'live.kuaishou.com') {
        return path.length > 1
      }

      return path.includes('/live/')
    } catch {
      return false
    }
  }

  /**
   * 【P0-2 断线自动重连】检测页面关闭原因
   * 区分用户主动关闭和异常关闭
   *
   * @param source 关闭来源：'page' | 'browser'
   * @returns ReconnectReason 重连原因类型
   */
  private detectCloseReason(source: 'page' | 'browser'): ReconnectReason {
    // 【P0-2 断线自动重连】严格按规范区分用户关闭和异常断开
    //
    // 用户主动关闭浏览器的特征：
    // - page.on('close') 触发（用户关闭标签页或浏览器）
    // - browser.on('disconnected') 触发（浏览器进程退出）
    //
    // 页面崩溃的特征：
    // - page.on('crash') 触发
    // - 需要通过其他异常检测机制判断

    if (source === 'page') {
      // page.on('close') 通常是用户主动关闭标签页
      // 按规范§2.3：用户关闭浏览器应禁止自动重连
      return 'browser_closed'
    }

    if (source === 'browser') {
      // browser.on('disconnected') 通常是用户关闭整个浏览器
      return 'browser_closed'
    }

    // 默认情况（不应该发生）
    return 'page_crash'
  }

  /**
   * 【P0-2 断线自动重连】执行重连
   *
   * @param reason 重连原因
   * @returns 是否重连成功
   */
  async reconnect(reason: ReconnectReason): Promise<boolean> {
    const accountId = this.account.id

    this.logger.info(`[reconnect][${accountId}] START, reason=${reason}`)

    // 检查是否允许重连
    if (!reconnectManager.shouldReconnect(reason)) {
      this.logger.info(`[reconnect][${accountId}] 不允许重连: ${reason}`)
      return false
    }

    // 执行重连
    const result = await reconnectManager.attemptReconnect(accountId, reason, async () => {
      try {
        // 尝试重新连接
        this.logger.info(`[reconnect][${accountId}] 尝试重新连接...`)

        // 清理现有状态
        this.isDisconnecting = false
        this.isDisconnected = false

        // 重新连接（使用已有登录态）
        const { needsLogin } = await this.connect({ headless: true })

        if (needsLogin) {
          this.logger.warn(`[reconnect][${accountId}] 需要重新登录，重连失败`)
          return false
        }

        this.logger.success(`[reconnect][${accountId}] 重连成功`)

        // 通知前端重连成功
        windowManager.send(IPC_CHANNELS.tasks.liveControl.reconnectedEvent, accountId, {
          success: true,
        })

        return true
      } catch (error) {
        this.logger.error(`[reconnect][${accountId}] 重连失败:`, error)
        return false
      }
    })

    this.logger.info(`[reconnect][${accountId}] END, result=${result}`)

    // 如果重连最终失败，通知前端
    if (result === 'failed') {
      windowManager.send(IPC_CHANNELS.tasks.liveControl.reconnectFailedEvent, accountId, {
        reason,
        message: '自动重连失败，请手动重新连接',
      })
    }

    return result === 'success'
  }

  /**
   * 【P0-2 场景D】检测登录态是否失效
   * 通过检测URL是否跳转到登录页来判断
   *
   * @param url 当前页面URL
   * @returns 是否已失效（跳转到登录页）
   */
  private isAuthExpired(url: string): boolean {
    // 各平台登录页特征（基于 platformConfig.ts 中的配置）
    const loginPatterns: Record<string, RegExp[]> = {
      douyin: [
        /passport\.jinritemai\.com/, // 抖音登录域名
        /fxg\.jinritemai\.com\/login/, // 抖音小店登录页
      ],
      buyin: [
        /passport\.jinritemai\.com/, // 巨量百应登录域名
        /buyin\.jinritemai\.com\/login/, // 巨量百应登录页
      ],
      eos: [
        /passport\.jinritemai\.com/, // 罗盘登录域名
        /compass\.jinritemai\.com\/login/, // 罗盘登录页
      ],
      xiaohongshu: [
        /www\.xiaohongshu\.com\/login/, // 小红书主站登录
        /ark\.xiaohongshu\.com\/login/, // 千帆登录页
      ],
      pgy: [
        /www\.xiaohongshu\.com\/login/, // 小红书主站登录
        /pgy\.xiaohongshu\.com\/login/, // 蒲公英登录页
      ],
      wxchannel: [
        /channels\.weixin\.qq\.com\/login/, // 视频号登录页
        /mp\.weixin\.qq\.com\/login/, // 公众号登录页
      ],
      kuaishou: [
        /passport\.kuaishou\.com/, // 快手登录域名
        /live\.kuaishou\.com\/login/, // 快手直播登录页
      ],
      taobao: [
        /login\.taobao\.com/, // 淘宝登录页
        /login\.m\.taobao\.com/, // 淘宝移动端登录
      ],
    }

    const platform = this.account.platform
    if (!platform) {
      this.logger.warn(`[isAuthExpired] 账号 ${this.account.id} 未设置平台`)
      return false
    }
    const patterns = loginPatterns[platform]

    if (!patterns) {
      this.logger.warn(`[isAuthExpired] 未知平台: ${platform}，无法检测登录态`)
      return false
    }

    const isLoginPage = patterns.some((pattern: RegExp) => pattern.test(url))

    if (isLoginPage) {
      this.logger.info(`[isAuthExpired] 平台 ${platform} 匹配到登录页: ${url}`)
    }

    return isLoginPage
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
