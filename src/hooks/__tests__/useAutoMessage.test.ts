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

describe('useAutoMessageStore account hydration', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    storage.clear()

    const { LocalStorageAdapter, storageManager } = await import('@/utils/storage')
    storageManager.registerAdapter(new LocalStorageAdapter())
    storageManager.clear()
    storageManager.setCurrentUser(null)

    const { useAccounts } = await import('@/hooks/useAccounts')
    const { useAutoMessageStore } = await import('@/hooks/useAutoMessage')

    useAccounts.setState({
      accounts: [
        { id: 'acc-a', name: '账号A' },
        { id: 'acc-b', name: '账号B' },
      ],
      currentAccountId: 'acc-a',
      defaultAccountId: 'acc-a',
      currentUserId: 'user-1',
    })

    useAutoMessageStore.setState({
      contexts: {},
      currentUserId: null,
    })
  })

  it('ensureContextLoaded should not reset another running account', async () => {
    const { storageManager } = await import('@/utils/storage')
    const { useAutoMessageStore } = await import('@/hooks/useAutoMessage')

    storageManager.set(
      'auto-message',
      {
        isRunning: false,
        config: {
          scheduler: { interval: [30000, 60000] },
          messages: [{ id: 'msg-1', content: 'B消息', pinTop: false }],
          random: false,
          extraSpaces: false,
        },
      },
      {
        level: 'account',
        userId: 'user-1',
        accountId: 'acc-b',
      },
    )

    useAutoMessageStore.setState({
      currentUserId: 'user-1',
      contexts: {
        'acc-a': {
          isRunning: true,
          config: {
            scheduler: { interval: [30000, 60000] },
            messages: [{ id: 'msg-a', content: 'A消息', pinTop: false }],
            random: false,
            extraSpaces: false,
          },
        },
      },
    })

    useAutoMessageStore.getState().ensureContextLoaded('user-1', 'acc-b')

    const contexts = useAutoMessageStore.getState().contexts
    expect(contexts['acc-a']?.isRunning).toBe(true)
    expect(contexts['acc-a']?.config.messages[0]?.content).toBe('A消息')
    expect(contexts['acc-b']?.config.messages[0]?.content).toBe('B消息')
  })
})
