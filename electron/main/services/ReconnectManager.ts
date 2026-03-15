/**
 * 自动重连管理器
 *
 * 【P0-2 断线自动重连】
 * 严格按《自动重连触发矩阵》实现，只允许以下场景自动重连：
 * - 网络异常 (network_error)
 * - 页面崩溃 (page_crash)
 * - listener 异常退出 (listener_error)
 *
 * 以下场景绝对禁止自动重连：
 * - 用户主动断开 (user_disconnect)
 * - 用户关闭浏览器 (browser_closed)
 * - 登录态失效 (auth_expired)
 * - 账号切换 (account_switched)
 * - 直播结束 (stream_ended)
 *
 * 符合规范§2.3, §2.5：disconnect ≠ 关闭浏览器，stopAll ≠ 断开连接
 */

import { createLogger } from '#/logger'

export type ReconnectReason =
  | 'network_error' // ✅ 允许：网络异常
  | 'page_crash' // ✅ 允许：页面崩溃
  | 'listener_error' // ✅ 允许：listener 异常退出
  | 'user_disconnect' // ❌ 禁止：用户主动断开
  | 'browser_closed' // ❌ 禁止：用户关闭浏览器
  | 'auth_expired' // ❌ 禁止：登录态失效
  | 'account_switched' // ❌ 禁止：账号切换
  | 'stream_ended' // ❌ 禁止：直播结束

interface ReconnectPolicy {
  allowed: boolean
  maxAttempts: number
  baseDelay: number
  backoffMultiplier: number
}

/**
 * 重连策略配置
 * 严格按《自动重连触发矩阵》定义
 */
const RECONNECT_POLICIES: Record<ReconnectReason, ReconnectPolicy> = {
  // ✅ 允许自动重连的场景
  network_error: {
    allowed: true,
    maxAttempts: 3,
    baseDelay: 5000, // 5秒基础延迟
    backoffMultiplier: 2, // 指数退避：5s → 10s → 20s
  },
  page_crash: {
    allowed: true,
    maxAttempts: 2,
    baseDelay: 1000, // 1秒基础延迟（立即重连）
    backoffMultiplier: 1, // 固定间隔
  },
  listener_error: {
    allowed: true,
    maxAttempts: 3,
    baseDelay: 5000, // 5秒基础延迟
    backoffMultiplier: 1, // 固定间隔
  },

  // ❌ 禁止自动重连的场景
  user_disconnect: {
    allowed: false,
    maxAttempts: 0,
    baseDelay: 0,
    backoffMultiplier: 0,
  },
  browser_closed: {
    allowed: false,
    maxAttempts: 0,
    baseDelay: 0,
    backoffMultiplier: 0,
  },
  auth_expired: {
    allowed: false,
    maxAttempts: 0,
    baseDelay: 0,
    backoffMultiplier: 0,
  },
  account_switched: {
    allowed: false,
    maxAttempts: 0,
    baseDelay: 0,
    backoffMultiplier: 0,
  },
  stream_ended: {
    allowed: false,
    maxAttempts: 0,
    baseDelay: 0,
    backoffMultiplier: 0,
  },
}

/**
 * 重连结果类型
 */
export type ReconnectResult = 'success' | 'failed' | 'forbidden'

/**
 * 每个账号的重连状态
 */
interface AccountReconnectState {
  attempts: number
  currentReason: ReconnectReason | null
  isReconnecting: boolean
}

export class ReconnectManager {
  private logger = createLogger('ReconnectManager')
  private accountStates: Map<string, AccountReconnectState> = new Map()

  /**
   * 检查是否应该自动重连
   * @param reason 断开原因
   * @returns 是否允许重连
   */
  shouldReconnect(reason: ReconnectReason): boolean {
    const policy = RECONNECT_POLICIES[reason]
    this.logger.info(`[shouldReconnect] reason=${reason}, allowed=${policy.allowed}`)
    return policy.allowed
  }

  /**
   * 获取账号的重连状态（如果不存在则创建）
   */
  private getAccountState(accountId: string): AccountReconnectState {
    if (!this.accountStates.has(accountId)) {
      this.accountStates.set(accountId, {
        attempts: 0,
        currentReason: null,
        isReconnecting: false,
      })
    }
    return this.accountStates.get(accountId)!
  }

  /**
   * 执行自动重连
   *
   * @param accountId 账号ID
   * @param reason 断开原因
   * @param reconnectFn 重连执行函数
   * @returns 重连结果：success(成功) | failed(失败达最大次数) | forbidden(禁止重连)
   */
  async attemptReconnect(
    accountId: string,
    reason: ReconnectReason,
    reconnectFn: () => Promise<boolean>,
  ): Promise<ReconnectResult> {
    const policy = RECONNECT_POLICIES[reason]

    // 检查是否允许重连
    if (!policy.allowed) {
      this.logger.info(`[attemptReconnect][${accountId}] 禁止重连: ${reason}`)
      return 'forbidden'
    }

    const state = this.getAccountState(accountId)

    // 防止并发重连
    if (state.isReconnecting) {
      this.logger.warn(`[attemptReconnect][${accountId}] 已有重连在进行中`)
      return 'failed'
    }

    state.isReconnecting = true
    state.currentReason = reason

    this.logger.info(
      `[attemptReconnect][${accountId}] START, reason=${reason}, maxAttempts=${policy.maxAttempts}`,
    )

    try {
      while (state.attempts < policy.maxAttempts) {
        // 计算延迟（指数退避）
        const delay = policy.baseDelay * policy.backoffMultiplier ** state.attempts

        this.logger.info(
          `[attemptReconnect][${accountId}] 第 ${state.attempts + 1}/${policy.maxAttempts} 次尝试，延迟 ${delay}ms`,
        )

        // 等待延迟
        await sleep(delay)

        // 执行重连
        const success = await reconnectFn()

        if (success) {
          this.logger.success(`[attemptReconnect][${accountId}] 重连成功`)
          // 重置状态
          state.attempts = 0
          state.currentReason = null
          return 'success'
        }

        state.attempts++
        this.logger.warn(`[attemptReconnect][${accountId}] 第 ${state.attempts} 次尝试失败`)
      }

      // 达到最大重试次数
      this.logger.error(`[attemptReconnect][${accountId}] 达到最大重试次数，重连失败`)
      return 'failed'
    } catch (error) {
      this.logger.error(`[attemptReconnect][${accountId}] 重连异常:`, error)
      return 'failed'
    } finally {
      state.isReconnecting = false
    }
  }

  /**
   * 重置账号的重连状态
   * @param accountId 账号ID
   */
  resetAccountState(accountId: string): void {
    this.accountStates.delete(accountId)
    this.logger.info(`[resetAccountState][${accountId}] 重连状态已重置`)
  }

  /**
   * 清理所有状态（应用退出时调用）
   */
  cleanup(): void {
    this.accountStates.clear()
    this.logger.info('[cleanup] 所有重连状态已清理')
  }
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 单例导出
export const reconnectManager = new ReconnectManager()
