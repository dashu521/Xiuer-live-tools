/**
 * 一键启动任务 Hook
 * 同时启动自动回复、自动发言、自动弹窗三个任务
 *
 * 注意：自动回复会自动触发数据监控的启动，这是通过 useAutoReply 内部的逻辑实现的
 * 参见 AutoReply/index.tsx 中的 startListening 函数
 */

import { useMemoizedFn } from 'ahooks'
import { useMemo, useState } from 'react'
import type { LooseElectronAPI } from 'shared/electron-api'
import { taskManager } from '@/tasks'
import type { TaskContext } from '@/tasks/types'
import { taskStateManager } from '@/utils/TaskStateManager'
import { useAccounts } from './useAccounts'
import { useCurrentAutoMessage } from './useAutoMessage'
import { useCurrentAutoPopUp } from './useAutoPopUp'
import { useAutoReply } from './useAutoReply'
import { useLiveControlStore } from './useLiveControl'
import { useLiveFeatureGate } from './useLiveFeatureGate'
import { useLiveStatsStore } from './useLiveStats'
import { useToast } from './useToast'

export interface OneClickStartState {
  isLoading: boolean
  canStart: boolean
  gateMessage: string
  isAnyTaskRunning: boolean
}

export function useOneClickStart(): {
  state: OneClickStartState
  startAllTasks: () => Promise<void>
  stopAllTasks: () => void
  checkCanStart: () => boolean
  isAnyTaskRunning: boolean
} {
  const { toast } = useToast()
  const gate = useLiveFeatureGate()
  const { currentAccountId } = useAccounts()

  // 自动回复
  const { isRunning: isAutoReplyRunning } = useAutoReply()

  // 自动发言
  const isAutoMessageRunning = useCurrentAutoMessage(ctx => ctx.isRunning)

  // 自动弹窗
  const isAutoPopUpRunning = useCurrentAutoPopUp(ctx => ctx.isRunning)

  const [isLoading, setIsLoading] = useState(false)

  const canStart = gate.canUse
  const gateMessage = gate.message

  const checkCanStart = useMemoizedFn(() => {
    if (!canStart) {
      toast.error(gateMessage)
      return false
    }
    return true
  })

  const createTaskContext = useMemoizedFn((): TaskContext => {
    const liveControlContext = useLiveControlStore.getState().contexts[currentAccountId]
    return {
      accountId: currentAccountId,
      gateState: liveControlContext
        ? {
            connectionState: liveControlContext.connectState.status,
            streamState: liveControlContext.streamState,
          }
        : undefined,
      toast: {
        success: (message: string) => toast.success(message),
        error: (message: string) => toast.error(message),
      },
      ipcInvoke: async <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
        return (window as unknown as LooseElectronAPI).ipcRenderer.invoke(
          channel,
          ...args,
        ) as Promise<T>
      },
    }
  })

  const startAllTasks = useMemoizedFn(async () => {
    if (!checkCanStart()) return

    setIsLoading(true)
    const results: { task: string; success: boolean }[] = []

    try {
      const ctx = createTaskContext()
      const autoReplyResult = await taskManager.start('autoReply', ctx)
      results.push({ task: '自动回复', success: autoReplyResult.success })

      if (!isAutoMessageRunning) {
        try {
          const result = await taskManager.start('autoSpeak', ctx)
          if (result.success) {
            results.push({ task: '自动发言', success: true })
          } else {
            console.error('[OneClickStart] Failed to start auto speak:', result.message)
            results.push({ task: '自动发言', success: false })
          }
        } catch (error) {
          console.error('[OneClickStart] Failed to start auto speak:', error)
          results.push({ task: '自动发言', success: false })
        }
      } else {
        results.push({ task: '自动发言', success: true })
      }

      if (!isAutoPopUpRunning) {
        const result = await taskManager.start('autoPopup', ctx)
        results.push({ task: '自动弹窗', success: result.success })
      } else {
        results.push({ task: '自动弹窗', success: true })
      }

      const successCount = results.filter(r => r.success).length
      const totalCount = results.length

      if (successCount === totalCount) {
        toast.success('已开始启动自动任务，请稍等一下')
      } else {
        const failedTasks = results
          .filter(r => !r.success)
          .map(r => r.task)
          .join('、')
        toast.error(`${failedTasks}启动失败，请重试`)
      }
    } catch (error) {
      toast.error('部分功能启动失败，你可以重试一次或单独开启')
      console.error('[OneClickStart] Failed to start tasks:', error)
    } finally {
      setIsLoading(false)
    }
  })

  const stopAllTasks = useMemoizedFn(async () => {
    const result = await taskStateManager.stopAllTasksForAccount(
      currentAccountId,
      'manual',
      true,
      message => {
        if (result.stoppedTasks.length > 0) {
          toast.success('已停止当前账号的自动任务')
        } else if (result.alreadyStopped.length > 0) {
          toast.info(message)
        }
      },
    )

    // 记录结果
    console.log('[OneClickStart] Stop result:', {
      stopped: result.stoppedTasks,
      alreadyStopped: result.alreadyStopped,
      errors: result.errors.length,
    })
  })

  // 检查数据监控是否运行
  const isLiveStatsRunning = useLiveStatsStore(
    state => state.contexts[currentAccountId]?.isListening ?? false,
  )

  const isAnyTaskRunning =
    isAutoReplyRunning || isAutoMessageRunning || isAutoPopUpRunning || isLiveStatsRunning

  const state = useMemo(
    () => ({
      isLoading,
      canStart,
      gateMessage,
      isAnyTaskRunning,
    }),
    [isLoading, canStart, gateMessage, isAnyTaskRunning],
  )

  return {
    state,
    startAllTasks,
    stopAllTasks,
    checkCanStart,
    isAnyTaskRunning,
  }
}
