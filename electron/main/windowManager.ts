// utils/windowManager.js
import type { BrowserWindow } from 'electron'
import { isAppQuitting } from './logger'
import { taskRuntimeMonitor } from './services/TaskRuntimeMonitor'

class WindowManager {
  private mainWindow?: BrowserWindow
  private readonly debugIpc = process.env.LOG_LEVEL === 'debug'

  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win

    // 自动清理引用
    win.on('closed', () => {
      this.mainWindow = undefined
    })
  }

  send(channel: string, ...args: any[]): boolean {
    const sendTime = Date.now()

    // 记录发送到监控
    const accountId = args[0] || 'unknown'
    taskRuntimeMonitor.logEventCustom('IPC_SEND', accountId, {
      channel: String(channel),
      sendTime,
      args: args.length > 1 ? `${args.length} args` : args[0],
    })

    // 应用退出时不发送任何消息，避免 "Object has been destroyed" 错误
    if (isAppQuitting) {
      taskRuntimeMonitor.logEventCustom('IPC_SEND_SKIPPED', accountId, { reason: 'app quitting' })
      return false
    }

    // 严格检查：窗口存在、未销毁、webContents 存在且未销毁
    if (
      this.mainWindow &&
      !this.mainWindow.isDestroyed() &&
      this.mainWindow.webContents &&
      !this.mainWindow.webContents.isDestroyed()
    ) {
      try {
        if (this.debugIpc) {
          console.log(`[windowManager][send] ${String(channel)}`, ...args)
        }
        this.mainWindow.webContents.send(channel, ...args)
        taskRuntimeMonitor.logEventCustom('IPC_SEND_SUCCESS', accountId, {
          channel: String(channel),
          sendTime,
          latencyMs: Date.now() - sendTime,
        })
        return true
      } catch (error) {
        // 捕获 "Object has been destroyed" 错误
        if (error instanceof Error && error.message.includes('destroyed')) {
          console.warn(`[windowManager][send] ERROR: window destroyed, channel: ${String(channel)}`)
          taskRuntimeMonitor.logEventCustom('IPC_SEND_ERROR', accountId, {
            channel: String(channel),
            error: 'window destroyed',
          })
          this.mainWindow = undefined
        } else {
          // 忽略其他错误，避免在退出时引发新的错误
          if (!isAppQuitting) {
            console.error(`[windowManager][send] ERROR: ${String(channel)}:`, error)
            taskRuntimeMonitor.logEventCustom('IPC_SEND_ERROR', accountId, {
              channel: String(channel),
              error: String(error),
            })
          }
        }
      }
    } else {
      console.warn(`[windowManager][send] SKIP: window not available, channel: ${String(channel)}`)
      taskRuntimeMonitor.logEventCustom('IPC_SEND_SKIPPED', accountId, {
        reason: 'window not available',
      })
    }
    return false
  }
}

export default new WindowManager()
