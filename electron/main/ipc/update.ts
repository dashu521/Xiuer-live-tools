import { ipcMain } from 'electron'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { createLogger } from '#/logger'
import { updateManager } from '#/managers/UpdateManager'

const logger = createLogger('update-ipc')

export function setupUpdateIpcHandlers() {
  // 检查更新
  ipcMain.handle(IPC_CHANNELS.updater.checkUpdate, async () => {
    logger.info('IPC: checkUpdate called')
    return await updateManager.checkUpdateVersion()
  })

  // 开始下载更新
  ipcMain.handle(IPC_CHANNELS.updater.startDownload, async () => {
    logger.info('IPC: startDownload called')
    await updateManager.startDownload()
  })

  // 退出并安装更新
  ipcMain.handle(IPC_CHANNELS.updater.quitAndInstall, async () => {
    logger.info('IPC: quitAndInstall called')
    await updateManager.quitAndInstall()
  })

  // 获取更新状态（供前端查询）
  ipcMain.handle('update:getStatus', async () => {
    return {
      platform: process.platform,
      canUpdate: process.platform === 'win32' || process.platform === 'darwin',
    }
  })
}
