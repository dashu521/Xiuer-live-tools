import { describe, expect, it, vi } from 'vitest'
import { reducer } from '../useToast'

describe('useToast reducer', () => {
  it('keeps the original close handler when updating a deduped toast', () => {
    const originalOnOpenChange = vi.fn()
    const replacedOnOpenChange = vi.fn()

    const initialState = reducer(
      { toasts: [] },
      {
        type: 'ADD_TOAST',
        toast: {
          id: 'toast-1',
          dedupeKey: 'sync-to-cloud-success',
          description: '第一次提示',
          open: true,
          duration: 2000,
          createdAt: 1,
          onOpenChange: originalOnOpenChange,
        },
      },
    )

    const nextState = reducer(initialState, {
      type: 'ADD_TOAST',
      toast: {
        id: 'toast-2',
        dedupeKey: 'sync-to-cloud-success',
        description: '第二次提示',
        open: true,
        duration: 2000,
        createdAt: 2,
        onOpenChange: replacedOnOpenChange,
      },
    })

    expect(nextState.toasts).toHaveLength(1)
    expect(nextState.toasts[0]).toMatchObject({
      id: 'toast-1',
      dedupeKey: 'sync-to-cloud-success',
      description: '第二次提示',
      open: true,
      createdAt: 1,
    })
    expect(nextState.toasts[0].onOpenChange).toBe(originalOnOpenChange)
  })
})
