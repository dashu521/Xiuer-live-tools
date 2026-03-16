import { Loader2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useAccessContext } from '@/domain/access'
import { GATE_ACTIONS } from '@/domain/access/gateActions'
import { useAccounts } from '@/hooks/useAccounts'
import { useAuthInit } from '@/hooks/useAuth'
import { useLiveControlStore } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import {
  useAuthCheckDone,
  useAuthStore,
  useIsAuthenticated,
  useIsOffline,
} from '@/stores/authStore'
import { useGateStore } from '@/stores/gateStore'
import { usePlatformPreferenceStore } from '@/stores/platformPreferenceStore'

const AuthDialog = lazy(async () => {
  const module = await import('@/components/auth/AuthDialog')
  return { default: module.AuthDialog }
})

const SubscribeDialog = lazy(async () => {
  const module = await import('@/components/auth/SubscribeDialog')
  return { default: module.SubscribeDialog }
})

const UserCenter = lazy(async () => {
  const module = await import('@/components/auth/UserCenter')
  return { default: module.UserCenter }
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false)
  const [showUserCenter, setShowUserCenter] = useState(false)
  const [currentFeature, setCurrentFeature] = useState<string>('')

  const authCheckDone = useAuthCheckDone()
  const _isAuthenticated = useIsAuthenticated()
  const isOffline = useIsOffline()
  const accessContext = useAccessContext()
  const { runPendingActionAndClear } = useGateStore()
  const refreshUserStatus = useAuthStore(s => s.refreshUserStatus)
  const { toast } = useToast()
  const trialExpiredModalShownRef = useRef(false)

  useAuthInit()

  useEffect(() => {
    const handleAuthRequired = (event: CustomEvent) => {
      const { feature } = event.detail
      setCurrentFeature(feature ?? 'login')
      setShowAuthDialog(true)
    }

    const handleSubscribeRequired = () => {
      setShowSubscribeDialog(true)
    }

    const handleAuthSuccess = () => {
      // 在 runPendingActionAndClear 之前记录 pendingActionName，用于判断是否应覆盖平台
      const pendingActionName = useGateStore.getState().pendingActionName
      runPendingActionAndClear()
      // 若用户是因「连接直播中控台」而登录，说明已在下拉框中选择了平台，不应覆盖
      const wasConnectAction = pendingActionName === GATE_ACTIONS.CONNECT_LIVE_CONTROL
      if (!wasConnectAction && !useGateStore.getState().defaultPlatformSetAfterLogin) {
        const accountId = useAccounts.getState().currentAccountId
        if (accountId) {
          // 获取用户设置的默认平台，而不是强制设置为 dev
          const defaultPlatform = usePlatformPreferenceStore
            .getState()
            .getDefaultPlatform(accountId)
          useLiveControlStore.getState().setConnectState(accountId, { platform: defaultPlatform })
          useGateStore.getState().setDefaultPlatformSetAfterLogin(true)
          toast.info({
            title: '默认平台已恢复',
            description: `当前平台：${defaultPlatform === 'dev' ? '测试平台' : defaultPlatform}`,
            dedupeKey: `default-platform:${accountId}`,
          })
        }
      }
    }

    const handleLicenseRequired = (event: CustomEvent) => {
      const { message } = event.detail
      toast.warning({
        title: '授权受限',
        description: message,
        dedupeKey: 'auth-license-required',
      })
    }

    const handleAccountDisabled = () => {
      toast.error({
        title: '账号不可用',
        description: '当前账号状态异常，请联系支持或稍后重试。',
        dedupeKey: 'auth-account-disabled',
      })
    }

    const handleUserCenterOpen = () => {
      setShowUserCenter(true)
      void refreshUserStatus().catch((error: unknown) => {
        console.warn(
          '[AuthProvider] Failed to refresh user status before opening user center:',
          error,
        )
      })
    }

    window.addEventListener('auth:required', handleAuthRequired as EventListener)
    window.addEventListener('auth:success', handleAuthSuccess as EventListener)
    window.addEventListener('gate:subscribe-required', handleSubscribeRequired as EventListener)
    window.addEventListener('auth:license-required', handleLicenseRequired as EventListener)
    window.addEventListener('auth:account-disabled', handleAccountDisabled as EventListener)
    window.addEventListener('auth:user-center', handleUserCenterOpen as EventListener)

    return () => {
      window.removeEventListener('auth:required', handleAuthRequired as EventListener)
      window.removeEventListener('auth:success', handleAuthSuccess as EventListener)
      window.removeEventListener(
        'gate:subscribe-required',
        handleSubscribeRequired as EventListener,
      )
      window.removeEventListener('auth:license-required', handleLicenseRequired as EventListener)
      window.removeEventListener('auth:account-disabled', handleAccountDisabled as EventListener)
      window.removeEventListener('auth:user-center', handleUserCenterOpen as EventListener)
    }
  }, [refreshUserStatus, runPendingActionAndClear, toast])

  // 试用已结束：进入主界面后自动弹一次试用弹窗
  useEffect(() => {
    if (!authCheckDone || !accessContext.userStatus || trialExpiredModalShownRef.current) return
    if (accessContext.trialExpired !== true) return
    trialExpiredModalShownRef.current = true
    setShowSubscribeDialog(true)
  }, [authCheckDone, accessContext])

  if (!authCheckDone) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4"
        style={{ backgroundColor: 'var(--app-bg)' }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground text-sm">加载中…</span>
      </div>
    )
  }

  return (
    <>
      {isOffline && (
        <div
          className="border-b px-4 py-2 text-center text-sm"
          style={{
            backgroundColor: 'var(--surface-muted)',
            color: 'var(--muted-foreground)',
          }}
        >
          当前网络不可用，部分功能可能受限
        </div>
      )}
      {children}

      <Suspense fallback={null}>
        <AuthDialog
          isOpen={showAuthDialog}
          onClose={() => {
            setShowAuthDialog(false)
            setCurrentFeature('')
          }}
          feature={currentFeature}
        />
        <SubscribeDialog
          isOpen={showSubscribeDialog}
          onClose={() => setShowSubscribeDialog(false)}
          actionName={useGateStore.getState().pendingActionName || undefined}
          trialExpired={accessContext.trialExpired}
        />
        <UserCenter isOpen={showUserCenter} onClose={() => setShowUserCenter(false)} />
      </Suspense>
    </>
  )
}
