import {
  type AccountPlatformPreferences,
  type PlatformPreference,
  usePlatformPreferenceStore,
} from '@/stores/platformPreferenceStore'

/**
 * 平台偏好设置服务
 *
 * 提供平台偏好设置的 CRUD 操作和数据管理功能
 * 支持多账号独立存储和持久化
 */

/**
 * 获取指定账号的默认平台
 * @param accountId 账号ID
 * @returns 平台标识符
 */
export function getAccountDefaultPlatform(accountId: string): string {
  return usePlatformPreferenceStore.getState().getDefaultPlatform(accountId)
}

/**
 * 设置指定账号的默认平台
 * @param accountId 账号ID
 * @param platform 平台标识符
 */
export function setAccountDefaultPlatform(accountId: string, platform: string): void {
  usePlatformPreferenceStore.getState().setDefaultPlatform(accountId, platform)
}

/**
 * 获取指定账号的完整偏好设置
 * @param accountId 账号ID
 * @returns 平台偏好设置对象
 */
export function getAccountPreference(accountId: string): PlatformPreference | null {
  return usePlatformPreferenceStore.getState().getPreference(accountId)
}

/**
 * 删除指定账号的偏好设置
 * @param accountId 账号ID
 */
export function removeAccountPreference(accountId: string): void {
  usePlatformPreferenceStore.getState().removePreference(accountId)
}

/**
 * 检查指定账号是否有偏好设置
 * @param accountId 账号ID
 * @returns 是否存在偏好设置
 */
export function hasAccountPreference(accountId: string): boolean {
  return usePlatformPreferenceStore.getState().hasPreference(accountId)
}

/**
 * 设置系统默认平台
 * @param platform 平台标识符
 */
export function setSystemDefaultPlatform(platform: string): void {
  usePlatformPreferenceStore.getState().setSystemDefaultPlatform(platform)
}

/**
 * 获取系统默认平台
 * @returns 系统默认平台标识符
 */
export function getSystemDefaultPlatform(): string {
  return usePlatformPreferenceStore.getState().systemDefaultPlatform
}

/**
 * 清空所有偏好设置
 */
export function clearAllPlatformPreferences(): void {
  usePlatformPreferenceStore.getState().clearAllPreferences()
}

/**
 * 导出所有偏好设置
 * @returns JSON 格式的偏好设置数据
 */
export function exportPlatformPreferences(): string {
  return usePlatformPreferenceStore.getState().exportPreferences()
}

/**
 * 导入偏好设置
 * @param data JSON 格式的偏好设置数据
 * @returns 是否导入成功
 */
export function importPlatformPreferences(data: string): boolean {
  return usePlatformPreferenceStore.getState().importPreferences(data)
}

/**
 * 获取所有账号的偏好设置
 * @returns 账号-偏好映射对象
 */
export function getAllPlatformPreferences(): AccountPlatformPreferences {
  return usePlatformPreferenceStore.getState().preferences
}

/**
 * 批量设置账号偏好
 * @param preferences 账号-偏好映射对象
 */
export function batchSetPlatformPreferences(preferences: AccountPlatformPreferences): void {
  const store = usePlatformPreferenceStore.getState()
  Object.entries(preferences).forEach(([accountId, preference]) => {
    store.setDefaultPlatform(accountId, preference.defaultPlatform)
  })
}

/**
 * 迁移旧版本数据
 * 从 localStorage 的旧格式迁移到新 store
 */
export function migrateLegacyPlatformPreferences(): void {
  const store = usePlatformPreferenceStore.getState()
  const migratedCount = { value: 0 }

  try {
    // 遍历 localStorage 查找旧格式的数据
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('account-default-platform-')) {
        const accountId = key.replace('account-default-platform-', '')
        const platform = localStorage.getItem(key)

        if (platform && accountId) {
          // 迁移到新 store
          store.setDefaultPlatform(accountId, platform)
          migratedCount.value++

          // 删除旧数据
          localStorage.removeItem(key)
          console.log(`[PlatformPreferenceService] 迁移数据: ${accountId} -> ${platform}`)
        }
      }
    }

    if (migratedCount.value > 0) {
      console.log(`[PlatformPreferenceService] 成功迁移 ${migratedCount.value} 条旧数据`)
    }
  } catch (error) {
    console.error('[PlatformPreferenceService] 迁移旧数据失败:', error)
  }
}

/**
 * 初始化平台偏好设置服务
 * 在应用启动时调用，执行数据迁移等初始化操作
 */
export function initializePlatformPreferenceService(): void {
  console.log('[PlatformPreferenceService] 初始化平台偏好设置服务')

  // 迁移旧数据
  migrateLegacyPlatformPreferences()

  // 可以在这里添加其他初始化逻辑
  // 例如：从服务器同步偏好设置等
}

/**
 * 平台偏好设置服务类
 * 提供面向对象的 API 接口
 */
export class PlatformPreferenceService {
  /**
   * 获取指定账号的默认平台
   */
  static getDefaultPlatform(accountId: string): string {
    return getAccountDefaultPlatform(accountId)
  }

  /**
   * 设置指定账号的默认平台
   */
  static setDefaultPlatform(accountId: string, platform: string): void {
    setAccountDefaultPlatform(accountId, platform)
  }

  /**
   * 获取指定账号的完整偏好设置
   */
  static getPreference(accountId: string): PlatformPreference | null {
    return getAccountPreference(accountId)
  }

  /**
   * 删除指定账号的偏好设置
   */
  static removePreference(accountId: string): void {
    removeAccountPreference(accountId)
  }

  /**
   * 检查指定账号是否有偏好设置
   */
  static hasPreference(accountId: string): boolean {
    return hasAccountPreference(accountId)
  }

  /**
   * 设置系统默认平台
   */
  static setSystemDefault(platform: string): void {
    setSystemDefaultPlatform(platform)
  }

  /**
   * 获取系统默认平台
   */
  static getSystemDefault(): string {
    return getSystemDefaultPlatform()
  }

  /**
   * 清空所有偏好设置
   */
  static clearAll(): void {
    clearAllPlatformPreferences()
  }

  /**
   * 导出所有偏好设置
   */
  static export(): string {
    return exportPlatformPreferences()
  }

  /**
   * 导入偏好设置
   */
  static import(data: string): boolean {
    return importPlatformPreferences(data)
  }

  /**
   * 获取所有账号的偏好设置
   */
  static getAll(): AccountPlatformPreferences {
    return getAllPlatformPreferences()
  }

  /**
   * 批量设置账号偏好
   */
  static batchSet(preferences: AccountPlatformPreferences): void {
    batchSetPlatformPreferences(preferences)
  }

  /**
   * 初始化服务
   */
  static initialize(): void {
    initializePlatformPreferenceService()
  }
}
