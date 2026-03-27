import { createElement } from 'react'
import type { AccountEventPayload } from 'shared/accountEvents'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import type {
  LiveControlDisconnectedPayload,
  LiveControlStreamStatePayload,
} from 'shared/liveControlEvents'
import type { StreamStatus } from 'shared/streamStatus'
import type { TaskStoppedEventPayload } from 'shared/taskEvents'
import { Button } from '@/components/ui/button'
import { useAutoMessageStore } from '@/hooks/useAutoMessage'
import { useAutoPopUpStore } from '@/hooks/useAutoPopUp'
import { useAutoReply, useAutoReplyStore } from '@/hooks/useAutoReply'
import { useChromeConfigStore } from '@/hooks/useChromeConfig'
import { useIpcListener } from '@/hooks/useIpc'
import { useLiveControlStore } from '@/hooks/useLiveControl'
import { useLiveStatsStore } from '@/hooks/useLiveStats'
import { useToast } from '@/hooks/useToast'
import { useUpdateConfigStore, useUpdateStore } from '@/hooks/useUpdate'
import { taskManager } from '@/tasks'
import { markCommentListenerStopped } from '@/utils/commentListenerRuntime'
import { getFriendlyErrorMessage } from '@/utils/errorMessages'
import { stopAllLiveTasks } from '@/utils/stopAllLiveTasks'

export function applyAutoMessageStoppedEvent(
  payload: TaskStoppedEventPayload,
  deps: {
    setIsRunningAutoMessage: (accountId: string, running: boolean) => void
    syncStatus: (taskId: 'autoSpeak', status: 'stopped', accountId: string) => void
  },
) {
  deps.setIsRunningAutoMessage(payload.accountId, false)
  deps.syncStatus('autoSpeak', 'stopped', payload.accountId)
}

export function applyAutoPopupStoppedEvent(
  payload: TaskStoppedEventPayload,
  deps: {
    setIsRunningAutoPopUp: (accountId: string, running: boolean) => void
    syncStatus: (taskId: 'autoPopup', status: 'stopped', accountId: string) => void
  },
) {
  deps.setIsRunningAutoPopUp(payload.accountId, false)
  deps.syncStatus('autoPopup', 'stopped', payload.accountId)
}

export function applyCommentListenerStoppedEvent(
  payload: TaskStoppedEventPayload,
  deps: {
    markCommentListenerStopped: (accountId: string) => void
    setIsListening: (accountId: string, status: 'stopped') => void
    setIsRunningAutoReply: (accountId: string, running: boolean) => void
    setLiveStatsListening: (accountId: string, listening: boolean) => void
    syncStatus: (taskId: 'autoReply', status: 'stopped', accountId: string) => void
  },
) {
  deps.markCommentListenerStopped(payload.accountId)
  deps.setIsListening(payload.accountId, 'stopped')
  deps.setIsRunningAutoReply(payload.accountId, false)
  deps.setLiveStatsListening(payload.accountId, false)
  deps.syncStatus('autoReply', 'stopped', payload.accountId)
}

export async function applyDisconnectedLiveControlEvent(
  payload: LiveControlDisconnectedPayload,
  deps: {
    getConnectState: (
      accountId: string,
    ) =>
      | { status?: 'disconnected' | 'connecting' | 'connected' | 'error'; phase?: string }
      | undefined
    showErrorToast: (accountId: string, reason: string, isErrorState: boolean) => void
    stopAllTasks: (accountId: string) => Promise<void>
  },
) {
  const reasonStr = payload.reason || ''
  const isFatalDisconnect =
    reasonStr.includes('browser has been closed') ||
    reasonStr.includes('连接已取消') ||
    reasonStr.includes('连接超时') ||
    reasonStr.includes('网络连接失败')

  const currentStatus = deps.getConnectState(payload.accountId)
  if (currentStatus?.phase === 'waiting_for_login' && !isFatalDisconnect) {
    return { ignored: true }
  }

  if (payload.reason && !reasonStr.includes('用户主动断开')) {
    deps.showErrorToast(payload.accountId, payload.reason, currentStatus?.status === 'error')
  }

  await deps.stopAllTasks(payload.accountId)
  return { ignored: false }
}

