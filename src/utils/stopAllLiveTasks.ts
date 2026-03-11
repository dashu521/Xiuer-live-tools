/**
 * 统一的任务停止机制
 * 当连接断开或直播结束时，强制停止所有直播相关任务
 */

import { IPC_CHANNELS } from 'shared/ipcChannels'
import { useAutoMessageStore } from '@/hooks/useAutoMessage'
import { useAutoPopUpStore } from '@/hooks/useAutoPopUp'
import { useAutoReplyStore } from '@/hooks/useAutoReply'
import { useLiveStatsStore } from '@/hooks/useLiveStats'
import type { TaskStopReason } from './taskGate'
import { getStopReasonText } from './taskGate'

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
  console.log(`[TaskGate] stopAllLiveTasks called for account ${accountId}, reason: ${reason}`)

  const stoppedTasks: string[] = []

  try {
    // 1. 检查评论监听状态（自动回复和数据监控共享同一个监听器）
    const autoReplyStore = useAutoReplyStore.getState()
    const autoReplyContext = autoReplyStore.contexts[accountId]
    const liveStatsStore = useLiveStatsStore.getState()
    const liveStatsContext = liveStatsStore.contexts[accountId]

    const autoReplyListening =
      autoReplyContext?.isListening === 'listening' || autoReplyContext?.isListening === 'waiting'
    const liveStatsListening = liveStatsContext?.isListening === true

    // 只要任一方在监听，就需要停止 IPC 监听器
    if (autoReplyListening || liveStatsListening) {
      console.log(
        `[TaskGate] Stopping comment listener for account ${accountId}, reason: ${reason}`,
      )
      console.log(
        `[task] Status before stop: autoReply.isListening=${autoReplyContext?.isListening}, liveStats.isListening=${liveStatsContext?.isListening}`,
      )
      try {
        await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.autoReply.stopCommentListener, accountId)
        console.log('[task] Comment listener IPC stop invoked successfully')
      } catch (error) {
        console.error('[TaskGate] Failed to stop comment listener:', error)
      }

      // 同步更新两边的状态
      if (autoReplyListening) {
        autoReplyStore.setIsListening(accountId, 'stopped')
        autoReplyStore.setIsRunning(accountId, false)
        stoppedTasks.push('auto-reply')
      }
      if (liveStatsListening) {
        liveStatsStore.setListening(accountId, false)
        stoppedTasks.push('live-stats')
      }
      console.log('[task] Status after stop: isListening=stopped')
    } else {
      console.log(
        `[TaskGate] Comment listener not running (autoReply=${autoReplyContext?.isListening}, liveStats=${liveStatsContext?.isListening}), skipping stop`,
      )
    }

    // 2. 停止自动发言任务（仅按账号停 IPC，避免 TaskManager 全局单任务误停其他账号）
    const autoMessageStore = useAutoMessageStore.getState()
    const autoMessageContext = autoMessageStore.contexts[accountId]
    if (autoMessageContext?.isRunning) {
      console.log(`[TaskGate] Stopping auto message task for account ${accountId}`)
      try {
        await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.autoMessage.stop, accountId)
        // 后端会发送 stoppedEvent(accountId)，AutoSpeakTask 的 handleStopped 会同步 TaskManager 状态
      } catch (error) {
        console.error('[TaskGate] Failed to stop auto message task:', error)
      }
      autoMessageStore.setIsRunning(accountId, false)
      stoppedTasks.push('auto-comment')
    }

    // 3. 停止自动弹窗任务
    const autoPopUpStore = useAutoPopUpStore.getState()
    const autoPopUpContext = autoPopUpStore.contexts[accountId]
    if (autoPopUpContext?.isRunning) {
      console.log(`[TaskGate] Stopping auto popup task for account ${accountId}`)
      try {
        await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.autoPopUp.stop, accountId)
      } catch (error) {
        console.error('[TaskGate] Failed to stop auto popup task:', error)
      }
      autoPopUpStore.setIsRunning(accountId, false)
      stoppedTasks.push('auto-popup')
    }

    // 显示停止提示（如果有任务被停止）
    if (stoppedTasks.length > 0 && showToast) {
      // 如果有多个任务，显示通用提示；如果只有一个，显示具体任务名
      if (stoppedTasks.length === 1) {
        const taskName = stoppedTasks[0]
        const reasonText = getStopReasonText(reason, taskName)
        console.log(`[TaskGate] Showing toast for stopped task: ${reasonText}`)
        if (toastCallback) {
          toastCallback(reasonText)
        } else {
          console.log(`[TaskGate] ${reasonText} (no toast callback provided)`)
        }
      } else {
        const reasonText = getStopReasonText(reason)
        console.log(`[TaskGate] Showing toast for stopped tasks: ${reasonText}`)
        if (toastCallback) {
          toastCallback(reasonText)
        } else {
          console.log(`[TaskGate] ${reasonText} (no toast callback provided)`)
        }
      }
    } else if (stoppedTasks.length === 0) {
      console.log('[TaskGate] No tasks were running, nothing to stop')
    }

    console.log(
      `[TaskGate] All tasks stopped for account ${accountId}, reason: ${reason}, stopped: ${stoppedTasks.join(', ')}`,
    )
  } catch (error) {
    console.error('[TaskGate] Error stopping tasks:', error)
  }
}
