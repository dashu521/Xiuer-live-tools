/**
 * 自动停机 Hook
 * 当 Gate 条件不满足时，自动停止正在运行的任务
 */

import { useEffect, useRef } from 'react'
import type { TaskStopReason } from '@/utils/taskGate'
import type { LiveFeatureGate } from './useLiveFeatureGate'
import { useToast } from './useToast'

export interface UseAutoStopOnGateLossParams {
  gate: LiveFeatureGate
  taskIsRunning: boolean
  stopAll: (reason: TaskStopReason) => Promise<void> | void
}

/**
 * 自动停机 Hook
 *
 * @param params - UseAutoStopOnGateLossParams
 */
export function useAutoStopOnGateLoss({
  gate,
  taskIsRunning,
  stopAll,
}: UseAutoStopOnGateLossParams) {
  const { toast } = useToast()
  const prevCanUseRef = useRef<boolean>(gate.canUse)
  const hasStoppedRef = useRef<boolean>(false)

  useEffect(() => {
    // 如果任务正在运行，但 Gate 条件不满足
    if (taskIsRunning && !gate.canUse) {
      // 检查是否从可用变为不可用
      const wasAvailable = prevCanUseRef.current

      if (wasAvailable && !hasStoppedRef.current) {
        // 判断停止原因
        let reason: TaskStopReason = 'disconnected'
        let toastMessage = ''

        if (gate.connectionState !== 'connected') {
          reason = 'disconnected'
          toastMessage = '中控台已断开，自动回复已停止'
        } else if (gate.streamState !== 'live') {
          reason = 'stream_ended'
          toastMessage = '直播已结束，自动回复已停止'
        } else if (gate.reason === 'AUTH_LOST') {
          reason = 'auth_lost'
          toastMessage = '登录已失效，自动回复已停止'
        } else {
          reason = 'disconnected'
          toastMessage = '自动回复已停止'
        }

        console.log(
          `[autostop] Gate lost detected: taskIsRunning=${taskIsRunning}, gate.canUse=${gate.canUse}, wasAvailable=${wasAvailable}`,
        )
        console.log(
          `[autostop] Gate state: connectionState=${gate.connectionState}, streamState=${gate.streamState}, reason=${gate.reason}`,
        )
        console.log(`[autostop] Stopping tasks with reason: ${reason}`)

        // 调用停止函数
        const stopResult = stopAll(reason)

        // 如果返回 Promise，等待完成后再显示 toast
        if (stopResult instanceof Promise) {
          stopResult
            .then(() => {
              console.log(`[autostop] Tasks stopped successfully, reason: ${reason}`)
              toast.error(toastMessage)
              hasStoppedRef.current = true
            })
            .catch(error => {
              console.error('[autostop] Failed to stop tasks:', error)
              toast.error(toastMessage)
              hasStoppedRef.current = true
            })
        } else {
          console.log('[autostop] Tasks stop function returned synchronously')
          toast.error(toastMessage)
          hasStoppedRef.current = true
        }
      }
    }

    // 更新上一次的 canUse 状态
    prevCanUseRef.current = gate.canUse

    // 如果任务停止或 Gate 条件满足，重置停止标记
    if (!taskIsRunning || gate.canUse) {
      hasStoppedRef.current = false
    }
  }, [
    gate.canUse,
    gate.connectionState,
    gate.streamState,
    gate.reason,
    taskIsRunning,
    stopAll,
    toast,
  ])
}
