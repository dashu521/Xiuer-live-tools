import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { buildAccessContext, checkAccess } from '@/domain/access'
import { useAuthStore } from '@/stores/authStore'
import { EVENTS, eventEmitter } from '@/utils/events'
import { storageManager } from '@/utils/storage/StorageManager'

interface Account {
  id: string
  name: string
}

interface AccountsStore {
  accounts: Account[]
  currentAccountId: string
  defaultAccountId: string | null
  currentUserId: string | null
  addAccount: (name: string) => { success: boolean; error?: string }
  removeAccount: (id: string) => void
  switchAccount: (id: string) => void
  setDefaultAccount: (id: string) => void
  getCurrentAccount: () => Account | undefined
  updateAccountName: (id: string, name: string) => void
  reorderAccounts: (fromIndex: number, toIndex: number) => void
  canAddAccount: () => { allowed: boolean; current: number; max: number; reason?: string }
  loadUserAccounts: (userId: string) => void
  reset: () => void
}

/**
 * 从存储加载账号数据
 */
const loadFromStorage = (
  userId: string,
): { accounts: Account[]; currentAccountId: string; defaultAccountId: string | null } | null => {
  if (!userId) return null

  const data = storageManager.get<{
    accounts: Account[]
    currentAccountId: string
    defaultAccountId: string | null
  }>('accounts', { level: 'user', userId })

  console.log('[useAccounts] 从存储加载:', userId, '数据存在:', !!data)
  return data
}

/**
 * 保存账号数据到存储
 */
const saveToStorage = (
  userId: string | null,
  data: { accounts: Account[]; currentAccountId: string; defaultAccountId: string | null },
) => {
  if (!userId) {
    console.warn('[useAccounts] saveToStorage: userId 为空，跳过保存')
    return
  }

  storageManager.set('accounts', data, {
    level: 'user',
    userId,
  })
  console.log('[useAccounts] 数据已保存到存储:', userId, '账号数:', data.accounts.length)
}

