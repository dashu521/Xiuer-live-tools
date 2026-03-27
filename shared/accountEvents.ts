import type {
  LiveControlDisconnectedPayload,
  LiveControlStreamStatePayload,
} from 'shared/liveControlEvents'
import type { TaskStoppedEventPayload } from 'shared/taskEvents'

export interface LiveControlStateChangedPayload {
  accountId: string
  connectState: Partial<{
    status: 'disconnected' | 'connecting' | 'connected' | 'error'
    phase:
      | 'idle'
      | 'preparing'
      | 'launching_browser'
      | 'waiting_for_login'
      | 'verifying_session'
      | 'streaming'
      | 'tasks_running'
      | 'error'
    error?: string | null
    session?: string | null
    lastVerifiedAt?: number | null
  }>
}

export type AccountEventPayload =
  | {
      domain: 'task'
      type: 'autoMessageStopped' | 'autoPopupStopped' | 'commentListenerStopped'
      accountId: string
      payload: TaskStoppedEventPayload
    }
  | {
      domain: 'liveControl'
      type: 'stateChanged'
      accountId: string
      payload: LiveControlStateChangedPayload
    }
  | {
      domain: 'liveControl'
      type: 'disconnected'
      accountId: string
      payload: LiveControlDisconnectedPayload
    }
  | {
      domain: 'liveControl'
      type: 'streamStateChanged'
      accountId: string
      payload: LiveControlStreamStatePayload
    }
