import { useMemoizedFn } from 'ahooks'
import { useEffect, useMemo, useRef } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { useShallow } from 'zustand/react/shallow'
import { useAuthStore } from '@/stores/authStore'
import { EVENTS, eventEmitter } from '@/utils/events'
import { isolatedStorage, STORAGE_PREFIXES } from '@/utils/storageIsolation'
import { useAccounts } from './useAccounts'

export interface SubAccountMessage {
  id: string
  content: string
  weight: number
}

export interface SubAccountStats {
  totalSent: number
  successCount: number
  failCount: number
  lastSendTime?: number
  lastError?: string
}

export interface SubAccount {
  id: string
  name: string
  platform: LiveControlPlatform
  status: 'idle' | 'connecting' | 'connected' | 'error'
  error?: string
  stats: SubAccountStats
  group?: string
}

export interface SubAccountGroup {
  id: string
  name: string
  accountIds: string[]
  enabled: boolean
}

interface SubAccountInteractionConfig {
  scheduler: {
    interval: [number, number]
  }
  messages: SubAccountMessage[]
  random: boolean
  extraSpaces: boolean
  rotateAccounts: boolean
  rotateGroups: boolean
  groups: SubAccountGroup[]
}

interface SubAccountContext {
  isRunning: boolean
  config: SubAccountInteractionConfig
  accounts: SubAccount[]
  batchCount: number
  liveRoomUrl: string
}

const defaultContext = (): SubAccountContext => ({
  isRunning: false,
  config: {
    scheduler: {
      interval: [30000, 60000],
    },
    messages: [
      { id: '1', content: '666', weight: 1 },
      { id: '2', content: '支持主播', weight: 1 },
      { id: '3', content: '来了来了', weight: 1 },
    ],
    random: true,
    extraSpaces: true,
    rotateAccounts: true,
    rotateGroups: false,
    groups: [],
  },
  accounts: [],
  batchCount: 5,
  liveRoomUrl: '',
})

interface SubAccountStore {
  contexts: Record<string, SubAccountContext>
  currentUserId: string | null
  setIsRunning: (accountId: string, running: boolean) => void
  setConfig: (accountId: string, config: Partial<SubAccountInteractionConfig>) => void
  setAccounts: (accountId: string, accounts: SubAccount[]) => void
  addAccount: (accountId: string, account: SubAccount) => void
  removeAccount: (accountId: string, subAccountId: string) => void
  updateAccountStatus: (
    accountId: string,
    subAccountId: string,
    status: SubAccount['status'],
    error?: string,
  ) => void
  updateAccountStats: (
    accountId: string,
    subAccountId: string,
    stats: Partial<SubAccountStats>,
  ) => void
  setBatchCount: (accountId: string, batchCount: number) => void
  setLiveRoomUrl: (accountId: string, url: string) => void
  addGroup: (accountId: string, group: SubAccountGroup) => void
  removeGroup: (accountId: string, groupId: string) => void
  updateGroup: (accountId: string, groupId: string, updates: Partial<SubAccountGroup>) => void
  setAccountGroup: (accountId: string, subAccountId: string, groupId: string | undefined) => void
  loadUserContexts: (userId: string) => void
  resetAllContexts: () => void
}

