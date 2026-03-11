/**
 * 安全存储适配器
 * 提供加密存储功能
 */

import { EncryptionUtils } from '@/utils/encryption'
import type { IStorageAdapter, StorageEntry } from '../types'

export interface SecureStorageAdapterOptions {
  /** 加密密钥 */
  encryptionKey?: string
  /** 键名前缀 */
  keyPrefix?: string
}

export class SecureStorageAdapter implements IStorageAdapter {
  readonly name = 'secureStorage'
  private options: Required<SecureStorageAdapterOptions>

  constructor(options: SecureStorageAdapterOptions = {}) {
    this.options = {
      encryptionKey: options.encryptionKey || 'xiuer-live-assistant-secure-key',
      keyPrefix: options.keyPrefix || 'secure_',
    }
  }

  get isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage
  }

  /**
   * 获取加密后的键名
   */
  private getSecureKey(key: string): string {
    return `${this.options.keyPrefix}${key}`
  }

  get<T>(key: string): StorageEntry<T> | null {
    if (!this.isAvailable) return null

    try {
      const secureKey = this.getSecureKey(key)
      const encrypted = localStorage.getItem(secureKey)
      if (!encrypted) return null

      // 解密数据
      const decrypted = EncryptionUtils.decrypt(encrypted, this.options.encryptionKey)
      return JSON.parse(decrypted) as StorageEntry<T>
    } catch (error) {
      console.error(`[SecureStorageAdapter] Failed to get item '${key}':`, error)
      // 如果解密失败，删除损坏的数据
      this.remove(key)
      return null
    }
  }

  set<T>(key: string, entry: StorageEntry<T>): void {
    if (!this.isAvailable) {
      throw new Error('localStorage is not available')
    }

    try {
      const secureKey = this.getSecureKey(key)
      const serialized = JSON.stringify(entry)
      const encrypted = EncryptionUtils.encrypt(serialized, this.options.encryptionKey)

      localStorage.setItem(secureKey, encrypted)
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
      const secureKey = this.getSecureKey(key)
      localStorage.removeItem(secureKey)
    } catch (error) {
      console.error(`[SecureStorageAdapter] Failed to remove item '${key}':`, error)
    }
  }

  clear(): void {
    if (!this.isAvailable) return

    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(this.options.keyPrefix)) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.error('[SecureStorageAdapter] Failed to clear storage:', error)
    }
  }

  keys(): string[] {
    if (!this.isAvailable) return []

    const keys: string[] = []
    const prefixLength = this.options.keyPrefix.length

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(this.options.keyPrefix)) {
        // 移除前缀返回原始键名
        keys.push(key.substring(prefixLength))
      }
    }

    return keys
  }

  has(key: string): boolean {
    if (!this.isAvailable) return false

    const secureKey = this.getSecureKey(key)
    return localStorage.getItem(secureKey) !== null
  }
}
