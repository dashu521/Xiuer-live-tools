import { describe, expect, it, vi } from 'vitest'
import { createTask } from '../BaseTask'
import { TaskStopReason } from '../ITask'

function createLoggerStub() {
  return {
    info: vi.fn(),
    error: vi.fn(),
  } as any
}

describe('createTask', () => {
  it('records completed stop info for tasks that finish during start', async () => {
    const logger = createLoggerStub()
    let task: ReturnType<typeof createTask>

    task = createTask(
      {
        taskName: 'quick-task',
        logger,
      },
      {
        onStart: async () => {
          await task.stop(TaskStopReason.COMPLETED)
        },
      },
    )

    await task.start()

    expect(task.isRunning()).toBe(false)
    expect(task.getLastStopInfo().reason).toBe(TaskStopReason.COMPLETED)
    expect(task.getLastStopInfo().error).toBeUndefined()
  })

  it('records error stop info when task stops with an error', async () => {
    const logger = createLoggerStub()
    const failure = new Error('boom')
    let task: ReturnType<typeof createTask>

    task = createTask(
      {
        taskName: 'failing-task',
        logger,
      },
      {
        onStart: async () => {
          await task.stop(TaskStopReason.ERROR, failure)
        },
      },
    )

    await task.start()

    expect(task.isRunning()).toBe(false)
    expect(task.getLastStopInfo().reason).toBe(TaskStopReason.ERROR)
    expect(task.getLastStopInfo().error).toBe(failure)
  })
})
