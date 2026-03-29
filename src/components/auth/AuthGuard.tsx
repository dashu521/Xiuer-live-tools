import { type ReactNode, useEffect, useState } from 'react'
import { AuthDialog } from '@/components/auth/AuthDialog'
import { normalizePlan, PLAN_TEXT_MAP } from '@/domain/access/planRules'
import { useAuthStore } from '@/stores/authStore'
import type { SafeUser } from '@/types/auth'

interface AuthGuardProps {
  children: ReactNode
  feature?: string
  fallback?: ReactNode
}

export function AuthGuard({ children, feature, fallback }: AuthGuardProps) {
  const authCheckDone = useAuthStore(state => state.authCheckDone)
  const checkAuth = useAuthStore(state => state.checkAuth)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuthentication = async () => {
      if (!authCheckDone) {
        await checkAuth()
      }
      setIsChecking(false)
    }

    checkAuthentication()
  }, [authCheckDone, checkAuth])

  const handleFeatureAccess = async (): Promise<boolean> => {
    if (!feature) return true

    try {
      const response = await window.authAPI.checkFeatureAccess(feature)
      const { featureAccess } = response

      if (!featureAccess.can_access) {
        if (featureAccess.requires_auth) {
          setShowAuthDialog(true)
        } else {
          // Show license upgrade dialog
          const requiredPlan = normalizePlan(featureAccess.required_plan)
          alert(`此功能需要 ${PLAN_TEXT_MAP[requiredPlan]} 许可证`)
        }
        return false
      }
      return true
    } catch (error) {
      console.error('Feature access check failed:', error)
      return false
    }
  }

  if (isChecking) {
    return fallback || <div>检查认证状态...</div>
  }

  if (!feature) {
    // No feature restriction, just render children
    return <>{children}</>
  }

  // Create a wrapper component that checks access before allowing interaction
  const WrappedChildren = () => {
    const [hasAccess, setHasAccess] = useState(false)

    useEffect(() => {
      handleFeatureAccess().then(setHasAccess)
    }, [])

    if (!hasAccess) {
      return (
        fallback || (
          <div className="flex items-center justify-center p-8 text-center">
            <div className="space-y-4">
              <div className="text-lg font-medium">需要登录</div>
              <div className="text-sm text-muted-foreground">使用此功能需要先登录账户</div>
              <button
                type="button"
                onClick={() => setShowAuthDialog(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                立即登录
              </button>
            </div>
          </div>
        )
      )
    }

    return <>{children}</>
  }

  return (
    <>
      <WrappedChildren />
      <AuthDialog
        isOpen={showAuthDialog}
        onClose={() => setShowAuthDialog(false)}
        feature={feature}
      />
    </>
  )
}

// Hook for feature access checking
export function useFeatureAccess() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const user = useAuthStore(state => state.user)

  const checkFeatureAccess = async (
    feature: string,
  ): Promise<{
    featureAccess: {
      can_access: boolean
      requires_auth: boolean
      required_plan: string
    }
    user: SafeUser | null
  }> => {
    try {
      const response = await window.authAPI.checkFeatureAccess(feature)
      return response as {
        featureAccess: {
          can_access: boolean
          requires_auth: boolean
          required_plan: string
        }
        user: SafeUser | null
      }
    } catch (error) {
      console.error('Feature access check failed:', error)
      return {
        featureAccess: {
          can_access: false,
          requires_auth: true,
          required_plan: 'trial',
        },
        user: null,
      }
    }
  }

  return {
    isAuthenticated,
    user,
    checkFeatureAccess,
  }
}
