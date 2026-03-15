import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AuthDialog } from '@/components/auth/AuthDialog'
import { SubscribeDialog } from '@/components/auth/SubscribeDialog'
import { UserCenter } from '@/components/auth/UserCenter'
import { useAccessContext } from '@/domain/access'
import { GATE_ACTIONS } from '@/domain/access/gateActions'
import { useAccounts } from '@/hooks/useAccounts'
import { useAuthInit } from '@/hooks/useAuth'
import { useLiveControlStore } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import { useAuthCheckDone, useIsAuthenticated, useIsOffline } from '@/stores/authStore'
import { useGateStore } from '@/stores/gateStore'
import { usePlatformPreferenceStore } from '@/stores/platformPreferenceStore'

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
          toast.success(
            `已切换到默认平台：${defaultPlatform === 'dev' ? '测试平台' : defaultPlatform}`,
          )
        }
      }
    }

    const handleLicenseRequired = (event: CustomEvent) => {
      const { message } = event.detail
      alert(message)
    }

    const handleAccountDisabled = () => {
      toast.error('账号不可用')
    }

    const handleUserCenterOpen = () => {
      setShowUserCenter(true)
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
  }, [runPendingActionAndClear, toast])

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
    </>
  )
}
