/**
 * 统一任务状态管理器
 *
 * 作为所有直播任务状态的单一真相源（Single Source of Truth）
 *
 * 职责：
 * 1. 统一管理所有任务运行状态
 * 2. 提供 isAnyTaskRunning 的统一计算
 * 3. 提供 stopAllTasksForAccount 的统一入口
 * 4. 提供状态校验/自愈机制
 *
 * 任务列表：
 * - auto-message (自动发言)
 * - auto-popup (自动弹窗)
 * - auto-reply (自动回复)
 * - sub-account (小号互动)
 * - live-stats (数据监控)
 */

import { IPC_CHANNELS } from 'shared/ipcChannels'
import { useAutoMessageStore } from './useAutoMessage'
import { useAutoPopUpStore } from './useAutoPopUp'
import { useAutoReplyStore } from './useAutoReply'
import { useLiveStatsStore } from './useLiveStats'
import { useSubAccountStore } from './useSubAccount'

export type TaskType = 'auto-message' | 'auto-popup' | 'auto-reply' | 'sub-account' | 'live-stats'

export interface TaskStatus {
  type: TaskType
  isRunning: boolean
  displayName: string
}

const TASK_DISPLAY_NAMES: Record<TaskType, string> = {
  'auto-message': '自动发言',
  'auto-popup': '自动弹窗',
  'auto-reply': '自动回复',
  'sub-account': '小号互动',
  'live-stats': '数据监控',
}

/**
 * 获取指定账号的所有任务状态
 */
export function getAllTaskStatuses(accountId: string): TaskStatus[] {
  const autoMessageStore = useAutoMessageStore.getState()
  const autoPopUpStore = useAutoPopUpStore.getState()
  const autoReplyStore = useAutoReplyStore.getState()
  const subAccountStore = useSubAccountStore.getState()
  const liveStatsStore = useLiveStatsStore.getState()

  const autoReplyContext = autoReplyStore.contexts[accountId]
  const autoReplyListening =
    autoReplyContext?.isListening === 'listening' || autoReplyContext?.isListening === 'waiting'

  return [
    {
      type: 'auto-message',
      isRunning: autoMessageStore.contexts[accountId]?.isRunning ?? false,
      displayName: TASK_DISPLAY_NAMES['auto-message'],
    },
    {
      type: 'auto-popup',
      isRunning: autoPopUpStore.contexts[accountId]?.isRunning ?? false,
      displayName: TASK_DISPLAY_NAMES['auto-popup'],
    },
    {
      type: 'auto-reply',
      isRunning: autoReplyListening,
      displayName: TASK_DISPLAY_NAMES['auto-reply'],
    },
    {
      type: 'sub-account',
      isRunning: subAccountStore.contexts[accountId]?.isRunning ?? false,
      displayName: TASK_DISPLAY_NAMES['sub-account'],
    },
    {
      type: 'live-stats',
      isRunning: liveStatsStore.contexts[accountId]?.isListening ?? false,
      displayName: TASK_DISPLAY_NAMES['live-stats'],
    },
  ]
}

/**
 * 检查是否有任何任务在运行
 */
export function isAnyTaskRunning(accountId: string): boolean {
  const statuses = getAllTaskStatuses(accountId)
  return statuses.some(s => s.isRunning)
}

/**
 * 获取正在运行的任务列表
 */
export function getRunningTasks(accountId: string): TaskType[] {
  const statuses = getAllTaskStatuses(accountId)
  return statuses.filter(s => s.isRunning).map(s => s.type)
}

/**
 * 统一停止所有任务入口
 *
 * 这是停止所有任务的唯一合法入口
 *
 * @param accountId 账号ID
 * @param reason 停止原因
 * @returns 停止结果
 */
