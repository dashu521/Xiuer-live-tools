/**
 * 账号状态管理 Hook
 * 集中管理所有账号的任务运行状态
 */

import { useCallback, useEffect, useRef } from 'react'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { taskManager } from '@/tasks'
import type { TaskId } from '@/tasks/types'
import type {
  AccountStatusMap,
  AccountTaskState,
  ConnectionStatus,
  TaskStatusInfo,
} from '@/types/account-status'
import { useAccounts } from './useAccounts'
import { useAutoMessageStore } from './useAutoMessage'
import { useAutoPopUpStore } from './useAutoPopUp'
import { useAutoReplyStore } from './useAutoReply'
import { useLiveControlStore } from './useLiveControl'
import { useLiveStatsStore } from './useLiveStats'

// 任务名称映射
const _TASK_NAME_MAP: Record<string, string> = {
  autoSpeak: '自动发言',
  autoReply: '自动回复',
}

/**
 * 账号状态 Store
 */
interface AccountStatusStore {
  /** 所有账号状态 */
  statusMap: AccountStatusMap
  /** 更新账号状态 */
  updateAccountStatus: (accountId: string, state: Partial<AccountTaskState>) => void
  /** 设置完整状态映射 */
  setStatusMap: (map: AccountStatusMap) => void
  /** 获取账号状态 */
  getAccountStatus: (accountId: string) => AccountTaskState | undefined
  /** 清理账号状态 */
  removeAccountStatus: (accountId: string) => void
}

const useAccountStatusStore = create<AccountStatusStore>()(
  subscribeWithSelector((set, get) => ({
    statusMap: {},

    updateAccountStatus: (accountId, state) => {
      set(prev => ({
        statusMap: {
          ...prev.statusMap,
          [accountId]: {
            ...prev.statusMap[accountId],
            accountId,
            ...state,
            lastUpdated: Date.now(),
          } as AccountTaskState,
        },
      }))
    },

    setStatusMap: map => set({ statusMap: map }),

    getAccountStatus: accountId => {
      return get().statusMap[accountId]
    },

    removeAccountStatus: accountId => {
      set(prev => {
        const newMap = { ...prev.statusMap }
        delete newMap[accountId]
        return { statusMap: newMap }
      })
    },
  })),
)

/**
 * 获取任务信息
 */
function _getTaskInfo(taskId: TaskId, accountId: string) {
  const status = taskManager.getStatus(taskId, accountId)

  return {
    taskId,
    status,
    // 这里可以扩展更多任务信息
  }
}

/**
 * 账号状态管理 Hook
 */
export function useAccountStatus() {
  const { statusMap, updateAccountStatus, removeAccountStatus } = useAccountStatusStore()
  const accounts = useAccounts(state => state.accounts)
  const _currentAccountId = useAccounts(state => state.currentAccountId)

  // 定时更新状态的引用
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * 刷新指定账号的状态
   */
  const refreshAccountStatus = useCallback(
    (accountId: string) => {
      // 获取连接状态
      const connectState = useLiveControlStore.getState().contexts[accountId]?.connectState

      let connectionStatus: ConnectionStatus = 'disconnected'
      if (connectState) {
        switch (connectState.status) {
          case 'connecting':
            connectionStatus = 'connecting'
            break
          case 'connected':
            connectionStatus = 'connected'
            break
          case 'disconnected':
            connectionStatus = 'disconnected'
            break
          default:
            connectionStatus = 'disconnected'
        }
      }

      // 获取所有任务状态（从各自的Store获取，而不是TaskManager）
      const tasks: TaskStatusInfo[] = []

      // 从自动发言Store获取状态
      const autoMessageContext = useAutoMessageStore.getState().contexts[accountId]
      tasks.push({
        taskId: 'autoSpeak',
        status: autoMessageContext?.isRunning ? 'running' : 'idle',
      })

      // 从自动弹窗Store获取状态
      const autoPopUpContext = useAutoPopUpStore.getState().contexts[accountId]
      tasks.push({
        taskId: 'autoPopup',
        status: autoPopUpContext?.isRunning ? 'running' : 'idle',
      })

      // 从自动回复Store获取状态
      const autoReplyContext = useAutoReplyStore.getState().contexts[accountId]
      tasks.push({
        taskId: 'autoReply',
        status: autoReplyContext?.isRunning ? 'running' : 'idle',
      })

      // 从数据监控Store获取状态
      const liveStatsContext = useLiveStatsStore.getState().contexts[accountId]
      tasks.push({
        taskId: 'liveStats',
        status: liveStatsContext?.isListening ? 'running' : 'idle',
      })

      updateAccountStatus(accountId, {
        accountId,
        connectionStatus,
        tasks,
      })
    },
    [updateAccountStatus],
  )

  /**
   * 刷新所有账号状态
   */
  const refreshAllStatus = useCallback(() => {
    accounts.forEach(account => {
      refreshAccountStatus(account.id)
    })
  }, [accounts, refreshAccountStatus])

  /**
   * 开始定时刷新
   */
  const startPolling = useCallback(
    (interval = 2000) => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      // 立即刷新一次
      refreshAllStatus()

      // 定时刷新
      intervalRef.current = setInterval(() => {
        refreshAllStatus()
      }, interval)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    },
    [refreshAllStatus],
  )

  /**
   * 停止定时刷新
   */
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  return {
    statusMap,
    refreshAccountStatus,
    refreshAllStatus,
    startPolling,
    stopPolling,
    removeAccountStatus,
  }
}

/**
 * 获取指定账号的状态（Selector Hook）
 */
export function useAccountStatusSelector(accountId: string) {
  return useAccountStatusStore(useCallback(state => state.statusMap[accountId], [accountId]))
}

/**
 * 获取所有账号状态
 */
export function useAllAccountStatus() {
  return useAccountStatusStore(state => state.statusMap)
}

// 导出 Store 供外部使用
export { useAccountStatusStore }
