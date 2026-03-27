import { useMemoizedFn, useThrottleFn } from 'ahooks'
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
import { useOSPlatform } from './useOSPlatform'

// 快捷键映射类型定义
export interface ShortcutMapping {
  id: string
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  goodsIds: number[]
}

/**
 * 【P1-3】单个商品配置
 * 支持为每个商品单独设置弹窗间隔
 */
export interface GoodsItemConfig {
  id: number
  interval?: [number, number] // 可选：单独设置间隔（毫秒）
}

export interface AutoPopUpConfig {
  scheduler: {
    interval: [number, number] // 全局默认间隔（毫秒）
  }
  goods: GoodsItemConfig[] // 商品配置列表（替代 goodsIds）
  goodsIds?: number[] // 【兼容旧配置】
  random: boolean
}

interface AutoPopUpContext {
  isRunning: boolean
  config: AutoPopUpConfig
  shortcuts?: ShortcutMapping[]
  isGlobalShortcut?: boolean
}

const defaultContext = (): AutoPopUpContext => ({
  isRunning: false,
  config: {
    scheduler: {
      interval: [30000, 45000],
    },
    goods: [], // 【P1-3】使用 goods 替代 goodsIds
    random: false,
  },
  shortcuts: [],
})

interface AutoPopUpStore {
  contexts: Record<string, AutoPopUpContext>
  currentUserId: string | null
  setIsRunning: (accountId: string, running: boolean) => void
  setConfig: (accountId: string, config: Partial<AutoPopUpConfig>) => void
  setShortcuts: (accountId: string, shortcuts: ShortcutMapping[]) => void
  setGlobalShortcut: (accountId: string, globalShortcut: boolean) => void
  loadUserContexts: (userId: string) => void
  resetAllContexts: () => void
}

