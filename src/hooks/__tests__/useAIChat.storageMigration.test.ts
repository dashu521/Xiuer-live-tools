import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const secureStorageMock = vi.hoisted(() => ({
  getItem: vi.fn(),
  removeItem: vi.fn(),
}))

vi.mock('@/utils/encryption', () => ({
  SecureStorage: secureStorageMock,
}))

const storage = new Map<string, string>()

const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
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

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
})

const ipcInvoke = vi.fn()

Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: localStorageMock,
    ipcRenderer: {
      invoke: ipcInvoke,
    },
  },
  configurable: true,
})

type AIChatStore = typeof import('@/hooks/useAIChat').useAIChatStore
type StoreState = ReturnType<AIChatStore['getState']>
type APIKeys = Partial<StoreState['apiKeys']>
type IPCChannels = typeof import('shared/ipcChannels').IPC_CHANNELS

let useAIChatStore: AIChatStore
let IPC_CHANNELS: IPCChannels
let initialState: StoreState

function resetStoreState() {
  useAIChatStore.setState({
    messages: [],
    status: 'ready',
    apiKeys: { ...initialState.apiKeys },
    isApiKeysHydrated: false,
    config: {
      ...initialState.config,
      modelPreferences: { ...initialState.config.modelPreferences },
    },
    customBaseURL: '',
    systemPrompt: undefined,
    autoScroll: true,
  })
}

beforeAll(async () => {
  ;({ useAIChatStore } = await import('@/hooks/useAIChat'))
  ;({ IPC_CHANNELS } = await import('shared/ipcChannels'))
  initialState = useAIChatStore.getState()
})

describe('useAIChatStore API key hydration', () => {
  beforeEach(() => {
    storage.clear()
    vi.clearAllMocks()
    resetStoreState()
  })

  it('prefers API keys already stored in the main process', async () => {
    const mainApiKeys: APIKeys = { deepseek: 'main-deepseek-key' }

    ipcInvoke.mockImplementation(async channel => {
      if (channel === IPC_CHANNELS.tasks.aiChat.getStoredApiKeys) {
        return mainApiKeys
      }

      throw new Error(`Unexpected channel: ${channel}`)
    })

    secureStorageMock.getItem.mockReturnValue({ deepseek: 'legacy-key' })

    await useAIChatStore.getState().hydrateApiKeys()

    expect(useAIChatStore.getState().apiKeys.deepseek).toBe('main-deepseek-key')
    expect(useAIChatStore.getState().isApiKeysHydrated).toBe(true)
    expect(ipcInvoke).toHaveBeenCalledTimes(1)
    expect(ipcInvoke).toHaveBeenCalledWith(IPC_CHANNELS.tasks.aiChat.getStoredApiKeys)
    expect(secureStorageMock.removeItem).toHaveBeenCalledWith('ai_chat_api_keys')
  })

  it('migrates legacy renderer storage into the main process when main storage is empty', async () => {
    const legacyApiKeys: APIKeys = { deepseek: 'legacy-deepseek-key', custom: 'legacy-custom-key' }

    ipcInvoke.mockImplementation(async (channel, payload) => {
      if (channel === IPC_CHANNELS.tasks.aiChat.getStoredApiKeys) {
        return {}
      }

      if (channel === IPC_CHANNELS.tasks.aiChat.setStoredApiKeys) {
        expect(payload).toMatchObject(legacyApiKeys)
        return { success: true }
      }

      throw new Error(`Unexpected channel: ${channel}`)
    })

    secureStorageMock.getItem.mockReturnValue(legacyApiKeys)

    await useAIChatStore.getState().hydrateApiKeys()

    expect(useAIChatStore.getState().apiKeys.deepseek).toBe('legacy-deepseek-key')
    expect(useAIChatStore.getState().apiKeys.custom).toBe('legacy-custom-key')
    expect(useAIChatStore.getState().isApiKeysHydrated).toBe(true)
    expect(ipcInvoke).toHaveBeenNthCalledWith(1, IPC_CHANNELS.tasks.aiChat.getStoredApiKeys)
    expect(ipcInvoke).toHaveBeenNthCalledWith(
      2,
      IPC_CHANNELS.tasks.aiChat.setStoredApiKeys,
      expect.objectContaining(legacyApiKeys),
    )
    expect(secureStorageMock.removeItem).toHaveBeenCalledWith('ai_chat_api_keys')
  })

  it('clears legacy renderer storage after saving API keys to the main process', async () => {
    ipcInvoke.mockResolvedValue({ success: true })

    await useAIChatStore.getState().saveApiKeys({ deepseek: 'saved-in-main' })

    expect(useAIChatStore.getState().apiKeys.deepseek).toBe('saved-in-main')
    expect(ipcInvoke).toHaveBeenCalledWith(
      IPC_CHANNELS.tasks.aiChat.setStoredApiKeys,
      expect.objectContaining({ deepseek: 'saved-in-main' }),
    )
    expect(secureStorageMock.removeItem).toHaveBeenCalledWith('ai_chat_api_keys')
  })

  it('falls back to legacy renderer storage when main-process hydration fails', async () => {
    ipcInvoke.mockRejectedValue(new Error('ipc unavailable'))
    secureStorageMock.getItem.mockReturnValue({ deepseek: 'legacy-fallback-key' })

    await useAIChatStore.getState().hydrateApiKeys()

    expect(useAIChatStore.getState().apiKeys.deepseek).toBe('legacy-fallback-key')
    expect(useAIChatStore.getState().isApiKeysHydrated).toBe(true)
    expect(secureStorageMock.removeItem).not.toHaveBeenCalled()
  })
})
