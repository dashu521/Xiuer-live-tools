// 定义事件回调的泛型类型
type EventCallback<T extends unknown[] = unknown[]> = (...args: T) => void

// 定义事件映射类型
interface EventMap {
  [EVENTS.ACCOUNT_REMOVED]: [accountId: string]
  [EVENTS.ACCOUNT_ADDED]: [accountId: string, accountName: string]
  [EVENTS.ACCOUNT_SWITCHED]: [accountId: string]
  [EVENTS.ACCOUNT_LIMIT_REACHED]: [reason: string]
  // 可以添加更多事件类型
  [key: string]: unknown[]
}

class EventEmitter {
  private events: Map<string, EventCallback[]> = new Map()

  /**
   * 订阅事件
   * @param event 事件名称
   * @param callback 回调函数
   * @returns 取消订阅的函数
   */
  on<T extends keyof EventMap>(event: T, callback: EventCallback<EventMap[T]>): () => void {
    if (!this.events.has(event as string)) {
      this.events.set(event as string, [])
    }
    this.events.get(event as string)?.push(callback as EventCallback)

    // 返回取消订阅的函数
    return () => this.off(event, callback)
  }

  /**
   * 取消订阅事件
   * @param event 事件名称
   * @param callback 要取消的回调函数
   */
  off<T extends keyof EventMap>(event: T, callback: EventCallback<EventMap[T]>) {
    const callbacks = this.events.get(event as string)
    if (callbacks) {
      const index = callbacks.indexOf(callback as EventCallback)
      if (index !== -1) {
        callbacks.splice(index, 1)
      }
      // 如果没有回调函数了，删除该事件
      if (callbacks.length === 0) {
        this.events.delete(event as string)
      }
    }
  }

  /**
   * 触发事件
   * @param event 事件名称
   * @param args 传递给回调函数的参数
   */
  emit<T extends keyof EventMap>(event: T, ...args: EventMap[T]) {
    const callbacks = this.events.get(event as string)
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(...args)
        } catch (error) {
          console.error(`Error in event ${event as string} callback:`, error)
        }
      }
    }
  }

  /**
   * 移除所有事件监听器
   * @param event 可选，指定要移除的事件，如果不指定则移除所有事件
   */
  removeAllListeners(event?: string) {
    if (event) {
      this.events.delete(event)
    } else {
      this.events.clear()
    }
  }

  /**
   * 获取指定事件的监听器数量
   * @param event 事件名称
   */
  listenerCount(event: string): number {
    return this.events.get(event)?.length || 0
  }
}

// 创建全局单例
export const eventEmitter = new EventEmitter()

// 定义事件常量
export const EVENTS = {
  ACCOUNT_REMOVED: 'account:removed',
  ACCOUNT_ADDED: 'account:added',
  ACCOUNT_SWITCHED: 'account:switched',
  ACCOUNT_LIMIT_REACHED: 'account:limit_reached',
} as const

// 导出事件名称类型
export type EventName = keyof typeof EVENTS

// 类型安全的事件发射器
export function emitEvent<E extends EventName>(event: E, ...args: EventMap[(typeof EVENTS)[E]]) {
  eventEmitter.emit(EVENTS[event], ...args)
}

// 类型安全的事件监听器
export function onEvent<E extends EventName>(
  event: E,
  callback: EventCallback<EventMap[(typeof EVENTS)[E]]>,
) {
  return eventEmitter.on(EVENTS[event], callback)
}