export const useSubAccountStore = create<SubAccountStore>()(
  immer((set, get) => {
    eventEmitter.on(EVENTS.ACCOUNT_REMOVED, (accountId: string) => {
      set(state => {
        delete state.contexts[accountId]
        const { currentUserId } = get()
        if (currentUserId) {
          try {
            isolatedStorage.removeAccountItem(STORAGE_PREFIXES.SUB_ACCOUNT, accountId)
          } catch (e) {
            console.error('[SubAccount] 删除隔离存储失败:', e)
          }
        }
      })
    })

    eventEmitter.on(EVENTS.ACCOUNT_ADDED, (accountId: string) => {
      set(state => {
        state.contexts[accountId] = defaultContext()
      })
    })

    const ensureContext = (state: SubAccountStore, accountId: string) => {
      if (!state.contexts[accountId]) {
        state.contexts[accountId] = defaultContext()
      }
      return state.contexts[accountId]
    }

    const saveToIsolation = (accountId: string, context: SubAccountContext) => {
      const { currentUserId } = get()
      if (currentUserId) {
        try {
          // 不保存 isRunning 和运行时状态
          const dataToSave = {
            ...context,
            isRunning: false,
            accounts: context.accounts.map(a => ({
              ...a,
              status: 'idle' as const,
              error: undefined,
            })),
          }
          isolatedStorage.setAccountItem(STORAGE_PREFIXES.SUB_ACCOUNT, accountId, dataToSave)
        } catch (e) {
          console.error('[SubAccount] 保存到隔离存储失败:', e)
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
          // isRunning 不保存到隔离存储
        }),

      setConfig: (accountId, config) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.config = {
            ...state.contexts[accountId].config,
            ...config,
          }
          saveToIsolation(accountId, context)
        }),

      setAccounts: (accountId, accounts) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.accounts = accounts
          saveToIsolation(accountId, context)
        }),

      addAccount: (accountId, account) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.accounts.push(account)
          saveToIsolation(accountId, context)
        }),

      removeAccount: (accountId, subAccountId) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.accounts = context.accounts.filter(a => a.id !== subAccountId)
          saveToIsolation(accountId, context)
        }),

      updateAccountStatus: (accountId, subAccountId, status, error) =>
        set(state => {
          const context = ensureContext(state, accountId)
          const account = context.accounts.find(a => a.id === subAccountId)
          if (account) {
            account.status = status
            account.error = error
          }
          // 不保存运行时状态到隔离存储
        }),

      updateAccountStats: (accountId, subAccountId, stats) =>
        set(state => {
          const context = ensureContext(state, accountId)
          const account = context.accounts.find(a => a.id === subAccountId)
          if (account) {
            account.stats = { ...account.stats, ...stats }
          }
          // 不保存运行时状态到隔离存储
        }),

      setBatchCount: (accountId, batchCount) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.batchCount = batchCount
          saveToIsolation(accountId, context)
        }),

      setLiveRoomUrl: (accountId, url) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.liveRoomUrl = url
          saveToIsolation(accountId, context)
        }),

      addGroup: (accountId, group) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.config.groups?.push(group)
          saveToIsolation(accountId, context)
        }),

      removeGroup: (accountId, groupId) =>
        set(state => {
          const context = ensureContext(state, accountId)
          // 获取被删除分组中的账号ID列表
          const removedGroup = context.config.groups?.find(g => g.id === groupId)
          const affectedAccountIds = removedGroup?.accountIds ?? []
          // 删除分组
          context.config.groups = context.config.groups?.filter(g => g.id !== groupId) ?? []
          // 清理受影响账号的group字段
          context.accounts?.forEach(account => {
            if (affectedAccountIds.includes(account.id)) {
              account.group = undefined
            }
          })
          saveToIsolation(accountId, context)
        }),

      updateGroup: (accountId, groupId, updates) =>
        set(state => {
          const context = ensureContext(state, accountId)
          const group = context.config.groups?.find(g => g.id === groupId)
          if (group) {
            Object.assign(group, updates)
          }
          saveToIsolation(accountId, context)
        }),

      setAccountGroup: (accountId, subAccountId, groupId) =>
        set(state => {
          const context = ensureContext(state, accountId)
          const account = context.accounts?.find(a => a.id === subAccountId)
          if (account) {
            context.config.groups?.forEach(g => {
              g.accountIds = g.accountIds?.filter(id => id !== subAccountId) ?? []
            })
            if (groupId) {
              const group = context.config.groups?.find(g => g.id === groupId)
              if (group && !group.accountIds?.includes(subAccountId)) {
                group.accountIds?.push(subAccountId)
              }
              account.group = group?.name
            } else {
              account.group = undefined
            }
          }
          saveToIsolation(accountId, context)
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
              const savedContext = isolatedStorage.getAccountItem<SubAccountContext>(
                STORAGE_PREFIXES.SUB_ACCOUNT,
                account.id,
              )
              if (savedContext) {
                state.contexts[account.id] = {
                  ...savedContext,
                  isRunning: false,
                  accounts: savedContext.accounts.map(a => ({
                    ...a,
                    status: 'idle' as const,
                    error: undefined,
                  })),
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

      resetAllContexts: () =>
        set(state => {
          // 保存当前数据到隔离存储
          const { currentUserId } = state
          if (currentUserId) {
            Object.entries(state.contexts).forEach(([accountId, context]) => {
              try {
                const dataToSave = {
                  ...context,
                  isRunning: false,
                  accounts: context.accounts.map(a => ({
                    ...a,
                    status: 'idle' as const,
                    error: undefined,
                  })),
                }
                isolatedStorage.setAccountItem(STORAGE_PREFIXES.SUB_ACCOUNT, accountId, dataToSave)
              } catch (e) {
                console.error('[SubAccount] 保存配置失败:', e)
              }
            })
          }
          state.contexts = {}
          state.currentUserId = null
        }),
    }
  }),
)