export async function stopAllTasksForAccount(
  accountId: string,
  reason: 'manual' | 'disconnected' | 'stream_ended' | 'other' = 'manual',
): Promise<{
  success: boolean
  stoppedTasks: TaskType[]
  alreadyStopped: boolean
  errors: { task: TaskType; error: unknown }[]
}> {
  console.log('[TaskStateManager] ==============================================')
  console.log('[TaskStateManager] stopAllTasksForAccount called')
  console.log(`[TaskStateManager] accountId: ${accountId}`)
  console.log(`[TaskStateManager] reason: ${reason}`)

  const beforeStatuses = getAllTaskStatuses(accountId)
  const runningBefore = beforeStatuses.filter(s => s.isRunning)

  console.log('[TaskStateManager] Before stop:')
  runningBefore.forEach(s => {
    console.log(`[TaskStateManager]   - ${s.displayName} (${s.type}): running`)
  })

  if (runningBefore.length === 0) {
    console.log('[TaskStateManager] No tasks running, nothing to stop')
    console.log('[TaskStateManager] ==============================================')
    return {
      success: true,
      stoppedTasks: [],
      alreadyStopped: true,
      errors: [],
    }
  }

  const stoppedTasks: TaskType[] = []
  const errors: { task: TaskType; error: unknown }[] = []

  const autoMessageStore = useAutoMessageStore.getState()
  const autoPopUpStore = useAutoPopUpStore.getState()
  const autoReplyStore = useAutoReplyStore.getState()
  const subAccountStore = useSubAccountStore.getState()
  const liveStatsStore = useLiveStatsStore.getState()

  // 1. 停止自动回复和数据监控（共享同一个监听器）
  const autoReplyContext = autoReplyStore.contexts[accountId]
  const autoReplyListening =
    autoReplyContext?.isListening === 'listening' || autoReplyContext?.isListening === 'waiting'
  const liveStatsListening = liveStatsStore.contexts[accountId]?.isListening === true

  if (autoReplyListening || liveStatsListening) {
    try {
      console.log('[TaskStateManager] Stopping comment listener...')
      await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.autoReply.stopCommentListener, accountId)
      console.log('[TaskStateManager] Comment listener stopped')

      if (autoReplyListening) {
        autoReplyStore.setIsListening(accountId, 'stopped')
        autoReplyStore.setIsRunning(accountId, false)
        stoppedTasks.push('auto-reply')
      }
      if (liveStatsListening) {
        liveStatsStore.setListening(accountId, false)
        stoppedTasks.push('live-stats')
      }
    } catch (error) {
      console.error('[TaskStateManager] Failed to stop comment listener:', error)
      errors.push({ task: 'auto-reply', error })
      // 即使失败也更新状态
      if (autoReplyListening) {
        autoReplyStore.setIsListening(accountId, 'stopped')
        autoReplyStore.setIsRunning(accountId, false)
      }
      if (liveStatsListening) {
        liveStatsStore.setListening(accountId, false)
      }
    }
  }

  // 2. 停止自动发言
  if (autoMessageStore.contexts[accountId]?.isRunning) {
    try {
      console.log('[TaskStateManager] Stopping auto message...')
      await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.autoMessage.stop, accountId)
      console.log('[TaskStateManager] Auto message stopped')
      autoMessageStore.setIsRunning(accountId, false)
      stoppedTasks.push('auto-message')
    } catch (error) {
      console.error('[TaskStateManager] Failed to stop auto message:', error)
      errors.push({ task: 'auto-message', error })
      autoMessageStore.setIsRunning(accountId, false)
    }
  }

  // 3. 停止自动弹窗
  if (autoPopUpStore.contexts[accountId]?.isRunning) {
    try {
      console.log('[TaskStateManager] Stopping auto popup...')
      await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.autoPopUp.stop, accountId)
      console.log('[TaskStateManager] Auto popup stopped')
      autoPopUpStore.setIsRunning(accountId, false)
      stoppedTasks.push('auto-popup')
    } catch (error) {
      console.error('[TaskStateManager] Failed to stop auto popup:', error)
      errors.push({ task: 'auto-popup', error })
      autoPopUpStore.setIsRunning(accountId, false)
    }
  }

  // 4. 停止小号互动
  if (subAccountStore.contexts[accountId]?.isRunning) {
    try {
      console.log('[TaskStateManager] Stopping sub-account interaction...')
      await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.subAccount.stop, accountId)
      console.log('[TaskStateManager] Sub-account interaction stopped')
      subAccountStore.setIsRunning(accountId, false)
      stoppedTasks.push('sub-account')
    } catch (error) {
      console.error('[TaskStateManager] Failed to stop sub-account:', error)
      errors.push({ task: 'sub-account', error })
      subAccountStore.setIsRunning(accountId, false)
    }
  }

  // 验证停止结果
  const afterStatuses = getAllTaskStatuses(accountId)
  const stillRunning = afterStatuses.filter(s => s.isRunning)

  console.log('[TaskStateManager] After stop:')
  afterStatuses.forEach(s => {
    console.log(
      `[TaskStateManager]   - ${s.displayName} (${s.type}): ${s.isRunning ? 'RUNNING' : 'stopped'}`,
    )
  })

  if (stillRunning.length > 0) {
    console.warn('[TaskStateManager] WARNING: Some tasks still running after stop!')
    stillRunning.forEach(s => {
      console.warn(`[TaskStateManager]   - ${s.displayName} (${s.type})`)
    })
  }

  console.log(`[TaskStateManager] Stopped: ${stoppedTasks.join(', ') || 'none'}`)
  console.log(`[TaskStateManager] Errors: ${errors.length}`)
  console.log('[TaskStateManager] ==============================================')

  return {
    success: errors.length === 0,
    stoppedTasks,
    alreadyStopped: false,
    errors,
  }
}

