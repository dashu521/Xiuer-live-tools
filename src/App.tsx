import { RefreshCwIcon, TerminalIcon } from 'lucide-react'
import { Outlet } from 'react-router'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { DefaultErrorFallback, ErrorBoundary } from '@/components/common/ErrorBoundary'
import LogDisplayer from '@/components/common/LogDisplayer'
import Sidebar from '@/components/common/Sidebar'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Toaster } from '@/components/ui/toaster'
import { useDevMode } from '@/hooks/useDevMode'
import { Header } from './components/common/Header'
import { useIpcListener } from './hooks/useIpc'
import './App.css'
import React, { Suspense, useEffect, useState } from 'react'
import type { StreamStatus } from 'shared/streamStatus'
import { AuthProvider } from '@/components/auth/AuthProvider'
// 新用户引导组件
import { QuickStartDialog, WelcomeDialog } from '@/components/onboarding'
import {
  getQuickStartCompleted,
  getWelcomeCompleted,
  setQuickStartCompleted,
  setWelcomeCompleted,
} from '@/constants/authStorageKeys'
// 初始化平台偏好设置服务
import { initializePlatformPreferenceService } from '@/services/platformPreferenceService'
import { useAuthCheckDone, useIsAuthenticated } from '@/stores/authStore'
// 初始化 TaskManager（注册所有任务）
import { taskManager } from '@/tasks'
import { getFriendlyErrorMessage } from '@/utils/errorMessages'
// 初始化统一存储系统
import { initializeStorage } from '@/utils/storage'
import { UpdateDialog } from './components/update/UpdateDialog'
import { useAccounts } from './hooks/useAccounts'
import { useAutoMessageStore, useLoadAutoMessageOnLogin } from './hooks/useAutoMessage'
import { useAutoPopUpStore, useLoadAutoPopUpOnLogin } from './hooks/useAutoPopUp'
import { useAutoReply, useAutoReplyStore } from './hooks/useAutoReply'
import { useLoadAutoReplyConfigOnLogin } from './hooks/useAutoReplyConfig'
// 加载隔离存储配置
import { useChromeConfigStore, useLoadChromeConfigOnLogin } from './hooks/useChromeConfig'
import { useLiveControlStore, useLoadLiveControlOnLogin } from './hooks/useLiveControl'
import { useLoadSubAccountOnLogin } from './hooks/useSubAccount'
import { useTaskConnectionGuard } from './hooks/useTaskConnectionGuard'
import { useToast } from './hooks/useToast'
import { useUpdateConfigStore, useUpdateStore } from './hooks/useUpdate'
import { cn } from './lib/utils'

