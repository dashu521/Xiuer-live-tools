/**
 * 账号级运行时管理器
 *
 * 统一管理所有账号的运行时状态，按 accountId 隔离
 * 职责：streamState、controlState 管理
 *
 * 注意：任务创建仍由 AccountSession 处理，此管理器负责状态同步
 */

import { EventEmitter } from 'node:events'
import { createLogger, type ScopedLogger } from '#/logger'
import { emitAccountEvent } from '#/services/AccountEventBus'
import { taskRuntimeMonitor } from '#/services/TaskRuntimeMonitor'

export type ControlState = 'connected' | 'disconnected'
export type StreamState = 'live' | 'offline' | 'unknown'

interface AccountRuntime {
  accountId: string
  accountName: string
  platformName: string
  controlState: ControlState
  streamState: StreamState
  isDisconnecting: boolean
  isDisconnected: boolean
  logger: ScopedLogger
}

const EVENTS = {
  STREAM_ENDED: 'streamEnded',
  CONTROL_DETACHED: 'controlDetached',
  TASKS_STOPPED: 'tasksStopped',
} as const

export class AccountScopedRuntimeManager extends EventEmitter {
  private runtimes = new Map<string, AccountRuntime>()
  private logger = createLogger('AccountRuntimeManager')

  /**
   * 创建账号运行时
   */
  createAccount(accountId: string, accountName: string, platformName: string): AccountRuntime {
    if (this.runtimes.has(accountId)) {
      this.logger.warn(`[createAccount] 账号 ${accountId} 已存在`)
    }

    const logger = createLogger(`@${accountName}`)

    const runtime: AccountRuntime = {
      accountId,
      accountName,
      platformName,
      controlState: 'disconnected',
      streamState: 'unknown',
      isDisconnecting: false,
      isDisconnected: true,
      logger,
    }

    this.runtimes.set(accountId, runtime)
    this.logger.info(`[createAccount] 账号 ${accountId} 已创建`)

    return runtime
  }

  /**
   * 删除账号运行时
   */
  deleteAccount(accountId: string): void {
    const runtime = this.runtimes.get(accountId)
    if (!runtime) return

    this.logger.info(`[deleteAccount] 删除账号 ${accountId}`)
    this.runtimes.delete(accountId)
    taskRuntimeMonitor.logEventCustom('ACCOUNT_DELETED', accountId, {})
  }

  /**
   * 获取账号运行时
   */
  getRuntime(accountId: string): AccountRuntime | undefined {
    return this.runtimes.get(accountId)
  }

  /**
   * 检查账号是否存在
   */
  hasAccount(accountId: string): boolean {
    return this.runtimes.has(accountId)
  }

  /**
   * 设置连接状态
   */
  setConnected(accountId: string): void {
    const runtime = this.runtimes.get(accountId)
    if (runtime) {
      runtime.controlState = 'connected'
      runtime.isDisconnected = false
      this.logger.info(`[setConnected][${accountId}] 已设置为 connected`)
    }
  }

  /**
   * 设置断开状态
   */
  setDisconnected(accountId: string): void {
    const runtime = this.runtimes.get(accountId)
    if (runtime) {
      runtime.controlState = 'disconnected'
      runtime.isDisconnected = true
      this.logger.info(`[setDisconnected][${accountId}] 已设置为 disconnected`)
    }
  }

  /**
   * 设置直播状态
   */
  setStreamState(accountId: string, state: StreamState): void {
    const runtime = this.runtimes.get(accountId)
    if (runtime) {
      const prevState = runtime.streamState
      runtime.streamState = state
      this.logger.info(`[setStreamState][${accountId}] ${prevState} -> ${state}`)
    }
  }

  /**
   * ====== 核心生命周期方法 ======
   */

