/**
 * 任务连接守卫 Hook
 * 监听连接状态变化，自动停止任务
 * 作为 disconnectedEvent 的兜底机制，确保连接断开时任务一定被停止
 */

import { useEffect } from 'react'
import { stopAllLiveTasks } from '@/utils/stopAllLiveTasks'
import { useAccounts } from './useAccounts'
import { useCurrentLiveControl } from './useLiveControl'

/**
 * 监听连接状态，自动停止任务（兜底机制）
 * 当连接断开或进入错误态时，委托统一停止入口处理
 */
export function useTaskConnectionGuard() {
  const connectState = useCurrentLiveControl(context => context.connectState)
  const currentAccountId = useAccounts(state => state.currentAccountId)

  useEffect(() => {
    const shouldStop =
      currentAccountId &&
      (connectState.status === 'disconnected' || connectState.status === 'error')

    if (!shouldStop) {
      return
    }

    void stopAllLiveTasks(currentAccountId, 'disconnected', false).catch(error => {
      console.error('[TaskConnectionGuard] Failed to delegate stopAllLiveTasks:', error)
    })
  }, [connectState.status, currentAccountId])
}
