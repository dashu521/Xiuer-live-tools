import { useEffect } from 'react'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { useAuthStore } from '@/stores/authStore'
import { EVENTS, eventEmitter } from '@/utils/events'
import type { StringFilterConfig } from '@/utils/filter'
import { mergeWithoutArray } from '@/utils/misc'
import { storageManager } from '@/utils/storage/StorageManager'
import { useAccounts } from './useAccounts'
import type { EventMessageType } from './useAutoReply'

interface AutoReplyBaseConfig {
  entry: CommentListenerConfig['source']
  hideUsername: boolean
  comment: {
    keywordReply: {
      enable: boolean
      rules: {
        keywords: string[]
        contents: string[]
      }[]
    }
    aiReply: {
      enable: boolean
      prompt: string
      autoSend: boolean
      /** 【P1-1 AI联动】是否使用AI对话的共享配置 */
      useSharedConfig?: boolean
    }
  }
  blockList: string[]
  ws?: {
    enable: boolean
    port: number
  }
}

export type SimpleEventReplyMessage = string | { content: string; filter: StringFilterConfig }

export interface SimpleEventReply {
  enable: boolean
  messages: SimpleEventReplyMessage[]
  options?: Record<string, boolean>
}

type CompassExtraConfig = {
  [K in EventMessageType]: SimpleEventReply
}

type WechatChannelExtraConfig = {
  pinComment: {
    enable: boolean
    includeHost: boolean
    matchStr: string[]
  }
}

export type AutoReplyConfig = AutoReplyBaseConfig & CompassExtraConfig & WechatChannelExtraConfig

const defaultPrompt =
  '你是一个直播间的助手，负责回复观众的评论。请用简短友好的语气回复，不要超过50个字。'

export const createDefaultConfig = (): AutoReplyConfig => {
  return {
    entry: 'control',
    hideUsername: false,
    comment: {
      keywordReply: {
        enable: false,
        rules: [],
      },
      aiReply: {
        enable: false,
        prompt: defaultPrompt,
        autoSend: false,
      },
    },
    room_enter: {
      enable: false,
      messages: [],
    },
    room_like: {
      enable: false,
      messages: [],
    },
    subscribe_merchant_brand_vip: {
      enable: false,
      messages: [],
    },
    live_order: {
      enable: false,
      messages: [],
      options: {
        onlyReplyPaid: false,
      },
    },
    room_follow: {
      enable: false,
      messages: [],
    },
    ecom_fansclub_participate: {
      enable: false,
      messages: [],
    },
    pinComment: {
      enable: false,
      includeHost: false,
      matchStr: [],
    },
    blockList: [],
    ws: {
      enable: false,
      port: 12354,
    },
  }
}

type DeepPartial<T> = T extends (...args: unknown[]) => unknown
  ? T
  : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends object
      ? {
          [P in keyof T]?: DeepPartial<T[P]>
        }
      : T

interface AutoReplyContext {
  config: AutoReplyConfig
}

const defaultContext = (): AutoReplyContext => ({
  config: createDefaultConfig(),
})

interface AutoReplyConfigStore {
  contexts: Record<string, AutoReplyContext>
  currentUserId: string | null
  updateConfig: (accountId: string, configUpdates: DeepPartial<AutoReplyConfig>) => void
  loadUserContexts: (userId: string) => void
  resetAllContexts: () => void
}

