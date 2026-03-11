import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { useAuthStore } from '@/stores/authStore'
import { EVENTS, eventEmitter } from '@/utils/events'
import { storageManager } from '@/utils/storage/StorageManager'
import { useAccounts } from './useAccounts'

interface ChromeConfig {
  path: string
  storageState: string
  headless: boolean
}

interface ChromeConfigStore {
  contexts: Record<string, ChromeConfig>
  currentUserId: string | null
  setPath: (accountId: string, path: string) => void
  setStorageState: (accountId: string, storageState: string) => void
  setHeadless: (accountId: string, headless: boolean) => void
  loadUserConfigs: (userId: string) => void
  resetAllContexts: () => void
}

const defaultContext = (): ChromeConfig => ({
  path: '',
  storageState: '',
  headless: false,
})

const DEFAULT_CHROME_CONFIG: ChromeConfig = defaultContext()

export const useChromeConfigStore = create<ChromeConfigStore>()(
  immer((set, get) => {
    eventEmitter.on(EVENTS.ACCOUNT_REMOVED, (accountId: string) => {
      set(state => {
        delete state.contexts[accountId]
        // 同时从存储中删除
        const { currentUserId } = get()
        if (currentUserId) {
          storageManager.remove('chrome-config', {
            level: 'account',
            userId: currentUserId,
            accountId,
          })
        }
      })
    })

    const ensureContext = (state: ChromeConfigStore, accountId: string) => {
      if (!state.contexts[accountId]) {
        state.contexts[accountId] = defaultContext()
      }
      return state.contexts[accountId]
    }

    const saveToStorage = (accountId: string, config: ChromeConfig) => {
      const { currentUserId } = get()
      if (currentUserId) {
        try {
          storageManager.set('chrome-config', config, {
            level: 'account',
            userId: currentUserId,
            accountId,
          })
        } catch (e) {
          console.error('[ChromeConfig] 保存到存储失败:', e)
        }
      }
    }

    return {
      contexts: {},
      currentUserId: null,

      setPath: (accountId, path) => {
        set(state => {
          const context = ensureContext(state, accountId)
          context.path = path
          saveToStorage(accountId, context)
        })
      },

      setStorageState: (accountId, storageState) => {
        set(state => {
          const context = ensureContext(state, accountId)
          context.storageState = storageState
          saveToStorage(accountId, context)
        })
      },

      setHeadless: (accountId, headless) => {
        set(state => {
          const context = ensureContext(state, accountId)
          context.headless = headless
          saveToStorage(accountId, context)
        })
      },

      loadUserConfigs: (userId: string) => {
        const loadConfigs = () => {
          const { accounts } = useAccounts.getState()
          if (accounts.length === 0) {
            return
          }

          set(state => {
            state.currentUserId = userId
            state.contexts = {}

            accounts.forEach(account => {
              const config = storageManager.get<ChromeConfig>('chrome-config', {
                level: 'account',
                userId,
                accountId: account.id,
              })
              if (config) {
                state.contexts[account.id] = config
              }
            })
          })
        }

        const { accounts } = useAccounts.getState()
        if (accounts.length > 0) {
          loadConfigs()
        } else {
          const unsubscribe = useAccounts.subscribe(state => {
            if (state.accounts.length > 0) {
              unsubscribe()
              loadConfigs()
            }
          })
        }
      },

      resetAllContexts: () => {
        set(state => {
          // 保存当前数据到存储
          const { currentUserId } = state
          if (currentUserId) {
            Object.entries(state.contexts).forEach(([accountId, config]) => {
              try {
                storageManager.set('chrome-config', config, {
                  level: 'account',
                  userId: currentUserId,
                  accountId,
                })
              } catch (e) {
                console.error('[ChromeConfig] 保存配置失败:', e)
              }
            })
          }
          state.contexts = {}
          state.currentUserId = null
        })
      },
    }
  }),
)

// Hook: 获取当前账号的Chrome配置
export function useCurrentChromeConfig<T>(getters: (state: ChromeConfig) => T): T {
  const currentAccountId = useAccounts(state => state.currentAccountId)
  return useChromeConfigStore(state => {
    const context = state.contexts[currentAccountId] ?? DEFAULT_CHROME_CONFIG
    return getters(context)
  })
}

// Hook: 获取当前账号的Chrome配置操作函数
export function useCurrentChromeConfigActions() {
  const setPath = useChromeConfigStore(state => state.setPath)
  const setStorageState = useChromeConfigStore(state => state.setStorageState)
  const setHeadless = useChromeConfigStore(state => state.setHeadless)
  const currentAccountId = useAccounts(state => state.currentAccountId)

  return useMemo(
    () => ({
      setPath: (path: string) => setPath(currentAccountId, path),
      setStorageState: (storageState: string) => setStorageState(currentAccountId, storageState),
      setHeadless: (headless: boolean) => setHeadless(currentAccountId, headless),
    }),
    [currentAccountId, setPath, setStorageState, setHeadless],
  )
}

// Hook: 自动加载当前用户的Chrome配置
export function useLoadChromeConfigOnLogin() {
  const { isAuthenticated, user } = useAuthStore()
  const loadUserConfigs = useChromeConfigStore(state => state.loadUserConfigs)

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // 延迟加载，确保存储系统已初始化
      setTimeout(() => {
        console.log('[ChromeConfig] 加载用户配置:', user.id)
        loadUserConfigs(user.id)
      }, 0)
    }
  }, [isAuthenticated, user?.id, loadUserConfigs])
}
