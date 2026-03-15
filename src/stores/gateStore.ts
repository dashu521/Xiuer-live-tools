/**
 * 统一门控：
 * - 未登录 → 打开登录弹窗，登录成功后执行 pendingAction
 * - 已登录但未在试用期内 → 打开试用弹窗，点击试用后执行 pendingAction
 * - 已登录且在试用期内 → 直接执行 action
 *
 * 方案三变体：使用本地缓存 + 服务端时间验证
 *
 * 【重构】已迁移到 AccessControl 权限层
 * 所有权限判断通过 buildAccessContext + checkAccess 完成
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { buildAccessContext, checkAccess } from '@/domain/access'
import { type GateActionName, getFeatureTypeForGateAction } from '@/domain/access/gateActions'

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
  pendingActionName: GateActionName | ''
  /** 首次登录后是否已设置默认平台为 test（persist） */
  defaultPlatformSetAfterLogin: boolean
  setPendingAction: (fn: (() => void | Promise<void>) | null, name?: GateActionName | '') => void
  setDefaultPlatformSetAfterLogin: (v: boolean) => void
  /** 执行并清空 pendingAction（由 AuthProvider/SubscribeDialog 在登录/试用成功后调用） */
  runPendingActionAndClear: () => Promise<void>
  /**
   * 统一门控：未登录弹登录；需订阅且未在试用弹订阅；否则执行 action
   */
  guardAction: (actionName: GateActionName, options: GuardActionOptions) => Promise<void>
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

      guardAction: async (actionName: GateActionName, options: GuardActionOptions) => {
        const { requireSubscription = false } = options
        const pendingFn = options.action != null ? options.action : null

        // 【重构】使用 AccessControl 权限层构建上下文
        const context = buildAccessContext()

        // 【日志】记录 guardAction 执行时的状态
        console.log('[GateStore] guardAction called:', {
          actionName,
          isAuthenticated: context.isAuthenticated,
          userPlan: context.plan,
          isPaidUser: context.isPaidUser,
          trialActive: context.trialActive,
          trialExpired: context.trialExpired,
          requireSubscription,
        })

        // DEV 模式额外日志
        if (context.isDevEnvironment) {
          console.log('[AccessControl] Context:', context)
        }

        // 1. 未登录检查
        if (!context.isAuthenticated) {
          get().setPendingAction(pendingFn, actionName)
          window.dispatchEvent(
            new CustomEvent('auth:required', { detail: { feature: actionName } }),
          )
          return
        }

        // 2. 不需要订阅检查，直接执行
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

        // 3. 【重构】动作名称到权限功能的映射收敛到权限域适配表
        const feature = getFeatureTypeForGateAction(actionName)
        const decision = checkAccess(context, feature)

        // DEV 模式权限检查日志
        if (context.isDevEnvironment) {
          console.log('[AccessControl]', feature, decision)
        }

        // 4. 权限检查通过，执行操作
        if (decision.allowed) {
          console.log('[GateStore] Access granted, executing action:', actionName, {
            plan: context.plan,
            isPaidUser: context.isPaidUser,
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

        // 5. 权限检查失败，根据原因处理
        console.log('[GateStore] Access denied:', actionName, {
          reason: decision.reason,
          action: decision.action,
          requiredPlan: decision.requiredPlan,
        })

        if (decision.action === 'login') {
          // 需要登录（理论上不会走到这里，因为前面已检查）
          get().setPendingAction(pendingFn, actionName)
          window.dispatchEvent(
            new CustomEvent('auth:required', { detail: { feature: actionName } }),
          )
        } else if (decision.action === 'subscribe') {
          // 需要开通试用
          get().setPendingAction(pendingFn, actionName)
          window.dispatchEvent(
            new CustomEvent('gate:subscribe-required', { detail: { actionName } }),
          )
        } else if (decision.action === 'upgrade') {
          // 需要升级套餐
          get().setPendingAction(pendingFn, actionName)
          window.dispatchEvent(
            new CustomEvent('gate:subscribe-required', {
              detail: {
                actionName,
                requiredPlan: decision.requiredPlan,
              },
            }),
          )
        } else {
          // 其他原因，默认显示试用弹窗
          get().setPendingAction(pendingFn, actionName)
          window.dispatchEvent(
            new CustomEvent('gate:subscribe-required', { detail: { actionName } }),
          )
        }
      },
    }),
    {
      name: 'gate-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ defaultPlatformSetAfterLogin: state.defaultPlatformSetAfterLogin }),
    },
  ),
)
