import type { LogMessage } from 'electron-log'
import type { ProgressInfo, UpdateDownloadedEvent } from 'electron-updater'
import type { providers } from 'shared/providers'

import { IPC_CHANNELS } from './ipcChannels'

export interface IpcChannels {
  // LiveControl
  [IPC_CHANNELS.tasks.liveControl.connect]: (params: {
    chromePath?: string
    headless?: boolean
    storageState?: string
    platform: LiveControlPlatform
    account: Account
    traceId?: string
  }) => Promise<{
    success: boolean
    browserLaunched: boolean
    error?: string
    needsLogin?: boolean
  }>
  [IPC_CHANNELS.tasks.liveControl.disconnect]: (accountId: string) => boolean
  [IPC_CHANNELS.tasks.liveControl.disconnectedEvent]: (id: string, reason?: string) => void
  [IPC_CHANNELS.tasks.liveControl.notifyAccountName]: (
    params:
      | {
          ok: true
          accountId: string
          accountName: string | null
        }
      | { ok: false },
  ) => void
  [IPC_CHANNELS.tasks.liveControl.streamStateChanged]: (
    accountId: string,
    streamState: import('shared/streamStatus').StreamStatus,
  ) => void
  [IPC_CHANNELS.tasks.liveControl.getLiveRoomUrl]: (
    accountId: string,
  ) => Promise<{ success: boolean; url?: string; error?: string }>

  // AutoMessage
  [IPC_CHANNELS.tasks.autoMessage.start]: (accountId: string, config: AutoCommentConfig) => boolean
  [IPC_CHANNELS.tasks.autoMessage.stop]: (accountId: string) => boolean
  [IPC_CHANNELS.tasks.autoMessage.stoppedEvent]: (id: string) => void
  /** 账号隔离的停止事件 */
  [key: `tasks:autoMessage:stopped:${string}`]: (id: string) => void
  [IPC_CHANNELS.tasks.autoMessage.sendBatchMessages]: (
    accountId: string,
    messages: string[],
    count: number,
  ) => boolean
  [IPC_CHANNELS.tasks.autoMessage.updateConfig]: (
    accountId: string,
    config: Parital<AutoCommentConfig>,
  ) => void

  // AutoPopup
  [IPC_CHANNELS.tasks.autoPopUp.start]: (accountId: string, config: AutoPopupConfig) => boolean
  [IPC_CHANNELS.tasks.autoPopUp.stop]: (accountId: string) => boolean
  [IPC_CHANNELS.tasks.autoPopUp.stoppedEvent]: (id: string) => void
  /** 账号隔离的停止事件 */
  [key: `tasks:autoPopUp:stopped:${string}`]: (id: string) => void
  [IPC_CHANNELS.tasks.autoPopUp.updateConfig]: (
    accountId: string,
    config: Parital<AutoPopupConfig>,
  ) => void
  [IPC_CHANNELS.tasks.autoPopUp.registerShortcuts]: (
    accountId: string,
    shortcuts: { accelerator: string; goodsIds: number[] }[],
  ) => void
  [IPC_CHANNELS.tasks.autoPopUp.unregisterShortcuts]: () => void

  // AutoReply
  [IPC_CHANNELS.tasks.autoReply.startCommentListener]: (
    accountId: string,
    config: CommentListenerConfig,
  ) => boolean
  [IPC_CHANNELS.tasks.autoReply.stopCommentListener]: (accountId: string) => void
  [IPC_CHANNELS.tasks.autoReply.sendReply]: (accountId: string, replyContent: string) => void
  [IPC_CHANNELS.tasks.autoReply.listenerStopped]: (accountId: string) => void
  /** 账号隔离的监听器停止事件 */
  [key: `tasks:autoReply:listenerStopped:${string}`]: (accountId: string) => void
  [IPC_CHANNELS.tasks.autoReply.showComment]: (data: {
    comment: LiveMessage
    accountId: string
  }) => void

