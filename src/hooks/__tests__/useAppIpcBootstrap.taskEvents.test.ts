import { describe, expect, it, vi } from 'vitest'
import {
  applyAutoMessageStoppedEvent,
  applyAutoPopupStoppedEvent,
  applyCommentListenerStoppedEvent,
} from '@/hooks/useAppIpcBootstrap'

describe('useAppIpcBootstrap task stopped events', () => {
  it('auto message stopped event only updates payload account', () => {
    const setIsRunningAutoMessage = vi.fn()
    const syncStatus = vi.fn()

    applyAutoMessageStoppedEvent(
      { accountId: 'account-a' },
      { setIsRunningAutoMessage, syncStatus },
    )

    expect(setIsRunningAutoMessage).toHaveBeenCalledTimes(1)
    expect(setIsRunningAutoMessage).toHaveBeenCalledWith('account-a', false)
    expect(syncStatus).toHaveBeenCalledWith('autoSpeak', 'stopped', 'account-a')
  })

  it('auto popup stopped event only updates payload account', () => {
    const setIsRunningAutoPopUp = vi.fn()
    const syncStatus = vi.fn()

    applyAutoPopupStoppedEvent({ accountId: 'account-b' }, { setIsRunningAutoPopUp, syncStatus })

    expect(setIsRunningAutoPopUp).toHaveBeenCalledTimes(1)
    expect(setIsRunningAutoPopUp).toHaveBeenCalledWith('account-b', false)
    expect(syncStatus).toHaveBeenCalledWith('autoPopup', 'stopped', 'account-b')
  })

  it('comment listener stopped event only updates payload account', () => {
    const markCommentListenerStopped = vi.fn()
    const setIsListening = vi.fn()
    const setIsRunningAutoReply = vi.fn()
    const setLiveStatsListening = vi.fn()
    const syncStatus = vi.fn()

    applyCommentListenerStoppedEvent(
      { accountId: 'account-c' },
      {
        markCommentListenerStopped,
        setIsListening,
        setIsRunningAutoReply,
        setLiveStatsListening,
        syncStatus,
      },
    )

    expect(markCommentListenerStopped).toHaveBeenCalledWith('account-c')
    expect(setIsListening).toHaveBeenCalledWith('account-c', 'stopped')
    expect(setIsRunningAutoReply).toHaveBeenCalledWith('account-c', false)
    expect(setLiveStatsListening).toHaveBeenCalledWith('account-c', false)
    expect(syncStatus).toHaveBeenCalledWith('autoReply', 'stopped', 'account-c')
  })
})