  /**
   * 关播时调用：只停止任务，不断开中控台，不关闭浏览器
   */
  async stopAllLiveTasks(accountId: string, reason: string): Promise<void> {
    const runtime = this.runtimes.get(accountId)
    if (!runtime) {
      this.logger.warn(`[stopAllLiveTasks] 账号 ${accountId} 不存在`)
      return
    }

    this.logger.info(`[stopAllLiveTasks][${accountId}] 开始停止任务, reason: ${reason}`)

    // 更新 streamState
    runtime.streamState = 'offline'

    // 发送 streamStateChanged 事件到前端
    const payload = {
      accountId,
      streamState: 'offline',
    } as const
    emitAccountEvent({
      domain: 'liveControl',
      type: 'streamStateChanged',
      accountId,
      payload,
    })
    taskRuntimeMonitor.logEventCustom('STREAM_ENDED', accountId, { reason })

    this.emit(EVENTS.TASKS_STOPPED, accountId, reason)
    this.logger.info(`[stopAllLiveTasks][${accountId}] 任务停止完成`)
  }

  /**
   * 主动断开中控台：解除控制关系，不断开浏览器
   */
  async detachControl(accountId: string, reason: string): Promise<void> {
    const runtime = this.runtimes.get(accountId)
    if (!runtime) {
      this.logger.warn(`[detachControl] 账号 ${accountId} 不存在`)
      return
    }

    if (runtime.isDisconnecting || runtime.isDisconnected) {
      this.logger.info(`[detachControl][${accountId}] 已在断开中或已断开`)
      return
    }

    runtime.isDisconnecting = true
    this.logger.info(`[detachControl][${accountId}] 开始断开控制, reason: ${reason}`)

    // 更新状态
    runtime.controlState = 'disconnected'
    runtime.isDisconnected = true

    // 发送 disconnectedEvent
    const payload = {
      accountId,
      reason,
    } as const
    emitAccountEvent({
      domain: 'liveControl',
      type: 'disconnected',
      accountId,
      payload,
    })
    taskRuntimeMonitor.logEventCustom('CONTROL_DETACHED', accountId, { reason })

    runtime.isDisconnecting = false
    this.emit(EVENTS.CONTROL_DETACHED, accountId, reason)
    this.logger.info(`[detachControl][${accountId}] 控制已断开`)
  }

  /**
   * 浏览器关闭时：触发断开控制
   */
  async onBrowserClosed(accountId: string, reason: string): Promise<void> {
    const runtime = this.runtimes.get(accountId)
    if (!runtime) return

    this.logger.info(`[onBrowserClosed][${accountId}] 浏览器已关闭, reason: ${reason}`)

    // 设置为离线
    runtime.streamState = 'offline'

    // 发送 streamStateChanged
    const payload = {
      accountId,
      streamState: 'offline',
    } as const
    emitAccountEvent({
      domain: 'liveControl',
      type: 'streamStateChanged',
      accountId,
      payload,
    })

    // 断开控制
    await this.detachControl(accountId, reason)
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    const stats = {
      totalAccounts: this.runtimes.size,
      connected: 0,
      disconnected: 0,
      live: 0,
      offline: 0,
      accounts: [] as any[],
    }

    for (const [accountId, runtime] of this.runtimes) {
      if (runtime.controlState === 'connected') stats.connected++
      else stats.disconnected++

      if (runtime.streamState === 'live') stats.live++
      else stats.offline++

      stats.accounts.push({
        accountId,
        controlState: runtime.controlState,
        streamState: runtime.streamState,
      })
    }

    return stats
  }

  printSummary() {
    const stats = this.getStatistics()
    console.log('=============================================')
    console.log('📊 Account Runtime Manager Summary')
    console.log('=============================================')
    console.log(`Total Accounts: ${stats.totalAccounts}`)
    console.log(`  Connected: ${stats.connected}`)
    console.log(`  Disconnected: ${stats.disconnected}`)
    console.log(`  Live: ${stats.live}`)
    console.log(`  Offline: ${stats.offline}`)
    console.log('--------------------------------------------')
    for (const account of stats.accounts) {
      console.log(`  ${account.accountId}:`)
      console.log(`    controlState: ${account.controlState}`)
      console.log(`    streamState: ${account.streamState}`)
    }
    console.log('=============================================')
  }
}

// 导出单例
export const accountRuntimeManager = new AccountScopedRuntimeManager()
