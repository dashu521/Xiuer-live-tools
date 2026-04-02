import { uniqueId } from 'lodash-es'
import type { ScopedLogger } from '#/logger'
import { type ITask, type TaskStopCallback, TaskStopReason } from './ITask'

export interface BaseTaskProps {
  taskName: string
  readonly logger: ScopedLogger
}

export function createTask(
  props: BaseTaskProps,
  hooks: { onStart?: () => Promise<void> | void; onStop?: () => void },
): ITask {
  const { taskName, logger } = props
  const taskId = uniqueId(taskName)
  const stopListeners: TaskStopCallback[] = []
  let isRunning = false
  let lastStopReason: TaskStopReason | null = null
  let lastStopError: unknown

  async function start() {
    if (!isRunning) {
      isRunning = true
      lastStopReason = null
      lastStopError = undefined
      try {
        await hooks.onStart?.()
      } catch (err) {
        stop(TaskStopReason.ERROR, err)
        // 【P0修复】异常必须向上抛出，不允许静默吞掉
        throw err
      }
    }
  }

  async function stop(reason: TaskStopReason = TaskStopReason.MANUAL, err?: unknown) {
    if (!isRunning) return
    isRunning = false
    lastStopReason = reason
    lastStopError = err
    if (err) {
      logger.error('任务因错误中断：', err)
    } else {
      logger.info('任务已停止')
    }
    hooks.onStop?.()
    stopListeners.forEach(cb => {
      cb(taskId, reason, err)
    })
  }

  return {
    start,
    stop,
    getTaskId: () => taskId,
    addStopListener: (cb: TaskStopCallback) => {
      stopListeners.push(cb)
    },
    getLastStopInfo: () => ({
      reason: lastStopReason,
      error: lastStopError,
    }),
    isRunning: () => isRunning,
  }
}
