import { Result } from '@praha/byethrow'
import type { ScopedLogger } from '#/logger'
import { insertRandomSpaces, randomInt, replaceVariant, sleep } from '#/utils'
import type { IPerformComment } from './../platforms/IPlatform'
import { createTask } from './BaseTask'
import { TaskStopReason } from './ITask'

const TASK_NAME = '一键评论'

export function createSendBatchMessageTask(
  platform: IPerformComment,
  config: SendBatchMessagesConfig,
  _logger: ScopedLogger,
) {
  const logger = _logger.scope(TASK_NAME)
  const messages = config.messages
    .map(message => message.trim())
    .filter(message => message.length > 0)

  if (messages.length === 0) {
    return Result.fail(new Error('必须提供至少一条非空消息'))
  }

  async function execute() {
    try {
      const { count } = config
      for (let i = 0; i < count; i++) {
        if (!task.isRunning()) {
          break
        }
        const messageIndex = randomInt(0, messages.length - 1)
        let message = replaceVariant(messages[messageIndex])
        if (!config.noSpace) {
          message = insertRandomSpaces(message)
        }

        const result = await platform.performComment(message)
        if (Result.isFailure(result)) {
          return task.stop(TaskStopReason.ERROR, result.error)
        }
        logger.success(`成功发送第 ${i + 1}/${count} 条评论：${message}`)
        // 以防万一，加一个 1s 的小停顿
        await sleep(1000)
      }
      task.stop(TaskStopReason.COMPLETED)
    } catch (error) {
      task.stop(TaskStopReason.ERROR, error)
    }
  }

  const task = createTask(
    {
      taskName: TASK_NAME,
      logger,
    },
    {
      onStart: () => {
        // 后台执行批量发送，确保 start() 返回时任务仍处于 running，
        // 外层才能正确登记 activeTasks 并感知真实运行态。
        void execute()
      },
    },
  )

  return Result.succeed({
    ...task,
  })
}
