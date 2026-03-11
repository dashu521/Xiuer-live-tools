export interface QueuedMessage {
  id: string
  content: string
  accountId: string
  accountName: string
  priority: number
  attempts: number
  maxAttempts: number
  createdAt: number
  scheduledAt: number
}

export interface MessageQueueConfig {
  maxAttempts: number
  retryInterval: number
  retryBackoff: number
  maxQueueSize: number
  messageTTL: number
}

const DEFAULT_CONFIG: MessageQueueConfig = {
  maxAttempts: 3,
  retryInterval: 5000,
  retryBackoff: 2,
  maxQueueSize: 100,
  messageTTL: 5 * 60 * 1000,
}

export class MessageQueue {
  private queue: QueuedMessage[] = []
  private processing = false
  private config: MessageQueueConfig
  private wakeResolver: (() => void) | null = null
  private handlers: {
    onSend?: (message: QueuedMessage) => Promise<boolean>
    onSuccess?: (message: QueuedMessage) => void
    onFailed?: (message: QueuedMessage, error: Error) => void
    onDrop?: (message: QueuedMessage, reason: string) => void
  } = {}

  constructor(config: Partial<MessageQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  setHandlers(handlers: typeof this.handlers) {
    this.handlers = { ...this.handlers, ...handlers }
  }

  enqueue(
    content: string,
    accountId: string,
    accountName: string,
    priority = 0,
  ): QueuedMessage | null {
    if (this.queue.length >= this.config.maxQueueSize) {
      return null
    }

    const message: QueuedMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      content,
      accountId,
      accountName,
      priority,
      attempts: 0,
      maxAttempts: this.config.maxAttempts,
      createdAt: Date.now(),
      scheduledAt: Date.now(),
    }

    const insertIndex = this.queue.findIndex(m => m.priority < priority)
    if (insertIndex === -1) {
      this.queue.push(message)
    } else {
      this.queue.splice(insertIndex, 0, message)
    }

    this.wake()
    this.process()

    return message
  }

  enqueueBatch(
    messages: Array<{
      content: string
      accountId: string
      accountName: string
      priority?: number
    }>,
  ): QueuedMessage[] {
    return messages
      .map(m => this.enqueue(m.content, m.accountId, m.accountName, m.priority))
      .filter((m): m is QueuedMessage => m !== null)
  }

  private wake() {
    if (this.wakeResolver) {
      this.wakeResolver()
      this.wakeResolver = null
    }
  }

  private interruptibleSleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.wakeResolver = null
        resolve()
      }, ms)
      this.wakeResolver = () => {
        clearTimeout(timer)
        resolve()
      }
    })
  }

  private async process() {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0) {
      const now = Date.now()

      this.cleanupExpired()

      if (this.queue.length === 0) break

      const message = this.queue.find(m => m.scheduledAt <= now)
      if (!message) {
        const nextScheduled = Math.min(...this.queue.map(m => m.scheduledAt))
        const waitTime = Math.max(0, nextScheduled - now)
        if (waitTime > 0) {
          await this.interruptibleSleep(waitTime)
          continue
        }
        break
      }

      const index = this.queue.indexOf(message)
      if (index !== -1) {
        this.queue.splice(index, 1)
      }

      await this.executeSend(message)
    }

    this.processing = false
  }

  private async executeSend(message: QueuedMessage): Promise<void> {
    message.attempts++

    try {
      if (!this.handlers.onSend) {
        throw new Error('未设置发送处理器')
      }

      const success = await this.handlers.onSend(message)

      if (success) {
        this.handlers.onSuccess?.(message)
      } else {
        throw new Error('发送失败')
      }
    } catch (error) {
      if (message.attempts < message.maxAttempts) {
        const delay = this.config.retryInterval * this.config.retryBackoff ** (message.attempts - 1)
        message.scheduledAt = Date.now() + delay
        this.queue.push(message)
      } else {
        this.handlers.onFailed?.(message, error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  private cleanupExpired() {
    const now = Date.now()
    const expired = this.queue.filter(m => now - m.createdAt > this.config.messageTTL)

    for (const message of expired) {
      this.handlers.onDrop?.(message, '消息过期')
    }

    this.queue = this.queue.filter(m => now - m.createdAt <= this.config.messageTTL)
  }

  getStatus(): {
    size: number
    processing: boolean
    pendingByAccount: Record<string, number>
  } {
    const pendingByAccount: Record<string, number> = {}
    for (const m of this.queue) {
      pendingByAccount[m.accountId] = (pendingByAccount[m.accountId] || 0) + 1
    }

    return {
      size: this.queue.length,
      processing: this.processing,
      pendingByAccount,
    }
  }

  clear(): void {
    for (const message of this.queue) {
      this.handlers.onDrop?.(message, '队列被清空')
    }
    this.queue = []
    this.wake()
  }

  cancelByAccount(accountId: string): number {
    const before = this.queue.length
    this.queue = this.queue.filter(m => {
      if (m.accountId === accountId) {
        this.handlers.onDrop?.(m, '账号被取消')
        return false
      }
      return true
    })
    return before - this.queue.length
  }
}
