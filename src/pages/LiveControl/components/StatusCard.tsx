import { useMemoizedFn } from 'ahooks'
import { GlobeIcon, Loader2, Monitor, Play, Square } from 'lucide-react'
import React, { useEffect, useRef } from 'react'
import type { IpcChannels } from 'shared/electron-api.d.ts'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { OneClickStartButton } from '@/components/common/OneClickStartButton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ConnectState } from '@/config/platformConfig'
import { useAccounts } from '@/hooks/useAccounts'
import { useCurrentChromeConfig, useCurrentChromeConfigActions } from '@/hooks/useChromeConfig'
import {
  useCurrentLiveControl,
  useCurrentLiveControlActions,
  useLiveControlStore,
} from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import { useGateStore } from '@/stores/gateStore'
import { getFullErrorInfo } from '@/utils/errorMessages'
import { generateTraceId } from '@/utils/traceId'
import PlatformSelect from './PlatformSelect'

// 使用共享类型定义
type ConnectResult = Awaited<ReturnType<IpcChannels[typeof IPC_CHANNELS.tasks.liveControl.connect]>>

const StatusAlert = React.memo(() => {
  const connectState = useCurrentLiveControl(state => state.connectState)

  // 连接中状态提示 - 已隐藏，保持业务逻辑不变
  if (connectState.status === 'connecting') {
    return null
  }

  if (connectState.platform === 'wxchannel') {
    return (
      <Alert>
        <GlobeIcon className="h-4 w-4" />
        <AlertTitle>你选择了视频号平台，请注意以下事项：</AlertTitle>
        <AlertDescription>
          <ol className="list-decimal list-inside">
            <li>
              请先确认<strong>开播后</strong>再连接中控台
            </li>
            <li>
              视频号助手无法<strong>一号多登</strong>，在别处登录视频号助手会
              <strong>中断连接</strong>!
            </li>
          </ol>
        </AlertDescription>
      </Alert>
    )
  }
  if (connectState.platform === 'taobao') {
    return (
      <Alert>
        <GlobeIcon className="h-4 w-4" />
        <AlertTitle>你选择了淘宝平台，请注意以下事项：</AlertTitle>
        <AlertDescription>
          <ol className="list-decimal list-inside">
            <li>
              请先确认<strong>开播后</strong>
              再连接中控台，因为进入淘宝中控台需要获取<strong>直播间ID</strong>
            </li>
            <li>
              目前淘宝会触发人机验证，所以将<strong>强制关闭无头模式</strong>
              ，除了登录和人机验证之外请尽量不要操作浏览器
            </li>
          </ol>
        </AlertDescription>
      </Alert>
    )
  }
  return null
})

const StatusCard = React.memo(() => {
  const connectState = useCurrentLiveControl(context => context.connectState)
  const accountName = useCurrentLiveControl(context => context.accountName)
  const streamState = useCurrentLiveControl(context => context.streamState)

  return (
    <div data-tour="live-control">
      <StatusCardContent
        connectState={connectState}
        accountName={accountName}
        streamState={streamState}
      />
    </div>
  )
})

