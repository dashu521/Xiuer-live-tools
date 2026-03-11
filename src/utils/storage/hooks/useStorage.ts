/**
 * 存储 Hook
 * 提供 React 组件中访问存储的接口
 */

import { useCallback, useEffect, useState } from 'react'
import { storageManager } from '../StorageManager'
import type { StorageDataType, StorageLevel } from '../types'

/**
 * 使用存储的 Hook
 */
export function useStorage<T>(
  dataType: StorageDataType,
  options: {
    level?: StorageLevel
    userId?: string
    accountId?: string
    defaultValue?: T
  } = {},
) {
  const { level = 'user', userId, accountId, defaultValue } = options

  const [value, setValueState] = useState<T | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // 从存储加载数据
  useEffect(() => {
    const data = storageManager.get<T>(dataType, {
      level,
      userId,
      accountId,
    })
    setValueState(data ?? defaultValue ?? null)
    setIsLoaded(true)
  }, [dataType, level, userId, accountId, defaultValue])

  // 设置数据
  const setValue = useCallback(
    (newValue: T | ((prev: T | null) => T)) => {
      const valueToStore =
        typeof newValue === 'function' ? (newValue as (prev: T | null) => T)(value) : newValue

      storageManager.set(dataType, valueToStore, {
        level,
        userId,
        accountId,
      })
      setValueState(valueToStore)
    },
    [dataType, level, userId, accountId, value],
  )

  // 删除数据
  const remove = useCallback(() => {
    storageManager.remove(dataType, {
      level,
      userId,
      accountId,
    })
    setValueState(null)
  }, [dataType, level, userId, accountId])

  return {
    value: value ?? defaultValue,
    setValue,
    remove,
    isLoaded,
  }
}

/**
 * 使用存储事件的 Hook
 */
export function useStorageEvents() {
  useEffect(() => {
    const unsubscribe = storageManager.addEventListener(event => {
      console.log('[Storage Event]', event)
    })

    return unsubscribe
  }, [])
}

/**
 * 使用存储统计的 Hook
 */
export function useStorageStats() {
  const [stats, setStats] = useState(() => {
    // 延迟初始化，避免在存储未初始化时调用
    try {
      return storageManager.getStats()
    } catch {
      return {
        totalEntries: 0,
        totalSize: 0,
        entriesByType: {},
        lastUpdated: null,
      }
    }
  })

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        setStats(storageManager.getStats())
      } catch {
        // 忽略存储未初始化的错误
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return stats
}
