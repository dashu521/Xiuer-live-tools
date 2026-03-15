import { useCallback, useEffect, useRef } from 'react'
import { normalizePlan, PLAN_TEXT_MAP } from '@/domain/access'
import { useAuthStore } from '@/stores/authStore'

export function useAuthInit() {
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    // Check authentication status on app startup
    // 注意：不阻塞应用启动，允许未登录用户浏览界面
    checkAuth()
  }, [checkAuth])
}

// Hook to handle login requirement for features
export function useRequireAuth(feature: string) {
  const { isAuthenticated, token } = useAuthStore()

  const checkAndPromptAuth = async (): Promise<boolean> => {
    if (!feature) return true

    try {
      const response = await window.authAPI.checkFeatureAccess(token || '', feature)
      const { featureAccess } = response

      if (!featureAccess.can_access) {
        if (featureAccess.requires_auth) {
          // Emit event to show auth dialog
          window.dispatchEvent(new CustomEvent('auth:required', { detail: { feature } }))
        } else {
          // Show license upgrade message
          const requiredPlan = normalizePlan(featureAccess.required_plan)
          const licenseText = PLAN_TEXT_MAP[requiredPlan]
          window.dispatchEvent(
            new CustomEvent('auth:license-required', {
              detail: {
                feature,
                requiredPlan,
                message: `此功能需要 ${licenseText} 许可证`,
              },
            }),
          )
        }
        return false
      }
      return true
    } catch (error) {
      console.error('Feature access check failed:', error)
      return false
    }
  }

  return {
    isAuthenticated,
    checkAndPromptAuth,
  }
}

/**
 * Hook for requiring authentication before executing an action
 *
 * 使用场景：当用户点击某个功能按钮时，先检查登录状态
 * - 如果已登录：直接执行操作
 * - 如果未登录：弹出登录对话框，登录成功后继续执行原操作
 *
 * @example
 * const { requireAuthForAction } = useRequireAuthForAction('connect-live-control')
 *
 * const handleConnect = requireAuthForAction(async () => {
 *   // 连接直播控制台的逻辑
 *   await connectLiveControl()
 * })
 */
export function useRequireAuthForAction(feature: string) {
  const { isAuthenticated } = useAuthStore()
  const pendingActionRef = useRef<(() => Promise<void>) | null>(null)
  const authSuccessListenerRef = useRef<((event: CustomEvent) => void) | null>(null)

  useEffect(() => {
    // 监听登录成功事件
    const handleAuthSuccess = (_event: CustomEvent) => {
      // 登录成功后，执行待执行的操作
      if (pendingActionRef.current) {
        const action = pendingActionRef.current
        pendingActionRef.current = null
        // 延迟执行，确保状态已更新
        setTimeout(() => {
          action().catch(error => {
            console.error('[useRequireAuthForAction] Failed to execute pending action:', error)
          })
        }, 100)
      }
    }

    window.addEventListener('auth:success', handleAuthSuccess as EventListener)
    authSuccessListenerRef.current = handleAuthSuccess as (event: CustomEvent) => void

    return () => {
      window.removeEventListener('auth:success', handleAuthSuccess as EventListener)
    }
  }, [])

  const requireAuthForAction = useCallback(
    async (action: () => Promise<void> | void): Promise<void> => {
      // 如果已登录，直接执行
      if (isAuthenticated) {
        await action()
        return
      }

      // 未登录：保存操作，弹出登录对话框
      pendingActionRef.current = async () => {
        await action()
      }

      // 触发登录对话框显示
      window.dispatchEvent(
        new CustomEvent('auth:required', {
          detail: {
            feature,
            action: 'execute-after-login', // 标记登录后需要执行操作
          },
        }),
      )
    },
    [isAuthenticated, feature],
  )

  return {
    isAuthenticated,
    requireAuthForAction,
  }
}
