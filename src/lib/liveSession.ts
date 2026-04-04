import type { StreamStatus } from 'shared/streamStatus'

export interface LiveSessionMeta {
  liveSessionId: string | null
  liveSessionStartedAt: string | null
  liveSessionEndedAt: string | null
}

export function deriveLiveSessionMeta(params: {
  prevStreamState: StreamStatus
  nextStreamState: StreamStatus
  current: LiveSessionMeta
  nowIso: string
  createId: () => string
}) {
  const { prevStreamState, nextStreamState, current, nowIso, createId } = params

  if (nextStreamState === 'live' && prevStreamState !== 'live') {
    return {
      liveSessionId: createId(),
      liveSessionStartedAt: nowIso,
      liveSessionEndedAt: null,
    } satisfies LiveSessionMeta
  }

  if (prevStreamState === 'live' && nextStreamState !== 'live') {
    return {
      ...current,
      liveSessionEndedAt: nowIso,
    } satisfies LiveSessionMeta
  }

  return current
}
