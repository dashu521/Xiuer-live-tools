import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TOAST } from '@/constants'
import { getToastStateForTests, resetToastStateForTests, toastApi } from '../useToast'

describe('useToast dedupe behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetToastStateForTests()
  })

  it('closes a deduped toast with the reused toast id', () => {
    toastApi.info({
      title: '第一次提示',
      description: '原始提示',
      dedupeKey: 'task:info:auto-message:test',
    })

    toastApi.info({
      title: '第二次提示',
      description: '复用同一个 dedupeKey',
      dedupeKey: 'task:info:auto-message:test',
    })

    const toast = getToastStateForTests().toasts[0]

    expect(toast.id).toBe('1')
    expect(toast.open).toBe(true)

    toast.onOpenChange?.(false)

    expect(getToastStateForTests().toasts[0]?.open).toBe(false)
  })

  it('does not reopen a recently dismissed deduped toast', () => {
    toastApi.warning({
      title: '连接已断开',
      description: '网络连接失败',
      dedupeKey: 'live-control-disconnected:test-account',
    })

    const toast = getToastStateForTests().toasts[0]
    toast.onOpenChange?.(false)

    toastApi.warning({
      title: '连接已断开',
      description: '网络连接失败',
      dedupeKey: 'live-control-disconnected:test-account',
    })

    expect(getToastStateForTests().toasts[0]?.open).toBe(false)

    vi.advanceTimersByTime(TOAST.REMOVE_DELAY)

    expect(getToastStateForTests().toasts).toHaveLength(0)
  })
})
