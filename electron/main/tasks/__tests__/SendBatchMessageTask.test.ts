import { Result } from '@praha/byethrow'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskStopReason } from '../ITask'
import { createSendBatchMessageTask } from '../SendBatchMessageTask'

vi.mock('#/utils', () => ({
  insertRandomSpaces: vi.fn((text: string) => text),
  randomInt: vi.fn(() => 0),
  replaceVariant: vi.fn((text: string) => text),
  sleep: vi.fn((ms: number) => new Promise(resolve => setTimeout(resolve, ms))),
}))

function createLoggerStub() {
  const scopedLogger = {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  }

  return {
    scope: vi.fn(() => scopedLogger),
  } as any
}

function createPlatformStub() {
  return {
    _isPerformComment: true,
    performComment: vi.fn().mockResolvedValue(Result.succeed(true)),
    getCommentPage: vi.fn(() => null),
  } as any
}

describe('createSendBatchMessageTask', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the task running after start until background sending completes', async () => {
    const platform = createPlatformStub()
    const result = createSendBatchMessageTask(
      platform,
      {
        messages: ['欢迎来到直播间'],
        count: 1,
        noSpace: true,
      },
      createLoggerStub(),
    )

    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isFailure(result)) {
      throw result.error
    }

    await result.value.start()

    expect(result.value.isRunning()).toBe(true)
    expect(platform.performComment).toHaveBeenCalledTimes(1)

    await vi.runAllTimersAsync()

    expect(result.value.isRunning()).toBe(false)
    expect(result.value.getLastStopInfo().reason).toBe(TaskStopReason.COMPLETED)
  })
})