function useGlobalIpcListener() {
  const { handleComment } = useAutoReply()
  const { setIsListening } = useAutoReplyStore()
  const { setConnectState, setAccountName, setStreamState } = useLiveControlStore()
  const setIsRunningAutoMessage = useAutoMessageStore(s => s.setIsRunning)
  const setIsRunningAutoPopUp = useAutoPopUpStore(s => s.setIsRunning)
  const setStorageState = useChromeConfigStore(s => s.setStorageState)
  const enableAutoCheckUpdate = useUpdateConfigStore(s => s.enableAutoCheckUpdate)
  const handleUpdate = useUpdateStore.use.handleUpdate()
  const { toast } = useToast()

  useIpcListener(IPC_CHANNELS.tasks.autoReply.showComment, ({ comment, accountId }) => {
    handleComment(comment, accountId)
  })

  useIpcListener(IPC_CHANNELS.tasks.liveControl.disconnectedEvent, async (id, reason) => {
    console.log(`[renderer][${id}] ==============================================`)
    console.log(`[renderer][${id}][event] 🚨 收到 disconnectedEvent 事件`, {
      accountId: id,
      reason: reason || '未知原因',
      timestamp: new Date().toISOString(),
    })

    const reasonStr = (reason || '') as string
    const isFatalDisconnect =
      reasonStr.includes('browser has been closed') ||
      reasonStr.includes('连接已取消') ||
      reasonStr.includes('连接超时') ||
      reasonStr.includes('网络连接失败')

    // 【关键】仅在「用户正在登录中」且非致命断开时忽略，避免登录过程中的短暂断开误报
    // 浏览器被关闭、连接已取消、超时等致命原因立即更新 UI，不再转圈
    const currentStatus = useLiveControlStore.getState().contexts[id]?.connectState
    console.log(`[renderer][${id}] currentStatus before:`, currentStatus)
    if (currentStatus?.phase === 'waiting_for_login' && !isFatalDisconnect) {
      console.log(`[renderer][${id}][event] ⏭️ 忽略 disconnectedEvent：用户正在登录中（非致命断开）`)
      return
    }

    console.log(`[renderer][${id}] >>> Step 1: setConnectState to disconnected`)
    setConnectState(id, {
      status: 'disconnected',
      phase: 'idle',
      error: reason || '直播中控台已断开连接',
    })
    console.log(
      `[renderer][${id}] >>> Step 1 done, new status:`,
      useLiveControlStore.getState().contexts[id]?.connectState,
    )

    if (reason && !reasonStr.includes('用户主动断开')) {
      const friendlyMessage = getFriendlyErrorMessage(reason)
      toast.error(friendlyMessage)
    }

    // 只停止该账号的任务，避免误停其他账号的 autoSpeak（TaskManager 为全局单任务）
    console.log(`[renderer][${id}] >>> Step 2: calling stopAllLiveTasks for account ${id}`)
    const { stopAllLiveTasks } = await import('@/utils/stopAllLiveTasks')
    await stopAllLiveTasks(id, 'disconnected', false) // 不显示 toast，避免重复
    console.log(`[renderer][${id}] >>> Step 2 done, stopAllLiveTasks completed`)
    console.log(`[renderer][${id}] ==============================================`)
  })

  useIpcListener(IPC_CHANNELS.tasks.autoMessage.stoppedEvent, async id => {
    // 同步状态：后端停止事件（可能是手动停止或系统停止）
    setIsRunningAutoMessage(id, false)

    // 【修复】同步 TaskManager 状态（按账号隔离）
    try {
      // 【修复】只同步指定账号的任务状态，不影响其他账号
      const taskStatus = taskManager.getStatus('autoSpeak', id)
      if (taskStatus === 'running') {
        // 【修复】调用 TaskManager 的 stop 方法，传入账号ID实现精确停止
        await taskManager.stop('autoSpeak', 'error', id)
        console.log(`[TaskManager] Synced autoSpeak status to stopped for account ${id}`)
      }
    } catch (error) {
      // TaskManager 可能未初始化，忽略
      console.log('[TaskManager] Failed to sync status (may not be initialized):', error)
    }

    console.log(`[TaskGate] Auto message stopped event for account ${id}`)
  })

  useIpcListener(IPC_CHANNELS.tasks.autoPopUp.stoppedEvent, id => {
    setIsRunningAutoPopUp(id, false)
    // 注意：如果是系统强制停止，toast 已在 stopAllLiveTasks 中显示
    // 这里只处理手动停止的情况
    console.log(`[TaskGate] Auto popup stopped event for account ${id}`)
  })

  useIpcListener(IPC_CHANNELS.tasks.autoReply.listenerStopped, id => {
    setIsListening(id, 'stopped')
    // 注意：如果是系统强制停止，toast 已在 stopAllLiveTasks 中显示
    // 这里只处理手动停止的情况
    console.log(`[TaskGate] Auto reply listener stopped event for account ${id}`)
  })

  useIpcListener(IPC_CHANNELS.chrome.saveState, (id, state) => {
    setStorageState(id, state)
  })

  useIpcListener(IPC_CHANNELS.tasks.liveControl.notifyAccountName, params => {
    if (params.ok) {
      console.log(`[conn][${params.accountId}][event] 收到 notifyAccountName 事件`, {
        accountId: params.accountId,
        accountName: params.accountName,
      })

      setAccountName(params.accountId, params.accountName)

      // 登录成功！更新连接状态为 connected，phase 设置为 streaming（等待开始直播）
      setConnectState(params.accountId, {
        status: 'connected',
        phase: 'streaming',
        error: null,
        lastVerifiedAt: Date.now(),
      })
      console.log(`[conn][${params.accountId}][event] 更新状态为 connected`, {
        accountId: params.accountId,
      })
      toast.success('已成功连接到直播控制台')
    } else {
      console.warn('[conn][event] notifyAccountName 返回失败')
    }
  })

  // 监听直播状态变化事件
  useIpcListener(
    IPC_CHANNELS.tasks.liveControl.streamStateChanged,
    async (accountId: string, streamState: StreamStatus) => {
      console.log(`[renderer][${accountId}] ==============================================`)
      console.log(
        `[renderer][${accountId}][event] 🌡️ streamStateChanged event received: ${streamState}`,
        { accountId, streamState, timestamp: new Date().toISOString() },
      )

      // 获取之前的状态
      const prevState = useLiveControlStore.getState().contexts[accountId]?.streamState
      console.log(`[renderer][${accountId}] prevState: ${prevState}, newState: ${streamState}`)

      // 更新状态
      console.log(`[renderer][${accountId}] >>> Step 1: setStreamState to ${streamState}`)
      setStreamState(accountId, streamState)
      console.log(
        `[renderer][${accountId}] >>> Step 1 done, new store state:`,
        useLiveControlStore.getState().contexts[accountId]?.streamState,
      )

      // 如果从 live 变为非 live，只停止该账号的任务，避免误停其他账号的 autoSpeak
      if (prevState === 'live' && streamState !== 'live') {
        console.log(
          `[renderer][${accountId}] >>> Step 2: Stream ended (${prevState} -> ${streamState}), calling stopAllLiveTasks`,
        )
        const { stopAllLiveTasks } = await import('@/utils/stopAllLiveTasks')
        await stopAllLiveTasks(accountId, 'stream_ended', false) // 不显示 toast，避免重复
        console.log(`[renderer][${accountId}] >>> Step 2 done, stopAllLiveTasks completed`)
      }
      console.log(`[renderer][${accountId}] ==============================================`)
    },
  )

  useIpcListener(IPC_CHANNELS.app.notifyUpdate, info => {
    if (enableAutoCheckUpdate) {
      handleUpdate(info)
    }
  })
}

