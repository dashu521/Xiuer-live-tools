export const IPC_CHANNELS = {
  diagnostics: {
    getRuntimeStats: 'diagnostics:getRuntimeStats',
    getAccountTasks: 'diagnostics:getAccountTasks',
    getTimeline: 'diagnostics:getTimeline',
    printSummary: 'diagnostics:printSummary',
    reset: 'diagnostics:reset',
  },
  tasks: {
    liveControl: {
      connect: 'tasks:liveControl:connect',
      notifyAccountName: 'tasks:liveControl:notifyAccountName',
      disconnect: 'tasks:liveControl:disconnect',
      disconnectedEvent: 'tasks:liveControl:disconnectedEvent',
      streamStateChanged: 'tasks:liveControl:streamStateChanged',
      getLiveRoomUrl: 'tasks:liveControl:getLiveRoomUrl',
    },
    autoMessage: {
      start: 'tasks:autoMessage:start',
      stop: 'tasks:autoMessage:stop',
      /** @deprecated 使用 stoppedFor(accountId) 替代 */
      stoppedEvent: 'tasks:autoMessage:stoppedEvent',
      /** 账号隔离的停止事件 */
      stoppedFor: (accountId: string) => `tasks:autoMessage:stopped:${accountId}`,
      updateConfig: 'tasks:autoMessage:updateConfig',
      sendBatchMessages: 'tasks:autoMessage:sendBatchMessages',
    },
    autoPopUp: {
      start: 'tasks:autoPopUp:start',
      stop: 'tasks:autoPopUp:stop',
      updateConfig: 'tasks:autoPopUp:updateConfig',
      /** @deprecated 使用 stoppedFor(accountId) 替代 */
      stoppedEvent: 'tasks:autoPopUp:stoppedEvent',
      /** 账号隔离的停止事件 */
      stoppedFor: (accountId: string) => `tasks:autoPopUp:stopped:${accountId}`,
      registerShortcuts: 'tasks:autoPopup:registerShortcut',
      unregisterShortcuts: 'tasks:autoPopup:unregisterShortcut',
    },
    aiChat: {
      chat: 'tasks:aiChat:chat',
      stream: 'tasks:aiChat:stream',
      error: 'tasks:aiChat:error',
      normalChat: 'tasks:aiChat:normalChat',
      testApiKey: 'tasks:aiChat:testApiKey',
    },
    autoReply: {
      startCommentListener: 'tasks:autoReply:startCommentListener',
      stopCommentListener: 'tasks:autoReply:stopCommentListener',
      /** @deprecated 使用 listenerStoppedFor(accountId) 替代 */
      listenerStopped: 'tasks:autoReply:listenerStopped',
      /** 账号隔离的监听器停止事件 */
      listenerStoppedFor: (accountId: string) => `tasks:autoReply:listenerStopped:${accountId}`,
      showComment: 'tasks:autoReply:showComment',
      startAutoReply: 'tasks:autoReply:startAutoReply',
      stopAutoReply: 'tasks:autoReply:stopAutoReply',
      replyGenerated: 'tasks:autoReply:replyGenerated',
      sendReply: 'tasks:autoReply:sendReply',
    },
    // 视频号上墙
    pinComment: 'tasks:pinComment',
    // 小号互动
    subAccount: {
      start: 'tasks:subAccount:start',
      stop: 'tasks:subAccount:stop',
      /** @deprecated 使用 stoppedFor(accountId) 替代 */
      stoppedEvent: 'tasks:subAccount:stoppedEvent',
      /** 账号隔离的停止事件 */
      stoppedFor: (accountId: string) => `tasks:subAccount:stopped:${accountId}`,
      updateConfig: 'tasks:subAccount:updateConfig',
      addAccount: 'tasks:subAccount:addAccount',
      removeAccount: 'tasks:subAccount:removeAccount',
      loginAccount: 'tasks:subAccount:loginAccount',
      disconnectAccount: 'tasks:subAccount:disconnectAccount',
      accountStatusChanged: 'tasks:subAccount:accountStatusChanged',
      sendBatch: 'tasks:subAccount:sendBatch',
      batchProgress: 'tasks:subAccount:batchProgress',
      checkHealth: 'tasks:subAccount:checkHealth',
      getAllAccounts: 'tasks:subAccount:getAllAccounts',
      clearStorageState: 'tasks:subAccount:clearStorageState',
      exportAccounts: 'tasks:subAccount:exportAccounts',
      importAccounts: 'tasks:subAccount:importAccounts',
      enterLiveRoom: 'tasks:subAccount:enterLiveRoom',
      syncAccounts: 'tasks:subAccount:syncAccounts',
    },
  },
  config: {
    save: 'config:save',
    load: 'config:load',
  },
  chrome: {
    getPath: 'chrome:getPath',
    setPath: 'chrome:setPath',
    selectPath: 'chrome:selectPath',
    toggleDevTools: 'chrome:toggleDevTools',
    saveState: 'chrome:saveState',
  },
  updater: {
    checkUpdate: 'updater:checkUpdate',
    updateAvailable: 'updater:updateAvailable',
    startDownload: 'updater:startDownload',
    downloadProgress: 'updater:downloadProgress',
    updateError: 'updater:updateError',
    updateDownloaded: 'updater:updateDownloaded',
    quitAndInstall: 'updater:quitAndInstall',
  },
  account: {
    switch: 'account:switch',
  },
  log: 'log',
  app: {
    openLogFolder: 'app:openLogFolder',
    notifyUpdate: 'app:notifyUpdate',
    openExternal: 'app:openExternal',
    hideToTrayTip: 'app:hideToTrayTip',
    setHideToTrayTipDismissed: 'app:setHideToTrayTipDismissed',
    getHideToTrayTipDismissed: 'app:getHideToTrayTipDismissed',
    clearLocalLoginData: 'app:clearLocalLoginData',
  },
  liveStats: {
    exportData: 'liveStats:exportData',
    openExportFolder: 'liveStats:openExportFolder',
  },
} as const
