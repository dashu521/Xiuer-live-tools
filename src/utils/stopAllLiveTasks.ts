/**
 * 统一的任务停止机制
 * 当连接断开或直播结束时，强制停止所有直播相关任务
 *
 * @see docs/live-control-lifecycle-spec.md 中控台与直播状态管理总规范
 *
 * 核心规则：
 * - stopAll 必须幂等
 * - 状态必须按 accountId 隔离
 */

import { taskStateManager } from './TaskStateManager'
import type { TaskStopReason } from './taskGate'

/**
 * 停止所有直播相关任务
 *
 * @param accountId - 账号ID
 * @param reason - 停止原因
 * @param showToast - 是否显示 toast 提示（默认 true）
 * @param toastCallback - toast 回调函数
 */
export async function stopAllLiveTasks(
  accountId: string,
  reason: TaskStopReason,
  showToast = true,
  toastCallback?: (message: string) => void,
): Promise<void> {
  console.log(
    `[stopAllLiveTasks] Delegating to TaskStateManager for account ${accountId}, reason: ${reason}`,
  )

  // 映射 TaskStopReason 到 TaskStateManager 的 reason
  const mappedReason =
    reason === 'stream_ended'
      ? 'stream_ended'
      : reason === 'disconnected'
        ? 'disconnected'
        : 'auto_stop'

  await taskStateManager.stopAllTasksForAccount(accountId, mappedReason, showToast, toastCallback)
}
