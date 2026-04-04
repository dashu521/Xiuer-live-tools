import { IPC_CHANNELS } from 'shared/ipcChannels'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

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

let DEFAULT_CONNECT_STATE: any
let AUTH_LAST_IDENTIFIER_KEY: string
let AUTH_REMEMBER_ME_KEY: string
let useAccounts: any
let useAutoMessageStore: any
let useAutoPopUpStore: any
let useAutoReplyConfigStore: any
let createDefaultConfig: any
let useChromeConfigStore: any
let useLiveControlStore: any
let useSubAccountStore: any
let useAuthStore: any
let initializeStorage: any

describe('kickout cleanup', () => {
  const clearTokensMock = vi.fn().mockResolvedValue(undefined)
  const invokeMock = vi.fn().mockResolvedValue(undefined)

  beforeAll(async () => {
    ;({ DEFAULT_CONNECT_STATE } = await import('@/config/platformConfig'))
    ;({ AUTH_LAST_IDENTIFIER_KEY, AUTH_REMEMBER_ME_KEY } = await import(
      '@/constants/authStorageKeys'
    ))
    ;({ useAccounts } = await import('@/hooks/useAccounts'))
    ;({ useAutoMessageStore } = await import('@/hooks/useAutoMessage'))
    ;({ useAutoPopUpStore } = await import('@/hooks/useAutoPopUp'))
    ;({ useAutoReplyConfigStore, createDefaultConfig } = await import('@/hooks/useAutoReplyConfig'))
    ;({ useChromeConfigStore } = await import('@/hooks/useChromeConfig'))
    ;({ useLiveControlStore } = await import('@/hooks/useLiveControl'))
    ;({ useSubAccountStore } = await import('@/hooks/useSubAccount'))
    ;({ useAuthStore } = await import('@/stores/authStore'))
    ;({ initializeStorage } = await import('@/utils/storage/init'))
    initializeStorage()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    storage.clear()

    ;(window as any).authAPI = {
      clearTokens: clearTokensMock,
    }
    ;(window as any).ipcRenderer = {
      invoke: invokeMock,
    }

    useAccounts.setState({
      accounts: [
        { id: 'acc-1', name: '账号A' },
        { id: 'acc-2', name: '账号B' },
        { id: 'acc-3', name: '账号C' },
      ],
      currentAccountId: 'acc-2',
      defaultAccountId: 'acc-1',
      currentUserId: 'user-1',
    })

    useLiveControlStore.setState({
      currentUserId: 'user-1',
      contexts: {
        default: {
          connectState: { ...DEFAULT_CONNECT_STATE },
          accountName: null,
          streamState: 'unknown',
        },
        'acc-1': {
          connectState: { ...DEFAULT_CONNECT_STATE, status: 'connected' },
          accountName: '账号A',
          streamState: 'live',
        },
        'acc-2': {
          connectState: { ...DEFAULT_CONNECT_STATE, status: 'connected' },
          accountName: '账号B',
          streamState: 'live',
        },
        'acc-3': {
          connectState: { ...DEFAULT_CONNECT_STATE, status: 'connected' },
          accountName: '账号C',
          streamState: 'live',
        },
      },
    })
    useAutoMessageStore.setState({
      currentUserId: 'user-1',
      contexts: {
        'acc-1': {
          isRunning: true,
          config: {
            scheduler: { interval: [1, 2] },
            messages: [],
            random: false,
            extraSpaces: false,
          },
        },
        'acc-3': {
          isRunning: true,
          config: {
            scheduler: { interval: [2, 3] },
            messages: [],
            random: true,
            extraSpaces: false,
          },
        },
      },
    })
    useAutoPopUpStore.setState({
      currentUserId: 'user-1',
      contexts: {
        'acc-1': {
          isRunning: true,
          config: {
            scheduler: { interval: [1, 2] },
            goods: [],
            random: false,
          },
          shortcuts: [],
        },
        'acc-2': {
          isRunning: true,
          config: {
            scheduler: { interval: [2, 3] },
            goods: [],
            random: true,
          },
          shortcuts: [],
        },
      },
    })
    useAutoReplyConfigStore.setState({
      currentUserId: 'user-1',
      contexts: {
        'acc-1': {
          config: createDefaultConfig(),
        },
        'acc-2': {
          config: createDefaultConfig(),
        },
      },
    })
    useChromeConfigStore.setState({
      currentUserId: 'user-1',
      contexts: {
        'acc-1': {
          path: '/tmp/chrome',
          storageState: '/tmp/chrome-user',
          headless: false,
        },
        'acc-2': {
          path: '/tmp/chrome-b',
          storageState: '/tmp/chrome-user-b',
          headless: false,
        },
      },
    })
    useSubAccountStore.setState((state: any) => ({
      ...state,
      currentUserId: 'user-1',
    }))

    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'user-1',
        username: 'user-1',
        email: '',
        createdAt: new Date().toISOString(),
        lastLogin: null,
        status: 'active',
        plan: 'trial',
        expire_at: null,
        deviceId: '',
        machineFingerprint: '',
        balance: 0,
      },
      token: 'access-token-a',
      refreshToken: 'refresh-token-a',
      isLoading: false,
      error: null,
      authCheckDone: true,
      isOffline: false,
      userStatus: {
        user_id: 'user-1',
        username: 'user-1',
        status: 'active',
        plan: 'trial',
      },
    })

    useAccounts.setState({
      accounts: [
        { id: 'acc-1', name: '账号A' },
        { id: 'acc-2', name: '账号B' },
        { id: 'acc-3', name: '账号C' },
      ],
      currentAccountId: 'acc-2',
      defaultAccountId: 'acc-1',
      currentUserId: 'user-1',
    })

    localStorage.setItem('account-config-user-1', '{"foo":"bar"}')
    localStorage.setItem('chrome-config-user-1', '{"foo":"bar"}')
    localStorage.setItem(AUTH_LAST_IDENTIFIER_KEY, 'user@example.com')
    localStorage.setItem(AUTH_REMEMBER_ME_KEY, 'false')
  })

  it('clears main-process tokens, auth state, and user-scoped local data', async () => {
    await useAuthStore.getState().clearTokensAndUnauth()

    expect(clearTokensMock).toHaveBeenCalledTimes(1)
    expect(invokeMock).toHaveBeenCalledTimes(12)
    expect(invokeMock.mock.calls).toEqual([
      [IPC_CHANNELS.tasks.commentListener.stop, 'acc-1'],
      [IPC_CHANNELS.tasks.autoMessage.stop, 'acc-1'],
      [IPC_CHANNELS.tasks.autoPopUp.stop, 'acc-1'],
      [IPC_CHANNELS.tasks.liveControl.disconnect, 'acc-1'],
      [IPC_CHANNELS.tasks.commentListener.stop, 'acc-2'],
      [IPC_CHANNELS.tasks.autoMessage.stop, 'acc-2'],
      [IPC_CHANNELS.tasks.autoPopUp.stop, 'acc-2'],
      [IPC_CHANNELS.tasks.liveControl.disconnect, 'acc-2'],
      [IPC_CHANNELS.tasks.commentListener.stop, 'acc-3'],
      [IPC_CHANNELS.tasks.autoMessage.stop, 'acc-3'],
      [IPC_CHANNELS.tasks.autoPopUp.stop, 'acc-3'],
      [IPC_CHANNELS.tasks.liveControl.disconnect, 'acc-3'],
    ])

    const authState = useAuthStore.getState()
    expect(authState.isAuthenticated).toBe(false)
    expect(authState.user).toBeNull()
    expect(authState.token).toBeNull()
    expect(authState.refreshToken).toBeNull()
    expect(authState.userStatus).toBeNull()

    expect(useAccounts.getState().accounts).toEqual([])
    expect(useAutoMessageStore.getState().contexts).toEqual({})
    expect(useAutoPopUpStore.getState().contexts).toEqual({})
    expect(useAutoReplyConfigStore.getState().contexts).toEqual({})
    expect(useChromeConfigStore.getState().contexts).toEqual({})
    expect(useLiveControlStore.getState().contexts).toEqual({
      default: {
        connectState: { ...DEFAULT_CONNECT_STATE },
        accountName: null,
        streamState: 'unknown',
        liveSessionId: null,
        liveSessionStartedAt: null,
        liveSessionEndedAt: null,
      },
    })

    expect(localStorage.getItem('account-config-user-1')).toBeNull()
    expect(localStorage.getItem('chrome-config-user-1')).toBeNull()
    expect(localStorage.getItem(AUTH_LAST_IDENTIFIER_KEY)).toBeNull()
  })
})
