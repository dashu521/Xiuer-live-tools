/**
 * 任务连接守卫 Hook
 * 监听连接状态变化，自动停止任务
 * 作为 disconnectedEvent 的兜底机制，确保连接断开时任务一定被停止
 */

import { useEffect } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { useAccounts } from './useAccounts'
import { useAutoMessageStore } from './useAutoMessage'
import { useAutoPopUpStore } from './useAutoPopUp'
import { useAutoReplyStore } from './useAutoReply'
import { useCurrentLiveControl } from './useLiveControl'
import { useLiveStatsStore } from './useLiveStats'

/**
 * 监听连接状态，自动停止任务（兜底机制）
 * 当连接断开时，同步停止前端状态并调用 IPC 停止后端任务
 */
export function useTaskConnectionGuard() {
  const connectState = useCurrentLiveControl(context => context.connectState)
  const { currentAccountId } = useAccounts()

  useEffect(() => {
    // 如果连接断开，停止所有任务
    if (connectState.status !== 'connected' && currentAccountId) {
      const autoReplyStore = useAutoReplyStore.getState()
      const autoMessageStore = useAutoMessageStore.getState()
      const autoPopUpStore = useAutoPopUpStore.getState()
      const liveStatsStore = useLiveStatsStore.getState()

      const autoReplyContext = autoReplyStore.contexts[currentAccountId]
      const autoMessageContext = autoMessageStore.contexts[currentAccountId]
      const autoPopUpContext = autoPopUpStore.contexts[currentAccountId]
      const liveStatsContext = liveStatsStore.contexts[currentAccountId]

      // 检查是否有任务在运行
      const autoReplyListening =
        autoReplyContext?.isListening === 'listening' || autoReplyContext?.isListening === 'waiting'
      const liveStatsListening = liveStatsContext?.isListening === true
      const autoMessageRunning = autoMessageContext?.isRunning === true
      const autoPopUpRunning = autoPopUpContext?.isRunning === true

      // 如果有任务在运行，调用 IPC 停止它们
      if (autoReplyListening || liveStatsListening || autoMessageRunning || autoPopUpRunning) {
        console.log(
          `[TaskConnectionGuard] Connection lost for account ${currentAccountId}, stopping all tasks`,
        )

        // 停止评论监听（自动回复和数据监控共享）
        if (autoReplyListening || liveStatsListening) {
          window.ipcRenderer
            ?.invoke(IPC_CHANNELS.tasks.autoReply.stopCommentListener, currentAccountId)
            .catch(error => {
              console.error('[TaskConnectionGuard] Failed to stop comment listener:', error)
            })

          if (autoReplyListening) {
            autoReplyStore.setIsListening(currentAccountId, 'stopped')
            autoReplyStore.setIsRunning(currentAccountId, false)
          }
          if (liveStatsListening) {
            liveStatsStore.setListening(currentAccountId, false)
          }
        }

        // 停止自动发言
        if (autoMessageRunning) {
          window.ipcRenderer
            ?.invoke(IPC_CHANNELS.tasks.autoMessage.stop, currentAccountId)
            .catch(error => {
              console.error('[TaskConnectionGuard] Failed to stop auto message:', error)
            })
          autoMessageStore.setIsRunning(currentAccountId, false)
        }

        // 停止自动弹窗
        if (autoPopUpRunning) {
          window.ipcRenderer
            ?.invoke(IPC_CHANNELS.tasks.autoPopUp.stop, currentAccountId)
            .catch(error => {
              console.error('[TaskConnectionGuard] Failed to stop auto popup:', error)
            })
          autoPopUpStore.setIsRunning(currentAccountId, false)
        }
      }
    }
  }, [connectState.status, currentAccountId])
}
