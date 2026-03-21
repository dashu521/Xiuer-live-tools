import { describe, expect, it, vi } from 'vitest'
import { executeWithErrorHandling } from '../useErrorHandler'

describe('executeWithErrorHandling', () => {
  it('returns a success result when the async function resolves', async () => {
    const onError = vi.fn()
    const result = await executeWithErrorHandling(async (value: number) => value * 2, onError, [21])

    expect(result).toEqual({
      ok: true,
      value: 42,
    })
    expect(onError).not.toHaveBeenCalled()
  })

  it('returns a failure result and forwards the error to the handler', async () => {
    const error = new Error('boom')
    const onError = vi.fn()
    const result = await executeWithErrorHandling(
      async () => {
        throw error
      },
      onError,
      [],
      '自定义错误提示',
    )

    expect(result).toEqual({
      ok: false,
      error,
    })
    expect(onError).toHaveBeenCalledWith(error, '自定义错误提示')
  })
})