export const useSubAccountActions = () => {
  const currentAccountId = useAccounts(state => state.currentAccountId)

  const updateConfig = useMemoizedFn((newConfig: Partial<SubAccountInteractionConfig>) => {
    useSubAccountStore.getState().setConfig(currentAccountId, newConfig)
  })

  return useMemo(() => {
    const getStore = () => useSubAccountStore.getState()
    return {
      setIsRunning: (running: boolean) => getStore().setIsRunning(currentAccountId, running),
      setScheduler: (scheduler: SubAccountInteractionConfig['scheduler']) =>
        updateConfig({ scheduler }),
      setMessages: (messages: SubAccountMessage[]) => updateConfig({ messages }),
      setRandom: (random: boolean) => updateConfig({ random }),
      setExtraSpaces: (extraSpaces: boolean) => updateConfig({ extraSpaces }),
      setRotateAccounts: (rotateAccounts: boolean) => updateConfig({ rotateAccounts }),
      setAccounts: (accounts: SubAccount[]) => getStore().setAccounts(currentAccountId, accounts),
      addAccount: (account: SubAccount) => getStore().addAccount(currentAccountId, account),
      removeAccount: (subAccountId: string) =>
        getStore().removeAccount(currentAccountId, subAccountId),
      updateAccountStatus: (subAccountId: string, status: SubAccount['status'], error?: string) =>
        getStore().updateAccountStatus(currentAccountId, subAccountId, status, error),
      updateAccountStats: (subAccountId: string, stats: Partial<SubAccountStats>) =>
        getStore().updateAccountStats(currentAccountId, subAccountId, stats),
      setBatchCount: (count: number) => getStore().setBatchCount(currentAccountId, count),
      setLiveRoomUrl: (url: string) => getStore().setLiveRoomUrl(currentAccountId, url),
      addGroup: (group: SubAccountGroup) => getStore().addGroup(currentAccountId, group),
      removeGroup: (groupId: string) => getStore().removeGroup(currentAccountId, groupId),
      updateGroup: (groupId: string, updates: Partial<SubAccountGroup>) =>
        getStore().updateGroup(currentAccountId, groupId, updates),
      setAccountGroup: (subAccountId: string, groupId: string | undefined) =>
        getStore().setAccountGroup(currentAccountId, subAccountId, groupId),
      setRotateGroups: (rotateGroups: boolean) => updateConfig({ rotateGroups }),
    }
  }, [currentAccountId, updateConfig])
}

export const useCurrentSubAccount = <T>(getter: (context: SubAccountContext) => T): T => {
  const currentAccountId = useAccounts(state => state.currentAccountId)
  const { loadUserContexts } = useSubAccountStore()
  const { user } = useAuthStore()

  // 当账号切换时，确保配置已加载
  useEffect(() => {
    if (currentAccountId && user?.id) {
      const state = useSubAccountStore.getState()
      // 如果当前账号的配置不存在，重新加载
      if (!state.contexts[currentAccountId]) {
        console.log('[SubAccount] 账号切换，加载配置:', currentAccountId)
        loadUserContexts(user.id)
      }
    }
  }, [currentAccountId, user?.id, loadUserContexts])

  const defaultContextRef = useRef(defaultContext())
  return useSubAccountStore(
    useShallow(state => {
      const context = state.contexts[currentAccountId] ?? defaultContextRef.current
      return getter(context)
    }),
  )
}

// Hook: 自动加载配置
export function useLoadSubAccountOnLogin() {
  const { loadUserContexts } = useSubAccountStore()
  const { isAuthenticated, user } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // 延迟加载，确保存储系统已初始化
      setTimeout(() => {
        console.log('[SubAccount] 加载用户配置:', user.id)
        loadUserContexts(user.id)
      }, 0)
    }
  }, [isAuthenticated, user?.id, loadUserContexts])
}

/**
 * 应用启动时将前端持久化的小号同步到后端 SubAccountManager
 *
 * 使用 Map 来跟踪每个账号的同步状态，避免：
 * 1. React StrictMode 的双重挂载导致重复同步
 * 2. 账号切换时的重复同步
 */
const syncedAccounts = new Map<string, boolean>()

export function useSyncSubAccountsOnMount() {
  const currentAccountId = useAccounts(state => state.currentAccountId)
  const accounts = useCurrentSubAccount(ctx => ctx.accounts)

  useEffect(() => {
    // 检查当前账号是否已同步
    if (syncedAccounts.get(currentAccountId) || accounts.length === 0) return

    // 标记为已同步
    syncedAccounts.set(currentAccountId, true)

    const configs = accounts.map(a => ({
      id: a.id,
      name: a.name,
      platform: a.platform,
    }))

    window.ipcRenderer
      .invoke(IPC_CHANNELS.tasks.subAccount.syncAccounts, currentAccountId, configs)
      .then(() => {
        console.log(`[SubAccount] 账号 ${currentAccountId} 的小号同步成功`)
      })
      .catch(error => {
        console.error(`[SubAccount] 账号 ${currentAccountId} 的小号同步失败:`, error)
        // 同步失败时重置标记，允许重试
        syncedAccounts.delete(currentAccountId)
      })
  }, [currentAccountId, accounts])
}
