import { beforeEach, describe, expect, it } from 'vitest'
import { useAccounts } from '@/hooks/useAccounts'
import { getSafeAutoReplyEntry } from '@/hooks/useAutoReplyConfig'
import { useLiveControlStore } from '@/hooks/useLiveControl'

describe('getSafeAutoReplyEntry', () => {
  beforeEach(() => {
    useAccounts.setState({
      accounts: [
        { id: 'acc-buyin', name: '百应账号' },
        { id: 'acc-douyin', name: '抖店账号' },
      ],
      currentAccountId: 'acc-buyin',
      defaultAccountId: null,
      currentUserId: 'user-1',
    })

    useLiveControlStore.setState({
      contexts: {
        default: {
          connectState: {
            platform: '',
            status: 'disconnected',
            phase: 'idle',
            error: null,
            session: null,
            lastVerifiedAt: null,
          },
          accountName: null,
          streamState: 'unknown',
          liveSessionId: null,
          liveSessionStartedAt: null,
          liveSessionEndedAt: null,
        },
        'acc-buyin': {
          connectState: {
            platform: 'buyin',
            status: 'connected',
            phase: 'streaming',
            error: null,
            session: null,
            lastVerifiedAt: null,
          },
          accountName: null,
          streamState: 'live',
          liveSessionId: null,
          liveSessionStartedAt: null,
          liveSessionEndedAt: null,
        },
        'acc-douyin': {
          connectState: {
            platform: 'douyin',
            status: 'connected',
            phase: 'streaming',
            error: null,
            session: null,
            lastVerifiedAt: null,
          },
          accountName: null,
          streamState: 'live',
          liveSessionId: null,
          liveSessionStartedAt: null,
          liveSessionEndedAt: null,
        },
      },
      currentUserId: 'user-1',
    })
  })

  it('falls back to compass for buyin when entry is empty', () => {
    expect(getSafeAutoReplyEntry('acc-buyin', '')).toBe('compass')
  })

  it('falls back to compass for douyin when entry is missing', () => {
    expect(getSafeAutoReplyEntry('acc-douyin', undefined)).toBe('compass')
  })

  it('keeps supported values unchanged', () => {
    expect(getSafeAutoReplyEntry('acc-buyin', 'compass')).toBe('compass')
  })
})
