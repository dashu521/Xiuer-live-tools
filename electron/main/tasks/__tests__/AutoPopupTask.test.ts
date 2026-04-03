import { Result } from '@praha/byethrow'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MaxTryCountExceededError } from '#/errors/PlatformError'
import { createAutoPopupTask } from '../AutoPopupTask'

vi.mock('#/windowManager', () => ({
  default: {
    send: vi.fn(),
  },
}))

vi.mock('#/utils', () => ({
  mergeWithoutArray: vi.fn((base: object, update: object) => ({ ...base, ...update })),
  randomInt: vi.fn((min: number) => min),
  takeScreenshot: vi.fn(),
  abortableSleep: vi.fn().mockResolvedValue(Result.succeed()),
  sleep: vi.fn().mockResolvedValue(undefined),
}))

function createLoggerStub() {
  const scopedLogger = {
    success: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    scope: vi.fn(() => scopedLogger),
  }

  return {
    scope: vi.fn(() => scopedLogger),
  } as any
}

function createPlatformStub() {
  return {
    _isPerformPopup: true,
    performPopup: vi.fn(),
    getPopupPage: vi.fn(() => null),
  } as any
}

async function waitForAssertion(assertion: () => void, attempts = 20) {
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  throw lastError
}

describe('createAutoPopupTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
  })

  it('skips lookup failures without stopping the whole task', async () => {
    const platform = createPlatformStub()
    platform.performPopup.mockResolvedValue(
      Result.fail(new MaxTryCountExceededError({ taskName: '查找商品', maxTryCount: 10 })),
    )

    const result = createAutoPopupTask(
      platform,
      {
        scheduler: { interval: [1000, 1000] },
        goods: [{ id: 1 }],
      },
      { id: 'acc-1', name: '主播A', platform: 'taobao' },
      createLoggerStub(),
    )

    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isFailure(result)) {
      throw result.error
    }

    await result.value.start()

    await waitForAssertion(() => {
      expect(platform.performPopup).toHaveBeenCalledTimes(1)
    })

    expect(result.value.isRunning()).toBe(true)
    expect(platform.performPopup).toHaveBeenNthCalledWith(1, 1, expect.any(AbortSignal))

    await (result.value as any).stop()
  })

  it('retries the same goods item instead of advancing to the next one', async () => {
    const platform = createPlatformStub()
    platform.performPopup
      .mockResolvedValueOnce(Result.fail(new Error('temporary failure 1')))
      .mockResolvedValueOnce(Result.fail(new Error('temporary failure 2')))
      .mockResolvedValueOnce(Result.succeed())

    const result = createAutoPopupTask(
      platform,
      {
        scheduler: { interval: [1000, 1000] },
        goods: [{ id: 1 }, { id: 2 }],
      },
      { id: 'acc-1', name: '主播A', platform: 'taobao' },
      createLoggerStub(),
    )

    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isFailure(result)) {
      throw result.error
    }

    await result.value.start()

    await waitForAssertion(() => {
      expect(platform.performPopup).toHaveBeenCalledTimes(3)
    })

    expect(platform.performPopup.mock.calls.map((args: [number, AbortSignal]) => args[0])).toEqual([
      1, 1, 1,
    ])
    expect(result.value.isRunning()).toBe(true)

    await (result.value as any).stop()
  })
})
