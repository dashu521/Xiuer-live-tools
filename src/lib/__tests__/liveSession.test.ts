import { describe, expect, it } from 'vitest'
import { deriveLiveSessionMeta } from '@/lib/liveSession'

describe('deriveLiveSessionMeta', () => {
  it('creates a new live session when entering live', () => {
    const result = deriveLiveSessionMeta({
      prevStreamState: 'offline',
      nextStreamState: 'live',
      current: {
        liveSessionId: null,
        liveSessionStartedAt: null,
        liveSessionEndedAt: null,
      },
      nowIso: '2026-04-04T10:00:00.000Z',
      createId: () => 'live-session-1',
    })

    expect(result).toEqual({
      liveSessionId: 'live-session-1',
      liveSessionStartedAt: '2026-04-04T10:00:00.000Z',
      liveSessionEndedAt: null,
    })
  })

  it('marks current live session ended when leaving live', () => {
    const result = deriveLiveSessionMeta({
      prevStreamState: 'live',
      nextStreamState: 'offline',
      current: {
        liveSessionId: 'live-session-1',
        liveSessionStartedAt: '2026-04-04T10:00:00.000Z',
        liveSessionEndedAt: null,
      },
      nowIso: '2026-04-04T12:00:00.000Z',
      createId: () => 'live-session-2',
    })

    expect(result).toEqual({
      liveSessionId: 'live-session-1',
      liveSessionStartedAt: '2026-04-04T10:00:00.000Z',
      liveSessionEndedAt: '2026-04-04T12:00:00.000Z',
    })
  })
})
