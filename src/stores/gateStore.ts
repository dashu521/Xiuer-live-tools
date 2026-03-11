/**
 * 统一门控：
 * - 未登录 → 打开登录弹窗，登录成功后执行 pendingAction
 * - 已登录但未在试用期内 → 打开试用弹窗，点击试用后执行 pendingAction
 * - 已登录且在试用期内 → 直接执行 action
 *
 * 方案三变体：使用本地缓存 + 服务端时间验证
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getServerTime } from '@/services/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { useTrialStore } from '@/stores/trialStore'

export type GuardActionOptions = {
  /** 通过门控后要执行的回调（可选，登录/试用后会自动执行或用户再次点击） */
  action?: () => void | Promise<void>
  /** 是否需要订阅/试用（非 test 平台、连接控制台等为 true） */
  requireSubscription?: boolean
}

interface GateStore {
  /** 登录/试用后待执行的回调 */
  pendingAction: (() => void | Promise<void>) | null
  /** 当前门控触发的 action 名称（用于弹窗文案） */
  pendingActionName: string
  /** 首次登录后是否已设置默认平台为 test（persist） */
  defaultPlatformSetAfterLogin: boolean
  setPendingAction: (fn: (() => void | Promise<void>) | null, name?: string) => void
  setDefaultPlatformSetAfterLogin: (v: boolean) => void
  /** 执行并清空 pendingAction（由 AuthProvider/SubscribeDialog 在登录/试用成功后调用） */
  runPendingActionAndClear: () => Promise<void>
  /**
   * 统一门控：未登录弹登录；需订阅且未在试用弹订阅；否则执行 action
   */
  guardAction: (actionName: string, options: GuardActionOptions) => Promise<void>
}

export const useGateStore = create<GateStore>()(
  persist(
    (set, get) => ({
      pendingAction: null,
      pendingActionName: '',
      defaultPlatformSetAfterLogin: false,

      setPendingAction: (fn, name = '') => {
        set({ pendingAction: fn, pendingActionName: name })
      },

      setDefaultPlatformSetAfterLogin: (v: boolean) => {
        set({ defaultPlatformSetAfterLogin: v })
      },

      runPendingActionAndClear: async () => {
        const { pendingAction, pendingActionName } = get()
        console.log('[GateStore] runPendingActionAndClear called:', {
          hasAction: !!pendingAction,
          actionName: pendingActionName,
        })
        set({ pendingAction: null, pendingActionName: '' })
        if (pendingAction) {
          try {
            await Promise.resolve(pendingAction())
          } catch (e) {
            console.error('[GateStore] pendingAction error:', e)
          }
        } else {
          console.warn('[GateStore] No pendingAction to run')
        }
      },

      guardAction: async (actionName: string, options: GuardActionOptions) => {
        const { requireSubscription = false } = options
        const pendingFn = options.action != null ? options.action : null
        const { isAuthenticated, refreshUserStatus } = useAuthStore.getState()

        if (!isAuthenticated) {
          get().setPendingAction(pendingFn, actionName)
          window.dispatchEvent(
            new CustomEvent('auth:required', { detail: { feature: actionName } }),
          )
          return
        }

        // 不需要订阅检查，直接执行
        if (!requireSubscription) {
          if (pendingFn) {
            try {
              await Promise.resolve(pendingFn())
            } catch (e) {
              console.error('[GateStore] guardAction error:', e)
            }
          }
          return
        }

        // 需要订阅检查：优先使用本地 trialStore（方案三变体）
        const trialStore = useTrialStore.getState()

        // 1. 检查本地试用状态
        const localTrialResult = trialStore.isInTrial()

        console.log('[GateStore] guardAction check:', {
          actionName,
          requireSubscription,
          localTrialResult,
          trialInfo: trialStore.getTrialInfo(),
        })

        // 本地试用有效且缓存未过期，直接通过
        if (localTrialResult === true) {
          console.log('[GateStore] Local trial valid, executing action:', actionName)
          if (pendingFn) {
            try {
              await Promise.resolve(pendingFn())
            } catch (e) {
              console.error('[GateStore] guardAction error:', e)
            }
          }
          return
        }

        // 2. 本地无试用或缓存过期，尝试从服务端验证
        try {
          // 同时获取服务端时间和用户状态
          const [serverTime, userStatus] = await Promise.all([getServerTime(), refreshUserStatus()])

          console.log('[GateStore] Server validation:', {
            serverTime,
            userStatus: userStatus?.trial,
          })

          // 使用服务端时间验证试用状态
          if (serverTime && trialStore.trialActivated && trialStore.trialEndsAt) {
            const serverTrialValid = serverTime < trialStore.trialEndsAt
            if (serverTrialValid) {
              console.log('[GateStore] Server trial valid, executing action:', actionName)
              // 更新验证时间
              trialStore.syncFromServer({
                trialStartedAt: trialStore.trialStartedAt!,
                trialEndsAt: trialStore.trialEndsAt!,
                serverTime,
              })
              if (pendingFn) {
                try {
                  await Promise.resolve(pendingFn())
                } catch (e) {
                  console.error('[GateStore] guardAction error:', e)
                }
              }
              return
            }
          }

          // 3. 检查后端返回的试用状态
          const backendTrialActive = userStatus?.trial?.is_active === true
          if (backendTrialActive && userStatus?.trial?.end_at) {
            const endTime = new Date(userStatus.trial.end_at).getTime()
            const currentTime = serverTime ?? Date.now()

            if (currentTime < endTime) {
              console.log('[GateStore] Backend trial valid, syncing and executing:', actionName)
              // 同步到本地 store
              trialStore.syncFromServer({
                trialStartedAt: userStatus.trial.start_at
                  ? new Date(userStatus.trial.start_at).getTime()
                  : currentTime,
                trialEndsAt: endTime,
                serverTime: currentTime,
              })
              if (pendingFn) {
                try {
                  await Promise.resolve(pendingFn())
                } catch (e) {
                  console.error('[GateStore] guardAction error:', e)
                }
              }
              return
            }
          }
        } catch (error) {
          console.error('[GateStore] Server validation failed:', error)
          // 服务端不可用，使用本地状态（降级）
          if (localTrialResult === null && trialStore.trialActivated) {
            console.log('[GateStore] Server unavailable, using local trial (degraded):', actionName)
            if (pendingFn) {
              try {
                await Promise.resolve(pendingFn())
              } catch (e) {
                console.error('[GateStore] guardAction error:', e)
              }
            }
            return
          }
        }

        // 4. 无试用权限，显示试用弹窗
        console.log('[GateStore] No trial access, showing subscribe dialog:', actionName)
        get().setPendingAction(pendingFn, actionName)
        window.dispatchEvent(new CustomEvent('gate:subscribe-required', { detail: { actionName } }))
      },
    }),
    {
      name: 'gate-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ defaultPlatformSetAfterLogin: state.defaultPlatformSetAfterLogin }),
    },
  ),
)
