import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_CONNECT_STATE } from '@/config/platformConfig'
import { useAutoMessageStore } from '@/hooks/useAutoMessage'
import { useLiveControlStore } from '@/hooks/useLiveControl'
import { useLiveStatsStore } from '@/hooks/useLiveStats'
import {
  ensureAccountStatusSync,
  resetAccountStatusSyncForTests,
  useAccountStatusStore,
} from '../useAccountStatus'
import { useAccounts } from '../useAccounts'

describe('useAccountStatus event-driven sync', () => {
  beforeEach(() => {
    resetAccountStatusSyncForTests()

    useAccounts.setState({
      accounts: [
        { id: 'acc-1', name: '账号1' },
        { id: 'acc-2', name: '账号2' },
      ],
      currentAccountId: 'acc-1',
      defaultAccountId: 'acc-1',
      currentUserId: null,
    })

    useLiveControlStore.setState({
      contexts: {
        default: {
          connectState: { ...DEFAULT_CONNECT_STATE },
          accountName: null,
          streamState: 'unknown',
        },
      },
      currentUserId: null,
    })

    useAutoMessageStore.setState({ contexts: {}, currentUserId: null })
    useLiveStatsStore.setState({ contexts: {} })
  })

  it('updates connection status for the changed account without polling', () => {
    ensureAccountStatusSync()

    useLiveControlStore.setState({
      contexts: {
        default: {
          connectState: { ...DEFAULT_CONNECT_STATE },
          accountName: null,
          streamState: 'unknown',
        },
        'acc-1': {
          connectState: {
            ...DEFAULT_CONNECT_STATE,
            platform: 'buyin',
            status: 'connected',
            phase: 'streaming',
          },
          accountName: null,
          streamState: 'live',
        },
        'acc-2': {
          connectState: {
            ...DEFAULT_CONNECT_STATE,
            platform: 'buyin',
            status: 'disconnected',
            phase: 'idle',
          },
          accountName: null,
          streamState: 'unknown',
        },
      },
    })

    const statusMap = useAccountStatusStore.getState().statusMap
    expect(statusMap['acc-1']?.connectionStatus).toBe('connected')
    expect(statusMap['acc-2']?.connectionStatus).toBe('disconnected')
  })

  it('updates task status only for the changed account', () => {
    ensureAccountStatusSync()

    useAutoMessageStore.getState().setIsRunning('acc-1', true)

    const statusMap = useAccountStatusStore.getState().statusMap
    const account1Task = statusMap['acc-1']?.tasks.find(task => task.taskId === 'autoSpeak')
    const account2Task = statusMap['acc-2']?.tasks.find(task => task.taskId === 'autoSpeak')

    expect(account1Task?.status).toBe('running')
    expect(account2Task?.status).toBe('idle')
  })

  it('removes deleted account status immediately', () => {
    ensureAccountStatusSync()
    useAutoMessageStore.getState().setIsRunning('acc-1', true)

    useAccounts.setState({
      accounts: [{ id: 'acc-2', name: '账号2' }],
      currentAccountId: 'acc-2',
      defaultAccountId: 'acc-2',
      currentUserId: null,
    })

    const statusMap = useAccountStatusStore.getState().statusMap
    expect(statusMap['acc-1']).toBeUndefined()
    expect(statusMap['acc-2']).toBeDefined()
  })
})
