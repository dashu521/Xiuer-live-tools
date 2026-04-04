import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { buildAccessContext, checkAccess } from '@/domain/access/AccessControl'
import { PLAN_TEXT_MAP } from '@/domain/access/planRules'
import { flushAllPersists, flushPersist, schedulePersist } from '@/utils/debouncedPersist'
import { EVENTS, eventEmitter } from '@/utils/events'
import { storageManager } from '@/utils/storage/StorageManager'

interface Account {
  id: string
  name: string
  platform?: LiveControlPlatform
}

export function normalizeAccountSelection<T extends { id: string }>(
  accounts: T[],
  currentAccountId: string,
  _defaultAccountId: string | null,
): { currentAccountId: string; defaultAccountId: string | null } {
  const firstAccountId = accounts[0]?.id ?? ''
  const accountIds = new Set(accounts.map(account => account.id))

  if (!firstAccountId) {
    return {
      currentAccountId: '',
      defaultAccountId: null,
    }
  }

  const nextCurrentAccountId =
    currentAccountId && accountIds.has(currentAccountId) ? currentAccountId : firstAccountId

  return {
    currentAccountId: nextCurrentAccountId,
    defaultAccountId: null,
  }
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

  return data
}

/**
 * 保存账号数据到存储
 */
const saveToStorage = (
  userId: string | null,
  data: { accounts: Account[]; currentAccountId: string; defaultAccountId: string | null },
  options?: { immediate?: boolean },
) => {
  if (!userId) {
    return
  }

  const persistKey = `accounts:${userId}`
  const snapshot = {
    accounts: [...data.accounts],
    currentAccountId: data.currentAccountId,
    defaultAccountId: data.defaultAccountId,
  }
  const write = () => {
    storageManager.set('accounts', snapshot, {
      level: 'user',
      userId,
    })
  }

  if (options?.immediate) {
    flushPersist(persistKey)
    write()
    return
  }

  schedulePersist(persistKey, write, 200)
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
      const planText = PLAN_TEXT_MAP[userPlan]
      const maxAccountText = maxAccounts < 0 ? '无限制' : `${maxAccounts} 个`
      const reason =
        decision.reason ||
        `${planText}当前最多可添加 ${maxAccountText} 直播账号，您现在已添加 ${currentCount} 个。如需添加更多账号，请升级会员等级。`

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
        const normalized = normalizeAccountSelection(state.accounts, state.currentAccountId, null)
        state.currentAccountId = normalized.currentAccountId
        state.defaultAccountId = null
      })

      // 在 set 外部调用 saveToStorage，确保使用最新的状态
      const currentState = get()
      saveToStorage(currentState.currentUserId, {
        accounts: currentState.accounts,
        currentAccountId: currentState.currentAccountId,
        defaultAccountId: null,
      })

      eventEmitter.emit(EVENTS.ACCOUNT_ADDED, newId, name)

      return { success: true }
    },

    removeAccount: (id: string) => {
      set(state => {
        state.accounts = state.accounts.filter(acc => acc.id !== id)
        state.defaultAccountId = null

        if (state.currentAccountId === id) {
          if (state.accounts.length > 0) {
            state.currentAccountId = state.accounts[0].id
          } else {
            state.currentAccountId = ''
          }
        }
      })

      const currentState = get()
      saveToStorage(
        currentState.currentUserId,
        {
          accounts: currentState.accounts,
          currentAccountId: currentState.currentAccountId,
          defaultAccountId: null,
        },
        { immediate: true },
      )

      eventEmitter.emit(EVENTS.ACCOUNT_REMOVED, id)
    },

    switchAccount: (id: string) => {
      const previousAccount = get().accounts.find(acc => acc.id === get().currentAccountId)
      const nextAccount = get().accounts.find(acc => acc.id === id)

      console.log(
        `[Accounts] switchAccount: ${previousAccount?.name || previousAccount?.id || 'unknown'} -> ${nextAccount?.name || nextAccount?.id || id}`,
      )

      set(state => {
        state.currentAccountId = id
      })

      const currentState = get()
      flushAllPersists()
      saveToStorage(
        currentState.currentUserId,
        {
          accounts: currentState.accounts,
          currentAccountId: currentState.currentAccountId,
          defaultAccountId: null,
        },
        { immediate: true },
      )

      eventEmitter.emit(EVENTS.ACCOUNT_SWITCHED, id)
    },

    setDefaultAccount: (id: string) => {
      console.log(`[Accounts] setDefaultAccount ignored (feature removed): ${id}`)
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
        defaultAccountId: null,
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
        defaultAccountId: null,
      })
    },

    loadUserAccounts: (userId: string) => {
      flushAllPersists()

      const loadedData = loadFromStorage(userId)

      set(state => {
        state.currentUserId = userId

        if (loadedData) {
          state.accounts = loadedData.accounts || []
          const normalized = normalizeAccountSelection(
            state.accounts,
            loadedData.currentAccountId || '',
            null,
          )
          state.currentAccountId = normalized.currentAccountId
          state.defaultAccountId = null
        } else {
          state.accounts = []
          state.currentAccountId = ''
          state.defaultAccountId = null
        }
      })
    },

    reset: () => {
      const currentState = get()

      if (currentState.currentUserId) {
        saveToStorage(
          currentState.currentUserId,
          {
            accounts: currentState.accounts,
            currentAccountId: currentState.currentAccountId,
            defaultAccountId: null,
          },
          { immediate: true },
        )
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