const StatusCardContent = React.memo(
  ({
    connectState,
    accountName,
    streamState,
  }: {
    connectState: ConnectState
    accountName: string | null
    streamState: string | null
  }) => {
    // 获取连接阶段显示文本
    const getConnectingPhaseText = () => {
      switch (connectState.phase) {
        case 'preparing':
          return '准备连接...'
        case 'launching_browser':
          return '正在启动浏览器...'
        case 'waiting_for_login':
          return '等待扫码登录...'
        case 'streaming':
          return '正在建立连接...'
        default:
          return '连接中...'
      }
    }

    // 【修复】获取直播状态显示文本
    const getStreamStateText = () => {
      switch (streamState) {
        case 'live':
          return '直播中'
        case 'offline':
          return '未开播'
        case 'ended':
          return '直播已结束'
        default:
          return '检测中...'
      }
    }

    // 【修复】获取直播状态颜色
    const getStreamStateColor = () => {
      switch (streamState) {
        case 'live':
          return 'text-green-600'
        case 'offline':
          return 'text-amber-600'
        case 'ended':
          return 'text-gray-500'
        default:
          return 'text-blue-600 animate-pulse'
      }
    }

    const statusText =
      connectState.status === 'connected'
        ? `已连接${accountName ? ` (${accountName})` : ''}`
        : connectState.status === 'connecting'
          ? getConnectingPhaseText()
          : connectState.status === 'error'
            ? '连接失败'
            : '未连接'

    const isConnected = connectState.status === 'connected'
    const isConnecting = connectState.status === 'connecting'
    const _isError = connectState.status === 'error'

    return (
      <TooltipProvider>
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 px-6 py-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="h-4 w-4 text-primary" />
                控制台状态
              </CardTitle>
              {/* 无头模式移到标题行右侧 */}
              <HeadlessSetting compact />
            </div>
          </CardHeader>
          <CardContent className="px-6 py-8">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* 左侧状态显示 */}
              <div className="flex items-center gap-4">
                <div
                  className={`h-14 w-14 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                    isConnected
                      ? 'border-green-500/30 bg-green-500/10'
                      : isConnecting
                        ? 'border-amber-500/50 bg-amber-500/10 animate-pulse'
                        : 'border-primary/30'
                  }`}
                >
                  {isConnected ? (
                    <div className="h-6 w-6 rounded-full border-2 border-green-500 animate-pulse" />
                  ) : isConnecting ? (
                    <Loader2 className="h-7 w-7 text-amber-500 animate-spin" />
                  ) : (
                    <Monitor className="h-7 w-7 text-primary" />
                  )}
                </div>
                <div className="min-w-[180px]">
                  <div
                    className={`text-base font-medium transition-colors ${isConnecting ? 'text-amber-600' : ''}`}
                  >
                    {statusText}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {connectState.platform
                      ? `${getPlatformName(connectState.platform)}`
                      : '请选择平台并连接'}
                    {/* 【修复】已连接时显示直播状态 */}
                    {isConnected && (
                      <span className={`ml-2 ${getStreamStateColor()}`}>
                        · {getStreamStateText()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 右侧操作区 */}
              <div className="flex items-center gap-4">
                {/* 平台选择 */}
                <div className="border rounded-lg px-3 py-2 bg-muted/30 h-10 flex items-center">
                  <PlatformSelect />
                </div>

                {/* 连接/断开按钮 */}
                <ConnectToLiveControl />

                {/* 一键开启任务 - 次级按钮 */}
                <OneClickStartButton variant="secondary" />
              </div>
            </div>

            {/* 平台提示 */}
            <div className="mt-4">
              <StatusAlert />
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>
    )
  },
)

// 获取平台显示名称
const getPlatformName = (platform: string) => {
  const names: Record<string, string> = {
    douyin: '抖音小店',
    buyin: '巨量百应',
    eos: '抖音团购',
    xiaohongshu: '小红书千帆',
    pgy: '小红书蒲公英',
    wxchannel: '视频号',
    kuaishou: '快手小店',
    taobao: '淘宝',
    dev: '测试平台',
  }
  return names[platform] || platform
}

const ConnectToLiveControl = React.memo(() => {
  const { setConnectState } = useCurrentLiveControlActions()
  const connectState = useCurrentLiveControl(context => context.connectState)
  const chromePath = useCurrentChromeConfig(context => context.path)
  const storageState = useCurrentChromeConfig(context => context.storageState)
  // 确保 headless 有默认值 false，避免 undefined 导致浏览器无法弹出
  let headless = useCurrentChromeConfig(context => context.headless ?? false)
  const account = useAccounts(store => store.getCurrentAccount())

  if (connectState.platform === 'taobao') {
    headless = false
  }

  const { toast } = useToast()
  const loginTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current)
        loginTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (connectState.status === 'connected' || connectState.status === 'disconnected') {
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current)
        loginTimeoutRef.current = null
      }
    }
  }, [connectState.status])

  useEffect(() => {
    if (connectState.status === 'connecting' && !loginTimeoutRef.current) {
      const checkTimer = setTimeout(() => {
        const currentState = useLiveControlStore.getState()
        const currentAccountId = useAccounts.getState().currentAccountId
        const currentContext = currentState.contexts[currentAccountId]

        if (currentContext?.connectState.status === 'connecting' && !loginTimeoutRef.current) {
          console.warn(
            '[State Machine] Invalid connecting state detected (no timeout), rolling back to disconnected',
          )
          setConnectState({
            status: 'disconnected',
            error: null,
            session: null,
            lastVerifiedAt: null,
          })
          toast.error('连接已失效，请重新连接')
        }
      }, 30000) // 增加到 30 秒，给 IPC 调用足够时间

      return () => {
        clearTimeout(checkTimer)
      }
    }
  }, [connectState.status, setConnectState, toast])

  const guardAction = useGateStore(s => s.guardAction)

  const connectLiveControl = useMemoizedFn(async () => {
    await guardAction('connect-live-control', {
      requireSubscription: true,
      action: async () => {
        try {
          if (!account) {
            toast.error('找不到当前账号，请重新选择')
            return
          }

          if (connectState.status === 'connecting') {
            console.warn(`[conn][${account.id}] 重入拒绝：正在连接中`)
            toast.error('正在连接中，请稍等')
            return
          }

          // 生成 traceId 用于全链路追踪
          const traceId = generateTraceId()
          console.log(`[conn][${account.id}][${traceId}] UI 点击连接`, {
            accountId: account.id,
            platform: connectState.platform,
          })

          if (!loginTimeoutRef.current) {
            loginTimeoutRef.current = null
          }

          console.log('[State Machine] selectedPlatformId:', connectState.platform)
          console.log('[State Machine] headless config:', headless)
          console.log('[State Machine] Status transition:', connectState.status, '→ connecting')

          // 阶段 1: 准备连接
          setConnectState({
            status: 'connecting',
            phase: 'preparing',
            error: null,
            lastVerifiedAt: null,
          })

          // 阶段 2: 启动浏览器
          setConnectState({
            phase: 'launching_browser',
          })

          const result = (await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.liveControl.connect, {
            headless,
            chromePath,
            storageState,
            platform: connectState.platform as LiveControlPlatform,
            account,
            traceId, // 传递 traceId 到主进程
          })) as ConnectResult

          console.log('[Connect] IPC result:', result)

          // 【修复 2.1】browserLaunched=false 时立即回到 disconnected 状态
          if (result && !result.browserLaunched) {
            console.warn(`[conn][${account.id}][${traceId}] IPC 同步失败，浏览器未启动`, {
              error: result.error,
              elapsed: '0ms',
            })

            // 立即回到 disconnected 状态
            setConnectState({
              status: 'disconnected',
              phase: 'error',
              error: result.error || '启动浏览器失败',
              session: null,
              lastVerifiedAt: null,
            })

            // 使用用户友好的错误提示
            const friendlyError = getFullErrorInfo(result.error || '连接失败')
            toast.error(`${friendlyError.title}：${friendlyError.message}`)
            // 延迟显示解决方案
            setTimeout(() => {
              toast.info(`💡 ${friendlyError.solution}`)
            }, 1000)

            // 清理超时定时器
            if (loginTimeoutRef.current) clearTimeout(loginTimeoutRef.current)
            loginTimeoutRef.current = null

            return
          }

          // 阶段 3: 浏览器已启动
          if (result.needsLogin) {
            setConnectState({
              phase: 'waiting_for_login',
            })
            toast.info('请在新打开的浏览器窗口中完成登录')
            console.log(`[conn][${account.id}][${traceId}] 浏览器已启动，等待用户扫码登录...`)
          } else {
            setConnectState({
              status: 'connected',
              phase: 'streaming',
              error: null,
              lastVerifiedAt: Date.now(),
            })
            console.log(
              `[conn][${account.id}][${traceId}] 浏览器已启动，已登录，状态已更新为 connected`,
            )
            toast.success('已成功连接到直播中控台')
          }
          loginTimeoutRef.current = setTimeout(() => {
            // 从 store 获取最新状态，避免闭包陷阱
            const currentAccountId = useAccounts.getState().currentAccountId
            const latestStatus =
              useLiveControlStore.getState().contexts[currentAccountId]?.connectState.status
            if (latestStatus === 'connecting') {
              console.log('[State Machine] Login timeout, status transition: connecting → error')
              setConnectState({
              status: 'error',
              error: '登录超时，请检查是否已完成扫码登录',
            })
            const timeoutError = getFullErrorInfo('登录超时')
            toast.error(`${timeoutError.title}：${timeoutError.message}`)
            setTimeout(() => {
              toast.info(`💡 ${timeoutError.solution}`)
            }, 1000)
            } else if (latestStatus === 'connected') {
              // 已经在 connected 状态，说明登录成功了，只是 notifyAccountName 事件可能延迟
              console.log('[State Machine] Login already succeeded, ignoring timeout')
            }
            loginTimeoutRef.current = null
          }, 60000)
        } catch (error) {
          console.error('[State Machine] Connection failed:', error)
          const errorMessage = error instanceof Error ? error.message : '连接失败'
          console.log('[State Machine] Connection error (non-fatal warning):', errorMessage)
          // 不在这里显示 toast，避免与后续的 disconnectedEvent 或登录成功事件冲突
          loginTimeoutRef.current = setTimeout(() => {
            // 从 store 获取最新状态，避免闭包陷阱
            const currentAccountId = useAccounts.getState().currentAccountId
            const latestStatus =
              useLiveControlStore.getState().contexts[currentAccountId]?.connectState.status
            if (latestStatus === 'connecting') {
              console.log(
                '[State Machine] Login timeout after error, status transition: connecting → error',
              )
              setConnectState({
                status: 'error',
                error: '登录超时，请检查是否已完成扫码登录',
              })
              // 使用用户友好的错误提示
              const timeoutError = getFullErrorInfo('登录超时')
              toast.error(`${timeoutError.title}：${timeoutError.message}`)
              setTimeout(() => {
                toast.info(`💡 ${timeoutError.solution}`)
              }, 1000)
            } else if (latestStatus === 'connected') {
              // 已经在 connected 状态，说明登录成功了
              console.log('[State Machine] Login already succeeded after error, ignoring timeout')
            }
            loginTimeoutRef.current = null
          }, 60000)
        }
      },
    })
  })

  const disconnectLiveControl = useMemoizedFn(async () => {
    if (!account) {
      toast.error('找不到当前账号，请重新选择')
      return
    }
    try {
      console.log('[State Machine] Starting disconnect for platform:', connectState.platform)
      console.log('[State Machine] Status transition:', connectState.status, '→ disconnected')

      await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.liveControl.disconnect, account.id)

      setConnectState({
        status: 'disconnected',
        session: null,
        lastVerifiedAt: null,
        error: null,
      })

      toast.success('已断开连接')
    } catch (error) {
      console.error('[State Machine] Disconnect failed:', error)
      toast.error('断开连接失败，请重试')
    }
  })

  const handleButtonClick = useMemoizedFn(() => {
    if (connectState.status === 'connected') {
      disconnectLiveControl()
    } else if (connectState.status === 'connecting') {
      console.log('[State Machine] Canceling connection attempt')
      console.log('[State Machine] Status transition:', connectState.status, '→ disconnected')

      setConnectState({
        status: 'disconnected',
        session: null,
        lastVerifiedAt: null,
        error: null,
      })

      toast.success('已取消连接')
    } else {
      connectLiveControl()
    }
  })

  const getButtonText = () => {
    // 未添加账号时的提示
    if (!account) {
      return '请先添加直播账号'
    }
    switch (connectState.status) {
      case 'connecting':
        return '连接中...'
      case 'connected':
        return '断开连接'
      case 'error':
        return '重试连接'
      default:
        return '连接直播中控台'
    }
  }

  const isConnected = connectState.status === 'connected'
  const isConnecting = connectState.status === 'connecting'
  const hasAccount = !!account

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={handleButtonClick}
          disabled={isConnecting || !hasAccount}
          variant={isConnected ? 'secondary' : 'default'}
          className={`h-10 px-4 text-sm font-medium transition-all ${isConnecting ? 'bg-amber-500 hover:bg-amber-600' : ''} ${!hasAccount ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {isConnecting ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : isConnected ? (
            <Square className="mr-1.5 h-4 w-4" />
          ) : (
            <Play className="mr-1.5 h-4 w-4" />
          )}
          {getButtonText()}
        </Button>
      </TooltipTrigger>
      {!hasAccount && (
        <TooltipContent side="bottom">
          <p>请先点击左侧「账号管理」添加直播账号</p>
        </TooltipContent>
      )}
    </Tooltip>
  )
})

const HeadlessSetting = React.memo(({ compact = false }: { compact?: boolean }) => {
  const headless = useCurrentChromeConfig(context => context.headless ?? false)
  const connectState = useCurrentLiveControl(context => context.connectState)
  const { setHeadless } = useCurrentChromeConfigActions()

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-pointer">
            <span className="text-xs text-muted-foreground whitespace-nowrap">无头</span>
            <Switch
              checked={headless}
              onCheckedChange={setHeadless}
              disabled={connectState.status !== 'disconnected'}
              className="scale-90"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>无头模式：后台运行浏览器，不显示窗口</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-muted/30 -my-1.5 cursor-pointer">
          <span className="text-sm text-muted-foreground whitespace-nowrap">无头模式</span>
          <Switch
            checked={headless}
            onCheckedChange={setHeadless}
            disabled={connectState.status !== 'disconnected'}
            className="scale-110"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>无头模式：后台运行浏览器，不显示窗口</p>
      </TooltipContent>
    </Tooltip>
  )
})

export { ConnectToLiveControl, HeadlessSetting, StatusAlert }
export default StatusCard
