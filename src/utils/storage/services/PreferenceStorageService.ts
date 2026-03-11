/**
 * 偏好设置存储服务
 * 统一管理用户和账号的偏好设置
 */

import { storageManager } from '../StorageManager'
import type { StorageDataType } from '../types'

/**
 * 偏好设置存储服务
 */
export class PreferenceStorageService {
  private userId: string
  private accountId?: string
  private dataType: StorageDataType

  constructor(userId: string, accountId?: string) {
    this.userId = userId
    this.accountId = accountId
    this.dataType = accountId ? 'account-pref' : 'user-pref'
  }

  /**
   * 获取偏好设置
   */
  get<T>(key: string, defaultValue: T): T {
    const data = storageManager.get<Record<string, T>>(this.dataType, {
      level: this.accountId ? 'account' : 'user',
      userId: this.userId,
      accountId: this.accountId,
    })

    if (!data) {
      return defaultValue
    }

    return data[key] ?? defaultValue
  }

  /**
   * 设置偏好设置
   */
  set<T>(key: string, value: T): void {
    const data =
      storageManager.get<Record<string, unknown>>(this.dataType, {
        level: this.accountId ? 'account' : 'user',
        userId: this.userId,
        accountId: this.accountId,
      }) || {}

    data[key] = value

    storageManager.set(this.dataType, data, {
      level: this.accountId ? 'account' : 'user',
      userId: this.userId,
      accountId: this.accountId,
    })
  }

  /**
   * 删除偏好设置
   */
  remove(key: string): void {
    const data = storageManager.get<Record<string, unknown>>(this.dataType, {
      level: this.accountId ? 'account' : 'user',
      userId: this.userId,
      accountId: this.accountId,
    })

    if (data) {
      delete data[key]
      storageManager.set(this.dataType, data, {
        level: this.accountId ? 'account' : 'user',
        userId: this.userId,
        accountId: this.accountId,
      })
    }
  }

  /**
   * 获取所有偏好设置
   */
  getAll(): Record<string, unknown> {
    return (
      storageManager.get<Record<string, unknown>>(this.dataType, {
        level: this.accountId ? 'account' : 'user',
        userId: this.userId,
        accountId: this.accountId,
      }) || {}
    )
  }

  /**
   * 批量设置偏好设置
   */
  setAll(preferences: Record<string, unknown>): void {
    storageManager.set(this.dataType, preferences, {
      level: this.accountId ? 'account' : 'user',
      userId: this.userId,
      accountId: this.accountId,
    })
  }

  /**
   * 清空所有偏好设置
   */
  clear(): void {
    storageManager.remove(this.dataType, {
      level: this.accountId ? 'account' : 'user',
      userId: this.userId,
      accountId: this.accountId,
    })
  }

  /**
   * 检查偏好设置是否存在
   */
  has(key: string): boolean {
    const data = storageManager.get<Record<string, unknown>>(this.dataType, {
      level: this.accountId ? 'account' : 'user',
      userId: this.userId,
      accountId: this.accountId,
    })

    return data ? key in data : false
  }
}

/**
 * 创建用户偏好设置服务
 */
export function createUserPreferenceService(userId: string): PreferenceStorageService {
  return new PreferenceStorageService(userId)
}

/**
 * 创建账号偏好设置服务
 */
export function createAccountPreferenceService(
  userId: string,
  accountId: string,
): PreferenceStorageService {
  return new PreferenceStorageService(userId, accountId)
}
