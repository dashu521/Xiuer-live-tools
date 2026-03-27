import type { StreamStatus } from 'shared/streamStatus'

export interface LiveControlDisconnectedPayload {
  accountId: string
  reason?: string
}

export interface LiveControlStreamStatePayload {
  accountId: string
  streamState: StreamStatus
}
