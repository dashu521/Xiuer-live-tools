const COMMENT_LISTENER_CHANNELS = {
  start: 'tasks:commentListener:start',
  stop: 'tasks:commentListener:stop',
  stopped: 'tasks:commentListener:stopped',
  stoppedFor: (accountId: string) => `tasks:commentListener:stopped:${accountId}`,
  showComment: 'tasks:commentListener:showComment',
} as const

export const IPC_CHANNELS = {
  auth: {
    register: 'auth:register',
    login: 'auth:login',
    loginWithSms: 'auth:loginWithSms',
    logout: 'auth:logout',
    validateToken: 'auth:validateToken',
    getCurrentUser: 'auth:getCurrentUser',
    restoreSession: 'auth:restoreSession',
    refreshSession: 'auth:refreshSession',
    getAuthSummary: 'auth:getAuthSummary',
    proxyRequest: 'auth:proxyRequest',
    getTokenInternal: 'auth:getTokenInternal',
    clearTokens: 'auth:clearTokens',
    checkFeatureAccess: 'auth:checkFeatureAccess',
    updateUserProfile: 'auth:updateUserProfile',
    changePassword: 'auth:changePassword',
    stateChanged: 'auth:stateChanged',
    loginRequired: 'auth:loginRequired',
  },
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
      /** 【P0-2 断线自动重连】重连成功事件 */
      reconnectedEvent: 'tasks:liveControl:reconnectedEvent',
      /** 【P0-2 断线自动重连】重连失败事件 */
      reconnectFailedEvent: 'tasks:liveControl:reconnectFailedEvent',
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
    commentListener: {
      start: COMMENT_LISTENER_CHANNELS.start,
      stop: COMMENT_LISTENER_CHANNELS.stop,
      /** @deprecated 使用 stoppedFor(accountId) 替代 */
      stopped: COMMENT_LISTENER_CHANNELS.stopped,
      /** 账号隔离的监听器停止事件 */
      stoppedFor: COMMENT_LISTENER_CHANNELS.stoppedFor,
      showComment: COMMENT_LISTENER_CHANNELS.showComment,
    },
    autoReply: {
      /** @deprecated 使用 tasks.commentListener.start 替代 */
      startCommentListener: COMMENT_LISTENER_CHANNELS.start,
      /** @deprecated 使用 tasks.commentListener.stop 替代 */
      stopCommentListener: COMMENT_LISTENER_CHANNELS.stop,
      /** @deprecated 使用 tasks.commentListener.stopped 替代 */
      listenerStopped: COMMENT_LISTENER_CHANNELS.stopped,
      /** @deprecated 使用 tasks.commentListener.stoppedFor(accountId) 替代 */
      listenerStoppedFor: COMMENT_LISTENER_CHANNELS.stoppedFor,
      /** @deprecated 使用 tasks.commentListener.showComment 替代 */
      showComment: COMMENT_LISTENER_CHANNELS.showComment,
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
      enterAllLiveRooms: 'tasks:subAccount:enterAllLiveRooms',
      enterAllProgress: 'tasks:subAccount:enterAllProgress',
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
