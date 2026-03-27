import type { AccountEventPayload } from 'shared/accountEvents'
import { describe, expect, it, vi } from 'vitest'
import { applyAccountEvent } from '@/hooks/useAppIpcBootstrap'

function createDeps() {
  return {
    task: {
      setIsRunningAutoMessage: vi.fn(),
      setIsRunningAutoPopUp: vi.fn(),
      markCommentListenerStopped: vi.fn(),
      setIsListening: vi.fn(),
      setIsRunningAutoReply: vi.fn(),
      setLiveStatsListening: vi.fn(),
      syncStatus: vi.fn(),
    },
    liveControl: {
      getConnectState: vi.fn(),
      showErrorToast: vi.fn(),
      stopAllTasks: vi.fn().mockResolvedValue(undefined),
      getPreviousStreamState: vi.fn(),
      setStreamState: vi.fn(),
      stopAllTasksForStreamEnd: vi.fn().mockResolvedValue(undefined),
      getPreviousConnectState: vi.fn(),
      setConnectState: vi.fn(),
      showConnectedToast: vi.fn(),
    },
  }
}

describe('account event bus routing', () => {
  it('routes task events by type to the matching task handlers', async () => {
    const deps = createDeps()
    const event: AccountEventPayload = {
      domain: 'task',
      type: 'autoMessageStopped',
      accountId: 'account-a',
      payload: { accountId: 'account-a' },
    }

    await applyAccountEvent(event, deps as any)

    expect(deps.task.setIsRunningAutoMessage).toHaveBeenCalledWith('account-a', false)
    expect(deps.task.syncStatus).toHaveBeenCalledWith('autoSpeak', 'stopped', 'account-a')
    expect(deps.task.setIsRunningAutoPopUp).not.toHaveBeenCalled()
    expect(deps.liveControl.setConnectState).not.toHaveBeenCalled()
  })

  it('routes live control stateChanged events and keeps account isolation', async () => {
    const deps = createDeps()
    deps.liveControl.getPreviousConnectState.mockImplementation(accountId =>
      accountId === 'account-a' ? { status: 'connecting', phase: 'verifying_session' } : undefined,
    )

    const event: AccountEventPayload = {
      domain: 'liveControl',
      type: 'stateChanged',
      accountId: 'account-a',
      payload: {
        accountId: 'account-a',
        connectState: {
          status: 'connected',
          phase: 'streaming',
          error: null,
          session: null,
          lastVerifiedAt: Date.now(),
        },
      },
    }

    await applyAccountEvent(event, deps as any)

    expect(deps.liveControl.setConnectState).toHaveBeenCalledWith(
      'account-a',
      event.payload.connectState,
    )
    expect(deps.liveControl.showConnectedToast).toHaveBeenCalledWith('account-a')
    expect(deps.task.syncStatus).not.toHaveBeenCalled()
  })
})
