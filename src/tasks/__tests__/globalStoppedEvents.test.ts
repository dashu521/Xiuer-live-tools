import type { AccountEventPayload } from 'shared/accountEvents'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoMessageStore } from '@/hooks/useAutoMessage'
import { useAutoPopUpStore } from '@/hooks/useAutoPopUp'
import { useAutoReplyStore } from '@/hooks/useAutoReply'
import { createDefaultConfig, useAutoReplyConfigStore } from '@/hooks/useAutoReplyConfig'
import { AutoPopupTask } from '../autoPopupTask'
import { AutoReplyTask } from '../autoReplyTask'
import { AutoSpeakTask } from '../autoSpeakTask'

vi.mock('@/utils/commentListenerRuntime', () => ({
  acquireCommentListener: vi.fn().mockResolvedValue(true),
  releaseCommentListener: vi.fn().mockResolvedValue(undefined),
}))

const ipcListeners = new Map<string, (...args: any[]) => void>()

function emit(channel: string, payload: AccountEventPayload) {
  const listener = ipcListeners.get(channel)
  if (listener) {
    listener(payload)
  }
}

function createTaskContext(accountId: string) {
  return {
    accountId,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
    ipcInvoke: vi.fn().mockResolvedValue(true),
  }
}

describe('global task stopped events account isolation', () => {
  beforeEach(() => {
    ipcListeners.clear()

    vi.stubGlobal('window', {
      ipcRenderer: {
        on: vi.fn((channel: string, listener: (...args: any[]) => void) => {
          ipcListeners.set(channel, listener)
          return () => {
            ipcListeners.delete(channel)
          }
        }),
        invoke: vi.fn().mockResolvedValue(true),
      },
    })

    useAutoMessageStore.setState({
      contexts: {
        'account-a': {
          isRunning: false,
          config: {
            scheduler: { interval: [1000, 2000] },
            messages: [{ id: '1', content: 'hello', pinTop: false }],
            random: false,
            extraSpaces: false,
          },
        },
        'account-b': {
          isRunning: false,
          config: {
            scheduler: { interval: [1000, 2000] },
            messages: [{ id: '2', content: 'world', pinTop: false }],
            random: false,
            extraSpaces: false,
          },
        },
      },
    })

    useAutoPopUpStore.setState({
      contexts: {
        'account-a': {
          isRunning: false,
          config: {
            scheduler: { interval: [1000, 2000] },
            goods: [{ id: 1 }],
            random: false,
          },
        },
        'account-b': {
          isRunning: false,
          config: {
            scheduler: { interval: [1000, 2000] },
            goods: [{ id: 2 }],
            random: false,
          },
        },
      },
    })

    useAutoReplyStore.setState({
      contexts: {
        'account-a': {
          isRunning: false,
          isListening: 'stopped',
          replies: [],
          comments: [],
        },
        'account-b': {
          isRunning: false,
          isListening: 'stopped',
          replies: [],
          comments: [],
        },
      },
    })

    useAutoReplyConfigStore.setState({
      contexts: {
        'account-a': { config: createDefaultConfig() },
        'account-b': { config: createDefaultConfig() },
      },
    } as any)
  })

  it('AutoSpeakTask only responds to matching account stopped payload', async () => {
    const task = new AutoSpeakTask()
    await task.start(createTaskContext('account-a') as any)

    emit(IPC_CHANNELS.account.event, {
      domain: 'task',
      type: 'autoMessageStopped',
      accountId: 'account-b',
      payload: { accountId: 'account-b' },
    })
    await Promise.resolve()

    expect(task.status).toBe('running')
    expect(useAutoMessageStore.getState().contexts['account-a']?.isRunning).toBe(true)

    emit(IPC_CHANNELS.account.event, {
      domain: 'task',
      type: 'autoMessageStopped',
      accountId: 'account-a',
      payload: { accountId: 'account-a' },
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(task.status).toBe('stopped')
    expect(useAutoMessageStore.getState().contexts['account-a']?.isRunning).toBe(false)
  })

  it('AutoPopupTask only responds to matching account stopped payload', async () => {
    const task = new AutoPopupTask()
    await task.start(createTaskContext('account-a') as any)

    emit(IPC_CHANNELS.account.event, {
      domain: 'task',
      type: 'autoPopupStopped',
      accountId: 'account-b',
      payload: { accountId: 'account-b' },
    })
    await Promise.resolve()

    expect(task.status).toBe('running')
    expect(useAutoPopUpStore.getState().contexts['account-a']?.isRunning).toBe(true)

    emit(IPC_CHANNELS.account.event, {
      domain: 'task',
      type: 'autoPopupStopped',
      accountId: 'account-a',
      payload: { accountId: 'account-a' },
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(task.status).toBe('stopped')
    expect(useAutoPopUpStore.getState().contexts['account-a']?.isRunning).toBe(false)
  })

  it('AutoReplyTask only responds to matching account stopped payload', async () => {
    const task = new AutoReplyTask()
    await task.start(createTaskContext('account-a') as any)

    emit(IPC_CHANNELS.account.event, {
      domain: 'task',
      type: 'commentListenerStopped',
      accountId: 'account-b',
      payload: { accountId: 'account-b' },
    })
    await Promise.resolve()

    expect(task.status).toBe('running')
    expect(useAutoReplyStore.getState().contexts['account-a']?.isRunning).toBe(true)

    emit(IPC_CHANNELS.account.event, {
      domain: 'task',
      type: 'commentListenerStopped',
      accountId: 'account-a',
      payload: { accountId: 'account-a' },
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(task.status).toBe('stopped')
    expect(useAutoReplyStore.getState().contexts['account-a']?.isRunning).toBe(false)
    expect(useAutoReplyStore.getState().contexts['account-a']?.isListening).toBe('stopped')
  })
})
