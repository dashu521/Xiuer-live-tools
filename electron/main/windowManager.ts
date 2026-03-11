// utils/windowManager.js
import type { BrowserWindow } from 'electron'
import type { IpcChannels } from 'shared/electron-api'

class WindowManager {
  private mainWindow?: BrowserWindow

  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win

    // 自动清理引用
    win.on('closed', () => {
      this.mainWindow = undefined
    })
  }

  send<Channel extends keyof IpcChannels>(
    channel: Channel | (string & {}),
    ...args: Parameters<IpcChannels[keyof IpcChannels]>
  ): boolean {
    // 严格检查：窗口存在、未销毁、webContents 存在且未销毁
    if (
      this.mainWindow &&
      !this.mainWindow.isDestroyed() &&
      this.mainWindow.webContents &&
      !this.mainWindow.webContents.isDestroyed()
    ) {
      try {
        this.mainWindow.webContents.send(channel, ...args)
        return true
      } catch (error) {
        // 捕获 "Object has been destroyed" 错误
        if (error instanceof Error && error.message.includes('destroyed')) {
          console.warn('[windowManager] 窗口已销毁，无法发送消息:', channel)
          this.mainWindow = undefined
        } else {
          console.error('[windowManager] send 失败:', error)
        }
      }
    }
    return false
  }
}

export default new WindowManager()