export const useAutoReplyConfigStore = create<AutoReplyConfigStore>()(
  immer((set, get) => {
    eventEmitter.on(EVENTS.ACCOUNT_REMOVED, (accountId: string) => {
      set(state => {
        delete state.contexts[accountId]
        const { currentUserId } = get()
        if (currentUserId) {
          try {
            storageManager.remove('auto-reply', {
              level: 'account',
              userId: currentUserId,
              accountId,
            })
          } catch (e) {
            console.error('[AutoReplyConfig] 删除存储失败:', e)
          }
        }
      })
    })

    const ensureContext = (state: AutoReplyConfigStore, accountId: string) => {
      if (!state.contexts[accountId]) {
        state.contexts[accountId] = defaultContext()
      }
      return state.contexts[accountId]
    }

    const saveToStorage = (accountId: string, context: AutoReplyContext) => {
      const { currentUserId } = get()
      if (currentUserId) {
        try {
          storageManager.set('auto-reply', context, {
            level: 'account',
            userId: currentUserId,
            accountId,
          })
        } catch (e) {
          console.error('[AutoReplyConfig] 保存到存储失败:', e)
        }
      }
    }

    return {
      contexts: {},
      currentUserId: null,

      updateConfig: (accountId, configUpdates) =>
        set(state => {
          const context = ensureContext(state, accountId)
          const newConfig = mergeWithoutArray(context.config, configUpdates)
          context.config = newConfig
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
              const savedContext = storageManager.get<AutoReplyContext>('auto-reply', {
                level: 'account',
                userId,
                accountId: account.id,
              })
              if (savedContext) {
                state.contexts[account.id] = savedContext
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
                storageManager.set('auto-reply', context, {
                  level: 'account',
                  userId: currentUserId,
                  accountId,
                })
              } catch (e) {
                console.error('[AutoReplyConfig] 保存配置失败:', e)
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

export const useAutoReplyConfig = () => {
  const store = useAutoReplyConfigStore()
  const currentAccountId = useAccounts(ctx => ctx.currentAccountId)
  const config = mergeWithoutArray(
    createDefaultConfig(),
    store.contexts[currentAccountId]?.config ?? {},
  )

  return {
    config,
    updateKeywordRules: (rules: AutoReplyConfig['comment']['keywordReply']['rules']) => {
      store.updateConfig(currentAccountId, {
        comment: { keywordReply: { rules } },
      })
    },
    updateAIReplySettings: (settings: DeepPartial<AutoReplyConfig['comment']['aiReply']>) => {
      store.updateConfig(currentAccountId, { comment: { aiReply: settings } })
    },
    updateGeneralSettings: (
      settings: DeepPartial<Pick<AutoReplyConfig, 'entry' | 'hideUsername'>>,
    ) => {
      store.updateConfig(currentAccountId, settings)
    },
    updateEventReplyContents: (
      replyType: EventMessageType,
      contents: SimpleEventReplyMessage[],
    ) => {
      store.updateConfig(currentAccountId, {
        [replyType]: { messages: contents },
      })
    },
    updateBlockList: (blockList: string[]) => {
      store.updateConfig(currentAccountId, { blockList })
    },
    updateKeywordReplyEnabled: (enable: boolean) => {
      store.updateConfig(currentAccountId, {
        comment: { keywordReply: { enable } },
      })
    },
    updateEventReplyEnabled: (replyType: EventMessageType, enable: boolean) => {
      store.updateConfig(currentAccountId, {
        [replyType]: { enable },
      })
    },
    updateEventReplyOptions: <T extends EventMessageType>(
      replyType: T,
      options: AutoReplyConfig[T]['options'],
    ) => {
      store.updateConfig(currentAccountId, {
        [replyType]: { options },
      })
    },
    updateWSConfig: (wsConfig: DeepPartial<AutoReplyConfig['ws']>) => {
      store.updateConfig(currentAccountId, { ws: wsConfig })
    },
    updatePinCommentConfig: (pinCommentConfig: DeepPartial<AutoReplyConfig['pinComment']>) => {
      store.updateConfig(currentAccountId, {
        pinComment: pinCommentConfig,
      })
    },
  }
}

// Hook: 自动加载配置
export function useLoadAutoReplyConfigOnLogin() {
  const { loadUserContexts } = useAutoReplyConfigStore()
  const { isAuthenticated, user } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // 延迟加载，确保存储系统已初始化
      setTimeout(() => {
        console.log('[AutoReplyConfig] 加载用户配置:', user.id)
        loadUserContexts(user.id)
      }, 0)
    }
  }, [isAuthenticated, user?.id, loadUserContexts])
}
