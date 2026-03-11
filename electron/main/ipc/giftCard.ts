/**
 * 礼品卡 IPC handlers — 已迁移到云端 API (auth-api)。
 * 前端现通过 apiClient 直连 /gift-card/redeem 等接口，IPC 通道仅保留空壳防止旧调用报错。
 */
import { ipcMain } from 'electron'

export function setupGiftCardIpcHandlers() {
  ipcMain.handle('gift-card:redeem', async () => {
    return {
      success: false,
      error: 'DEPRECATED',
      message: '请使用新版本兑换，礼品卡已迁移至云端',
    }
  })

  ipcMain.handle('gift-card:getHistory', async () => {
    return { success: false, error: 'DEPRECATED', message: '请使用新版本' }
  })

  ipcMain.handle('gift-card:admin:create', async () => {
    return { success: false, error: 'DEPRECATED', message: '请前往管理后台操作' }
  })

  ipcMain.handle('gift-card:admin:list', async () => {
    return { success: false, error: 'DEPRECATED', message: '请前往管理后台操作' }
  })

  ipcMain.handle('gift-card:admin:disable', async () => {
    return { success: false, error: 'DEPRECATED', message: '请前往管理后台操作' }
  })

  ipcMain.handle('gift-card:admin:stats', async () => {
    return { success: false, error: 'DEPRECATED', message: '请前往管理后台操作' }
  })
}
