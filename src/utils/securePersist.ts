import type { StateCreator } from 'zustand'
import { SecureStorage, type SensitiveKey } from '@/utils/encryption'

interface SecurePersistConfig<T> {
  name: string
  sensitiveKey?: SensitiveKey
  version?: number
  migrate?: (persistedState: unknown, version: number) => T
}

/**
 * 安全的持久化中间件
 * 为敏感数据提供加密存储功能
 */
export const securePersist = <T extends Record<string, unknown>>(
  config: StateCreator<T, [], [], T>,
  options: SecurePersistConfig<T>,
): StateCreator<T, [], [], T> => {
  return (set, get, api) => {
    // 从安全存储中恢复状态
    const loadState = () => {
      try {
        const persistedState = SecureStorage.getItem<T>(options.name)
        if (persistedState) {
          // 处理版本迁移
          if (options.version && options.migrate) {
            return options.migrate(persistedState, options.version)
          }
          return persistedState
        }
      } catch (error) {
        console.error('Failed to load persisted state:', error)
      }
      return {}
    }

    // 保存状态到安全存储
    const saveState = (state: T) => {
      try {
        SecureStorage.setItem(options.name, state)
      } catch (error) {
        console.error('Failed to save state:', error)
      }
    }

    // 初始化状态
    const initialState = loadState()
    const store = config(
      (partial, replace) => {
        set(partial as any, replace as any)
        // 状态更新后保存
        saveState(get())
      },
      get,
      api,
    )

    // 合并初始状态
    return { ...initialState, ...store } as T
  }
}

/**
 * 普通持久化中间件（用于非敏感数据）
 */
export const regularPersist = <T extends Record<string, unknown>>(
  config: StateCreator<T, [], [], T>,
  name: string,
): StateCreator<T, [], [], T> => {
  return (set, get, api) => {
    // 从 localStorage 恢复状态
    const loadState = () => {
      try {
        const item = localStorage.getItem(name)
        if (item) {
          return JSON.parse(item)
        }
      } catch (error) {
        console.error('Failed to load persisted state:', error)
      }
      return {}
    }

    // 保存状态到 localStorage
    const saveState = (state: T) => {
      try {
        localStorage.setItem(name, JSON.stringify(state))
      } catch (error) {
        console.error('Failed to save state:', error)
      }
    }

    // 初始化状态
    const initialState = loadState()
    const store = config(
      (partial, replace) => {
        set(partial as any, replace as any)
        // 状态更新后保存
        saveState(get())
      },
      get,
      api,
    )

    // 合并初始状态
    return { ...initialState, ...store } as T
  }
}

// 导出配置类型
export type { SecurePersistConfig }
