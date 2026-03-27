/**
 * TaskManager Hook
 * 提供便捷的任务管理接口
 */

import { useMemoizedFn } from 'ahooks'
import { taskManager } from '@/tasks'
import { getGateTaskName, getTaskDisplayName } from '@/tasks/taskMeta'
import type { StopReason, TaskContext, TaskId } from '@/tasks/types'
import { getStopReasonText } from '@/utils/taskGate'
import { useAccounts } from './useAccounts'
import { useLiveControlStore } from './useLiveControl'
import { useToast } from './useToast'

function buildTaskToastKey(
  taskId: TaskId,
  accountId: string,
  type: 'success' | 'error' | 'warning' | 'info',
  reason?: StopReason | 'already-running',
) {
  return ['task', type, taskId, accountId, reason ?? 'default'].join(':')
}

/**
 * 使用 TaskManager 的 Hook
 */
export function useTaskManager() {
  const { currentAccountId } = useAccounts()
  const { toast } = useToast()

  /**
   * 创建任务上下文
   */
  const createContext = useMemoizedFn((taskId: TaskId): TaskContext => {
    const liveControlContext = useLiveControlStore.getState().contexts[currentAccountId]
    const displayName = getTaskDisplayName(taskId)

    return {
      accountId: currentAccountId,
      gateState: liveControlContext
        ? {
            connectionState: liveControlContext.connectState.status,
            streamState: liveControlContext.streamState,
          }
        : undefined,
      toast: {
        success: (message: string) =>
          toast.success({
            title: displayName,
            description: message,
            dedupeKey: buildTaskToastKey(taskId, currentAccountId, 'success'),
            duration: 2500,
            priority: 2,
          }),
        error: (message: string) =>
          toast.error({
            title: `${displayName}异常`,
            description: message,
            dedupeKey: buildTaskToastKey(taskId, currentAccountId, 'error'),
            duration: 4500,
            priority: 4,
          }),
      },
      ipcInvoke: (channel, ...args) => {
        if (!window.ipcRenderer) {
          throw new Error('IPC renderer not available')
        }
        return window.ipcRenderer.invoke(channel, ...args)
      },
    }
  })

  /**
   * 启动任务
   */
  const startTask = useMemoizedFn(async (taskId: TaskId): Promise<boolean> => {
    const ctx = createContext(taskId)
    const displayName = getTaskDisplayName(taskId)
    // 【Phase 2B-1】taskManager.start() 已基于任务实例真实状态返回 ALREADY_RUNNING
    const result = await taskManager.start(taskId, ctx)

    if (!result.success) {
      if (result.reason === 'NOT_CONNECTED' || result.reason === 'NOT_LIVE') {
        // Gate 检查失败，不显示 toast（由 GateButton 处理）
        console.log(`[useTaskManager] Gate check failed: ${result.message}`)
      } else if (result.reason === 'ALREADY_RUNNING') {
        // 【Phase 2B-1】基于真实运行状态的提示
        console.log(
          `[useTaskManager] Task ${taskId} is already running for account ${currentAccountId}`,
        )
        toast.info({
          title: `${displayName}已在运行`,
          description: result.message || '任务已在运行中',
          dedupeKey: buildTaskToastKey(taskId, currentAccountId, 'info', 'already-running'),
          duration: 2200,
          priority: 1,
        })
      } else {
        toast.error({
          title: `${displayName}启动失败`,
          description: result.message || '启动任务失败',
          dedupeKey: buildTaskToastKey(taskId, currentAccountId, 'error'),
          duration: 4500,
          priority: 4,
        })
      }
      return false
    }

    return true
  })

  /**
   * 停止任务
   */
  const stopTask = useMemoizedFn(
    async (taskId: TaskId, reason: StopReason = 'manual'): Promise<void> => {
      // 【修复】传入 accountId 以停止指定账号的任务
      await taskManager.stop(taskId, reason, currentAccountId)
      const displayName = getTaskDisplayName(taskId)

      // 显示停止提示（仅非手动停止时显示）
      if (reason === 'manual') {
        toast.success({
          title: `${displayName}已停止`,
          description: '任务已手动停止',
          dedupeKey: buildTaskToastKey(taskId, currentAccountId, 'success', reason),
          duration: 2200,
          priority: 2,
        })
      } else {
        const taskName = getGateTaskName(taskId)
        const reasonText = getStopReasonText(reason, taskName)
        toast.warning({
          title: `${displayName}已停止`,
          description: reasonText,
          dedupeKey: buildTaskToastKey(taskId, currentAccountId, 'warning', reason),
          duration: 3500,
          priority: 3,
        })
      }
    },
  )

  /**
   * 获取任务状态
   */
  const getTaskStatus = useMemoizedFn((taskId: TaskId) => {
    // 【修复】传入 accountId 以获取指定账号的任务状态
    return taskManager.getStatus(taskId, currentAccountId)
  })

  return {
    startTask,
    stopTask,
    getTaskStatus,
    taskManager,
  }
}
