import { type ReactNode, useEffect, useState } from 'react'
import { AuthDialog } from '@/components/auth/AuthDialog'
import { useAuthStore } from '@/stores/authStore'
import type { SafeUser } from '@/types/auth'

interface AuthGuardProps {
  children: ReactNode
  feature?: string
  fallback?: ReactNode
}

export function AuthGuard({ children, feature, fallback }: AuthGuardProps) {
  const { token, checkAuth } = useAuthStore()
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuthentication = async () => {
      if (token) {
        await checkAuth()
      }
      setIsChecking(false)
    }

    checkAuthentication()
  }, [token, checkAuth])

  const handleFeatureAccess = async (): Promise<boolean> => {
    if (!feature) return true

    try {
      const response = await window.authAPI.checkFeatureAccess(token || '', feature)

      if (!response.canAccess) {
        if (response.requiresAuth) {
          setShowAuthDialog(true)
        } else {
          // Show license upgrade dialog
          alert(`此功能需要 ${getLicenseText(response.requiredLicense)} 许可证`)
        }
        return false
      }
      return true
    } catch (error) {
      console.error('Feature access check failed:', error)
      return false
    }
  }

  const getLicenseText = (licenseType: string) => {
    // 首发版：仅支持标准套餐名称
    switch (licenseType) {
      case 'trial':
        return '试用版'
      case 'pro':
        return '专业版'
      case 'pro_max':
        return '专业增强版'
      case 'ultra':
        return '旗舰版'
      default:
        return '免费版'
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
  const { isAuthenticated, token, user } = useAuthStore()

  const checkFeatureAccess = async (
    feature: string,
  ): Promise<{
    canAccess: boolean
    requiresAuth: boolean
    requiredLicense: string
    user: SafeUser | null
  }> => {
    try {
      const response = await window.authAPI.checkFeatureAccess(token || '', feature)
      return response as {
        canAccess: boolean
        requiresAuth: boolean
        requiredLicense: string
        user: SafeUser | null
      }
    } catch (error) {
      console.error('Feature access check failed:', error)
      return {
        canAccess: false,
        requiresAuth: true,
        requiredLicense: 'free',
        user: null,
      }
    }
  }

  const requiresAuth = async (feature: string): Promise<boolean> => {
    try {
      return await window.authAPI.requiresAuthentication(feature)
    } catch (error) {
      console.error('Auth requirement check failed:', error)
      return true
    }
  }

  return {
    isAuthenticated,
    user,
    checkFeatureAccess,
    requiresAuth,
  }
}