function AppContent() {
  const { enabled: devMode } = useDevMode()
  const { accounts, currentAccountId } = useAccounts()
  // 【修复】直接解构 setConnectState，避免 selector 返回新对象导致无限循环
  const setConnectState = useLiveControlStore(state => state.setConnectState)
  const [logCollapsed, setLogCollapsed] = useState(() => {
    const saved = localStorage.getItem('logPanelCollapsed')
    // 默认折叠状态为 true（折叠）
    return saved === null ? true : saved === 'true'
  })

  // 【关键】注册全局 IPC 事件监听（notifyAccountName -> 已连接、disconnectedEvent、streamStateChanged 等），不调用则 UI 收不到主进程事件，界面会空白/异常
  useGlobalIpcListener()

  // 【数据隔离】登录时加载各 Store 的配置
  useLoadChromeConfigOnLogin()
  useLoadAutoReplyConfigOnLogin()
  useLoadAutoPopUpOnLogin()
  useLoadAutoMessageOnLogin()
  useLoadSubAccountOnLogin()
  useLoadLiveControlOnLogin()

  // 【关键】监听连接状态，当连接断开时自动停止所有任务（兜底机制）
  useTaskConnectionGuard()

  // 初始化平台偏好设置服务（应用启动时执行一次）
  useEffect(() => {
    initializePlatformPreferenceService()
  }, [])

  // Check if running in Electron environment
  useEffect(() => {
    if (!window.ipcRenderer) {
      console.error('window.ipcRenderer is not available. Please run this app in Electron.')
    }
  }, [])

  // 修复：只在 currentAccountId 变化时执行，避免 accounts 数组引用变化导致的无限循环
  // 使用 useRef 跟踪上一次的 account，只在 account 真正变化时才执行 IPC 调用
  const prevAccountIdRef = React.useRef<string | null>(null)
  const prevAccountRef = React.useRef<{ id: string; name: string } | null>(null)

  useEffect(() => {
    // 如果 currentAccountId 没有变化，不执行
    if (prevAccountIdRef.current === currentAccountId) {
      return
    }

    const account = accounts.find(acc => acc.id === currentAccountId)

    // 如果找到了账号，且账号信息有变化，才执行 IPC 调用
    if (account && window.ipcRenderer) {
      // 检查账号信息是否真的变化了（避免相同账号的重复调用）
      const accountChanged =
        !prevAccountRef.current ||
        prevAccountRef.current.id !== account.id ||
        prevAccountRef.current.name !== account.name

      if (accountChanged) {
        window.ipcRenderer.invoke(IPC_CHANNELS.account.switch, { account })
        // 【修复】切换账号时，只重置临时状态（如 connecting），保留已连接状态
        // 避免持久化的临时状态影响新账号，但保持已连接账号的状态显示
        const currentState = useLiveControlStore.getState().contexts[account.id]?.connectState
        if (currentState?.status === 'connecting') {
          // 如果状态是 connecting，重置为 disconnected（防止无效状态残留）
          setConnectState(account.id, {
            status: 'disconnected',
            phase: 'idle',
            error: null,
            session: null,
            lastVerifiedAt: null,
          })
        }
        // 注意：如果状态是 connected，保持原状态，不重置
        // 这样切换回已连接的账号时，状态显示正确
        prevAccountRef.current = { id: account.id, name: account.name }
      }
    }

    prevAccountIdRef.current = currentAccountId
    // 只依赖 currentAccountId，不依赖 accounts 数组（避免数组引用变化导致的循环）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentAccountId,
    accounts.find,
    // 避免持久化的旧状态（如 connecting）影响新账号
    // 注意：只重置当前账号的 UI 状态，不影响其他账号的后台连接/任务
    setConnectState,
    accounts,
  ])

  useEffect(() => {
    localStorage.setItem('logPanelCollapsed', String(logCollapsed))
  }, [logCollapsed])

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleToggleDevTools = async () => {
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke(IPC_CHANNELS.chrome.toggleDevTools)
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger disabled={!devMode} className="min-h-screen">
          <div
            className="flex flex-col h-screen overflow-hidden"
            style={{ backgroundColor: 'var(--app-bg)' }}
          >
            {/* 头部标题：固定高度；主内容区高度 = 100vh - 头部 - 底部日志，无全局滚动 */}
            <Header />

            <div className="flex flex-1 min-h-0 overflow-hidden gap-0">
              {/* 侧边栏 */}
              <Sidebar />

              <main
                className="min-h-0 flex-1 flex flex-col overflow-hidden p-6"
                style={{
                  backgroundColor: 'var(--content-bg)',
                  borderTopLeftRadius: '1rem',
                  boxShadow: 'var(--content-edge-shadow)',
                }}
              >
                <div className="mx-auto w-full max-w-full xl:max-w-7xl 2xl:max-w-screen-2xl flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center flex-1 min-h-0">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                            <span className="text-sm text-muted-foreground">加载中...</span>
                          </div>
                        </div>
                      }
                    >
                      {/* 全屏页(如自动回复)用 h-full 填满后内部滚动；其它页内容过长时此层滚动 */}
                      <div className="h-full min-h-0 overflow-y-auto">
                        <Outlet />
                      </div>
                    </Suspense>
                  </div>
                </div>
              </main>
            </div>

            <div
              className={cn(
                'shrink-0 transition-all duration-200',
                logCollapsed ? 'h-12 shadow-none opacity-50' : 'h-[11.25rem] opacity-100',
              )}
              style={{
                backgroundColor: logCollapsed ? 'var(--surface-muted)' : 'var(--surface)',
                boxShadow: logCollapsed ? 'none' : '0 -1px 0 rgba(0,0,0,0.06)',
              }}
            >
              <LogDisplayer
                collapsed={logCollapsed}
                onToggleCollapsed={() => setLogCollapsed(prev => !prev)}
              />
            </div>
            <UpdateDialog />
          </div>
        </ContextMenuTrigger>
        {devMode && (
          <ContextMenuContent>
            <ContextMenuItem onClick={handleRefresh}>
              <RefreshCwIcon className="mr-2 h-4 w-4" />
              <span>刷新页面</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleToggleDevTools}>
              <TerminalIcon className="mr-2 h-4 w-4" />
              <span>开发者工具</span>
            </ContextMenuItem>
          </ContextMenuContent>
        )}
      </ContextMenu>
      <Toaster />
    </>
  )
}