  // AIChat
  [IPC_CHANNELS.tasks.aiChat.normalChat]: (params: {
    messages: AIChatMessage[]
    provider: keyof typeof providers
    model: string
    apiKey: string
    customBaseURL?: string
  }) => string | null
  [IPC_CHANNELS.tasks.aiChat.testApiKey]: (params: {
    apiKey: string
    provider: keyof typeof providers
    customBaseURL?: string
  }) => { success: boolean; models?: string[]; error?: string }
  [IPC_CHANNELS.tasks.aiChat.chat]: (params: {
    messages: AIChatMessage[]
    provider: keyof typeof providers
    model: string
    apiKey: string
    customBaseURL?: string
  }) => void
  [IPC_CHANNELS.tasks.aiChat.stream]: (
    data:
      | {
          chunk: string
          type: 'content' | 'reasoning'
        }
      | { done: boolean },
  ) => void
  [IPC_CHANNELS.tasks.aiChat.error]: (data: { error: string }) => void

  // 视频号上墙
  [IPC_CHANNELS.tasks.pinComment]: (params: { accountId: string; content: string }) => void

  // 小号互动
  [IPC_CHANNELS.tasks.subAccount.start]: (
    accountId: string,
    config: SubAccountInteractionConfig,
  ) => boolean
  [IPC_CHANNELS.tasks.subAccount.stop]: (accountId: string) => boolean
  [IPC_CHANNELS.tasks.subAccount.stoppedEvent]: (accountId: string) => void
  /** 账号隔离的停止事件 */
  [key: `tasks:subAccount:stopped:${string}`]: (accountId: string) => void
  [IPC_CHANNELS.tasks.subAccount.updateConfig]: (
    accountId: string,
    config: Partial<SubAccountInteractionConfig>,
  ) => void
  [IPC_CHANNELS.tasks.subAccount.addAccount]: (
    accountId: string,
    subAccount: SubAccountConfig,
  ) => boolean
  [IPC_CHANNELS.tasks.subAccount.removeAccount]: (
    accountId: string,
    subAccountId: string,
  ) => boolean
  [IPC_CHANNELS.tasks.subAccount.loginAccount]: (
    accountId: string,
    subAccountId: string,
  ) => Promise<{
    success: boolean
    error?: string
    session?: {
      status: 'idle' | 'connecting' | 'connected' | 'error'
      error?: string
    }
  }>
  [IPC_CHANNELS.tasks.subAccount.disconnectAccount]: (
    accountId: string,
    subAccountId: string,
  ) => Promise<{ success: boolean }>
  [IPC_CHANNELS.tasks.subAccount.accountStatusChanged]: (
    accountId: string,
    data: {
      accountId: string
      accountName?: string
      message?: string
      status?: 'idle' | 'connecting' | 'connected' | 'error'
      error?: string
      timestamp: number
    },
  ) => void
  [IPC_CHANNELS.tasks.subAccount.sendBatch]: (
    accountId: string,
    count: number,
    messages?: { content: string; weight?: number }[],
  ) => Promise<{ success: boolean; error?: string }>
  [IPC_CHANNELS.tasks.subAccount.batchProgress]: (
    accountId: string,
    data: {
      current: number
      total: number
      completed: number
      failed: number
    },
  ) => void
  [IPC_CHANNELS.tasks.subAccount.checkHealth]: (
    accountId: string,
    subAccountId: string,
  ) => Promise<{ status: 'healthy' | 'warning' | 'error'; message?: string }>
  [IPC_CHANNELS.tasks.subAccount.enterLiveRoom]: (
    accountId: string,
    subAccountId: string,
    liveRoomUrl: string,
  ) => Promise<{ success: boolean; error?: string }>
  [IPC_CHANNELS.tasks.subAccount.getAllAccounts]: (accountId: string) => Array<{
    id: string
    name: string
    platform: LiveControlPlatform
    status: string
    error?: string
    stats: { totalSent: number; successCount: number; failCount: number }
    hasStorageState: boolean
    liveRoomUrl?: string
  }>
  [IPC_CHANNELS.tasks.subAccount.clearStorageState]: (
    accountId: string,
    subAccountId: string,
  ) => boolean
  [IPC_CHANNELS.tasks.subAccount.exportAccounts]: (accountId: string) => {
    success: boolean
    data?: string
  }
  [IPC_CHANNELS.tasks.subAccount.importAccounts]: (
    accountId: string,
    jsonData: string,
  ) => { success: boolean; added?: number; error?: string }
  [IPC_CHANNELS.tasks.subAccount.syncAccounts]: (
    accountId: string,
    accountConfigs: Array<{ id: string; name: string; platform: LiveControlPlatform }>,
  ) => { synced: number }

