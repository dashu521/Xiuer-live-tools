import { useMemoizedFn } from 'ahooks'
import { useEffect, useMemo, useRef } from 'react'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { useShallow } from 'zustand/react/shallow'
import { useAuthStore } from '@/stores/authStore'
import { EVENTS, eventEmitter } from '@/utils/events'
import { storageManager } from '@/utils/storage/StorageManager'
import { useAccounts } from './useAccounts'

export interface Message {
  id: string
  content: string
  pinTop: boolean
}

interface AutoMessageConfig {
  scheduler: {
    interval: [number, number] // [最小间隔, 最大间隔]
  }
  messages: Message[]
  random: boolean
  extraSpaces: boolean
}

interface AutoMessageContext {
  isRunning: boolean
  config: AutoMessageConfig
  batchCount?: number
}

const defaultContext = (): AutoMessageContext => ({
  isRunning: false,
  config: {
    scheduler: {
      interval: [30000, 60000],
    },
    messages: [],
    random: false,
    extraSpaces: false,
  },
})

interface AutoMessageStore {
  contexts: Record<string, AutoMessageContext>
  currentUserId: string | null
  setIsRunning: (accountId: string, running: boolean) => void
  setConfig: (accountId: string, config: Partial<AutoMessageConfig>) => void
  setBatchCount: (accountId: string, batchCount: number) => void
  loadUserContexts: (userId: string) => void
  resetAllContexts: () => void
}

export const useAutoMessageStore = create<AutoMessageStore>()(
  immer((set, get) => {
    eventEmitter.on(EVENTS.ACCOUNT_REMOVED, (accountId: string) => {
      set(state => {
        delete state.contexts[accountId]
        const { currentUserId } = get()
        if (currentUserId) {
          try {
            storageManager.remove('auto-message', {
              level: 'account',
              userId: currentUserId,
              accountId,
            })
          } catch (e) {
            console.error('[AutoMessage] 删除存储失败:', e)
          }
        }
      })
    })

    eventEmitter.on(EVENTS.ACCOUNT_ADDED, (accountId: string) => {
      set(state => {
        state.contexts[accountId] = defaultContext()
      })
    })

    const ensureContext = (state: AutoMessageStore, accountId: string) => {
      if (!state.contexts[accountId]) {
        state.contexts[accountId] = defaultContext()
      }
      return state.contexts[accountId]
    }

    const saveToStorage = (accountId: string, context: AutoMessageContext) => {
      const { currentUserId } = get()
      if (currentUserId) {
        try {
          // 不保存 isRunning 状态
          const dataToSave = {
            ...context,
            isRunning: false,
          }
          storageManager.set('auto-message', dataToSave, {
            level: 'account',
            userId: currentUserId,
            accountId,
          })
        } catch (e) {
          console.error('[AutoMessage] 保存到存储失败:', e)
        }
      }
    }

    return {
      contexts: {},
      currentUserId: null,

      setIsRunning: (accountId, running) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.isRunning = running
          // isRunning 不保存到存储
        }),

      setConfig: (accountId, config) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.config = {
            ...state.contexts[accountId].config,
            ...config,
          }
          saveToStorage(accountId, context)
        }),

      setBatchCount: (accountId, count) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.batchCount = count
          saveToStorage(accountId, context)
        }),

      loadUserContexts: (userId: string) => {
        const loadContexts = () => {
          const { accounts } = useAccounts.getState()
          if (accounts.length === 0) {
            return
          }

          set(state => {
            state.currentUserId = userId
            state.contexts = {}

            accounts.forEach(account => {
              const savedContext = storageManager.get<AutoMessageContext>('auto-message', {
                level: 'account',
                userId,
                accountId: account.id,
              })
              if (savedContext) {
                state.contexts[account.id] = {
                  ...savedContext,
                  isRunning: false,
                }
              }
            })
          })
        }

        const { accounts } = useAccounts.getState()
        if (accounts.length > 0) {
          loadContexts()
        } else {
          const unsubscribe = useAccounts.subscribe(state => {
            if (state.accounts.length > 0) {
              unsubscribe()
              loadContexts()
            }
          })
        }
      },

      resetAllContexts: () => {
        set(state => {
          // 保存当前数据到存储
          const { currentUserId } = state
          if (currentUserId) {
            Object.entries(state.contexts).forEach(([accountId, context]) => {
              try {
                const dataToSave = {
                  ...context,
                  isRunning: false,
                }
                storageManager.set('auto-message', dataToSave, {
                  level: 'account',
                  userId: currentUserId,
                  accountId,
                })
              } catch (e) {
                console.error('[AutoMessage] 保存配置失败:', e)
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

export const useAutoMessageActions = () => {
  const setIsRunning = useAutoMessageStore(state => state.setIsRunning)
  const setConfig = useAutoMessageStore(state => state.setConfig)
  const setBatchCount = useAutoMessageStore(state => state.setBatchCount)
  const currentAccountId = useAccounts(state => state.currentAccountId)
  const updateConfig = useMemoizedFn((newConfig: Partial<AutoMessageConfig>) => {
    setConfig(currentAccountId, newConfig)
  })

  return useMemo(
    () => ({
      setIsRunning: (running: boolean) => setIsRunning(currentAccountId, running),
      setScheduler: (scheduler: AutoMessageConfig['scheduler']) => updateConfig({ scheduler }),
      setMessages: (messages: Message[]) => updateConfig({ messages }),
      setRandom: (random: boolean) => updateConfig({ random }),
      setExtraSpaces: (extraSpaces: boolean) => updateConfig({ extraSpaces }),
      setBatchCount: (count: number) => setBatchCount(currentAccountId, count),
    }),
    [currentAccountId, setIsRunning, updateConfig, setBatchCount],
  )
}

export const useCurrentAutoMessage = <T>(getter: (context: AutoMessageContext) => T): T => {
  const currentAccountId = useAccounts(state => state.currentAccountId)
  const { loadUserContexts } = useAutoMessageStore()
  const { user } = useAuthStore()

  // 当账号切换时，确保配置已加载
  useEffect(() => {
    if (currentAccountId && user?.id) {
      const state = useAutoMessageStore.getState()
      // 如果当前账号的配置不存在，重新加载
      if (!state.contexts[currentAccountId]) {
        console.log('[AutoMessage] 账号切换，加载配置:', currentAccountId)
        loadUserContexts(user.id)
      }
    }
  }, [currentAccountId, user?.id, loadUserContexts])

  const defaultContextRef = useRef(defaultContext())
  return useAutoMessageStore(
    useShallow(state => {
      const context = state.contexts[currentAccountId] ?? defaultContextRef.current
      return getter(context)
    }),
  )
}

// Hook: 自动加载配置
export function useLoadAutoMessageOnLogin() {
  const { loadUserContexts } = useAutoMessageStore()
  const { isAuthenticated, user } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // 延迟加载，确保存储系统已初始化
      setTimeout(() => {
        console.log('[AutoMessage] 加载用户配置:', user.id)
        loadUserContexts(user.id)
      }, 0)
    }
  }, [isAuthenticated, user?.id, loadUserContexts])
}
