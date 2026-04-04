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

describe('useAutoPopUpStore account hydration', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    storage.clear()

    const { LocalStorageAdapter, storageManager } = await import('@/utils/storage')
    storageManager.registerAdapter(new LocalStorageAdapter())
    storageManager.clear()
    storageManager.setCurrentUser(null)

    const { useAccounts } = await import('@/hooks/useAccounts')
    const { useAutoPopUpStore } = await import('@/hooks/useAutoPopUp')

    useAccounts.setState({
      accounts: [
        { id: 'acc-a', name: '账号A' },
        { id: 'acc-b', name: '账号B' },
      ],
      currentAccountId: 'acc-a',
      defaultAccountId: 'acc-a',
      currentUserId: 'user-1',
    })

    useAutoPopUpStore.setState({
      contexts: {},
      currentUserId: null,
    })
  })

  it('ensureContextLoaded should not reset another running account', async () => {
    const { storageManager } = await import('@/utils/storage')
    const { useAutoPopUpStore } = await import('@/hooks/useAutoPopUp')

    storageManager.set(
      'auto-popup',
      {
        isRunning: false,
        config: {
          scheduler: { interval: [30000, 45000] },
          goods: [{ id: 1001 }],
          random: false,
        },
      },
      {
        level: 'account',
        userId: 'user-1',
        accountId: 'acc-b',
      },
    )

    useAutoPopUpStore.setState({
      currentUserId: 'user-1',
      contexts: {
        'acc-a': {
          isRunning: true,
          config: {
            scheduler: { interval: [30000, 45000] },
            goods: [{ id: 2001 }],
            random: false,
          },
          shortcuts: [],
          goodsAutoFillAttempted: false,
          goodsAutoFillLocked: false,
        },
      },
    })

    useAutoPopUpStore.getState().ensureContextLoaded('user-1', 'acc-b')

    const contexts = useAutoPopUpStore.getState().contexts
    expect(contexts['acc-a']?.isRunning).toBe(true)
    expect(contexts['acc-a']?.config.goods[0]?.id).toBe(2001)
    expect(contexts['acc-b']?.config.goods[0]?.id).toBe(1001)
  })
})
