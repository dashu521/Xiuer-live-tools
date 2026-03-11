/**
 * TaskManager - 统一任务调度器
 * 管理所有任务的启动、停止和状态
 * 【修复】支持多账号隔离，每个账号的任务状态独立管理
 */

import { useLiveControlStore } from '@/hooks/useLiveControl'
import { gateCanRun } from './gateCheck'
import type { StopReason, Task, TaskContext, TaskId, TaskStatus } from './types'
import { BaseTask } from './types'

/**
 * 账号任务状态
 */
interface AccountTaskState {
  status: TaskStatus
  taskInstance: Task
}

/**
 * TaskManager 单例
 * 【修复】使用 Map<accountId, Map<taskId, AccountTaskState>> 实现账号隔离
 */
export class TaskManagerImpl {
  // 任务模板（用于创建每个账号的任务实例）
  private taskTemplates: Map<TaskId, new () => Task> = new Map()
  // 账号任务状态：accountId -> taskId -> AccountTaskState
  private accountTasks: Map<string, Map<TaskId, AccountTaskState>> = new Map()
  // 已清理账号集合：用于区分“从未创建过”和“已显式清理”
  private cleanedAccounts: Set<string> = new Set()
  // 全局状态存储（向后兼容）
  private statusStore: Map<TaskId, TaskStatus> = new Map()

  /**
   * 注册任务模板
   */
  register(TaskClass: new () => Task): void {
    const tempTask = new TaskClass()
    this.taskTemplates.set(tempTask.id, TaskClass)
    this.statusStore.set(tempTask.id, 'idle')
    console.log(`[TaskManager] Registered task template: ${tempTask.id}`)
  }

  /**
   * 获取或创建账号的任务状态
   */
  private getOrCreateAccountTaskState(accountId: string, taskId: TaskId): AccountTaskState {
    this.cleanedAccounts.delete(accountId)

    if (!this.accountTasks.has(accountId)) {
      this.accountTasks.set(accountId, new Map())
    }

    const accountMap = this.accountTasks.get(accountId)!
    if (!accountMap.has(taskId)) {
      const TaskClass = this.taskTemplates.get(taskId)
      if (!TaskClass) {
        throw new Error(`Task template ${taskId} not found`)
      }
      accountMap.set(taskId, {
        status: 'idle',
        taskInstance: new TaskClass(),
      })
    }

    return accountMap.get(taskId)!
  }

  /**
   * 获取任务状态（按账号隔离）
   */
  getStatus(taskId: TaskId, accountId?: string): TaskStatus {
    // 如果没有提供 accountId，返回全局状态（向后兼容）
    if (!accountId) {
      return this.statusStore.get(taskId) || 'idle'
    }

    // 按账号获取状态
    const accountMap = this.accountTasks.get(accountId)
    if (!accountMap) {
      return 'idle'
    }

    const taskState = accountMap.get(taskId)
    return taskState?.status || 'idle'
  }

  /**
   * 启动任务
   * @param taskId - 任务 ID
   * @param ctx - 任务上下文
   * @returns 启动结果
   */
  async start(
    taskId: TaskId,
    ctx: TaskContext,
  ): Promise<{ success: boolean; reason?: string; message?: string }> {
    const accountId = ctx.accountId

    // 【修复】获取或创建该账号的任务状态
    let taskState: AccountTaskState
    try {
      taskState = this.getOrCreateAccountTaskState(accountId, taskId)
    } catch (_error) {
      console.error(`[TaskManager] Task ${taskId} not found`)
      return { success: false, reason: 'TASK_NOT_FOUND', message: '任务未找到' }
    }

    const task = taskState.taskInstance

    // Gate 检查
    const liveControlStore = useLiveControlStore.getState()
    const context = liveControlStore.contexts[accountId]
    if (context) {
      const gateResult = gateCanRun(context.connectState.status, context.streamState)
      if (!gateResult.ok) {
        console.log(`[TaskManager] Gate check failed for task ${taskId}: ${gateResult.reason}`)
        return {
          success: false,
          reason: gateResult.reason,
          message: gateResult.message,
        }
      }
    } else {
      console.warn(`[TaskManager] Context not found for account ${accountId}, skipping gate check`)
    }

    // 【修复】检查该账号的任务是否已在运行
    if (taskState.status === 'running' || taskState.status === 'stopping') {
      console.log(
        `[TaskManager] Task ${taskId} for account ${accountId} is already ${taskState.status}`,
      )
      return { success: false, reason: 'ALREADY_RUNNING', message: '任务已在运行中' }
    }

    try {
      // 【修复】重置任务状态（如果之前停止过）
      if (taskState.status === 'stopped' && task instanceof BaseTask) {
        ;(task as BaseTask & { reset: () => void }).reset()
      }

      // 【修复】更新该账号的任务状态
      taskState.status = 'running'
      task.status = 'running'
      this.statusStore.set(taskId, 'running')

      // 启动任务
      console.log(`[TaskManager] Starting task ${taskId} for account ${accountId}`)
      await task.start(ctx)
      console.log(`[TaskManager] Task ${taskId} started successfully for account ${accountId}`)

      return { success: true }
    } catch (error) {
      console.error(`[TaskManager] Failed to start task ${taskId} for account ${accountId}:`, error)
      taskState.status = 'error'
      task.status = 'error'
      this.statusStore.set(taskId, 'error')
      return {
        success: false,
        reason: 'ERROR',
        message: error instanceof Error ? error.message : '启动任务失败',
      }
    }
  }

