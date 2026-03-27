import { useMemoizedFn } from 'ahooks'
import type { LogMessage } from 'electron-log'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { useIpcListener } from '@/hooks/useIpc'
import { cn } from '@/lib/utils'

interface ParsedLog {
  id: string
  timestamp: string
  module: string
  level: string
  message: string
}

// interface LogMessage {
//   logId: string
//   date: Date
//   scope?: string
//   level: string
//   data: string[]
// }

const MAX_LOG_MESSAGES = 200 // 仅展示最近的 200 条日志

// [SECURITY] 敏感信息脱敏配置
const SENSITIVE_PATTERNS = [
  { pattern: /token[=:]\s*["']?[a-zA-Z0-9_\-.]+["']?/gi, replacement: 'token=***' },
  {
    pattern:
      /"(access_token|refresh_token|token|password|old_password|new_password|code|secret|key)"\s*:\s*"[^"]+"/gi,
    replacement: '"$1":"***"',
  },
  { pattern: /password[=:]\s*["']?[^"'\s]+["']?/gi, replacement: 'password=***' },
  { pattern: /code[=:]\s*["']?\d{4,8}["']?/gi, replacement: 'code=***' },
  { pattern: /secret[=:]\s*["']?[^"'\s]+["']?/gi, replacement: 'secret=***' },
  { pattern: /key[=:]\s*["']?[a-zA-Z0-9]{16,}["']?/gi, replacement: 'key=***' },
  {
    pattern: /authorization[:\s]+["']?bearer\s+[a-zA-Z0-9_\-.]+["']?/gi,
    replacement: 'authorization: Bearer ***',
  },
  {
    pattern: /([?&])(token|password|old_password|new_password|code|secret|key)=[^&]*/gi,
    replacement: '$1$2=***',
  },
]

/**
 * [SECURITY] 敏感信息脱敏处理
 */
function sanitizeLogMessage(message: string): string {
  let sanitized = message
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement)
  }
  return sanitized
}

export default function LogDisplayer({
  collapsed = true,
  onToggleCollapsed,
}: {
  collapsed?: boolean
  onToggleCollapsed?: () => void
}) {
  const [logMessages, setLogMessages] = useState<ParsedLog[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    if (viewportRef.current && autoScroll) {
      const scrollContainer = viewportRef.current
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      })
    }
  }, [autoScroll])

  const parseLogMessage = (log: LogMessage): ParsedLog | null => {
    if (!log.data || log.data.length === 0) {
      return null
    }
    const rawMessage = log.data.map(String).join(' ').split('\n')[0]
    // [SECURITY] 脱敏处理
    const sanitizedMessage = sanitizeLogMessage(rawMessage)
    return {
      id: crypto.randomUUID(),
      timestamp: log.date.toLocaleString(),
      module: log.scope ?? 'App',
      level: typeof log.level === 'string' ? log.level.toUpperCase() : 'INFO',
      // [SECURITY] 脱敏后的消息
      message: sanitizedMessage,
    }
  }

  useEffect(() => {
    // 监听 ScrollArea 的 viewport 元素
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector<HTMLDivElement>(
        '[data-radix-scroll-area-viewport]',
      )
      if (viewport) {
        // 使用 MutableRefObject 来避免只读属性错误
        viewportRef.current = viewport
      }
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: parseLogMessage 不影响
  const handleLogMessage = useCallback(
    (message: LogMessage) => {
      const parsed = parseLogMessage(message)
      if (parsed) {
        setLogMessages(prev => [...prev.slice(-MAX_LOG_MESSAGES + 1), parsed])
        if (autoScroll) {
          scrollToBottom()
        }
      }
    },
    [autoScroll, scrollToBottom],
  )

  useIpcListener(IPC_CHANNELS.log, handleLogMessage)

  const autoScrollId = useId()

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 日志头部 */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">运行日志</h3>
          <span className="text-xs text-muted-foreground">{logMessages.length} 条记录</span>
        </div>
        <div className="flex items-center gap-4">
          {/* 自动滚动开关 */}
          <div className="flex items-center gap-2">
            <Switch id={autoScrollId} checked={autoScroll} onCheckedChange={setAutoScroll} />
            <label
              htmlFor={autoScrollId}
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              自动滚动
            </label>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapsed}
            className="h-7 px-2 text-muted-foreground"
            title={collapsed ? '展开日志' : '收起日志'}
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            variant="subtle"
            size="sm"
            onClick={() => {
              setLogMessages([])
              scrollToBottom()
            }}
            className="text-xs h-7 px-2 text-muted-foreground"
          >
            清空
          </Button>
        </div>
      </div>

      {/* 日志内容 */}
      {!collapsed && (
        <ScrollArea ref={scrollAreaRef} className="flex-1">
          <div className="p-4 font-mono text-sm">
            {logMessages.map((log, index) => (
              <LogItem key={log.id} log={log} index={index} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

function LogItem({ log, index }: { log: ParsedLog; index: number }) {
  const getLevelColor = useMemoizedFn((level: string): string => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return 'text-destructive font-medium'
      case 'FATAL':
        return 'text-destructive font-bold'
      case 'WARN':
        return 'text-warning font-medium'
      case 'DEBUG':
        return 'text-sky-300'
      case 'INFO':
        return 'text-muted-foreground'
      case 'SUCCESS':
        return 'text-emerald-300'
      case 'NOTE':
        return 'text-violet-300'
      default:
        return 'text-muted-foreground'
    }
  })
  return (
    <div
      key={log.id}
      className={cn(
        'flex gap-2 items-start py-1 whitespace-nowrap',
        index % 2 === 0 ? 'bg-muted/40' : 'bg-background',
      )}
    >
      <span className="text-muted-foreground shrink-0">[{log.timestamp}]</span>
      <span className="text-foreground/70 shrink-0">[{log.module}]</span>
      <span className={cn('shrink-0', getLevelColor(log.level))}>{log.level}</span>
      <span className="text-foreground truncate">{log.message}</span>
    </div>
  )
}
