import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, string>()
const localStorageMock = {
  getItem: vi.fn((key: string) => (storage.has(key) ? storage.get(key)! : null)),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value)
  }),
  removeItem: vi.fn((key: string) => {
    storage.delete(key)
  }),
  clear: vi.fn(() => {
    storage.clear()
  }),
  key: vi.fn((index: number) => Array.from(storage.keys())[index] ?? null),
  get length() {
    return storage.size
  },
}

Object.defineProperty(globalThis, 'window', {
  value: globalThis,
  configurable: true,
  writable: true,
})

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
})

describe('useLiveControl persistence restore', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    storage.clear()

    const { LocalStorageAdapter, storageManager } = await import('@/utils/storage')
    storageManager.registerAdapter(new LocalStorageAdapter())
    storageManager.clear()
    storageManager.setCurrentUser(null)

    const { DEFAULT_CONNECT_STATE } = await import('@/config/platformConfig')
    const { useAccounts } = await import('@/hooks/useAccounts')
    const { useLiveControlStore } = await import('@/hooks/useLiveControl')

    useAccounts.setState({
      accounts: [],
      currentAccountId: '',
      defaultAccountId: null,
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
  })

  it('does not restore persisted connected state as active connection on startup', async () => {
    const { storageManager } = await import('@/utils/storage')
    const { useAccounts } = await import('@/hooks/useAccounts')
    const { useLiveControlStore } = await import('@/hooks/useLiveControl')

    storageManager.set('live-control', {
      connectState: {
        platform: 'buyin',
        status: 'connected',
        phase: 'streaming',
        session: 'session-1',
        lastVerifiedAt: 123,
        error: null,
      },
      accountName: '测试账号',
      streamState: 'live',
    }, {
      level: 'account',
      userId: 'user-1',
      accountId: 'acc-1',
    })

    useAccounts.setState({
      accounts: [{ id: 'acc-1', name: '账号1' }],
      currentAccountId: '',
      defaultAccountId: null,
      currentUserId: 'user-1',
    })

    useLiveControlStore.getState().loadUserContexts('user-1')

    expect(useLiveControlStore.getState().contexts['acc-1']).toMatchObject({
      connectState: {
        platform: 'buyin',
        status: 'disconnected',
        phase: 'idle',
        session: null,
        lastVerifiedAt: null,
        error: null,
      },
      accountName: null,
      streamState: 'unknown',
    })
  })
})
