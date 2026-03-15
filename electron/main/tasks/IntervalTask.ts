import { Result } from '@praha/byethrow'
import { ErrorFactory } from '@praha/error-factory'
import { AbortError, UnexpectedError } from '#/errors/AppError'
import { taskRuntimeMonitor } from '#/services/TaskRuntimeMonitor'
import { randomInt } from '#/utils'
import { type BaseTaskProps, createTask } from './BaseTask'
import { TaskStopReason } from './ITask'

export interface IntervalTaskProps extends BaseTaskProps {
  /** 定时执行的间隔，可以是区间也可以是定值 */
  interval: [number, number] | number
}

export function createIntervalTask(
  execute: (signal: AbortSignal) => Promise<Result.Result<void, Error>>,
  props: IntervalTaskProps,
) {
  const { logger } = props
  let timer: ReturnType<typeof setTimeout> | null = null
  let interval = props.interval
  let abortController: AbortController | null = null
  /** 下一次执行的特定间隔（由外部设置，优先于默认 interval） */
  let nextInterval: [number, number] | number | null = null

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
      // 从 logger 的 scope 名称中提取账号信息
      const scopeName =
        typeof props.logger.scope === 'function' ? props.logger.scope.name : 'unknown'
      taskRuntimeMonitor.decrementTimer(scopeName || 'unknown')
    }
  }

  const calculateNextInterval = () => {
    // 优先使用外部设置的特定间隔
    if (nextInterval !== null) {
      const specificInterval = nextInterval
      nextInterval = null // 使用后重置
      if (typeof specificInterval === 'number') {
        return specificInterval
      }
      const [mn, mx] = [Math.min(...specificInterval), Math.max(...specificInterval)]
      return randomInt(mn, mx)
    }
    // 使用默认间隔
    if (typeof interval === 'number') {
      return interval
    }
    const [mn, mx] = [Math.min(...interval), Math.max(...interval)]
    return randomInt(mn, mx)
  }

  /**
   * 设置下一次执行的特定间隔
   * 用于按商品设置不同弹窗时间的场景
   */
  function setNextInterval(customInterval: [number, number] | number) {
    nextInterval = customInterval
    logger.info(`[动态间隔] 已设置下一次执行间隔: ${JSON.stringify(customInterval)}`)
  }

  const task = createTask(props, {
    onStart: () => {
      scheduleNextRun()
    },
    onStop: () => {
      clearTimer()
      if (abortController) {
        abortController.abort()
        abortController = null
      }
    },
  })

  async function scheduleNextRun() {
    if (!task.isRunning()) {
      return
    }
    clearTimer()

    // 中止上一个任务
    if (abortController) {
      abortController.abort()
    }

    abortController = new AbortController()
    const { signal } = abortController

    try {
      const executeResult = await execute(signal)
      if (Result.isFailure(executeResult)) {
        // 任务被终止不影响后续（针对 restart）
        if (!(executeResult.error instanceof AbortError)) {
          return task.stop(TaskStopReason.ERROR, executeResult.error)
        }
      }

      if (task.isRunning() && !signal.aborted) {
        const interval = calculateNextInterval()
        timer = setTimeout(() => scheduleNextRun(), interval)
        const scopeName =
          typeof props.logger.scope === 'function' ? props.logger.scope.name : 'unknown'
        taskRuntimeMonitor.incrementTimer(scopeName || 'unknown')
        logger.info(`任务将在 ${interval / 1000} 秒后继续执行。`)
      }
    } catch (error) {
      // 兜底用的，不能保证 execute 里涉及的第三方库代码不会抛出错误
      task.stop(TaskStopReason.ERROR, new UnexpectedError({ cause: error }))
    }
  }

  function validateInterval(interval: IntervalTaskProps['interval']): Result.Result<void, Error> {
    if (
      (typeof interval === 'number' && interval <= 0) ||
      (Array.isArray(interval) && interval.some(t => t <= 0))
    ) {
      return Result.fail(new IntervalValidationError())
    }
    return Result.succeed()
  }

  /**
   * 【P1-2 运行时配置热更新】更新间隔配置
   * 支持运行时更新，无需重启任务
   */
  function updateInterval(newInterval: IntervalTaskProps['interval']): Result.Result<void, Error> {
    return Result.pipe(
      validateInterval(newInterval),
      Result.inspect(() => {
        const oldInterval = interval
        interval = newInterval
        logger.info(
          `[热更新] 间隔已更新: ${JSON.stringify(oldInterval)} -> ${JSON.stringify(newInterval)}`,
        )

        // 如果任务正在运行，立即应用新间隔（下一个周期生效）
        if (task.isRunning()) {
          logger.info('[热更新] 新间隔将在下一个执行周期生效')
        }
      }),
    )
  }

  return Result.pipe(
    validateInterval(interval),
    Result.map(() => ({
      ...task,
      validateInterval,
      updateInterval,
      setNextInterval,
      restart() {
        if (!task.isRunning()) return
        scheduleNextRun()
      },
    })),
  )
}

class IntervalValidationError extends ErrorFactory({
  name: 'IntervalValidationError',
  message: '计时器配置验证失败：不能将计时器设置为 0 或负数',
}) {}
