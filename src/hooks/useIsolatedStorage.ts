/**
 * 数据隔离存储 Hook
 *
 * 提供用户级和账号级的双重数据隔离存储
 * 替代直接使用 localStorage 或普通 persist store
 */

import { useCallback, useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { isolatedStorage, STORAGE_PREFIXES, type StorageType } from '@/utils/storageIsolation'
import { useAccounts } from './useAccounts'

/**
 * 使用用户级隔离存储
 * @param prefix 存储类型前缀
 */
export function useUserIsolatedStorage<T>(prefix: StorageType) {
  const { isAuthenticated, user } = useAuthStore()
  const userId = user?.id
  const prefixValue = STORAGE_PREFIXES[prefix]

  const getItem = useCallback(
    (suffix?: string): T | null => {
      if (!isAuthenticated || !userId) {
        console.warn(`[useUserIsolatedStorage] 用户未登录，无法读取 ${prefix}`)
        return null
      }
      return isolatedStorage.getUserItem<T>(prefixValue, suffix)
    },
    [isAuthenticated, userId, prefixValue, prefix],
  )

  const setItem = useCallback(
    (value: T, suffix?: string): boolean => {
      if (!isAuthenticated || !userId) {
        console.warn(`[useUserIsolatedStorage] 用户未登录，无法写入 ${prefix}`)
        return false
      }
      try {
        isolatedStorage.setUserItem(prefixValue, value, suffix)
        return true
      } catch (error) {
        console.error('[useUserIsolatedStorage] 写入失败:', error)
        return false
      }
    },
    [isAuthenticated, userId, prefixValue, prefix],
  )

  const removeItem = useCallback(
    (suffix?: string): void => {
      if (!isAuthenticated || !userId) return
      isolatedStorage.removeUserItem(prefixValue, suffix)
    },
    [isAuthenticated, userId, prefixValue],
  )

  return useMemo(
    () => ({
      getItem,
      setItem,
      removeItem,
      isAuthenticated,
      userId,
    }),
    [getItem, setItem, removeItem, isAuthenticated, userId],
  )
}

/**
 * 使用账号级隔离存储
 * @param prefix 存储类型前缀
 * @param accountId 账号ID
 */
export function useAccountIsolatedStorage<T>(prefix: StorageType, accountId: string) {
  const { isAuthenticated, user } = useAuthStore()
  const { accounts } = useAccounts()
  const userId = user?.id
  const prefixValue = STORAGE_PREFIXES[prefix]

  // 验证当前用户是否有权限访问该账号
  const hasAccess = useMemo(() => {
    if (!isAuthenticated || !userId) return false
    return accounts.some(acc => acc.id === accountId)
  }, [isAuthenticated, userId, accounts, accountId])

  const getItem = useCallback(
    (suffix?: string): T | null => {
      if (!hasAccess) {
        console.warn(`[useAccountIsolatedStorage] 无权访问账号 ${accountId} 的 ${prefix}`)
        return null
      }
      return isolatedStorage.getAccountItem<T>(prefixValue, accountId, suffix)
    },
    [hasAccess, accountId, prefixValue, prefix],
  )

  const setItem = useCallback(
    (value: T, suffix?: string): boolean => {
      if (!hasAccess) {
        console.warn(`[useAccountIsolatedStorage] 无权写入账号 ${accountId} 的 ${prefix}`)
        return false
      }
      try {
        isolatedStorage.setAccountItem(prefixValue, accountId, value, suffix)
        return true
      } catch (error) {
        console.error('[useAccountIsolatedStorage] 写入失败:', error)
        return false
      }
    },
    [hasAccess, accountId, prefixValue, prefix],
  )

  const removeItem = useCallback(
    (suffix?: string): void => {
      if (!hasAccess) return
      isolatedStorage.removeAccountItem(prefixValue, accountId, suffix)
    },
    [hasAccess, accountId, prefixValue],
  )

  return useMemo(
    () => ({
      getItem,
      setItem,
      removeItem,
      hasAccess,
      isAuthenticated,
      userId,
      accountId,
    }),
    [getItem, setItem, removeItem, hasAccess, isAuthenticated, userId, accountId],
  )
}

/**
 * 使用当前选中账号的隔离存储
 * @param prefix 存储类型前缀
 */
export function useCurrentAccountIsolatedStorage<T>(prefix: StorageType) {
  const { currentAccountId } = useAccounts()

  return useAccountIsolatedStorage<T>(prefix, currentAccountId || 'default')
}

/**
 * 获取数据隔离状态信息（用于调试）
 */
export function useIsolationDebugInfo() {
  const { isAuthenticated, user } = useAuthStore()
  const { accounts, currentAccountId } = useAccounts()

  const debugInfo = useMemo(() => {
    if (!isAuthenticated || !user?.id) {
      return {
        isAuthenticated: false,
        userId: null,
        accountCount: 0,
        currentAccountId: null,
        storageKeys: [],
      }
    }

    return {
      isAuthenticated: true,
      userId: user.id,
      accountCount: accounts.length,
      currentAccountId,
      storageKeys: isolatedStorage.getUserStorageKeys(user.id),
    }
  }, [isAuthenticated, user, accounts, currentAccountId])

  return debugInfo
}