  /**
   * 停止任务
   * @param taskId - 任务 ID
   * @param reason - 停止原因
   * @param accountId - 账号 ID（可选，用于精确停止指定账号的任务）
   */
  async stop(taskId: TaskId, reason: StopReason, accountId?: string): Promise<void> {
    // 【修复】如果提供了 accountId，只停止该账号的任务
    if (accountId) {
      const accountMap = this.accountTasks.get(accountId)
      if (!accountMap) {
        console.warn(`[TaskManager] No tasks found for account ${accountId}`)
        return
      }

      const taskState = accountMap.get(taskId)
      if (!taskState) {
        console.warn(`[TaskManager] Task ${taskId} not found for account ${accountId}`)
        return
      }

      if (taskState.status === 'idle' || taskState.status === 'stopped') {
        console.log(
          `[TaskManager] Task ${taskId} for account ${accountId} is already ${taskState.status}`,
        )
        return
      }

      try {
        console.log(
          `[TaskManager] Stopping task ${taskId} for account ${accountId}, reason: ${reason}`,
        )
        await taskState.taskInstance.stop(reason)
        taskState.status = taskState.taskInstance.status
        console.log(
          `[TaskManager] Task ${taskId} stopped for account ${accountId}, final status: ${taskState.status}`,
        )
      } catch (error) {
        console.error(
          `[TaskManager] Error stopping task ${taskId} for account ${accountId}:`,
          error,
        )
        taskState.status = 'error'
        taskState.taskInstance.status = 'error'
      }
      return
    }

    // 【向后兼容】如果没有提供 accountId，停止所有账号的该任务
    console.log(`[TaskManager] Stopping task ${taskId} for all accounts`)
    for (const [accId, accountMap] of this.accountTasks.entries()) {
      const taskState = accountMap.get(taskId)
      if (taskState && taskState.status !== 'idle' && taskState.status !== 'stopped') {
        await this.stop(taskId, reason, accId)
      }
    }
  }

  /**
   * 停止指定账号的所有运行中的任务
   * @param accountId - 账号 ID
   * @param reason - 停止原因
   */
  async stopAllForAccount(accountId: string, reason: StopReason): Promise<void> {
    console.log(`[TaskManager] stopAllForAccount called for ${accountId}, reason: ${reason}`)
    const accountMap = this.accountTasks.get(accountId)
    if (!accountMap) {
      console.log(`[TaskManager] No tasks found for account ${accountId}`)
      return
    }

    const runningTasks: TaskId[] = []
    for (const [taskId, taskState] of accountMap.entries()) {
      if (taskState.status === 'running' || taskState.status === 'stopping') {
        runningTasks.push(taskId)
      }
    }

    if (runningTasks.length === 0) {
      console.log(`[TaskManager] No running tasks for account ${accountId}`)
      return
    }

    console.log(`[TaskManager] Stopping ${runningTasks.length} tasks for account ${accountId}`)
    await Promise.all(runningTasks.map(taskId => this.stop(taskId, reason, accountId)))
  }

  /**
   * 停止所有运行中的任务（所有账号）
   * @param reason - 停止原因
   * @param toastCallback - 可选的 toast 回调
   */
  async stopAll(reason: StopReason, toastCallback?: (message: string) => void): Promise<void> {
    console.log(`[TaskManager] stopAll called with reason: ${reason}`)

    for (const accountId of this.accountTasks.keys()) {
      await this.stopAllForAccount(accountId, reason)
    }

    // 显示 toast（如果有回调且不是手动停止）
    if (toastCallback && reason !== 'manual') {
      const { getStopReasonText } = await import('@/utils/taskGate')
      const reasonText = getStopReasonText(reason)
      toastCallback(reasonText)
    }
  }

  /**
   * 获取所有任务状态（按账号）
   */
  getAllStatusForAccount(accountId: string): Record<TaskId, TaskStatus> {
    const accountMap = this.accountTasks.get(accountId)
    if (!accountMap && this.cleanedAccounts.has(accountId)) {
      return {} as Record<TaskId, TaskStatus>
    }

    const result: Record<string, TaskStatus> = {}
    for (const taskId of this.taskTemplates.keys()) {
      result[taskId] = accountMap?.get(taskId)?.status || 'idle'
    }
    return result as Record<TaskId, TaskStatus>
  }

  /**
   * 获取所有任务状态（全局，向后兼容）
   */
  getAllStatus(): Record<TaskId, TaskStatus> {
    const result: Record<string, TaskStatus> = {}
    for (const taskId of this.taskTemplates.keys()) {
      result[taskId] = this.getStatus(taskId)
    }
    return result as Record<TaskId, TaskStatus>
  }

  /**
   * 清理账号的所有任务状态（账号删除时调用）
   */
  cleanupAccount(accountId: string): void {
    console.log(`[TaskManager] Cleaning up tasks for account ${accountId}`)
    const accountMap = this.accountTasks.get(accountId)
    if (accountMap) {
      // 停止所有运行中的任务
      for (const [taskId, taskState] of accountMap.entries()) {
        if (taskState.status === 'running' || taskState.status === 'stopping') {
          try {
            const result = taskState.taskInstance.stop('manual')
            if (result instanceof Promise) {
              result.catch((error: Error) => {
                console.error(`[TaskManager] Error stopping task ${taskId} during cleanup:`, error)
              })
            }
          } catch (error) {
            console.error(`[TaskManager] Error stopping task ${taskId} during cleanup:`, error)
          }
        }
      }
      this.accountTasks.delete(accountId)
      this.cleanedAccounts.add(accountId)
    }
  }
}

// 导出单例
export const taskManager = new TaskManagerImpl()