export const useAccounts = create<AccountsStore>()(
  immer((set, get) => ({
    accounts: [],
    currentAccountId: '',
    defaultAccountId: null,
    currentUserId: null,

    canAddAccount: () => {
      const state = get()

      // 【重构】使用 AccessControl 权限层检查
      const context = buildAccessContext()
      const decision = checkAccess(context, 'addLiveAccount')

      const currentCount = state.accounts.length
      const maxAccounts = context.maxLiveAccounts

      // 如果权限检查通过，允许添加
      if (decision.allowed) {
        return { allowed: true, current: currentCount, max: maxAccounts }
      }

      // 权限检查失败，返回详细原因
      // 根据套餐类型生成友好的提示信息
      const userPlan = context.plan
      let reason: string

      if (userPlan === 'free') {
        reason =
          '亲爱哒，免费版只可以添加1个直播账号哦～如果需要添加更多账号，还请您升级会员等级，解锁更多功能吧！'
      } else if (userPlan === 'trial') {
        reason = '亲爱哒，试用版只可以添加1个直播账号哦～如果觉得好用，可以升级专业版添加更多账号！'
      } else if (userPlan === 'pro') {
        reason =
          '亲爱哒，专业版只可以添加1个直播账号哦～如果需要管理更多直播间，可以升级专业增强版（支持3个账号）或旗舰版（无限制）！'
      } else if (userPlan === 'pro_max') {
        reason =
          '亲爱哒，专业增强版只可以添加3个直播账号哦～如果需要无限制添加账号，可以升级旗舰版！'
      } else {
        reason =
          decision.reason ||
          `已达到账号数量上限 (${currentCount}/${maxAccounts})，如需添加更多账号，请联系客服升级套餐。`
      }

      return {
        allowed: false,
        current: currentCount,
        max: maxAccounts,
        reason,
      }
    },

    addAccount: (name: string) => {
      const check = get().canAddAccount()

      if (!check.allowed) {
        eventEmitter.emit(EVENTS.ACCOUNT_LIMIT_REACHED, check.reason || '已达到账号数量上限')
        return { success: false, error: check.reason }
      }

      const newId = crypto.randomUUID()

      set(state => {
        state.accounts.push({
          id: newId,
          name,
        })
        if (!state.defaultAccountId && state.accounts.length > 0) {
          state.defaultAccountId = state.currentAccountId || state.accounts[0].id
        }
      })

      // 在 set 外部调用 saveToStorage，确保使用最新的状态
      const currentState = get()
      console.log(
        '[useAccounts] addAccount 后保存数据，userId:',
        currentState.currentUserId,
        '账号数:',
        currentState.accounts.length,
      )
      saveToStorage(currentState.currentUserId, {
        accounts: currentState.accounts,
        currentAccountId: currentState.currentAccountId,
        defaultAccountId: currentState.defaultAccountId,
      })

      eventEmitter.emit(EVENTS.ACCOUNT_ADDED, newId, name)

      return { success: true }
    },

    removeAccount: (id: string) => {
      set(state => {
        if (state.defaultAccountId === id) {
          if (
            state.currentAccountId &&
            state.currentAccountId !== id &&
            state.accounts.some(acc => acc.id === state.currentAccountId)
          ) {
            state.defaultAccountId = state.currentAccountId
          } else {
            const remainingAccounts = state.accounts.filter(acc => acc.id !== id)
            if (remainingAccounts.length > 0) {
              state.defaultAccountId = remainingAccounts[0].id
            } else {
              state.defaultAccountId = null
            }
          }
        }

        state.accounts = state.accounts.filter(acc => acc.id !== id)

        if (state.currentAccountId === id) {
          if (
            state.defaultAccountId &&
            state.accounts.some(acc => acc.id === state.defaultAccountId)
          ) {
            state.currentAccountId = state.defaultAccountId
          } else if (state.accounts.length > 0) {
            state.currentAccountId = state.accounts[0].id
          }
        }
      })

      const currentState = get()
      saveToStorage(currentState.currentUserId, {
        accounts: currentState.accounts,
        currentAccountId: currentState.currentAccountId,
        defaultAccountId: currentState.defaultAccountId,
      })

      eventEmitter.emit(EVENTS.ACCOUNT_REMOVED, id)
    },

    switchAccount: (id: string) => {
      set(state => {
        state.currentAccountId = id
      })

      const currentState = get()
      saveToStorage(currentState.currentUserId, {
        accounts: currentState.accounts,
        currentAccountId: currentState.currentAccountId,
        defaultAccountId: currentState.defaultAccountId,
      })

      eventEmitter.emit(EVENTS.ACCOUNT_SWITCHED, id)
    },

    setDefaultAccount: (id: string) => {
      const state = get()
      if (!state.accounts.some(acc => acc.id === id)) return

      set(state => {
        state.defaultAccountId = id
      })

      const currentState = get()
      saveToStorage(currentState.currentUserId, {
        accounts: currentState.accounts,
        currentAccountId: currentState.currentAccountId,
        defaultAccountId: currentState.defaultAccountId,
      })
    },

    getCurrentAccount: () => {
      return get().accounts.find(acc => acc.id === get().currentAccountId)
    },

    updateAccountName: (id: string, name: string) => {
      const state = get()
      const account = state.accounts.find(acc => acc.id === id)
      if (!account) return

      set(state => {
        const acc = state.accounts.find(a => a.id === id)
        if (acc) acc.name = name
      })

      const currentState = get()
      saveToStorage(currentState.currentUserId, {
        accounts: currentState.accounts,
        currentAccountId: currentState.currentAccountId,
        defaultAccountId: currentState.defaultAccountId,
      })
    },

    reorderAccounts: (fromIndex: number, toIndex: number) => {
      set(state => {
        if (
          fromIndex < 0 ||
          fromIndex >= state.accounts.length ||
          toIndex < 0 ||
          toIndex >= state.accounts.length
        ) {
          return
        }
        const [movedAccount] = state.accounts.splice(fromIndex, 1)
        state.accounts.splice(toIndex, 0, movedAccount)
      })

      const currentState = get()
      saveToStorage(currentState.currentUserId, {
        accounts: currentState.accounts,
        currentAccountId: currentState.currentAccountId,
        defaultAccountId: currentState.defaultAccountId,
      })
    },

    loadUserAccounts: (userId: string) => {
      console.log('[useAccounts] loadUserAccounts 被调用，userId:', userId)

      const loadedData = loadFromStorage(userId)

      set(state => {
        state.currentUserId = userId

        if (loadedData) {
          state.accounts = loadedData.accounts || []
          state.currentAccountId = loadedData.currentAccountId || ''
          state.defaultAccountId = loadedData.defaultAccountId || null
          console.log('[useAccounts] 加载完成，账号数:', state.accounts.length)
        } else {
          state.accounts = []
          state.currentAccountId = ''
          state.defaultAccountId = null
          console.log('[useAccounts] 无历史数据，初始化为空')
        }
      })
    },

    reset: () => {
      const currentState = get()

      if (currentState.currentUserId) {
        saveToStorage(currentState.currentUserId, {
          accounts: currentState.accounts,
          currentAccountId: currentState.currentAccountId,
          defaultAccountId: currentState.defaultAccountId,
        })
        console.log('[useAccounts] 登出时保存数据:', currentState.currentUserId)
      }

      set(state => {
        state.accounts = []
        state.currentAccountId = ''
        state.defaultAccountId = null
        state.currentUserId = null
      })
    },
  })),
)

// 监听用户变化，自动切换数据
// 返回清理函数，避免HMR热更新时重复订阅
const unsubscribe =
  typeof useAuthStore?.subscribe === 'function'
    ? useAuthStore.subscribe((state, prevState) => {
        const currentUserId = state.user?.id
        const prevUserId = prevState.user?.id

        // 用户登录
        if (currentUserId && currentUserId !== prevUserId) {
          console.log('[useAccounts] 检测到用户变化:', prevUserId, '->', currentUserId)
          useAccounts.getState().loadUserAccounts(currentUserId)
        }

        // 用户登出
        if (!currentUserId && prevUserId) {
          console.log('[useAccounts] 检测到用户登出:', prevUserId)
          useAccounts.getState().reset()
        }
      })
    : () => {}

// 导出清理函数，供需要时使用
export { unsubscribe }
