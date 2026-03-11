/**
 * LocalStorage 适配器
 */

import type { IStorageAdapter, StorageEntry } from '../types'

/**
 * 检查值是否是 StorageEntry 格式
 */
function isStorageEntry<T>(value: unknown): value is StorageEntry<T> {
  return typeof value === 'object' && value !== null && 'data' in value
}

export class LocalStorageAdapter implements IStorageAdapter {
  readonly name = 'localStorage'

  get isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage
  }

  get<T>(key: string): StorageEntry<T> | null {
    if (!this.isAvailable) return null

    try {
      const item = localStorage.getItem(key)
      if (!item) return null

      const parsed = JSON.parse(item)

      // 验证是否是 StorageEntry 格式
      if (!isStorageEntry<T>(parsed)) {
        // 旧数据格式，包装成 StorageEntry
        return {
          data: parsed as T,
          meta: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
          },
        }
      }

      return parsed
    } catch (_error) {
      // 解析失败（如旧数据是纯字符串），静默返回 null
      // 不打印错误，因为旧数据不是 JSON 格式是正常的
      return null
    }
  }

  set<T>(key: string, entry: StorageEntry<T>): void {
    if (!this.isAvailable) {
      throw new Error('localStorage is not available')
    }

    try {
      const serialized = JSON.stringify(entry)
      localStorage.setItem(key, serialized)
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        throw new Error(`Storage quota exceeded when setting '${key}'`)
      }
      throw error
    }
  }

  remove(key: string): void {
    if (!this.isAvailable) return

    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error(`[LocalStorageAdapter] Failed to remove item '${key}':`, error)
    }
  }

  clear(): void {
    if (!this.isAvailable) return

    try {
      localStorage.clear()
    } catch (error) {
      console.error('[LocalStorageAdapter] Failed to clear storage:', error)
    }
  }

  keys(): string[] {
    if (!this.isAvailable) return []

    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        keys.push(key)
      }
    }
    return keys
  }

  has(key: string): boolean {
    if (!this.isAvailable) return false

    return localStorage.getItem(key) !== null
  }
}
