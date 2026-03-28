import { app, ipcMain } from 'electron'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { createLogger, isAppQuitting } from '#/logger'
import { enhancedUpdateManager } from '#/managers/EnhancedUpdateManager'
import { rollbackManager } from '#/managers/RollbackManager'

const logger = createLogger('update-ipc')
const DEFAULT_UPDATE_SOURCE = 'official'

export function setupUpdateIpcHandlers() {
  // 检查更新
  ipcMain.handle(IPC_CHANNELS.updater.checkUpdate, async (_, source?: string) => {
    if (isAppQuitting) {
      logger.warn('IPC: checkUpdate called during app quitting, ignored')
      return { error: '应用正在退出' }
    }
    logger.info('IPC: checkUpdate called', { source: source || DEFAULT_UPDATE_SOURCE })
    return await enhancedUpdateManager.checkUpdateVersion(source || DEFAULT_UPDATE_SOURCE)
  })

  // 开始下载更新
  ipcMain.handle(IPC_CHANNELS.updater.startDownload, async () => {
    if (isAppQuitting) {
      logger.warn('IPC: startDownload called during app quitting, ignored')
      return { error: '应用正在退出' }
    }
    logger.info('IPC: startDownload called')
    await enhancedUpdateManager.startDownload()
  })

  ipcMain.handle(IPC_CHANNELS.updater.listBackups, async () => {
    logger.info('IPC: listBackups called')
    if (!rollbackManager.isOperational()) {
      return []
    }
    const backups = await enhancedUpdateManager.listBackups()
    return backups.map(backup => ({
      id: backup.id,
      version: backup.version,
      timestamp: backup.timestamp,
      size: backup.size,
    }))
  })

  ipcMain.handle(IPC_CHANNELS.updater.rollback, async (_, targetVersion?: string) => {
    if (isAppQuitting) {
      logger.warn('IPC: rollback called during app quitting, ignored')
      return { success: false, error: '应用正在退出' }
    }
    if (!rollbackManager.isOperational()) {
      return { success: false, error: '当前运行环境不支持回滚' }
    }
    logger.info('IPC: rollback called', { targetVersion: targetVersion || 'latest' })
    try {
      const success = await enhancedUpdateManager.rollback(targetVersion)
      return success ? { success: true } : { success: false, error: '回滚失败' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '回滚失败',
      }
    }
  })

  // 退出并安装更新
  ipcMain.handle(IPC_CHANNELS.updater.quitAndInstall, async () => {
    if (isAppQuitting) {
      logger.warn('IPC: quitAndInstall called during app quitting, ignored')
      return { error: '应用正在退出' }
    }
    logger.info('IPC: quitAndInstall called')
    await enhancedUpdateManager.quitAndInstall()
  })

  // 获取更新状态（供前端查询）
  ipcMain.handle(IPC_CHANNELS.updater.getStatus, async () => {
    const packagedCanUpdate =
      (process.platform === 'win32' || process.platform === 'darwin') && app.isPackaged
    const backupCapabilities = rollbackManager.isOperational()

    return {
      platform: process.platform,
      canUpdate: packagedCanUpdate,
      capabilities: {
        checkUpdate: packagedCanUpdate,
        startDownload: packagedCanUpdate,
        quitAndInstall: packagedCanUpdate,
        pauseDownload: false,
        resumeDownload: false,
        cancelDownload: false,
        rollback: backupCapabilities,
        listBackups: backupCapabilities,
      },
    }
  })
}
