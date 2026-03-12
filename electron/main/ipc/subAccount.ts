import { Result } from '@praha/byethrow'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { createLogger } from '#/logger'
import { accountManager } from '#/managers/AccountManager'
import { type SubAccountStatus, subAccountManager } from '#/managers/SubAccountManager'
import { subAccountTaskManager } from '#/managers/SubAccountTaskManager'
import {
  type MessageTemplateContext,
  randomInt,
  replaceMessageTemplate,
  sleep,
  typedIpcMainHandle,
} from '#/utils'
import windowManager from '#/windowManager'

// 导入验证库（使用已存在的 zod）
import { z } from 'zod'

// 子账号导入数据验证 Schema
const ImportAccountSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  platform: z.enum(['douyin', 'kuaishou', 'taobao', 'xiaohongshu']),
})

const ImportAccountsArraySchema = z.array(ImportAccountSchema)

const TASK_NAME = '小号互动'

// 为每个账号维护独立的批量发送控制器
const batchAbortControllers: Map<string, AbortController> = new Map()

// 标记是否已初始化，防止重复注册
let isInitialized = false
// 保存状态变更回调引用，用于可能的清理
let statusChangeCallback:
  | ((accountId: string, status: SubAccountStatus, error?: string) => void)
  | null = null

function setupIpcHandlers() {
  // 防止重复初始化
  if (isInitialized) {
    console.log('[SubAccountIPC] 已经初始化，跳过重复注册')
    return
  }
  isInitialized = true

  // 清理旧的回调（如果存在）
  if (statusChangeCallback) {
    console.log('[SubAccountIPC] 清理旧的状态变更回调')
    // 注意：SubAccountManager 需要实现移除回调的方法
  }

  // 注册小号状态变更回调，实时同步到前端
  statusChangeCallback = (subAccountId, status, error) => {
    windowManager.send(IPC_CHANNELS.tasks.subAccount.accountStatusChanged, subAccountId, {
      accountId: subAccountId,
      status,
      error,
      timestamp: Date.now(),
    })
  }
  subAccountManager.onStatusChange(statusChangeCallback)

  typedIpcMainHandle(IPC_CHANNELS.tasks.subAccount.start, async (_, accountId, config) => {
    const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
    try {
      const ok = await subAccountTaskManager.start(accountId, config)
      if (!ok) {
        logger.error('启动任务失败')
        return false
      }
      logger.info('小号互动任务已启动')
      return true
    } catch (error) {
      logger.error('启动任务失败：', error)
      return false
    }
  })

  typedIpcMainHandle(IPC_CHANNELS.tasks.subAccount.stop, async (_, accountId) => {
    // 停止该账号的批量发送
    const ac = batchAbortControllers.get(accountId)
    if (ac) {
      ac.abort()
      batchAbortControllers.delete(accountId)
    }
    const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
    try {
      subAccountTaskManager.stop(accountId)
      logger.info('小号互动任务已停止')
      return true
    } catch (error) {
      logger.error('停止任务失败：', error)
      return false
    }
  })

  typedIpcMainHandle(
    IPC_CHANNELS.tasks.subAccount.updateConfig,
    async (_, accountId, newConfig) => {
      const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
      const result = subAccountTaskManager.updateConfig(accountId, newConfig)
      if (Result.isSuccess(result)) {
        logger.info('更新配置成功')
      } else {
        logger.error('更新配置失败：', result.error)
      }
    },
  )

  typedIpcMainHandle(
    IPC_CHANNELS.tasks.subAccount.addAccount,
    async (_, accountId, subAccountConfig) => {
      const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
      const result = subAccountManager.addAccount(subAccountConfig)
      if (Result.isFailure(result)) {
        logger.error('添加小号失败：', result.error)
        return false
      }
      logger.info(`添加小号成功: ${subAccountConfig.name}`)
      return true
    },
  )

  typedIpcMainHandle(
    IPC_CHANNELS.tasks.subAccount.removeAccount,
    async (_, accountId, subAccountId) => {
      const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
      await subAccountManager.removeAccount(subAccountId)
      logger.info(`移除小号: ${subAccountId}`)
      return true
    },
  )

  typedIpcMainHandle(
    IPC_CHANNELS.tasks.subAccount.loginAccount,
    async (_, accountId, subAccountId) => {
      const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
      logger.info(`开始登录小号：${subAccountId}`)

      const result = await subAccountManager.connectAccount(subAccountId, false)
      if (Result.isFailure(result)) {
        logger.error('登录小号失败：', result.error)
        return { success: false, error: result.error.message }
      }

      const session = result.value
      logger.success(`小号登录成功：${session.name}，状态=${session.status}`)

      // 返回 session 信息，让前端知道真实状态（可能是 connecting 等待二次验证）
      return {
        success: true,
        session: {
          status: session.status,
          error: session.error,
        },
      }
    },
  )

  typedIpcMainHandle(
    IPC_CHANNELS.tasks.subAccount.disconnectAccount,
    async (_, accountId, subAccountId) => {
      const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
      logger.info(`断开小号连接: ${subAccountId}`)

      await subAccountManager.disconnectAccount(subAccountId)
      logger.success(`小号已断开: ${subAccountId}`)
      return { success: true }
    },
  )

  typedIpcMainHandle(
    IPC_CHANNELS.tasks.subAccount.enterLiveRoom,
    async (_, accountId, subAccountId, liveRoomUrl) => {
      const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
      logger.info(`小号 ${subAccountId} 正在进入直播间: ${liveRoomUrl}`)

      const result = await subAccountManager.enterLiveRoom(subAccountId, liveRoomUrl)
      if (Result.isFailure(result)) {
        logger.error('进入直播间失败：', result.error)
        return { success: false, error: result.error.message }
      }

      logger.success(`小号 ${subAccountId} 已进入直播间`)
      return { success: true }
    },
  )

  typedIpcMainHandle(
    IPC_CHANNELS.tasks.subAccount.sendBatch,
    async (_, accountId, count, messages) => {
      const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)

      // 清理旧的控制器
      batchAbortControllers.get(accountId)?.abort()

      const connectedAccounts = subAccountManager.getConnectedAccounts()
      if (connectedAccounts.length === 0) {
        return { success: false, error: '没有已连接的小号' }
      }

      const msgList: { content: string; weight?: number }[] =
        Array.isArray(messages) && messages.length > 0
          ? messages
          : [{ content: '666' }, { content: '支持主播' }, { content: '来了来了' }]

      logger.info(`开始批量发送，共 ${count} 轮，${connectedAccounts.length} 个小号`)

      const ac = new AbortController()
      batchAbortControllers.set(accountId, ac)

      const runBatch = async () => {
        let completedCount = 0
        let failedCount = 0
        // 为每个账号维护失败计数器
        const accountFailCount = new Map<string, number>()
        const totalRounds = count * connectedAccounts.length

        try {
          for (let i = 0; i < count; i++) {
            if (ac.signal.aborted) break

            const currentConnected = subAccountManager.getConnectedAccounts()
            for (const subAccount of currentConnected) {
              if (ac.signal.aborted) break

              // 检查该账号是否连续失败过多
              const failCount = accountFailCount.get(subAccount.id) || 0
              if (failCount >= 3) {
                logger.warn(`小号 ${subAccount.name} 连续失败 ${failCount} 次，跳过本轮发送`)
                continue
              }

              const totalWeight = msgList.reduce((sum, m) => sum + (m.weight || 1), 0)
              let rw = Math.random() * totalWeight
              let picked = msgList[0]
              for (const m of msgList) {
                rw -= m.weight || 1
                if (rw <= 0) {
                  picked = m
                  break
                }
              }

              const templateContext: MessageTemplateContext = {
                currentTime: new Date(),
                streamerName: '主播',
              }
              const content = replaceMessageTemplate(picked.content, templateContext)

              const result = await subAccountManager.sendComment(subAccount.id, content)
              if (Result.isFailure(result)) {
                logger.error(`小号 ${subAccount.name} 发送失败:`, result.error)
                failedCount++
                // 更新失败计数
                accountFailCount.set(subAccount.id, failCount + 1)
              } else {
                logger.success(`小号 ${subAccount.name} 发送：${content}`)
                completedCount++
                // 重置失败计数
                accountFailCount.set(subAccount.id, 0)
              }

              // 发送进度事件（节流：每 10 条发送一次）
              const currentProgress =
                i * currentConnected.length + currentConnected.indexOf(subAccount) + 1
              if (currentProgress % 10 === 0 || currentProgress === totalRounds) {
                windowManager.send(IPC_CHANNELS.tasks.subAccount.batchProgress, accountId, {
                  current: currentProgress,
                  total: totalRounds,
                  completed: completedCount,
                  failed: failedCount,
                })
              }

              await sleep(randomInt(500, 1500))
            }

            if (i < count - 1) {
              await sleep(randomInt(2000, 5000))
            }
          }
          logger.success('批量发送完成')
        } catch (error) {
          if (!ac.signal.aborted) {
            logger.error('批量发送异常:', error)
          }
        } finally {
          if (batchAbortControllers.get(accountId) === ac) {
            batchAbortControllers.delete(accountId)
          }
        }
      }

      runBatch()
      return { success: true }
    },
  )

  typedIpcMainHandle(
    IPC_CHANNELS.tasks.subAccount.checkHealth,
    async (_, _accountId, subAccountId) => {
      const health = await subAccountManager.checkHealth(subAccountId)
      return health
    },
  )

  typedIpcMainHandle(IPC_CHANNELS.tasks.subAccount.getAllAccounts, async _ => {
    const accounts = subAccountManager.getAllAccounts().map(session => ({
      id: session.id,
      name: session.name,
      platform: session.platform,
      status: session.status,
      error: session.error,
      stats: session.stats,
      hasStorageState: !!session.storageState,
      liveRoomUrl: session.liveRoomUrl,
    }))
    return accounts
  })

  typedIpcMainHandle(
    IPC_CHANNELS.tasks.subAccount.clearStorageState,
    async (_, _accountId, subAccountId) => {
      const session = subAccountManager.getAccount(subAccountId)
      if (session) {
        session.storageState = undefined
        return true
      }
      return false
    },
  )

  typedIpcMainHandle(IPC_CHANNELS.tasks.subAccount.exportAccounts, async _ => {
    const accounts = subAccountManager.getAllAccounts().map(session => ({
      id: session.id,
      name: session.name,
      platform: session.platform,
      stats: session.stats,
      hasStorageState: !!session.storageState,
    }))
    return { success: true, data: JSON.stringify(accounts, null, 2) }
  })

  typedIpcMainHandle(
    IPC_CHANNELS.tasks.subAccount.importAccounts,
    async (_, _accountId, jsonData) => {
      try {
        // 解析并验证输入数据
        const parsed = JSON.parse(jsonData)
        const accounts = ImportAccountsArraySchema.parse(parsed)

        let added = 0
        for (const acc of accounts) {
          const result = subAccountManager.addAccount({
            id: acc.id || crypto.randomUUID(),
            name: acc.name,
            platform: acc.platform,
          })
          if (Result.isSuccess(result)) added++
        }

        return { success: true, added }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return { success: false, error: `数据格式错误: ${error.errors.map(e => e.message).join(', ')}` }
        }
        return { success: false, error: String(error) }
      }
    },
  )

  typedIpcMainHandle(
    IPC_CHANNELS.tasks.subAccount.syncAccounts,
    async (_, accountId, accountConfigs) => {
      const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
      let synced = 0
      for (const acc of accountConfigs) {
        if (!subAccountManager.getAccount(acc.id)) {
          const result = subAccountManager.addAccount({
            id: acc.id,
            name: acc.name,
            platform: acc.platform,
          })
          if (Result.isSuccess(result)) synced++
        }
      }
      if (synced > 0) {
        logger.info(`同步了 ${synced} 个小号到后端`)
      }
      return { synced }
    },
  )
}

export function setupSubAccountIpcHandlers() {
  setupIpcHandlers()
}
