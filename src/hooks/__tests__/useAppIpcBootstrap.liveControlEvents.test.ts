import type { StreamStatus } from 'shared/streamStatus'
import { describe, expect, it, vi } from 'vitest'
import {
  applyDisconnectedLiveControlEvent,
  applyStreamStateChangedEvent,
} from '@/hooks/useAppIpcBootstrap'

describe('useAppIpcBootstrap live control events', () => {
  it('ignores non-fatal disconnected event while waiting for login', async () => {
    const showErrorToast = vi.fn()
    const stopAllTasks = vi.fn().mockResolvedValue(undefined)

    const result = await applyDisconnectedLiveControlEvent(
      {
        accountId: 'account-a',
        reason: '用户切换页面',
      },
      {
        getConnectState: () => ({ phase: 'waiting_for_login', status: 'connecting' }),
        showErrorToast,
        stopAllTasks,
      },
    )

    expect(result).toEqual({ ignored: true })
    expect(showErrorToast).not.toHaveBeenCalled()
    expect(stopAllTasks).not.toHaveBeenCalled()
  })

  it('only stops tasks for the payload account on disconnected event', async () => {
    const showErrorToast = vi.fn()
    const stopAllTasks = vi.fn().mockResolvedValue(undefined)

    await applyDisconnectedLiveControlEvent(
      {
        accountId: 'account-b',
        reason: 'browser has been closed',
      },
      {
        getConnectState: accountId =>
          accountId === 'account-b' ? { phase: 'streaming', status: 'connected' } : undefined,
        showErrorToast,
        stopAllTasks,
      },
    )

    expect(showErrorToast).toHaveBeenCalledWith('account-b', 'browser has been closed', false)
    expect(stopAllTasks).toHaveBeenCalledTimes(1)
    expect(stopAllTasks).toHaveBeenCalledWith('account-b')
  })

  it('only stops tasks when the same account changes from live to offline', async () => {
    const streamStates = new Map<string, StreamStatus>([
      ['account-a', 'live'],
      ['account-b', 'live'],
    ])
    const stopAllTasksForStreamEnd = vi.fn().mockResolvedValue(undefined)

    await applyStreamStateChangedEvent(
      {
        accountId: 'account-a',
        streamState: 'offline',
      },
      {
        getPreviousStreamState: accountId => streamStates.get(accountId),
        setStreamState: (accountId, streamState) => {
          streamStates.set(accountId, streamState)
        },
        stopAllTasksForStreamEnd,
      },
    )

    expect(streamStates.get('account-a')).toBe('offline')
    expect(streamStates.get('account-b')).toBe('live')
    expect(stopAllTasksForStreamEnd).toHaveBeenCalledTimes(1)
    expect(stopAllTasksForStreamEnd).toHaveBeenCalledWith('account-a')
  })
})
