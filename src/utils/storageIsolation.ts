/**
 * 数据隔离存储系统
 *
 * 实现用户级和账号级的双重数据隔离
 * 所有存储键名格式: {prefix}-{userId}-{accountId?}-{suffix?}
 */

import { useAuthStore } from '@/stores/authStore'

// 存储键前缀定义
export const STORAGE_PREFIXES = {
  // 用户级存储
  AUTH: 'auth',
  USER_SETTINGS: 'user-settings',
  USER_ACCOUNTS: 'accounts-storage',

  // 账号级存储
  ACCOUNT_CONFIG: 'account-config',
  CHROME_CONFIG: 'chrome-config',
  AUTO_REPLY: 'auto-reply',
  AUTO_POPUP: 'auto-popup',
  AUTO_MESSAGE: 'auto-message',
  LIVE_CONTROL: 'live-control',
  SUB_ACCOUNT: 'sub-account',
  PLATFORM_PREF: 'platform-pref',
} as const

// 存储类型（键名）
export type StorageType = keyof typeof STORAGE_PREFIXES

// 存储前缀值类型
export type StoragePrefixValue = (typeof STORAGE_PREFIXES)[StorageType]

/**
 * 生成隔离的存储键名
 * @param prefix 存储前缀
 * @param userId 用户ID
 * @param accountId 账号ID（可选，用于账号级存储）
 * @param suffix 额外后缀（可选）
 */
export function generateStorageKey(
  prefix: string,
  userId: string,
  accountId?: string,
  suffix?: string,
): string {
  const parts = [prefix, userId]
  if (accountId) parts.push(accountId)
  if (suffix) parts.push(suffix)
  return parts.join('-')
}

/**
 * 获取当前登录用户ID
 * @throws 如果用户未登录
 */
export function getCurrentUserId(): string {
  const { user, isAuthenticated } = useAuthStore.getState()
  if (!isAuthenticated || !user?.id) {
    throw new Error('用户未登录，无法访问数据')
  }
  return user.id
}

/**
 * 验证用户是否有权限访问指定账号的数据
 * @param accountId 账号ID
 * @param userId 用户ID（可选，默认当前登录用户）
 */
export function verifyAccountAccess(accountId: string, userId?: string): boolean {
  if (!userId) {
    getCurrentUserId()
  }
  const { accounts } = useAccounts.getState()

  // 检查该账号是否属于当前用户
  return accounts.some(acc => acc.id === accountId)
}

/**
 * 隔离的 localStorage 包装器
 */
export const isolatedStorage = {
  /**
   * 设置用户级数据
   */
  setUserItem<T>(prefix: StoragePrefixValue, value: T, suffix?: string): void {
    const userId = getCurrentUserId()
    const key = generateStorageKey(prefix, userId, undefined, suffix)
    localStorage.setItem(key, JSON.stringify({ data: value, timestamp: Date.now() }))
  },

  /**
   * 获取用户级数据
   */
  getUserItem<T>(prefix: StoragePrefixValue, suffix?: string): T | null {
    try {
      const userId = getCurrentUserId()
      const key = generateStorageKey(prefix, userId, undefined, suffix)
      const value = localStorage.getItem(key)
      if (!value) return null
      const parsed = JSON.parse(value)
      return parsed.data as T
    } catch {
      return null
    }
  },

  /**
   * 移除用户级数据
   */
  removeUserItem(prefix: StoragePrefixValue, suffix?: string): void {
    const userId = getCurrentUserId()
    const key = generateStorageKey(prefix, userId, undefined, suffix)
    localStorage.removeItem(key)
  },

  /**
   * 设置账号级数据
   * @throws 如果用户无权访问该账号
   */
  setAccountItem<T>(
    prefix: StoragePrefixValue,
    accountId: string,
    value: T,
    suffix?: string,
  ): void {
    const userId = getCurrentUserId()

    // 权限校验
    if (!verifyAccountAccess(accountId, userId)) {
      throw new Error(`用户 ${userId} 无权访问账号 ${accountId}`)
    }

    const key = generateStorageKey(prefix, userId, accountId, suffix)
    localStorage.setItem(
      key,
      JSON.stringify({
        data: value,
        timestamp: Date.now(),
        userId,
        accountId,
      }),
    )
  },

  /**
   * 获取账号级数据
   * @throws 如果用户无权访问该账号
   */
  getAccountItem<T>(prefix: StoragePrefixValue, accountId: string, suffix?: string): T | null {
    try {
      const userId = getCurrentUserId()

      // 权限校验
      if (!verifyAccountAccess(accountId, userId)) {
        throw new Error(`用户 ${userId} 无权访问账号 ${accountId}`)
      }

      const key = generateStorageKey(prefix, userId, accountId, suffix)
      const value = localStorage.getItem(key)
      if (!value) return null
      const parsed = JSON.parse(value)

      // 验证数据所有权
      if (parsed.userId !== userId || parsed.accountId !== accountId) {
        console.warn(`[storageIsolation] 数据所有权验证失败: ${key}`)
        return null
      }

      return parsed.data as T
    } catch {
      return null
    }
  },

  /**
   * 移除账号级数据
   */
  removeAccountItem(prefix: StoragePrefixValue, accountId: string, suffix?: string): void {
    const userId = getCurrentUserId()
    const key = generateStorageKey(prefix, userId, accountId, suffix)
    localStorage.removeItem(key)
  },

  /**
   * 清除用户的所有数据（登出时调用）
   */
  clearUserData(userId: string): void {
    const prefixes = Object.values(STORAGE_PREFIXES)

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue

      // 检查是否是以该用户ID开头的存储键
      const isUserKey = prefixes.some(prefix => key.startsWith(`${prefix}-${userId}`))

      if (isUserKey) {
        localStorage.removeItem(key)
      }
    }
  },

  /**
   * 获取用户的所有存储键（用于调试）
   */
  getUserStorageKeys(userId: string): string[] {
    const keys: string[] = []
    const prefixes = Object.values(STORAGE_PREFIXES)

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue

      const isUserKey = prefixes.some(prefix => key.startsWith(`${prefix}-${userId}`))

      if (isUserKey) {
        keys.push(key)
      }
    }

    return keys
  },
}

// 导入 useAccounts 用于权限校验
import { useAccounts } from '@/hooks/useAccounts'
