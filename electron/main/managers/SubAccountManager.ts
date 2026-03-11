import { Result } from '@praha/byethrow'
import type { Browser, BrowserContext, Page } from 'playwright'
import { createLogger } from '#/logger'
import { browserManager, type StorageState } from '#/managers/BrowserSessionManager'
import type { IPerformComment, IPlatform } from '#/platforms/IPlatform'
import { SUB_ACCOUNT_PLATFORM_CONFIGS } from '#/platforms/sub-account/SimpleCommentPlatform'

const logger = createLogger('SubAccountManager')
// 版本标记：支持二次验证的登录流程 v2.1 - 添加轮询检测

export type SubAccountStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface SubAccountStats {
  totalSent: number
  successCount: number
  failCount: number
  lastSendTime?: number
  lastError?: string
}

export interface SubAccountSession {
  id: string
  name: string
  platform: LiveControlPlatform
  status: SubAccountStatus
  browser?: Browser
  context?: BrowserContext
  page?: Page
  platformInstance?: IPlatform & IPerformComment
  error?: string
  stats: SubAccountStats
  storageState?: string
  liveRoomUrl?: string
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
]

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
]

class SubAccountManager {
  private sessions: Map<string, SubAccountSession> = new Map()
  private healthCheckInterval?: ReturnType<typeof setInterval>
  private readonly HEALTH_CHECK_INTERVAL = 30 * 1000
  /** 每小号发送锁，避免定时任务与一键刷屏并发操作同一页面 */
  private sendLocks: Map<string, Promise<void>> = new Map()
  /** 状态变更回调 */
  private onStatusChangeCallbacks: Array<
    (accountId: string, status: SubAccountStatus, error?: string) => void
  > = []
  /** 登录轮询定时器追踪，防止内存泄露 */
  private loginPollTimers: Map<string, NodeJS.Timeout> = new Map()
  /** 标记是否已清理，防止重复清理 */
  private isCleanedUp = false

  constructor() {
    this.startHealthCheck()

    // 监听进程退出信号，确保清理资源
    process.on('exit', () => {
      this.cleanup()
    })

    // 处理 SIGINT (Ctrl+C) 和 SIGTERM
    process.on('SIGINT', () => {
      console.log('[SubAccountManager] 收到 SIGINT，开始清理...')
      this.cleanup().then(() => {
        process.exit(0)
      })
    })

    process.on('SIGTERM', () => {
      console.log('[SubAccountManager] 收到 SIGTERM，开始清理...')
      this.cleanup().then(() => {
        process.exit(0)
      })
    })
  }

  /**
   * 注册状态变更回调
   */
  onStatusChange(
    callback: (accountId: string, status: SubAccountStatus, error?: string) => void,
  ): void {
    this.onStatusChangeCallbacks.push(callback)
  }

  /**
   * 通知状态变更
   */
  private notifyStatusChange(accountId: string, status: SubAccountStatus, error?: string): void {
    for (const callback of this.onStatusChangeCallbacks) {
      try {
        callback(accountId, status, error)
      } catch (e) {
        logger.error('状态变更回调执行失败:', e)
      }
    }
  }

