import { useMemoizedFn } from 'ahooks'
import { useEffect, useMemo, useRef } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { useShallow } from 'zustand/react/shallow'
import { useAuthStore } from '@/stores/authStore'
import { EVENTS, eventEmitter } from '@/utils/events'
import {
  loadAccountScopedContexts,
  persistAccountScopedContext,
  persistAllAccountScopedContexts,
  removeAccountScopedContext,
  runWhenAccountsReady,
} from './accountScopedContextStorage'
import { useAccounts } from './useAccounts'

export interface Message {
  id: string
  content: string
  pinTop: boolean
}

export function getEffectiveAutoMessages(messages: Message[]): Message[] {
  return messages
    .map(message => ({
      ...message,
      content: message.content.trim(),
    }))
    .filter(message => message.content.length > 0)
}

export function getEffectiveAutoMessageContents(messages: Message[]): string[] {
  return getEffectiveAutoMessages(messages).map(message => message.content)
}

export function hasEffectiveAutoMessages(messages: Message[]): boolean {
  return getEffectiveAutoMessages(messages).length > 0
}

export interface AutoMessageConfig {
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
        removeAccountScopedContext('auto-message', get().currentUserId, accountId, '[AutoMessage]')
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
      persistAccountScopedContext({
        namespace: 'auto-message',
        userId: get().currentUserId,
        accountId,
        context,
        logPrefix: '[AutoMessage]',
        serialize: savedContext => ({
          ...savedContext,
          isRunning: false,
        }),
      })
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

          // 【P1-2 运行时配置热更新】如果任务正在运行，同步更新到主进程
          if (context.isRunning) {
            if (config.messages && getEffectiveAutoMessages(context.config.messages).length === 0) {
              context.isRunning = false
              window.ipcRenderer
                .invoke(IPC_CHANNELS.tasks.autoMessage.stop, accountId)
                .catch((err: Error) => console.error('[AutoMessage] 停止主进程任务失败:', err))
              return
            }

            const runtimeConfig: Partial<AutoCommentConfig> = {}

            if (config.scheduler) {
              runtimeConfig.scheduler = config.scheduler
            }
            if (config.random !== undefined) {
              runtimeConfig.random = config.random
            }
            if (config.extraSpaces !== undefined) {
              runtimeConfig.extraSpaces = config.extraSpaces
            }
            if (config.messages) {
              const effectiveMessages = getEffectiveAutoMessages(context.config.messages).map(
                ({ content, pinTop }) => ({
                  content,
                  pinTop,
                }),
              )
              if (effectiveMessages.length > 0) {
                runtimeConfig.messages = effectiveMessages
              }
            }

            if (Object.keys(runtimeConfig).length > 0) {
              window.ipcRenderer
                .invoke(IPC_CHANNELS.tasks.autoMessage.updateConfig, accountId, runtimeConfig)
                .catch((err: Error) => console.error('[AutoMessage] 同步配置到主进程失败:', err))
            }
          }
        }),

      setBatchCount: (accountId, count) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.batchCount = count
          saveToStorage(accountId, context)
        }),

      loadUserContexts: (userId: string) => {
        const loadContexts = () => {
          set(state => {
            state.currentUserId = userId
            state.contexts = loadAccountScopedContexts({
              namespace: 'auto-message',
              userId,
              restoreContext: savedContext => ({
                ...savedContext,
                isRunning: false,
              }),
            })
          })
        }

        runWhenAccountsReady(loadContexts)
      },

      resetAllContexts: () => {
        set(state => {
          persistAllAccountScopedContexts({
            namespace: 'auto-message',
            userId: state.currentUserId,
            contexts: state.contexts,
            logPrefix: '[AutoMessage]',
            serialize: savedContext => ({
              ...savedContext,
              isRunning: false,
            }),
          })
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
        loadUserContexts(user.id)
      }, 0)
    }
  }, [isAuthenticated, user?.id, loadUserContexts])
}