export async function applyStreamStateChangedEvent(
  payload: LiveControlStreamStatePayload,
  deps: {
    getPreviousStreamState: (accountId: string) => StreamStatus | undefined
    setStreamState: (accountId: string, streamState: StreamStatus) => void
    stopAllTasksForStreamEnd: (accountId: string) => Promise<void>
  },
) {
  const prevState = deps.getPreviousStreamState(payload.accountId)
  deps.setStreamState(payload.accountId, payload.streamState)

  if (prevState === 'live' && payload.streamState !== 'live') {
    await deps.stopAllTasksForStreamEnd(payload.accountId)
  }
}

export async function applyAccountEvent(
  event: AccountEventPayload,
  deps: {
    task: {
      setIsRunningAutoMessage: (accountId: string, running: boolean) => void
      setIsRunningAutoPopUp: (accountId: string, running: boolean) => void
      markCommentListenerStopped: (accountId: string) => void
      setIsListening: (accountId: string, status: 'stopped') => void
      setIsRunningAutoReply: (accountId: string, running: boolean) => void
      setLiveStatsListening: (accountId: string, listening: boolean) => void
      syncStatus: (
        taskId: 'autoSpeak' | 'autoPopup' | 'autoReply',
        status: 'stopped',
        accountId: string,
      ) => void
    }
    liveControl: {
      getConnectState: (
        accountId: string,
      ) =>
        | { status?: 'disconnected' | 'connecting' | 'connected' | 'error'; phase?: string }
        | undefined
      showErrorToast: (accountId: string, reason: string, isErrorState: boolean) => void
      stopAllTasks: (accountId: string) => Promise<void>
      getPreviousStreamState: (accountId: string) => StreamStatus | undefined
      setStreamState: (accountId: string, streamState: StreamStatus) => void
      stopAllTasksForStreamEnd: (accountId: string) => Promise<void>
      getPreviousConnectState: (
        accountId: string,
      ) => { status?: string; phase?: string } | undefined
      setConnectState: (
        accountId: string,
        connectState: Partial<{
          status: 'disconnected' | 'connecting' | 'connected' | 'error'
          phase:
            | 'idle'
            | 'preparing'
            | 'launching_browser'
            | 'waiting_for_login'
            | 'verifying_session'
            | 'streaming'
            | 'tasks_running'
            | 'error'
          error?: string | null
          session?: string | null
          lastVerifiedAt?: number | null
        }>,
      ) => void
      showConnectedToast: (accountId: string) => void
    }
  },
) {
  switch (event.domain) {
    case 'task': {
      switch (event.type) {
        case 'autoMessageStopped':
          applyAutoMessageStoppedEvent(event.payload, {
            setIsRunningAutoMessage: deps.task.setIsRunningAutoMessage,
            syncStatus: deps.task.syncStatus,
          })
          return
        case 'autoPopupStopped':
          applyAutoPopupStoppedEvent(event.payload, {
            setIsRunningAutoPopUp: deps.task.setIsRunningAutoPopUp,
            syncStatus: deps.task.syncStatus,
          })
          return
        case 'commentListenerStopped':
          applyCommentListenerStoppedEvent(event.payload, {
            markCommentListenerStopped: deps.task.markCommentListenerStopped,
            setIsListening: deps.task.setIsListening,
            setIsRunningAutoReply: deps.task.setIsRunningAutoReply,
            setLiveStatsListening: deps.task.setLiveStatsListening,
            syncStatus: deps.task.syncStatus,
          })
          return
      }
      break
    }
    case 'liveControl': {
      switch (event.type) {
        case 'disconnected':
          await applyDisconnectedLiveControlEvent(event.payload, {
            getConnectState: deps.liveControl.getConnectState,
            showErrorToast: deps.liveControl.showErrorToast,
            stopAllTasks: deps.liveControl.stopAllTasks,
          })
          return
        case 'streamStateChanged':
          await applyStreamStateChangedEvent(event.payload, {
            getPreviousStreamState: deps.liveControl.getPreviousStreamState,
            setStreamState: deps.liveControl.setStreamState,
            stopAllTasksForStreamEnd: deps.liveControl.stopAllTasksForStreamEnd,
          })
          return
        case 'stateChanged': {
          const prevContext = deps.liveControl.getPreviousConnectState(event.accountId)
          const shouldToastConnected =
            event.payload.connectState.status === 'connected' &&
            event.payload.connectState.phase === 'streaming' &&
            (prevContext?.status !== 'connected' || prevContext?.phase !== 'streaming')

          deps.liveControl.setConnectState(event.accountId, event.payload.connectState)

          if (shouldToastConnected) {
            deps.liveControl.showConnectedToast(event.accountId)
          }
          return
        }
      }
      break
    }
  }
}