  private startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck()
    }, this.HEALTH_CHECK_INTERVAL)
  }

  private async performHealthCheck() {
    for (const session of this.sessions.values()) {
      if (session.status !== 'connected') continue
      try {
        if (!session.page) continue
        if (session.page.isClosed()) {
          logger.warn(`小号 ${session.name} 页面已关闭，标记为断开`)
          await this.cleanupSession(session)
          session.status = 'error'
          session.error = '页面已关闭'
          this.notifyStatusChange(session.id, 'error', '页面已关闭')
          continue
        }
        await session.page.title()
      } catch (error) {
        logger.error(`小号 ${session.name} 健康检查失败:`, error)
        session.status = 'error'
        session.error = '连接异常，请重新登录'
        this.notifyStatusChange(session.id, 'error', '连接异常，请重新登录')
        await this.cleanupSession(session)
      }
    }
  }

  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }
  }

  addAccount(config: SubAccountConfig): Result.Result<SubAccountSession, Error> {
    if (this.sessions.has(config.id)) {
      return Result.fail(new Error(`小号 ${config.name} 已存在`))
    }

    const session: SubAccountSession = {
      id: config.id,
      name: config.name,
      platform: config.platform,
      status: 'idle',
      stats: {
        totalSent: 0,
        successCount: 0,
        failCount: 0,
      },
    }

    this.sessions.set(config.id, session)
    logger.info(`添加小号: ${config.name} (${config.platform})`)
    return Result.succeed(session)
  }

  async removeAccount(accountId: string): Promise<void> {
    const session = this.sessions.get(accountId)
    if (!session) return

    // 先停止登录轮询
    this.stopLoginPolling(accountId)

    await this.cleanupSession(session)
    session.status = 'idle'
    session.error = undefined
    this.notifyStatusChange(session.id, 'idle')
    this.sessions.delete(accountId)
    logger.info(`移除小号：${session.name}`)
  }

  private getPlatformConfig(platform: LiveControlPlatform) {
    return SUB_ACCOUNT_PLATFORM_CONFIGS[platform] ?? SUB_ACCOUNT_PLATFORM_CONFIGS.douyin
  }

  private getPlatformHomeUrl(platform: LiveControlPlatform): string {
    return this.getPlatformConfig(platform).loginUrl
  }

  private getLoggedInSelector(platform: LiveControlPlatform): string {
    return this.getPlatformConfig(platform).loggedInSelector
  }

  async connectAccount(
    accountId: string,
    headless = true,
    _timeoutMs = 5 * 60 * 1000,
  ): Promise<Result.Result<SubAccountSession, Error>> {
    const session = this.sessions.get(accountId)
    if (!session) {
      return Result.fail(new Error('小号不存在'))
    }

    if (session.status === 'connected') {
      return Result.succeed(session)
    }

    if (session.status === 'connecting') {
      // 通过检查浏览器实例是否仍存活来判断是否真的在连接中
      const hasActiveBrowser = session.browser?.isConnected?.() ?? false
      if (!hasActiveBrowser) {
        logger.warn(`小号 ${session.name} 连接状态异常，重置为空闲状态`)
        session.status = 'idle'
        session.error = undefined
        this.notifyStatusChange(session.id, 'idle')
        await this.cleanupSession(session)
      } else {
        return Result.fail(new Error('小号正在连接中，请稍候'))
      }
    }

    session.status = 'connecting'
    session.error = undefined
    this.notifyStatusChange(session.id, 'connecting')

    try {
      let storageState: StorageState | undefined
      if (session.storageState) {
        try {
          storageState = JSON.parse(session.storageState)
          logger.info(`小号 ${session.name} 使用保存的登录状态`)
        } catch {
          logger.warn(`小号 ${session.name} 登录状态解析失败，将重新登录`)
        }
      }

      const browserSession = await browserManager.createSession(headless, storageState)
      const { browser, context, page } = browserSession

      const viewport = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)]
      await page.setViewportSize(viewport)

      const _userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false })
      })

      session.browser = browser
      session.context = context
      session.page = page

      const homeUrl = this.getPlatformHomeUrl(session.platform)
      const loggedInSelector = this.getLoggedInSelector(session.platform)

      logger.info(`小号 ${session.name} 正在登录 ${session.platform} 主站...`)

      // 使用更长的超时时间，并允许页面加载不完全（load 而非 networkidle）
      // 这样可以更快进入页面，让用户看到登录界面
      try {
        await page.goto(homeUrl, { waitUntil: 'load', timeout: 30000 })
      } catch (_gotoError) {
        // 页面加载超时，但可能页面已经可用，继续尝试
        logger.warn(`小号 ${session.name} 页面加载超时，继续检查登录状态`)
      }

      // 等待页面稳定（网络空闲）
      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 })
      } catch {
        // 忽略网络空闲超时
      }

      const isAlreadyLoggedIn = await page
        .$(loggedInSelector)
        .then(el => !!el)
        .catch(() => false)

      if (isAlreadyLoggedIn) {
        logger.info(`小号 ${session.name} 已登录`)
        // 【关键】已登录的情况下，直接设置状态为 connected
        session.status = 'connected'
        this.notifyStatusChange(session.id, 'connected')
      } else {
        logger.info(`小号 ${session.name} 等待用户登录（支持二次验证）...`)

        // 先尝试快速等待登录（30 秒内）
        const quickLoginSuccess = await page
          .waitForSelector(loggedInSelector, { timeout: 30000 })
          .then(() => true)
          .catch(() => false)

        if (quickLoginSuccess) {
          logger.success(`小号 ${session.name} 登录成功`)
          // 【关键】快速登录成功，立即更新状态
          session.status = 'connected'
          this.notifyStatusChange(session.id, 'connected')
        } else {
          // 快速登录失败，检查是否实际已登录成功
          const currentUrl = page.url()
          const pageTitle = await page.title().catch(() => '')

          logger.info(`小号 ${session.name} 当前 URL: ${currentUrl}`)
          logger.info(`小号 ${session.name} 当前标题：${pageTitle}`)

          // 【关键】多种方式检测是否已登录
          // 1. 检测 loggedInSelector
          const recheckLoggedIn = await page
            .$(loggedInSelector)
            .then(el => !!el)
            .catch(() => false)

          // 2. 检测 URL 是否已跳转到主站页面（非登录页面）
          // 只要是在 douyin.com 主站下（非登录页），就说明已登录
          const isOnMainPage =
            !currentUrl.includes('login') &&
            !currentUrl.includes('passport') &&
            !currentUrl.includes('signin') &&
            !currentUrl.includes('auth') &&
            // 抖音主站
            (currentUrl.startsWith('https://www.douyin.com/') ||
              // 小红书主站
              currentUrl.startsWith('https://www.xiaohongshu.com/') ||
              // 快手主站
              currentUrl.startsWith('https://www.kuaishou.com/') ||
              // 淘宝主站
              currentUrl.startsWith('https://www.taobao.com/') ||
              // 视频号
              currentUrl.includes('weixin.qq.com'))

          // 3. 检测是否存在登录按钮（如果不存在登录按钮，说明已登录）
          const hasLoginButton = await page
            .$('button[class*="login"], [class*="login-button"], [data-e2e="login-button"]')
            .then(el => !!el)
            .catch(() => false)

          const isActuallyLoggedIn = recheckLoggedIn || (isOnMainPage && !hasLoginButton)

          logger.info(
            `小号 ${session.name} 登录检测结果：loggedInSelector=${recheckLoggedIn}, isOnMainPage=${isOnMainPage}, hasLoginButton=${hasLoginButton}`,
          )

          if (isActuallyLoggedIn) {
            logger.success(`小号 ${session.name} 检测到已登录（页面已跳转到首页）`)
            session.status = 'connected'
            this.notifyStatusChange(session.id, 'connected')
          } else {
            // 确实未登录，检查是否需要二次验证
            const isInLoginFlow =
              currentUrl.includes('login') ||
              currentUrl.includes('auth') ||
              currentUrl.includes('passport') ||
              currentUrl.includes('signin') ||
              pageTitle.includes('登录') ||
              pageTitle.includes('Login')

            logger.info(`小号 ${session.name} 是否在登录流程中：${isInLoginFlow}`)

            if (isInLoginFlow) {
              logger.warn(`小号 ${session.name} 可能需要二次验证，启动后台轮询检测...`)
              session.status = 'connecting'
              session.error = '等待二次验证，请在浏览器中完成验证'
              this.notifyStatusChange(
                session.id,
                'connecting',
                '等待二次验证，请在浏览器中完成验证',
              )

              // 启动后台轮询检测登录状态
              this.startLoginPolling(session, loggedInSelector)

              // 返回连接中状态，让前端知道正在等待
              return Result.succeed(session)
            }

            // 不在登录流程中，可能是其他错误
            throw new Error('登录超时，请检查网络或账号状态')
          }
        }
      }

      session.status = 'connected'
      this.notifyStatusChange(session.id, 'connected')

      try {
        const newStorageState = await context.storageState()
        session.storageState = JSON.stringify(newStorageState)
        logger.info(`小号 ${session.name} 登录状态已保存`)
      } catch (error) {
        logger.warn(`小号 ${session.name} 保存登录状态失败:`, error)
      }

      logger.success(`小号连接成功: ${session.name}（观众身份）`)
      return Result.succeed(session)
    } catch (error) {
      // 只有在不是二次验证的情况下才清理会话
      if (session.status !== 'connecting') {
        await this.cleanupSession(session)
        session.status = 'error'
        this.notifyStatusChange(
          session.id,
          'error',
          error instanceof Error ? error.message : '登录超时或失败',
        )
      }
      session.error = error instanceof Error ? error.message : '登录超时或失败'
      logger.error(`小号连接失败: ${session.name}`, error)
      return Result.fail(error instanceof Error ? error : new Error('连接失败'))
    }
  }

  private async cleanupSession(session: SubAccountSession): Promise<void> {
    try {
      await session.platformInstance?.disconnect()
    } catch (error) {
      logger.error(`清理平台实例失败：${session.name}`, error)
    }
    try {
      await session.context?.close()
    } catch (error) {
      logger.error(`关闭浏览器上下文失败：${session.name}`, error)
    }
    try {
      await session.browser?.close()
    } catch (error) {
      logger.error(`关闭浏览器实例失败：${session.name}`, error)
    }
    session.browser = undefined
    session.context = undefined
    session.page = undefined
    session.platformInstance = undefined

    // 清理登录轮询定时器
    this.stopLoginPolling(session.id)
  }

  /**
   * 停止登录轮询检测
   */
  private stopLoginPolling(accountId: string): void {
    const timer = this.loginPollTimers.get(accountId)
    if (timer) {
      clearTimeout(timer)
      this.loginPollTimers.delete(accountId)
      logger.info(`小号 ${accountId} 登录轮询已停止`)
    }
  }

  /**
   * 启动登录状态轮询检测
   * 当用户需要二次验证时，后台轮询检测用户何时完成登录
   */
  private startLoginPolling(session: SubAccountSession, loggedInSelector: string): void {
    // 清除旧的定时器，防止重复创建
    this.stopLoginPolling(session.id)

    const POLL_INTERVAL = 3000 // 每 3 秒检测一次
    const MAX_POLL_TIME = 5 * 60 * 1000 // 最多轮询 5 分钟

    let pollCount = 0
    const maxPolls = MAX_POLL_TIME / POLL_INTERVAL

    const poll = async () => {
      if (session.status !== 'connecting') {
        logger.info(`小号 ${session.name} 状态已改变，停止轮询`)
        this.stopLoginPolling(session.id)
        return
      }

      pollCount++
      if (pollCount > maxPolls) {
        logger.warn(`小号 ${session.name} 登录轮询超时`)
        session.status = 'error'
        session.error = '登录验证超时，请重新尝试'
        this.notifyStatusChange(session.id, 'error', '登录验证超时，请重新尝试')
        await this.cleanupSession(session)
        this.stopLoginPolling(session.id)
        return
      }

      try {
        if (!session.page || session.page.isClosed()) {
          logger.warn(`小号 ${session.name} 页面已关闭，停止轮询`)
          session.status = 'error'
          session.error = '登录页面已关闭'
          this.notifyStatusChange(session.id, 'error', '登录页面已关闭')
          this.stopLoginPolling(session.id)
          return
        }

        // 检测是否已登录
        const isLoggedIn = await session.page
          .$(loggedInSelector)
          .then(el => !!el)
          .catch(() => false)

        if (isLoggedIn) {
          logger.success(`小号 ${session.name} 轮询检测到登录成功`)
          session.status = 'connected'
          session.error = undefined

          // 【关键】先保存状态再发送事件，确保状态一致性
          try {
            const newStorageState = session.context
              ? await session.context.storageState()
              : undefined
            if (newStorageState) session.storageState = JSON.stringify(newStorageState)
            logger.info(`小号 ${session.name} 登录状态已保存`)
          } catch (error) {
            logger.warn(`小号 ${session.name} 保存登录状态失败:`, error)
          }

          // 通知前端状态变更
          this.notifyStatusChange(session.id, 'connected')
          logger.success(`小号连接成功：${session.name}（观众身份），已停止轮询`)

          this.stopLoginPolling(session.id)
          return
        }

        // 继续轮询
        const timer = setTimeout(poll, POLL_INTERVAL)
        this.loginPollTimers.set(session.id, timer)
      } catch (error) {
        logger.error(`小号 ${session.name} 轮询检测出错:`, error)
        const timer = setTimeout(poll, POLL_INTERVAL)
        this.loginPollTimers.set(session.id, timer)
      }
    }

    // 启动轮询
    const timer = setTimeout(poll, POLL_INTERVAL)
    this.loginPollTimers.set(session.id, timer)
    logger.info(`小号 ${session.name} 启动登录状态轮询检测`)
  }

  async disconnectAccount(accountId: string): Promise<void> {
    const session = this.sessions.get(accountId)
    if (!session) return

    await this.cleanupSession(session)
    session.status = 'idle'
    session.error = undefined
    this.notifyStatusChange(session.id, 'idle')
  }

  getAllAccounts(): SubAccountSession[] {
    return Array.from(this.sessions.values())
  }

  getConnectedAccounts(): SubAccountSession[] {
    return this.getAllAccounts().filter(s => s.status === 'connected')
  }

  getAccount(accountId: string): SubAccountSession | undefined {
    return this.sessions.get(accountId)
  }

  private getLiveRoomSelectors(platform: LiveControlPlatform): {
    inputSelector: string
    sendButtonSelector: string
    sendMethod: 'click' | 'enter'
  } {
    const cfg = this.getPlatformConfig(platform)
    return {
      inputSelector: cfg.commentInputSelector,
      sendButtonSelector: cfg.sendButtonSelector,
      sendMethod: cfg.sendMethod ?? 'click',
    }
  }

  async enterLiveRoom(
    accountId: string,
    liveRoomUrl: string,
  ): Promise<Result.Result<boolean, Error>> {
    const session = this.sessions.get(accountId)
    if (!session) {
      return Result.fail(new Error('小号不存在'))
    }

    // 【关键】如果处于 connecting 状态，检查是否已经完成验证但未更新状态
    if (session.status === 'connecting' && session.page && !session.page.isClosed()) {
      // 尝试检测一次登录状态，避免状态同步延迟
      try {
        const loggedInSelector = this.getLoggedInSelector(session.platform)
        const isLoggedIn = await session.page
          .$(loggedInSelector)
          .then(el => !!el)
          .catch(() => false)

        if (isLoggedIn) {
          logger.info(`小号 ${session.name} 进入直播间前检测到登录成功，更新状态`)
          session.status = 'connected'
          session.error = undefined
          this.notifyStatusChange(session.id, 'connected')
        }
      } catch (checkError) {
        logger.warn(`小号 ${session.name} 登录状态检查失败:`, checkError)
      }
    }

    if (session.status !== 'connected' || !session.page) {
      logger.warn(
        `小号 ${session.name} 状态检查失败：status=${session.status}, hasPage=${!!session.page}`,
      )
      return Result.fail(new Error('小号未连接'))
    }

    try {
      logger.info(`小号 ${session.name} 正在进入直播间：${liveRoomUrl}`)

      // 导航到直播间页面
      await session.page.goto(liveRoomUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      // 等待页面主体加载完成
      await session.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        logger.warn(`小号 ${session.name} 页面网络空闲等待超时，继续检测评论框`)
      })

      const selectors = this.getLiveRoomSelectors(session.platform)

      // 尝试等待评论输入框出现（多次重试）
      let inputFound = false
      const maxRetries = 3
      for (let i = 0; i < maxRetries && !inputFound; i++) {
        try {
          await session.page.waitForSelector(selectors.inputSelector, {
            timeout: 15000,
            state: 'visible',
          })
          inputFound = true
        } catch (_e) {
          logger.warn(`小号 ${session.name} 第 ${i + 1} 次等待评论框超时`)

          // 尝试滚动页面，可能评论框在底部
          if (i < maxRetries - 1) {
            await session.page
              .evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight)
              })
              .catch(() => {})
            await new Promise(r => setTimeout(r, 2000))
          }
        }
      }

      if (!inputFound) {
        // 最后一次尝试：检查是否已经在直播间页面（URL 匹配）
        const currentUrl = session.page.url()
        if (currentUrl.includes('live.douyin.com') || currentUrl.includes('live.kuaishou.com')) {
          logger.info(`小号 ${session.name} 已在直播间页面，跳过评论框检测`)
        } else {
          throw new Error('等待评论输入框超时，可能直播间未开播或页面加载异常')
        }
      }

      session.liveRoomUrl = liveRoomUrl
      logger.success(`小号 ${session.name} 已进入直播间`)
      return Result.succeed(true)
    } catch (error) {
      logger.error(`小号 ${session.name} 进入直播间失败`, error)
      return Result.fail(error instanceof Error ? error : new Error('进入直播间失败'))
    }
  }

  async sendComment(accountId: string, message: string): Promise<Result.Result<boolean, Error>> {
    const session = this.sessions.get(accountId)
    if (!session) {
      return Result.fail(new Error('小号不存在'))
    }

    if (session.status !== 'connected' || !session.page) {
      return Result.fail(new Error('小号未连接'))
    }

    if (!session.liveRoomUrl) {
      return Result.fail(new Error('小号尚未进入直播间，请先设置直播间地址'))
    }

    const prevLock = this.sendLocks.get(accountId) ?? Promise.resolve()
    // 使用更安全的锁实现，确保即使发生异常也能释放
    let lockReleased = false
    const releaseLock = () => {
      if (!lockReleased) {
        lockReleased = true
        // 从 Map 中删除该账号的锁，允许下一个操作
        if (this.sendLocks.get(accountId) === currentLockPromise) {
          this.sendLocks.delete(accountId)
        }
      }
    }

    let resolveNext: (() => void) | undefined
    const nextLock = new Promise<void>(resolve => {
      resolveNext = resolve
    })

    // 创建当前锁的 Promise，完成后自动清理
    const currentLockPromise = prevLock.then(() => nextLock)
    this.sendLocks.set(accountId, currentLockPromise)

    await prevLock
    try {
      const result = await this.doSendComment(session, message)
      return result
    } catch (error) {
      logger.error(`小号 ${session.name} 发送评论时发生未捕获异常:`, error)
      return Result.fail(error instanceof Error ? error : new Error('发送失败'))
    } finally {
      // 确保无论如何都释放锁，防止死锁
      releaseLock()
      if (resolveNext) {
        try {
          resolveNext()
        } catch (e) {
          logger.error(`释放发送锁失败：${accountId}`, e)
        }
      }
    }
  }

  private async doSendComment(
    session: SubAccountSession,
    message: string,
  ): Promise<Result.Result<boolean, Error>> {
    const page = session.page
    if (!page) {
      return Result.fail(new Error('小号未连接'))
    }
    const selectors = this.getLiveRoomSelectors(session.platform)
    try {
      session.stats.totalSent++

      // 【关键】检查页面是否可用
      if (page.isClosed()) {
        session.stats.failCount++
        session.stats.lastError = '浏览器页面已关闭'
        session.stats.lastSendTime = Date.now()
        return Result.fail(new Error('浏览器页面已关闭'))
      }

      const input = await page.$(selectors.inputSelector)
      if (!input) {
        session.stats.failCount++
        session.stats.lastError = '未找到评论输入框'
        session.stats.lastSendTime = Date.now()
        logger.warn(`小号 ${session.name} 未找到评论输入框，selector=${selectors.inputSelector}`)
        return Result.fail(new Error('未找到评论输入框'))
      }

      await input.fill(message)

      if (selectors.sendMethod === 'click') {
        const sendButton = await page.$(selectors.sendButtonSelector)
        if (sendButton) {
          await sendButton.click()
        } else {
          logger.warn(
            `小号 ${session.name} 未找到发送按钮，尝试按回车，selector=${selectors.sendButtonSelector}`,
          )
          await input.press('Enter')
        }
      } else {
        await input.press('Enter')
      }

      session.stats.successCount++
      session.stats.lastSendTime = Date.now()
      logger.success(
        `小号 ${session.name} 发送评论：${message} (成功${session.stats.successCount}/总计${session.stats.totalSent})`,
      )
      return Result.succeed(true)
    } catch (error) {
      session.stats.failCount++
      session.stats.lastError = error instanceof Error ? error.message : '发送失败'
      session.stats.lastSendTime = Date.now()
      logger.error(`小号 ${session.name} 发送评论失败`, error)
      return Result.fail(error instanceof Error ? error : new Error('发送失败'))
    }
  }

  getAccountStats(accountId: string): SubAccountStats | undefined {
    const session = this.sessions.get(accountId)
    return session?.stats
  }

  async checkHealth(
    accountId: string,
  ): Promise<{ status: 'healthy' | 'warning' | 'error'; message?: string }> {
    const session = this.sessions.get(accountId)
    if (!session) {
      return { status: 'error', message: '小号不存在' }
    }

    if (session.status !== 'connected') {
      return { status: 'error', message: '小号未连接' }
    }

    const stats = session.stats
    if (stats.totalSent >= 5) {
      const errorRate = stats.failCount / stats.totalSent
      if (errorRate >= 0.8) {
        return {
          status: 'error',
          message: `错误率过高 (${(errorRate * 100).toFixed(0)}%)，可能已被封禁`,
        }
      }
      if (errorRate >= 0.5) {
        return {
          status: 'warning',
          message: `错误率较高 (${(errorRate * 100).toFixed(0)}%)，建议检查`,
        }
      }
    }

    if (stats.lastError && stats.lastSendTime) {
      const timeSinceLastError = Date.now() - stats.lastSendTime
      const fiveMinutes = 5 * 60 * 1000
      if (timeSinceLastError < fiveMinutes && stats.failCount > stats.successCount) {
        return { status: 'warning', message: '最近发送失败较多' }
      }
    }

    return { status: 'healthy' }
  }

  async cleanup(): Promise<void> {
    // 防止重复清理
    if (this.isCleanedUp) {
      logger.info('SubAccountManager 已经清理，跳过')
      return
    }
    this.isCleanedUp = true

    logger.info('SubAccountManager 开始清理...')
    this.stopHealthCheck()

    // 清理所有登录轮询定时器
    for (const [accountId, timer] of this.loginPollTimers.entries()) {
      clearTimeout(timer)
      logger.info(`清理登录轮询定时器: ${accountId}`)
    }
    this.loginPollTimers.clear()

    const cleanupPromises = Array.from(this.sessions.values()).map(async session => {
      await this.cleanupSession(session)
      session.status = 'idle'
      session.error = undefined
      this.notifyStatusChange(session.id, 'idle')
    })
    await Promise.all(cleanupPromises)
    this.sessions.clear()

    // 清理所有发送锁
    this.sendLocks.clear()

    logger.info('SubAccountManager 已清理完成')
  }
}

export const subAccountManager = new SubAccountManager()