  // Updater
  [IPC_CHANNELS.updater.checkUpdate]: () => Promise<
    { latestVersion: string; currentVersion: string; releaseNote?: string } | undefined
  >
  [IPC_CHANNELS.updater.startDownload]: (source: string) => void
  [IPC_CHANNELS.updater.quitAndInstall]: () => void
  [IPC_CHANNELS.updater.updateAvailable]: (info: VersionInfo) => void
  [IPC_CHANNELS.updater.updateError]: (error: ErrorType) => void
  [IPC_CHANNELS.updater.downloadProgress]: (progress: ProgressInfo) => void
  [IPC_CHANNELS.updater.updateDownloaded]: (event?: UpdateDownloadedEvent) => void

  // Chrome
  [IPC_CHANNELS.chrome.selectPath]: () => string | null
  [IPC_CHANNELS.chrome.getPath]: (edge?: boolean) => string | null
  [IPC_CHANNELS.chrome.toggleDevTools]: () => void
  [IPC_CHANNELS.chrome.setPath]: (path: string) => void
  [IPC_CHANNELS.chrome.saveState]: (accountId: string, state: string) => void

  // App
  [IPC_CHANNELS.app.openLogFolder]: () => void
  [IPC_CHANNELS.app.openExternal]: (url: string) => void
  [IPC_CHANNELS.app.notifyUpdate]: (arg: {
    currentVersion: string
    latestVersion: string
    releaseNote?: string
  }) => void
  [IPC_CHANNELS.app.hideToTrayTip]: (arg: Record<string, never>) => void
  [IPC_CHANNELS.app.setHideToTrayTipDismissed]: (dismissed: boolean) => Promise<void>
  [IPC_CHANNELS.app.getHideToTrayTipDismissed]: () => Promise<boolean>
  [IPC_CHANNELS.app.clearLocalLoginData]: () => Promise<void>

  [IPC_CHANNELS.account.switch]: (params: { account: Account }) => void

  // Log
  [IPC_CHANNELS.log]: (message: LogMessage) => void

  // LiveStats
  [IPC_CHANNELS.liveStats.exportData]: (data: {
    accountName: string
    startTime: number | null
    endTime: number
    duration: number
    stats: {
      likeCount: number
      commentCount: number
      enterCount: number
      followCount: number
      fansClubCount: number
      orderCount: number
      paidOrderCount: number
      brandVipCount: number
    }
    danmuList: Array<{
      nickName: string
      content: string
      time: string
    }>
    fansClubChanges: Array<{
      id: string
      nickName: string
      userId?: string
      content?: string
      time: string
    }>
    events: Array<{
      id: string
      type: string
      nickName: string
      content?: string
      time: string
      extra?: Record<string, unknown>
    }>
  }) => Promise<{ success: boolean; filePath?: string; error?: string }>
  [IPC_CHANNELS.liveStats.openExportFolder]: () => void
}

export interface ElectronAPI {
  ipcRenderer: {
    invoke: <Channel extends keyof IpcChannels>(
      channel: Channel,
      ...args: Parameters<IpcChannels[Channel]>
    ) => ReturnType<IpcChannels[Channel]> extends Promise<infer _U>
      ? ReturnType<IpcChannels[Channel]>
      : Promise<ReturnType<IpcChannels[Channel]>>

    send: <Channel extends keyof IpcChannels>(
      channel: Channel,
      ...args: Parameters<IpcChannels[Channel]>
    ) => void

    on: <Channel extends keyof IpcChannels>(
      channel: Channel,
      listener: (...args: Parameters<IpcChannels[Channel]>) => void,
    ) => () => void
  }
}
