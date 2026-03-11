import { createLogger } from '#/logger'
import type { MainEvents } from './eventTypes'

type EventMap = MainEvents
type EventKey = keyof EventMap
type EventPayload<K extends EventKey> = EventMap[K]
type Handler<K extends EventKey> = (payload: EventPayload<K>) => void

const listeners: Map<EventKey, Handler<any>[]> = new Map()
const logger = createLogger('EventBus')

export const emitter = {
  on: <K extends EventKey>(event: K, handler: Handler<K>) => {
    logger.debug('监听事件', event)
    if (!listeners.has(event)) {
      listeners.set(event, [])
    }
    listeners.get(event)?.push(handler)
  },

  /**
   * 移除单个事件监听器
   * 优化：支持移除特定的监听器，避免监听器累积导致内存泄漏
   */
  off: <K extends EventKey>(event: K, handler: Handler<K>) => {
    const eventListeners = listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(handler)
      if (index > -1) {
        eventListeners.splice(index, 1)
        logger.debug('移除事件监听器', event)
      }
    }
  },

  /**
   * 添加一次性事件监听器
   * 触发一次后自动移除
   */
  once: <K extends EventKey>(event: K, handler: Handler<K>) => {
    const wrappedHandler = ((payload: EventPayload<K>) => {
      emitter.off(event, wrappedHandler as Handler<K>)
      handler(payload)
    }) as Handler<K>
    emitter.on(event, wrappedHandler)
  },

  emit: <K extends EventKey>(event: K, payload: EventPayload<K>) => {
    logger.debug('触发事件', event)
    for (const listener of listeners.get(event) ?? []) {
      listener(payload)
    }
  },

  removeAllListeners: <K extends EventKey>(event: K) => {
    listeners.delete(event)
  },

  /**
   * 获取指定事件的监听器数量
   * 用于调试和监控
   */
  listenerCount: <K extends EventKey>(event: K): number => {
    return listeners.get(event)?.length ?? 0
  },
}
