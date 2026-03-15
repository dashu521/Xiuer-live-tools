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

// [LOG-LEVEL] 日志级别控制
// 生产环境默认不输出 debug 级日志
const LOG_LEVEL = process.env.LOG_LEVEL || (app.isPackaged ? 'info' : 'debug')
const isDebugEnabled = LOG_LEVEL === 'debug' || LOG_LEVEL === 'verbose'

// [SECURITY] 敏感信息脱敏配置
const SENSITIVE_PATTERNS = [
  // token / password / code / secret / key
  { pattern: /token[=:]\s*["']?[a-zA-Z0-9_\-.]+["']?/gi, replacement: 'token=***' },
  { pattern: /password[=:]\s*["']?[^"'\s]+["']?/gi, replacement: 'password=***' },
  { pattern: /code[=:]\s*["']?\d{4,8}["']?/gi, replacement: 'code=***' },
  { pattern: /secret[=:]\s*["']?[^"'\s]+["']?/gi, replacement: 'secret=***' },
  { pattern: /key[=:]\s*["']?[a-zA-Z0-9]{16,}["']?/gi, replacement: 'key=***' },
  // Authorization header
  {
    pattern: /authorization[:\s]+["']?bearer\s+[a-zA-Z0-9_\-.]+["']?/gi,
    replacement: 'authorization: Bearer ***',
  },
  // cookie with session
  { pattern: /cookie[:\s]+.*?session[^;]*/gi, replacement: 'cookie: session=***' },
  // URL with query params containing sensitive data
  { pattern: /([?&])(token|password|code|secret|key)=[^&]*/gi, replacement: '$1$2=***' },
]

/**
 * [SECURITY] 敏感信息脱敏处理
 * 对日志内容进行脱敏，防止敏感信息泄露
 */
function sanitizeLogData(data: unknown[]): unknown[] {
  return data.map(item => {
    if (typeof item === 'string') {
      let sanitized = item
      for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
        sanitized = sanitized.replace(pattern, replacement)
      }
      return sanitized
    }
    // 对于对象，转换为字符串后脱敏
    if (item && typeof item === 'object') {
      try {
        const str = JSON.stringify(item)
        let sanitized = str
        for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
          sanitized = sanitized.replace(pattern, replacement)
        }
        return sanitized
      } catch {
        return item
      }
    }
    return item
  })
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

// [LOG-LEVEL] 根据环境控制 debug 日志输出
// 生产环境默认不输出 debug 级日志到文件和控制台
if (!isDebugEnabled) {
  electronLog.transports.file.level = 'info'
  electronLog.transports.console.level = 'info'
}

// [2025-02-11 07:30:03.037] [中控台] » INFO         启动中……
electronLog.transports.console.format = ({ data, level, message }) => {
  // [SECURITY] 脱敏处理
  const sanitizedData = sanitizeLogData(data)
  const text = formatLogData(sanitizedData, level)

  // [LOG-LEVEL] debug/verbose 日志不发送到 UI
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
  // [SECURITY] 脱敏处理
  const sanitizedData = sanitizeLogData(data)
  const text = formatLogData(sanitizedData, level)
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
