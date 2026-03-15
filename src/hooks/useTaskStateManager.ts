/**
 * 兼容层：任务状态与停止入口统一委托给 utils/TaskStateManager。
 * 保留原 hook 文件路径，避免旧引用继续持有第二套实现。
 */

import {
  forceResetAllTaskStates as forceResetAllTaskStatesImpl,
  reconcileTaskStates as reconcileTaskStatesImpl,
  taskStateManager,
} from '@/utils/TaskStateManager'

export type TaskType = 'auto-message' | 'auto-popup' | 'auto-reply' | 'sub-account' | 'live-stats'

export interface TaskStatus {
  type: TaskType
  isRunning: boolean
  displayName: string
}

export function getAllTaskStatuses(accountId: string): TaskStatus[] {
  return taskStateManager.getTaskStates(accountId)
}

export function isAnyTaskRunning(accountId: string): boolean {
  return taskStateManager.hasAnyRunningTask(accountId)
}

export function getRunningTasks(accountId: string): TaskType[] {
  return taskStateManager.getRunningTasks(accountId)
}

export async function stopAllTasksForAccount(
  accountId: string,
  reason: 'manual' | 'disconnected' | 'stream_ended' | 'other' = 'manual',
): Promise<{
  success: boolean
  stoppedTasks: TaskType[]
  alreadyStopped: boolean
  errors: { task: TaskType; error: unknown }[]
}> {
  const result = await taskStateManager.stopAllTasksForAccount(
    accountId,
    reason === 'other' ? 'auto_stop' : reason,
    false,
  )

  return {
    success: result.errors.length === 0,
    stoppedTasks: result.stoppedTasks,
    alreadyStopped: result.stoppedTasks.length === 0,
    errors: result.errors.map(error => ({ task: error.type, error: error.error })),
  }
}

export async function reconcileTaskStates(accountId: string): Promise<{
  wasInconsistent: boolean
  fixedTasks: TaskType[]
}> {
  return reconcileTaskStatesImpl(accountId)
}

export function forceResetAllTaskStates(accountId: string): void {
  forceResetAllTaskStatesImpl(accountId)
}
