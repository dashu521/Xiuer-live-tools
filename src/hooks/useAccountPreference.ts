import { useCallback, useEffect, useState } from 'react'
import { useAccounts } from './useAccounts'

/**
 * 账号隔离的偏好设置 Hook
 *
 * 为每个账号提供独立的偏好设置存储，确保不同账号间的数据完全隔离
 *
 * @param key 偏好设置的键名（会自动添加账号ID前缀）
 * @param defaultValue 默认值
 * @returns [value, setValue, isLoaded]
 */
export function useAccountPreference<T>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void, boolean] {
  const { currentAccountId } = useAccounts()
  const [value, setValueState] = useState<T>(defaultValue)
  const [isLoaded, setIsLoaded] = useState(false)

  // 生成账号隔离的存储键
  const getStorageKey = useCallback(
    (accountId: string) => `account-pref-${accountId}-${key}`,
    [key],
  )

  // 加载偏好设置
  useEffect(() => {
    if (!currentAccountId) {
      setValueState(defaultValue)
      setIsLoaded(true)
      return
    }

    try {
      const storageKey = getStorageKey(currentAccountId)
      const stored = localStorage.getItem(storageKey)

      if (stored !== null) {
        try {
          const parsed = JSON.parse(stored)
          setValueState(parsed as T)
          console.log(`[useAccountPreference] 加载偏好 [${key}]:`, parsed)
        } catch {
          // 如果不是JSON，直接作为字符串处理
          setValueState(stored as unknown as T)
        }
      } else {
        setValueState(defaultValue)
      }
    } catch (error) {
      console.error(`[useAccountPreference] 加载失败 [${key}]:`, error)
      setValueState(defaultValue)
    }

    setIsLoaded(true)
  }, [currentAccountId, key, defaultValue, getStorageKey])

  // 保存偏好设置
  const setValue = useCallback(
    (newValue: T) => {
      if (!currentAccountId) {
        console.warn(`[useAccountPreference] 无法保存：当前账号ID为空 [${key}]`)
        return
      }

      try {
        const storageKey = getStorageKey(currentAccountId)
        const valueToStore = typeof newValue === 'string' ? newValue : JSON.stringify(newValue)
        localStorage.setItem(storageKey, valueToStore)
        setValueState(newValue)
        console.log(`[useAccountPreference] 保存偏好 [${key}]:`, newValue)
      } catch (error) {
        console.error(`[useAccountPreference] 保存失败 [${key}]:`, error)
      }
    },
    [currentAccountId, key, getStorageKey],
  )

  return [value, setValue, isLoaded]
}

/**
 * 获取指定账号的偏好设置（同步版本）
 * @param accountId 账号ID
 * @param key 偏好设置的键名
 * @param defaultValue 默认值
 * @returns 偏好设置值
 */
export function getAccountPreference<T>(accountId: string, key: string, defaultValue: T): T {
  if (!accountId) return defaultValue

  try {
    const storageKey = `account-pref-${accountId}-${key}`
    const stored = localStorage.getItem(storageKey)

    if (stored !== null) {
      try {
        return JSON.parse(stored) as T
      } catch {
        return stored as unknown as T
      }
    }
  } catch (error) {
    console.error(`[getAccountPreference] 读取失败 [${key}]:`, error)
  }

  return defaultValue
}

/**
 * 设置指定账号的偏好设置（同步版本）
 * @param accountId 账号ID
 * @param key 偏好设置的键名
 * @param value 偏好设置值
 */
export function setAccountPreference<T>(accountId: string, key: string, value: T): void {
  if (!accountId) {
    console.warn(`[setAccountPreference] 无法保存：账号ID为空 [${key}]`)
    return
  }

  try {
    const storageKey = `account-pref-${accountId}-${key}`
    const valueToStore = typeof value === 'string' ? value : JSON.stringify(value)
    localStorage.setItem(storageKey, valueToStore)
    console.log(`[setAccountPreference] 保存偏好 [${key}]:`, value)
  } catch (error) {
    console.error(`[setAccountPreference] 保存失败 [${key}]:`, error)
  }
}

/**
 * 删除指定账号的偏好设置
 * @param accountId 账号ID
 * @param key 偏好设置的键名
 */
export function removeAccountPreference(accountId: string, key: string): void {
  if (!accountId) return

  try {
    const storageKey = `account-pref-${accountId}-${key}`
    localStorage.removeItem(storageKey)
    console.log(`[removeAccountPreference] 删除偏好 [${key}]`)
  } catch (error) {
    console.error(`[removeAccountPreference] 删除失败 [${key}]:`, error)
  }
}

/**
 * 清空指定账号的所有偏好设置
 * @param accountId 账号ID
 */
export function clearAccountPreferences(accountId: string): void {
  if (!accountId) return

  try {
    const prefix = `account-pref-${accountId}-`
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    console.log(`[clearAccountPreferences] 清空账号 ${accountId} 的所有偏好设置`)
  } catch (error) {
    console.error('[clearAccountPreferences] 清空失败:', error)
  }
}

/**
 * 迁移旧的全局偏好设置到账号隔离格式
 * @param accountId 账号ID
 * @param oldKey 旧的全局键名
 * @param newKey 新的偏好设置键名
 * @returns 是否迁移成功
 */
export function migrateGlobalPreference(
  accountId: string,
  oldKey: string,
  newKey: string,
): boolean {
  if (!accountId) return false

  try {
    const oldValue = localStorage.getItem(oldKey)
    if (oldValue !== null) {
      const storageKey = `account-pref-${accountId}-${newKey}`
      localStorage.setItem(storageKey, oldValue)
      console.log(`[migrateGlobalPreference] 迁移偏好 [${oldKey}] -> [${newKey}]:`, oldValue)
      return true
    }
  } catch (error) {
    console.error(`[migrateGlobalPreference] 迁移失败 [${oldKey}]:`, error)
  }

  return false
}
