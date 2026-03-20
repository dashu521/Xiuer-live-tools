import { Loader2 } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAccessContext } from '@/domain/access'
import { GATE_ACTIONS } from '@/domain/access/gateActions'
import { useAccounts } from '@/hooks/useAccounts'
import { useAuthInit } from '@/hooks/useAuth'
import { useLiveControlStore } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import { KICKED_OUT_EVENT, sessionCheck } from '@/services/apiClient'
import {
  useAuthCheckDone,
  useAuthStore,
  useIsAuthenticated,
  useIsOffline,
} from '@/stores/authStore'
import { useGateStore } from '@/stores/gateStore'
import { usePlatformPreferenceStore } from '@/stores/platformPreferenceStore'

/** 心跳检测周期（毫秒） */
const HEARTBEAT_INTERVAL = 30 * 1000 // 30秒
/** 后台降频后的周期（毫秒） */
const HEARTBEAT_INTERVAL_BACKGROUND = 60 * 1000 // 60秒

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
  const isAuthenticated = useIsAuthenticated()
  const isOffline = useIsOffline()
  const navigate = useNavigate()
  const accessContext = useAccessContext()
  const { runPendingActionAndClear } = useGateStore()
  const refreshUserStatus = useAuthStore(s => s.refreshUserStatus)
  const clearTokensAndUnauth = useAuthStore(s => s.clearTokensAndUnauth)
  const { toast } = useToast()
  const trialExpiredModalShownRef = useRef(false)

  // 心跳检测相关 refs
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isPageVisibleRef = useRef(true)
  const isKickedOutRef = useRef(false)
  const kickoutHandledRef = useRef(false)

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
          const currentPlatform =
            useLiveControlStore.getState().contexts[accountId]?.connectState.platform || ''
          // 获取用户设置的默认平台，而不是强制设置为 dev
          const defaultPlatform = usePlatformPreferenceStore
            .getState()
            .getDefaultPlatform(accountId)
          if (!currentPlatform && defaultPlatform) {
            useLiveControlStore.getState().setConnectState(accountId, {
              platform: defaultPlatform,
            })
            toast.info({
              title: '默认平台已恢复',
              description: `当前平台：${defaultPlatform === 'dev' ? '测试平台' : defaultPlatform}`,
              dedupeKey: `default-platform:${accountId}`,
            })
          }
          useGateStore.getState().setDefaultPlatformSetAfterLogin(true)
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

    const handleKickedOut = async (event: CustomEvent) => {
      if (kickoutHandledRef.current) return
      kickoutHandledRef.current = true
      const { message } = event.detail
      console.warn('[AuthProvider] User kicked out:', message)
      await clearTokensAndUnauth()
      setShowUserCenter(false)
      setShowSubscribeDialog(false)
      setCurrentFeature('login')
      navigate('/', { replace: true })
      toast.error({
        title: '账号已在其他设备登录',
        description: message || '您的账号已在其他设备登录，请重新登录',
        duration: 5000,
      })
      setShowAuthDialog(true)
    }

    const handleKickedOutEvent: EventListener = event => {
      void handleKickedOut(event as CustomEvent)
    }

    window.addEventListener('auth:required', handleAuthRequired as EventListener)
    window.addEventListener('auth:success', handleAuthSuccess as EventListener)
    window.addEventListener('gate:subscribe-required', handleSubscribeRequired as EventListener)
    window.addEventListener('auth:license-required', handleLicenseRequired as EventListener)
    window.addEventListener('auth:account-disabled', handleAccountDisabled as EventListener)
    window.addEventListener('auth:user-center', handleUserCenterOpen as EventListener)
    window.addEventListener(KICKED_OUT_EVENT, handleKickedOutEvent)

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
      window.removeEventListener(KICKED_OUT_EVENT, handleKickedOutEvent)
    }
  }, [clearTokensAndUnauth, navigate, refreshUserStatus, runPendingActionAndClear, toast])

  // 试用已结束：进入主界面后自动弹一次试用弹窗
  useEffect(() => {
    if (!authCheckDone || !accessContext.userStatus || trialExpiredModalShownRef.current) return
    if (accessContext.trialExpired !== true) return
    trialExpiredModalShownRef.current = true
    setShowSubscribeDialog(true)
  }, [authCheckDone, accessContext])

  // ===================== 心跳检测机制 =====================

  /**
   * 执行单次心跳检测
   * 调用 /auth/session-check 接口检查会话是否仍然有效
   * 该接口会同时验证 access_token 和 refresh_token 是否被撤销
   */
  const doHeartbeat = useCallback(async () => {
    // 停止条件检查
    if (!isAuthenticated || isKickedOutRef.current) {
      console.log('[Heartbeat] Skipping: not authenticated or already kicked out')
      return
    }

    console.log('[Heartbeat] Checking session...')

    try {
      const result = await sessionCheck()

      if (!result.ok) {
        console.warn('[Heartbeat] Session check failed:', result.status, result.error)

        // 检查是否是被踢下线
        if (result.error?.code === 'kicked_out' || result.error?.message?.includes('其他设备')) {
          console.warn('[Heartbeat] Detected kicked out status')
          isKickedOutRef.current = true
          // 触发踢下线事件，复用现有处理链路
          window.dispatchEvent(
            new CustomEvent(KICKED_OUT_EVENT, {
              detail: { message: result.error.message || '您的账号已在其他设备登录' },
            }),
          )
        }
        // 其他错误（如网络问题）不处理，让下次心跳继续检测
      } else {
        console.log('[Heartbeat] Session is valid')
      }
    } catch (error) {
      console.error('[Heartbeat] Unexpected error during heartbeat:', error)
      // 异常不中断轮询，下次继续
    }
  }, [isAuthenticated])

  /**
   * 启动心跳检测
   */
  const startHeartbeat = useCallback(() => {
    // 清理现有定时器
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }

    // 重置被踢标记
    isKickedOutRef.current = false

    // 立即执行一次
    void doHeartbeat()

    // 设置定时器
    const interval = isPageVisibleRef.current ? HEARTBEAT_INTERVAL : HEARTBEAT_INTERVAL_BACKGROUND
    heartbeatTimerRef.current = setInterval(() => {
      void doHeartbeat()
    }, interval)

    console.log('[Heartbeat] Started with interval:', interval, 'ms')
  }, [doHeartbeat])

  /**
   * 停止心跳检测
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
      console.log('[Heartbeat] Stopped')
    }
  }, [])

  /**
   * 处理页面可见性变化 - 后台降频
   */
  useEffect(() => {
    if (isAuthenticated) {
      kickoutHandledRef.current = false
    }
  }, [isAuthenticated])

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible'
      isPageVisibleRef.current = isVisible

      console.log('[Heartbeat] Page visibility changed:', isVisible ? 'visible' : 'hidden')

      // 如果心跳正在运行，根据可见性调整频率
      if (heartbeatTimerRef.current && isAuthenticated && !isKickedOutRef.current) {
        stopHeartbeat()
        startHeartbeat()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, startHeartbeat, stopHeartbeat])

  /**
   * 登录状态变化时启停心跳
   */
  useEffect(() => {
    if (isAuthenticated && authCheckDone) {
      // 登录后开始心跳
      startHeartbeat()
    } else {
      // 未登录时停止心跳
      stopHeartbeat()
    }

    return () => {
      stopHeartbeat()
    }
  }, [isAuthenticated, authCheckDone, startHeartbeat, stopHeartbeat])

  /**
   * 被踢下线时停止心跳
   */
  useEffect(() => {
    const handleKickedOutStopHeartbeat = () => {
      isKickedOutRef.current = true
      stopHeartbeat()
    }

    window.addEventListener(KICKED_OUT_EVENT, handleKickedOutStopHeartbeat)
    return () => {
      window.removeEventListener(KICKED_OUT_EVENT, handleKickedOutStopHeartbeat)
    }
  }, [stopHeartbeat])

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