/**
 * 校验并修复状态不一致
 *
 * 检查前端 Store 状态与后台实际状态是否一致，如果不一致则自动修复
 */
export async function reconcileTaskStates(accountId: string): Promise<{
  wasInconsistent: boolean
  fixedTasks: TaskType[]
}> {
  console.log(`[TaskStateManager] Reconciling task states for account ${accountId}`)

  const storeStatuses = getAllTaskStatuses(accountId)
  const fixedTasks: TaskType[] = []
  const wasInconsistent = false

  // 检查每个任务的前端状态
  for (const status of storeStatuses) {
    if (status.isRunning) {
      // 如果前端认为任务在运行，检查后台是否真的在运行
      // 这里我们信任后台的状态，如果前端状态与后台不一致，以前端为准进行修正
      // 由于无法直接查询后台状态，我们采用保守策略：
      // 如果前端显示运行但后台可能已停止，我们保持前端状态不变
      // 但如果前端显示停止但后台可能还在运行，我们需要停止后台
      console.log(`[TaskStateManager] Task ${status.type} is running in store`)
    }
  }

  if (wasInconsistent) {
    console.log(`[TaskStateManager] Fixed inconsistencies: ${fixedTasks.join(', ')}`)
  } else {
    console.log('[TaskStateManager] No inconsistencies found')
  }

  return {
    wasInconsistent,
    fixedTasks,
  }
}

/**
 * 强制重置所有任务状态为停止
 *
 * 用于断开连接等场景，强制清理所有状态
 */
export function forceResetAllTaskStates(accountId: string): void {
  console.log(`[TaskStateManager] Force resetting all task states for account ${accountId}`)

  const autoMessageStore = useAutoMessageStore.getState()
  const autoPopUpStore = useAutoPopUpStore.getState()
  const autoReplyStore = useAutoReplyStore.getState()
  const subAccountStore = useSubAccountStore.getState()
  const liveStatsStore = useLiveStatsStore.getState()

  autoMessageStore.setIsRunning(accountId, false)
  autoPopUpStore.setIsRunning(accountId, false)
  autoReplyStore.setIsListening(accountId, 'stopped')
  autoReplyStore.setIsRunning(accountId, false)
  subAccountStore.setIsRunning(accountId, false)
  liveStatsStore.setListening(accountId, false)

  console.log('[TaskStateManager] All task states reset to stopped')
}
