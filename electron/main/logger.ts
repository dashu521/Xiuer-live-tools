import * as path from 'node:path'
import { app } from 'electron'
import electronLog, { type FormatParams, type LogFunctions } from 'electron-log'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import windowManager from './windowManager'

// 全局退出标志，由 app.ts 在 before-quit 时设置
export let isAppQuitting = false
export function setAppQuitting(value: boolean) {
  isAppQuitting = value
}

const appRoot = path.join(app.getAppPath(), path.sep)
const cleanPathRegex = new RegExp(appRoot.replace(/\\/g, '\\\\').replace(/\//g, '[\\\\/]'), 'gi')

function cleanStack(stack?: string) {
  if (!stack) return stack
  return stack.replace(cleanPathRegex, `APP:${path.sep}`)
}

function formatLogData(data: FormatParams['data'], _level: FormatParams['level']) {
  function errorMessage(item: Error) {
    return `${item.message}\n${cleanStack(item.stack)}${item.cause ? `\nCaused by: ${item.cause}` : ''}`
  }
  return data.map(item => (item instanceof Error ? errorMessage(item) : item)).join(' ')
}

// [2025-02-11 07:30:03.037] [中控台] » INFO         启动中……
electronLog.transports.console.format = ({ data, level, message }) => {
  // TODO: error 有可能是：message + Error 的形式，如果带有 Error，要记录堆栈信息
  const text = formatLogData(data, level)
  // 不放 hooks 里了，这样少一次 format 计算
  // 应用退出时不发送日志到渲染进程，避免 "Object has been destroyed" 错误
  if (level !== 'verbose' && level !== 'debug' && !isAppQuitting) {
    try {
      // 双重检查：确保窗口管理器可以发送消息
      windowManager.send(IPC_CHANNELS.log, { ...message, data: [text] })
    } catch (error) {
      // 忽略发送失败，避免崩溃
      // 在退出时捕获任何可能的 "Object has been destroyed" 错误
      if (!(error instanceof Error && error.message.includes('destroyed'))) {
        console.warn('[logger] Failed to send log to renderer:', error)
      }
    }
  }
  return [
    `[${message.date.toLocaleString()}]`,
    message.scope ? `[${message.scope}]` : '',
    '»',
    `${level.toUpperCase()}`,
    `\t${text}`,
  ]
}
electronLog.transports.file.format = ({ data, level, message }) => {
  const text = formatLogData(data, level)
  return [
    `[${message.date.toISOString().replace('T', ' ').slice(0, -1)}]`,
    `[${level.toUpperCase()}]`,
    message.scope ? `[${message.scope}]` : '',
    `\t${text}`,
  ]
}
electronLog.scope.labelPadding = false
electronLog.addLevel('success', 3)

export interface ScopedLogger extends LogFunctions {
  scope(name: string): ScopedLogger
}

export function createLogger(name: string): ScopedLogger {
  const logger = electronLog.scope(name)
  return {
    scope(scopeName: string) {
      const newScopeName = `${name} -> ${scopeName}`
      return createLogger(newScopeName)
    },
    ...logger,
  }
}

export default electronLog