export const useAutoPopUpStore = create<AutoPopUpStore>()(
  immer((set, get) => {
    eventEmitter.on(EVENTS.ACCOUNT_REMOVED, (accountId: string) => {
      set(state => {
        delete state.contexts[accountId]
        removeAccountScopedContext('auto-popup', get().currentUserId, accountId, '[AutoPopUp]')
      })
    })

    const ensureContext = (state: AutoPopUpStore, accountId: string) => {
      if (!state.contexts[accountId]) {
        state.contexts[accountId] = defaultContext()
      }
      return state.contexts[accountId]
    }

    const saveToStorage = (accountId: string, context: AutoPopUpContext) => {
      persistAccountScopedContext({
        namespace: 'auto-popup',
        userId: get().currentUserId,
        accountId,
        context,
        logPrefix: '[AutoPopUp]',
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
            // 【P1-3】同步到主进程时，确保使用新的 goods 格式
            const ipcConfig = {
              ...config,
              goods:
                config.goods || (config.goodsIds ? config.goodsIds.map(id => ({ id })) : undefined),
            }
            window.ipcRenderer
              .invoke(IPC_CHANNELS.tasks.autoPopUp.updateConfig, accountId, ipcConfig)
              .catch((err: Error) => console.error('[AutoPopUp] 同步配置到主进程失败:', err))
          }
        }),

      setShortcuts: (accountId, shortcuts) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.shortcuts = shortcuts
          saveToStorage(accountId, context)
        }),

      setGlobalShortcut: (accountId, value) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.isGlobalShortcut = value
          saveToStorage(accountId, context)
        }),

      loadUserContexts: (userId: string) => {
        const loadContexts = () => {
          set(state => {
            state.currentUserId = userId
            state.contexts = loadAccountScopedContexts({
              namespace: 'auto-popup',
              userId,
              restoreContext: (savedContext, accountId) => {
                const nextContext: AutoPopUpContext = {
                  ...savedContext,
                  config: {
                    ...savedContext.config,
                  },
                  isRunning: false,
                }
                if (
                  nextContext.config.goodsIds &&
                  nextContext.config.goodsIds.length > 0 &&
                  (!nextContext.config.goods || nextContext.config.goods.length === 0)
                ) {
                  nextContext.config.goods = nextContext.config.goodsIds.map(id => ({ id }))
                  console.log(`[AutoPopUp] 数据迁移: account ${accountId} goodsIds -> goods`)
                }
                return nextContext
              },
            })
          })
        }

        runWhenAccountsReady(loadContexts)
      },

      resetAllContexts: () => {
        set(state => {
          persistAllAccountScopedContexts({
            namespace: 'auto-popup',
            userId: state.currentUserId,
            contexts: state.contexts,
            logPrefix: '[AutoPopUp]',
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

export const useAutoPopUpActions = () => {
  const setIsRunning = useAutoPopUpStore(state => state.setIsRunning)
  const setConfig = useAutoPopUpStore(state => state.setConfig)
  const setShortcuts = useAutoPopUpStore(state => state.setShortcuts)
  const setGlobalShortcut = useAutoPopUpStore(state => state.setGlobalShortcut)
  const currentAccountId = useAccounts(state => state.currentAccountId)
  const updateConfig = useMemoizedFn((newConfig: Partial<AutoPopUpConfig>) => {
    setConfig(currentAccountId, newConfig)
  })
  return useMemo(
    () => ({
      setIsRunning: (running: boolean) => setIsRunning(currentAccountId, running),
      setScheduler: (scheduler: AutoPopUpConfig['scheduler']) => updateConfig({ scheduler }),
      // 【P1-3】使用 goods 替代 goodsIds
      setGoods: (goods: AutoPopUpConfig['goods']) => updateConfig({ goods }),
      // 【兼容旧配置】保留 setGoodsIds 方法
      setGoodsIds: (goodsIds: number[]) => updateConfig({ goods: goodsIds.map(id => ({ id })) }),
      setRandom: (random: boolean) => updateConfig({ random }),
      // 添加设置快捷键映射的方法
      setShortcuts: (shortcuts: ShortcutMapping[]) => setShortcuts(currentAccountId, shortcuts),
      // 添加单个快捷键映射
      addShortcut: (shortcut: ShortcutMapping) => {
        const currentShortcuts =
          useAutoPopUpStore.getState().contexts[currentAccountId]?.shortcuts ?? []
        setShortcuts(currentAccountId, [shortcut, ...currentShortcuts])
      },
      updateShortcut: (shortcut: ShortcutMapping) => {
        const currentShortcuts =
          useAutoPopUpStore.getState().contexts[currentAccountId]?.shortcuts ?? []
        setShortcuts(
          currentAccountId,
          currentShortcuts.map(s => (s.id === shortcut.id ? shortcut : s)),
        )
      },
      // 删除快捷键映射
      removeShortcut: (id: string) => {
        const currentShortcuts =
          useAutoPopUpStore.getState().contexts[currentAccountId]?.shortcuts || []
        setShortcuts(
          currentAccountId,
          currentShortcuts.filter(s => s.id !== id),
        )
      },
      setGlobalShortcut: (value: boolean) => {
        setGlobalShortcut(currentAccountId, value)
      },
    }),
    [currentAccountId, setIsRunning, updateConfig, setShortcuts, setGlobalShortcut],
  )
}

// 添加快捷键监听 hook
export const useShortcutListener = () => {
  const shortcuts = useCurrentAutoPopUp(context => context.shortcuts)
  const isRunning = useCurrentAutoPopUp(context => context.isRunning)
  const isGlobalShortcut = useCurrentAutoPopUp(ctx => ctx.isGlobalShortcut)
  const platform = useOSPlatform()
  const accountId = useAccounts(s => s.currentAccountId)

  // 全局的
  useEffect(() => {
    if (!isGlobalShortcut) return
    if (!isRunning) return
    if (!shortcuts || shortcuts.length === 0) return

    const mappedShortcuts = shortcuts.map(sc => {
      const accelerator = [
        sc.ctrl && 'CommandOrControl',
        sc.alt && 'Alt',
        sc.shift && 'Shift',
        sc.key,
      ]
        .filter(Boolean)
        .join('+')

      return {
        accelerator,
        goodsIds: sc.goodsIds,
      }
    })

    window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.autoPopUp.registerShortcuts,
      accountId,
      mappedShortcuts,
    )

    return () => {
      window.ipcRenderer.invoke(IPC_CHANNELS.tasks.autoPopUp.unregisterShortcuts)
    }
  }, [isGlobalShortcut, shortcuts, isRunning, accountId])

  const throttledKeydown = useThrottleFn(
    (e: KeyboardEvent, shortcuts: ShortcutMapping[]) => {
      // 检查是否有匹配的快捷键
      const shortcut = shortcuts.find(s => s.key.toLocaleLowerCase() === e.key.toLocaleLowerCase())
      if (
        shortcut &&
        !!shortcut.ctrl ===
          // Mac 系统可以用 Command 代替 Ctrl，也可以使用 Control
          ((platform === 'MacOS' && e.metaKey) || e.ctrlKey) &&
        !!shortcut.alt === e.altKey &&
        !!shortcut.shift === e.shiftKey
      ) {
        window.ipcRenderer.invoke(IPC_CHANNELS.tasks.autoPopUp.updateConfig, accountId, {
          goodsIds: shortcut.goodsIds,
        })
      }
    },
    { wait: 1000, trailing: false },
  )

  // 局部的
  useEffect(() => {
    if (isGlobalShortcut) return
    if (!isRunning) return
    if (!shortcuts || shortcuts.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查是否有匹配的快捷键
      throttledKeydown.run(e, shortcuts)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [shortcuts, isRunning, isGlobalShortcut, throttledKeydown])
}

export const useCurrentAutoPopUp = <T>(getter: (context: AutoPopUpContext) => T): T => {
  const currentAccountId = useAccounts(state => state.currentAccountId)
  const defaultContextRef = useRef(defaultContext())
  return useAutoPopUpStore(
    useShallow(state => {
      const context = state.contexts[currentAccountId] ?? defaultContextRef.current
      return getter(context)
    }),
  )
}

// Hook: 自动加载配置
export function useLoadAutoPopUpOnLogin() {
  const { loadUserContexts } = useAutoPopUpStore()
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
