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

const getUserConfigMock = vi.fn()
const syncUserConfigMock = vi.fn()

vi.mock('@/services/apiClient', () => ({
  getUserConfig: (...args: unknown[]) => getUserConfigMock(...args),
  syncUserConfig: (...args: unknown[]) => syncUserConfigMock(...args),
}))

describe('configSyncService account selection', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    storage.clear()
    vi.useRealTimers()

    const { LocalStorageAdapter, storageManager } = await import('@/utils/storage')
    storageManager.registerAdapter(new LocalStorageAdapter())
    const { configSyncService } = await import('@/services/configSyncService')
    configSyncService.resetForTests()
  })

  it('collects currentAccountId and defaultAccountId for cloud sync', async () => {
    const { useAccounts } = await import('@/hooks/useAccounts')
    const { useAutoMessageStore } = await import('@/hooks/useAutoMessage')
    const { useAutoPopUpStore } = await import('@/hooks/useAutoPopUp')
    const { useAutoReplyConfigStore } = await import('@/hooks/useAutoReplyConfig')
    const { usePlatformPreferenceStore } = await import('@/stores/platformPreferenceStore')
    const { configSyncService } = await import('@/services/configSyncService')

    useAccounts.setState({
      accounts: [{ id: 'acc-1', name: '账号1' }],
      currentAccountId: 'acc-1',
      defaultAccountId: 'acc-1',
      currentUserId: 'user-1',
    })
    usePlatformPreferenceStore.setState({
      preferences: {
        'acc-1': {
          defaultPlatform: 'buyin',
          updatedAt: '2026-03-20T00:00:00.000Z',
        },
      },
      currentUserId: 'user-1',
    })
    useAutoReplyConfigStore.setState({
      contexts: {
        'acc-1': {
          config: {
            comment: {
              keywordReply: {
                enable: true,
                rules: [{ keywords: ['你好'], contents: ['欢迎光临'] }],
              },
            },
          },
        },
      },
      currentUserId: 'user-1',
    })
    useAutoMessageStore.setState({
      contexts: {
        'acc-1': {
          isRunning: true,
          batchCount: 9,
          config: {
            scheduler: { interval: [30000, 60000] },
            messages: [{ id: 'msg-1', content: '欢迎来到直播间', pinTop: false }],
            random: true,
            extraSpaces: false,
          },
        },
      },
      currentUserId: 'user-1',
    })
    useAutoPopUpStore.setState({
      contexts: {
        'acc-1': {
          isRunning: true,
          config: {
            scheduler: { interval: [30000, 45000] },
            goods: [{ id: 1001, interval: [10000, 15000] }],
            random: false,
          },
          shortcuts: [{ id: 'sc-1', key: '1', goodsIds: [1001] }],
          isGlobalShortcut: true,
        },
      },
      currentUserId: 'user-1',
    })

    expect(configSyncService.collectConfigData()).toMatchObject({
      accounts: [{ id: 'acc-1', name: '账号1' }],
      currentAccountId: 'acc-1',
      defaultAccountId: 'acc-1',
      autoReplyConfigs: {
        'acc-1': {
          config: {
            comment: {
              keywordReply: {
                enable: true,
                rules: [{ keywords: ['你好'], contents: ['欢迎光临'] }],
              },
            },
          },
        },
      },
      autoMessageConfigs: {
        'acc-1': {
          config: {
            scheduler: { interval: [30000, 60000] },
            messages: [{ id: 'msg-1', content: '欢迎来到直播间', pinTop: false }],
            random: true,
            extraSpaces: false,
          },
        },
      },
      autoPopUpConfigs: {
        'acc-1': {
          config: {
            scheduler: { interval: [30000, 45000] },
            goods: [{ id: 1001, interval: [10000, 15000] }],
            random: false,
          },
          shortcuts: [{ id: 'sc-1', key: '1', goodsIds: [1001] }],
          isGlobalShortcut: true,
        },
      },
    })
  })

  it('restores valid current/default account ids from cloud config', async () => {
    getUserConfigMock.mockResolvedValue({
      ok: true,
      data: {
        success: true,
        config: {
          accounts: [
            { id: 'acc-1', name: '账号1' },
            { id: 'acc-2', name: '账号2' },
          ],
          currentAccountId: 'acc-2',
          defaultAccountId: 'acc-1',
          platformPreferences: {
            'acc-2': { defaultPlatform: 'buyin', updatedAt: '2026-03-20T00:00:00.000Z' },
          },
        },
        version: 1,
        updated_at: '2026-03-20T00:00:00.000Z',
      },
    })

    const { useAccounts } = await import('@/hooks/useAccounts')
    const { configSyncService } = await import('@/services/configSyncService')

    useAccounts.setState({
      accounts: [],
      currentAccountId: '',
      defaultAccountId: null,
      currentUserId: 'user-1',
    })

    const result = await configSyncService.loadFromCloud()

    expect(result).toEqual({ success: true })
    expect(useAccounts.getState()).toMatchObject({
      accounts: [
        { id: 'acc-1', name: '账号1' },
        { id: 'acc-2', name: '账号2' },
      ],
      currentAccountId: 'acc-2',
      defaultAccountId: 'acc-1',
    })
  })

  it('falls back to first account when cloud selection is missing or invalid', async () => {
    getUserConfigMock.mockResolvedValue({
      ok: true,
      data: {
        success: true,
        config: {
          accounts: [
            { id: 'acc-1', name: '账号1' },
            { id: 'acc-2', name: '账号2' },
          ],
          currentAccountId: 'missing',
          defaultAccountId: null,
        },
        version: 1,
        updated_at: '2026-03-20T00:00:00.000Z',
      },
    })

    const { useAccounts } = await import('@/hooks/useAccounts')
    const { configSyncService } = await import('@/services/configSyncService')

    useAccounts.setState({
      accounts: [],
      currentAccountId: '',
      defaultAccountId: null,
      currentUserId: 'user-1',
    })

    await configSyncService.loadFromCloud()

    expect(useAccounts.getState()).toMatchObject({
      currentAccountId: 'acc-1',
      defaultAccountId: 'acc-1',
    })
  })

  it('restores auto reply, auto message, and auto popup configs from cloud without syncing runtime flags', async () => {
    getUserConfigMock.mockResolvedValue({
      ok: true,
      data: {
        success: true,
        config: {
          accounts: [
            { id: 'acc-1', name: '账号1' },
            { id: 'acc-2', name: '账号2' },
          ],
          currentAccountId: 'acc-2',
          defaultAccountId: 'acc-1',
          autoReplyConfigs: {
            'acc-2': {
              config: {
                comment: {
                  keywordReply: {
                    enable: true,
                    rules: [{ keywords: ['下单'], contents: ['这就发链接'] }],
                  },
                },
              },
            },
          },
          autoMessageConfigs: {
            'acc-2': {
              config: {
                scheduler: { interval: [10000, 20000] },
                messages: [{ id: 'm-1', content: '欢迎新朋友', pinTop: true }],
                random: false,
                extraSpaces: true,
              },
            },
          },
          autoPopUpConfigs: {
            'acc-2': {
              config: {
                scheduler: { interval: [5000, 10000] },
                goods: [{ id: 2001 }],
                random: true,
              },
              shortcuts: [{ id: 'shortcut-1', key: '2', goodsIds: [2001] }],
              isGlobalShortcut: false,
            },
          },
        },
        version: 1,
        updated_at: '2026-03-20T00:00:00.000Z',
      },
    })

    const { useAccounts } = await import('@/hooks/useAccounts')
    const { useAutoMessageStore } = await import('@/hooks/useAutoMessage')
    const { useAutoPopUpStore } = await import('@/hooks/useAutoPopUp')
    const { useAutoReplyConfigStore } = await import('@/hooks/useAutoReplyConfig')
    const { configSyncService } = await import('@/services/configSyncService')

    useAccounts.setState({
      accounts: [],
      currentAccountId: '',
      defaultAccountId: null,
      currentUserId: 'user-1',
    })
    useAutoReplyConfigStore.setState({
      contexts: {},
      currentUserId: 'user-1',
    })
    useAutoMessageStore.setState({
      contexts: {
        'acc-2': {
          isRunning: true,
          batchCount: 12,
          config: {
            scheduler: { interval: [30000, 60000] },
            messages: [],
            random: false,
            extraSpaces: false,
          },
        },
      },
      currentUserId: 'user-1',
    })
    useAutoPopUpStore.setState({
      contexts: {
        'acc-2': {
          isRunning: true,
          config: {
            scheduler: { interval: [30000, 45000] },
            goods: [],
            random: false,
          },
          shortcuts: [],
          isGlobalShortcut: true,
        },
      },
      currentUserId: 'user-1',
    })

    await configSyncService.loadFromCloud()

    expect(useAutoReplyConfigStore.getState().contexts).toMatchObject({
      'acc-2': {
        config: {
          comment: {
            keywordReply: {
              enable: true,
              rules: [{ keywords: ['下单'], contents: ['这就发链接'] }],
            },
          },
        },
      },
    })
    expect(useAutoMessageStore.getState().contexts).toMatchObject({
      'acc-2': {
        isRunning: true,
        batchCount: 12,
        config: {
          scheduler: { interval: [10000, 20000] },
          messages: [{ id: 'm-1', content: '欢迎新朋友', pinTop: true }],
          random: false,
          extraSpaces: true,
        },
      },
    })
    expect(useAutoPopUpStore.getState().contexts).toMatchObject({
      'acc-2': {
        isRunning: true,
        config: {
          scheduler: { interval: [5000, 10000] },
          goods: [{ id: 2001 }],
          random: true,
        },
        shortcuts: [{ id: 'shortcut-1', key: '2', goodsIds: [2001] }],
        isGlobalShortcut: false,
      },
    })
  })

  it('auto sync uploads auto message changes after debounce', async () => {
    vi.useFakeTimers()
    syncUserConfigMock.mockResolvedValue({
      ok: true,
      data: {
        success: true,
        message: '配置同步成功',
        synced_at: '2026-03-20T00:00:00.000Z',
      },
    })

    const { useAccounts } = await import('@/hooks/useAccounts')
    const { useAutoMessageStore } = await import('@/hooks/useAutoMessage')
    const { configSyncService } = await import('@/services/configSyncService')

    useAccounts.setState({
      accounts: [{ id: 'acc-1', name: '账号1' }],
      currentAccountId: 'acc-1',
      defaultAccountId: null,
      currentUserId: 'user-1',
    })
    useAutoMessageStore.setState({
      contexts: {},
      currentUserId: 'user-1',
    })

    const cleanup = configSyncService.setupAutoSync()

    useAutoMessageStore.getState().setConfig('acc-1', {
      scheduler: { interval: [15000, 30000] },
      messages: [{ id: 'm-2', content: '记得点关注', pinTop: false }],
      random: true,
      extraSpaces: false,
    })

    await vi.advanceTimersByTimeAsync(4500)

    expect(syncUserConfigMock).toHaveBeenCalledTimes(1)
    expect(syncUserConfigMock.mock.calls[0][0]).toMatchObject({
      autoMessageConfigs: {
        'acc-1': {
          config: {
            scheduler: { interval: [15000, 30000] },
            messages: [{ id: 'm-2', content: '记得点关注', pinTop: false }],
            random: true,
            extraSpaces: false,
          },
        },
      },
    })

    cleanup()
  })

  it('auto sync retries after rate-limit window instead of dropping pending changes', async () => {
    vi.useFakeTimers()
    syncUserConfigMock.mockResolvedValue({
      ok: true,
      data: {
        success: true,
        message: '配置同步成功',
        synced_at: '2026-03-20T00:00:00.000Z',
      },
    })

    const { useAccounts } = await import('@/hooks/useAccounts')
    const { useAutoMessageStore } = await import('@/hooks/useAutoMessage')
    const { configSyncService } = await import('@/services/configSyncService')

    useAccounts.setState({
      accounts: [{ id: 'acc-1', name: '账号1' }],
      currentAccountId: 'acc-1',
      defaultAccountId: null,
      currentUserId: 'user-1',
    })
    useAutoMessageStore.setState({
      contexts: {},
      currentUserId: 'user-1',
    })

    const cleanup = configSyncService.setupAutoSync()

    useAutoMessageStore.getState().setConfig('acc-1', {
      scheduler: { interval: [15000, 30000] },
      messages: [{ id: 'm-1', content: '第一条消息', pinTop: false }],
      random: true,
      extraSpaces: false,
    })

    await vi.advanceTimersByTimeAsync(4500)
    expect(syncUserConfigMock).toHaveBeenCalledTimes(1)

    useAutoMessageStore.getState().setConfig('acc-1', {
      scheduler: { interval: [15000, 30000] },
      messages: [{ id: 'm-2', content: '第二条消息', pinTop: false }],
      random: true,
      extraSpaces: false,
    })

    await vi.advanceTimersByTimeAsync(4500)
    expect(syncUserConfigMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(11000)
    expect(syncUserConfigMock).toHaveBeenCalledTimes(2)
    expect(syncUserConfigMock.mock.calls[1][0]).toMatchObject({
      autoMessageConfigs: {
        'acc-1': {
          config: {
            messages: [{ id: 'm-2', content: '第二条消息', pinTop: false }],
          },
        },
      },
    })

    cleanup()
  })
})
