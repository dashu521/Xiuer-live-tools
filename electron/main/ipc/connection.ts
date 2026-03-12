import process from 'node:process'
import { Result } from '@praha/byethrow'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { createLogger } from '#/logger'
import { accountManager } from '#/managers/AccountManager'
import { browserManager } from '#/managers/BrowserSessionManager'
import { typedIpcMainHandle } from '#/utils'
import windowManager from '#/windowManager'

const TASK_NAME = '中控台'

/** 主进程允许同时连接的最大账号数，避免内存与 FD 耗尽 */
const MAX_CONCURRENT_ACCOUNTS = 10

function setupIpcHandlers() {
  typedIpcMainHandle(
    IPC_CHANNELS.tasks.liveControl.connect,
    async (_, { chromePath, headless, storageState, platform, account, traceId }) => {
      const logPrefix = traceId ? `[conn][${account.id}][${traceId}]` : `[conn][${account.id}]`
      const logger = createLogger(`@${account.name}`).scope(TASK_NAME)

      try {
        const currentCount = accountManager.accountSessions.size
        if (currentCount >= MAX_CONCURRENT_ACCOUNTS) {
          const msg = `同时连接账号数已达上限（${MAX_CONCURRENT_ACCOUNTS}），请先断开部分账号再连接`
          createLogger(TASK_NAME).warn(msg)
          return {
            success: false,
            browserLaunched: false,
            error: msg,
          }
        }

        if (chromePath) {
          browserManager.setChromePath(chromePath)
        }

        logger.info(
          `${logPrefix}[connect:start] platform=${platform} account=${account.name} headless=${headless}`,
        )

        const accountSession = accountManager.createSession(platform, account)

        // 打点：连接数 + 主进程内存，便于观测多账号资源占用
        const mem = process.memoryUsage()
        createLogger(TASK_NAME).info(
          `${logPrefix}[资源] 当前连接数=${accountManager.accountSessions.size} heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB rss=${Math.round(mem.rss / 1024 / 1024)}MB`,
        )

        // 等待异步连接完成，确保真正成功后才返回
        createLogger(TASK_NAME).info(`${logPrefix}[connect:launching] headless 参数：${headless}`)
        try {
          const connectResult = await accountSession.connect({
            headless,
            storageState,
          })

          logger.info(`${logPrefix}[connect:async-started] returning browserLaunched=true`)
          // 如果返回了 needsLogin，说明浏览器已启动但需要用户登录
          return {
            success: true,
            browserLaunched: true,
            needsLogin: connectResult.needsLogin,
          }
        } catch (error) {
          logger.error(
            `${logPrefix}[connect:sync-failed] elapsed=0ms error=${error instanceof Error ? error.message : '未知错误'}`,
          )

          // 检查 session 是否仍然存在（浏览器可能已启动）
          const sessionExists = accountManager.accountSessions.has(account.id)

          if (sessionExists) {
            // 浏览器已启动，但登录过程中断（如用户关闭浏览器）
            // 清理 session 但返回 browserLaunched=true，让前端知道浏览器已经弹出过
            logger.info(
              `${logPrefix}[connect:browser-was-launched] session still exists, cleaning up and returning browserLaunched=true`,
            )
            accountManager.closeSession(account.id)

            windowManager.send(
              IPC_CHANNELS.tasks.liveControl.disconnectedEvent,
              account.id,
              error instanceof Error ? error.message : '浏览器已关闭，连接已取消',
            )

            // 返回 browserLaunched=true，前端会显示"请扫码登录"而不是"连接失败"
            // 虽然实际上浏览器已经关闭，但这个返回值可以避免显示"连接失败"的误导性提示
            return {
              success: true,
              browserLaunched: true,
              needsLogin: true,
            }
          }

          // 浏览器未启动，真正失败
          windowManager.send(
            IPC_CHANNELS.tasks.liveControl.disconnectedEvent,
            account.id,
            error instanceof Error ? error.message : '连接直播控制台失败',
          )

          return {
            success: false,
            browserLaunched: false,
            error: error instanceof Error ? error.message : '连接失败',
          }
        }
      } catch (error) {
        logger.warn(
          `${logPrefix}[connect:error] error=${error instanceof Error ? error.message : '启动浏览器时出现问题'}`,
        )
        return {
          success: false,
          browserLaunched: false,
          error: error instanceof Error ? error.message : '启动浏览器时出现问题',
        }
      }
    },
  )

  typedIpcMainHandle(IPC_CHANNELS.tasks.liveControl.disconnect, async (_, accountId: string) => {
    try {
      // 【修复】断开连接时不关闭浏览器，只断开控制关系
      accountManager.closeSession(accountId, '用户主动断开', { closeBrowser: false })
      return true
    } catch (error) {
      const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
      logger.error('断开连接失败:', error)
      return false
    }
  })

  // 获取直播间 URL（用于小号互动自动填入）
  typedIpcMainHandle(
    IPC_CHANNELS.tasks.liveControl.getLiveRoomUrl,
    async (_, accountId: string) => {
      try {
        const sessionResult = accountManager.getSession(accountId)
        if (Result.isFailure(sessionResult)) {
          return { success: false, error: '账号未连接' }
        }
        const session = sessionResult.value

        // 使用新的 getLiveRoomUrl 方法，支持从中控台提取直播间链接
        const result = await session.getLiveRoomUrl()
        return result
      } catch (error) {
        const logger = createLogger(TASK_NAME)
        logger.error('获取直播间 URL 失败:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '获取直播间 URL 失败',
        }
      }
    },
  )
}

export function setupLiveControlIpcHandlers() {
  setupIpcHandlers()
}