export function useAppIpcBootstrap() {
  useCommentIpcSync()
  useAccountEventIpcSync()
  useChromeIpcSync()
  useUpdateIpcSync()
}

function useCommentIpcSync() {
  const { handleComment } = useAutoReply()

  useIpcListener(IPC_CHANNELS.tasks.commentListener.showComment, ({ comment, accountId }) => {
    handleComment(comment, accountId)
  })
}

function useAccountEventIpcSync() {
  const setIsListening = useAutoReplyStore(s => s.setIsListening)
  const setIsRunningAutoReply = useAutoReplyStore(s => s.setIsRunning)
  const setIsRunningAutoMessage = useAutoMessageStore(s => s.setIsRunning)
  const setIsRunningAutoPopUp = useAutoPopUpStore(s => s.setIsRunning)
  const setLiveStatsListening = useLiveStatsStore(s => s.setListening)
  const { setConnectState, setAccountName, setStreamState } = useLiveControlStore()
  const { toast } = useToast()

  useIpcListener(IPC_CHANNELS.account.event, async event => {
    await applyAccountEvent(event, {
      task: {
        setIsRunningAutoMessage,
        setIsRunningAutoPopUp,
        markCommentListenerStopped,
        setIsListening,
        setIsRunningAutoReply,
        setLiveStatsListening,
        syncStatus: taskManager.syncStatus.bind(taskManager),
      },
      liveControl: {
        getConnectState: accountId =>
          useLiveControlStore.getState().contexts[accountId]?.connectState,
        showErrorToast: (accountId, reason, isErrorState) => {
          toast.error({
            title: isErrorState ? '连接失败' : '连接已断开',
            description: getFriendlyErrorMessage(reason),
            dedupeKey: `live-control-disconnected:${accountId}`,
            duration: 4500,
            priority: 4,
          })
        },
        stopAllTasks: accountId => stopAllLiveTasks(accountId, 'disconnected', false),
        getPreviousStreamState: accountId =>
          useLiveControlStore.getState().contexts[accountId]?.streamState,
        setStreamState,
        stopAllTasksForStreamEnd: accountId => stopAllLiveTasks(accountId, 'stream_ended', false),
        getPreviousConnectState: accountId =>
          useLiveControlStore.getState().contexts[accountId]?.connectState,
        setConnectState,
        showConnectedToast: accountId => {
          toast.success({
            title: '连接成功',
            description: '已成功连接到直播控制台',
            dedupeKey: `live-control-connected:${accountId}`,
            duration: 2500,
            priority: 2,
          })
        },
      },
    })
  })

  useIpcListener(IPC_CHANNELS.tasks.liveControl.notifyAccountName, params => {
    if (!params.ok) {
      console.warn('[conn][event] notifyAccountName 返回失败')
      return
    }

    setAccountName(params.accountId, params.accountName)
  })
}

function useChromeIpcSync() {
  const setStorageState = useChromeConfigStore(s => s.setStorageState)

  useIpcListener(IPC_CHANNELS.chrome.saveState, (id, state) => {
    setStorageState(id, state)
  })
}

function useUpdateIpcSync() {
  const enableAutoCheckUpdate = useUpdateConfigStore(s => s.enableAutoCheckUpdate)
  const { toast } = useToast()
  const handleUpdate = useUpdateStore.use.handleUpdate()
  const handleCheckResult = useUpdateStore.use.handleCheckResult()

  useIpcListener(IPC_CHANNELS.updater.updateAvailable, info => {
    handleCheckResult(info)
  })

  useIpcListener(IPC_CHANNELS.app.notifyUpdate, info => {
    if (enableAutoCheckUpdate) {
      toast.info({
        title: `发现新版本 v${info.latestVersion}`,
        description: '已在后台完成检查，点击查看更新内容后再决定是否下载。',
        duration: 8000,
        dedupeKey: `app-update-notify:${info.latestVersion}`,
        priority: 2,
        action: createElement(
          Button,
          {
            size: 'sm',
            variant: 'outline',
            onClick: () => {
              handleUpdate(info)
            },
          },
          '查看更新',
        ),
      })
    }
  })
}
