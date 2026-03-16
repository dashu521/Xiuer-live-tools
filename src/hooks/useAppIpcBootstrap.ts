import { useEffect } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import type { StreamStatus } from 'shared/streamStatus'
import { useAccounts } from '@/hooks/useAccounts'
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

export function useAppIpcBootstrap() {
  useCommentIpcSync()
  useTaskEventIpcSync()
  useLiveControlIpcSync()
  useChromeIpcSync()
  useUpdateIpcSync()
}

function useCommentIpcSync() {
  const { handleComment } = useAutoReply()

  useIpcListener(IPC_CHANNELS.tasks.commentListener.showComment, ({ comment, accountId }) => {
    handleComment(comment, accountId)
  })
}

function useTaskEventIpcSync() {
  const accounts = useAccounts(s => s.accounts)
  const setIsListening = useAutoReplyStore(s => s.setIsListening)
  const setIsRunningAutoReply = useAutoReplyStore(s => s.setIsRunning)
  const setIsRunningAutoMessage = useAutoMessageStore(s => s.setIsRunning)
  const setIsRunningAutoPopUp = useAutoPopUpStore(s => s.setIsRunning)
  const setLiveStatsListening = useLiveStatsStore(s => s.setListening)

  useIpcListener(IPC_CHANNELS.tasks.autoMessage.stoppedEvent, id => {
    setIsRunningAutoMessage(id, false)
    taskManager.syncStatus('autoSpeak', 'stopped', id)
    console.log(`[TaskGate] Auto message stopped event for account ${id}`)
  })

  useIpcListener(IPC_CHANNELS.tasks.autoPopUp.stoppedEvent, id => {
    setIsRunningAutoPopUp(id, false)
    taskManager.syncStatus('autoPopup', 'stopped', id)
    console.log(`[TaskGate] Auto popup stopped event for account ${id}`)
  })

  useIpcListener(IPC_CHANNELS.tasks.commentListener.stopped, id => {
    markCommentListenerStopped(id)
    setIsListening(id, 'stopped')
    setIsRunningAutoReply(id, false)
    setLiveStatsListening(id, false)
    taskManager.syncStatus('autoReply', 'stopped', id)
    console.log(`[TaskGate] Auto reply listener stopped event for account ${id}`)
  })

  useEffect(() => {
    if (!window.ipcRenderer?.on) return

    const cleanupFns: Array<() => void> = []

    for (const account of accounts) {
      cleanupFns.push(
        window.ipcRenderer.on(
          IPC_CHANNELS.tasks.autoMessage.stoppedFor(
            account.id,
          ) as `tasks:autoMessage:stopped:${string}`,
          (id: string) => {
            setIsRunningAutoMessage(id, false)
            taskManager.syncStatus('autoSpeak', 'stopped', id)
            console.log(`[TaskGate] Auto message stopped(scoped) for account ${id}`)
          },
        ),
      )

      cleanupFns.push(
        window.ipcRenderer.on(
          IPC_CHANNELS.tasks.autoPopUp.stoppedFor(
            account.id,
          ) as `tasks:autoPopUp:stopped:${string}`,
          (id: string) => {
            setIsRunningAutoPopUp(id, false)
            taskManager.syncStatus('autoPopup', 'stopped', id)
            console.log(`[TaskGate] Auto popup stopped(scoped) for account ${id}`)
          },
        ),
      )

      cleanupFns.push(
        window.ipcRenderer.on(
          IPC_CHANNELS.tasks.commentListener.stoppedFor(
            account.id,
          ) as `tasks:commentListener:stopped:${string}`,
          (id: string) => {
            markCommentListenerStopped(id)
            setIsListening(id, 'stopped')
            setIsRunningAutoReply(id, false)
            setLiveStatsListening(id, false)
            taskManager.syncStatus('autoReply', 'stopped', id)
            console.log(`[TaskGate] Auto reply listener stopped(scoped) for account ${id}`)
          },
        ),
      )
    }

    return () => {
      for (const cleanup of cleanupFns) {
        cleanup()
      }
    }
  }, [
    accounts,
    setIsListening,
    setIsRunningAutoReply,
    setIsRunningAutoMessage,
    setIsRunningAutoPopUp,
    setLiveStatsListening,
  ])
}

function useLiveControlIpcSync() {
  const { setConnectState, setAccountName, setStreamState } = useLiveControlStore()
  const { toast } = useToast()

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

    const currentStatus = useLiveControlStore.getState().contexts[id]?.connectState
    if (currentStatus?.phase === 'waiting_for_login' && !isFatalDisconnect) {
      console.log(`[renderer][${id}][event] ⏭️ 忽略 disconnectedEvent：用户正在登录中（非致命断开）`)
      return
    }

    setConnectState(id, {
      status: 'disconnected',
      phase: 'idle',
      error: reason || '直播中控台已断开连接',
    })

    if (reason && !reasonStr.includes('用户主动断开')) {
      toast.error({
        title: '连接已断开',
        description: getFriendlyErrorMessage(reason),
        dedupeKey: `live-control-disconnected:${id}`,
      })
    }

    await stopAllLiveTasks(id, 'disconnected', false)
    console.log(`[renderer][${id}] ==============================================`)
  })

  useIpcListener(IPC_CHANNELS.tasks.liveControl.notifyAccountName, params => {
    if (!params.ok) {
      console.warn('[conn][event] notifyAccountName 返回失败')
      return
    }

    const prevContext = useLiveControlStore.getState().contexts[params.accountId]
    const shouldToastConnected =
      prevContext?.connectState.status !== 'connected' ||
      prevContext?.connectState.phase !== 'streaming'

    setAccountName(params.accountId, params.accountName)
    setConnectState(params.accountId, {
      status: 'connected',
      phase: 'streaming',
      error: null,
      lastVerifiedAt: Date.now(),
    })
    if (shouldToastConnected) {
      toast.success({
        description: '已成功连接到直播控制台',
        dedupeKey: `live-control-connected:${params.accountId}`,
      })
    }
  })

  useIpcListener(
    IPC_CHANNELS.tasks.liveControl.streamStateChanged,
    async (accountId: string, streamState: StreamStatus) => {
      const prevState = useLiveControlStore.getState().contexts[accountId]?.streamState
      setStreamState(accountId, streamState)

      if (prevState === 'live' && streamState !== 'live') {
        await stopAllLiveTasks(accountId, 'stream_ended', false)
      }
    },
  )
}

function useChromeIpcSync() {
  const setStorageState = useChromeConfigStore(s => s.setStorageState)

  useIpcListener(IPC_CHANNELS.chrome.saveState, (id, state) => {
    setStorageState(id, state)
  })
}

function useUpdateIpcSync() {
  const enableAutoCheckUpdate = useUpdateConfigStore(s => s.enableAutoCheckUpdate)
  const handleUpdate = useUpdateStore.use.handleUpdate()
  const handleCheckResult = useUpdateStore.use.handleCheckResult()

  useIpcListener(IPC_CHANNELS.updater.updateAvailable, info => {
    handleCheckResult(info)
  })

  useIpcListener(IPC_CHANNELS.app.notifyUpdate, info => {
    if (enableAutoCheckUpdate) {
      handleUpdate(info)
    }
  })
}