function AppWithOnboarding() {
  const [showWelcome, setShowWelcome] = useState(false)
  const [showQuickStart, setShowQuickStart] = useState(false)
  const isAuthenticated = useIsAuthenticated()
  const authCheckDone = useAuthCheckDone()
  const { toast } = useToast()

  // 首次启动显示欢迎引导
  useEffect(() => {
    if (authCheckDone && !isAuthenticated) {
      const hasCompleted = getWelcomeCompleted()
      if (!hasCompleted) {
        setShowWelcome(true)
      }
    }
  }, [authCheckDone, isAuthenticated])

  // 首次登录后显示快速开始引导
  useEffect(() => {
    if (isAuthenticated) {
      const hasCompletedQuickStart = getQuickStartCompleted()
      if (!hasCompletedQuickStart) {
        setShowQuickStart(true)
      }
    }
  }, [isAuthenticated])

  const handleWelcomeClose = () => {
    setShowWelcome(false)
    setWelcomeCompleted(true)
  }

  const handleWelcomeStart = () => {
    setShowWelcome(false)
    setWelcomeCompleted(true)
    // 触发登录对话框
    window.dispatchEvent(new CustomEvent('auth:required', { detail: { feature: 'login' } }))
  }

  const handleQuickStartClose = () => {
    setShowQuickStart(false)
    setQuickStartCompleted(true)
  }

  const handleQuickStartConnect = () => {
    setShowQuickStart(false)
    setQuickStartCompleted(true)
    // 触发连接中控台
    window.dispatchEvent(new CustomEvent('live-control:connect-required'))
    toast.success('请点击左侧「打开中控台」开始连接')
  }

  return (
    <>
      <AppContent />
      <WelcomeDialog
        isOpen={showWelcome}
        onClose={handleWelcomeClose}
        onStart={handleWelcomeStart}
      />
      <QuickStartDialog
        isOpen={showQuickStart}
        onClose={handleQuickStartClose}
        onConnect={handleQuickStartConnect}
      />
    </>
  )
}

// 在应用启动时立即初始化存储系统（必须在 AuthProvider 之前）
initializeStorage()

export default function App() {
  return (
    <ErrorBoundary fallback={DefaultErrorFallback}>
      <AuthProvider>
        <AppWithOnboarding />
      </AuthProvider>
    </ErrorBoundary>
  )
}
