/**
 * 数据迁移工具
 * 用于将旧格式的数据迁移到新格式
 */

import { storageManager } from '../StorageManager'
import type { MigrationStrategy } from '../types'

/**
 * 迁移记录
 */
interface MigrationRecord {
  dataType: string
  fromVersion: number
  toVersion: number
  migratedAt: string
  success: boolean
  error?: string
}

/**
 * 数据迁移器
 */
export class DataMigrator {
  private strategies: Map<string, MigrationStrategy[]> = new Map()
  private migrationRecords: MigrationRecord[] = []
  private readonly MIGRATION_RECORD_KEY = 'migration-records'

  constructor() {
    this.loadMigrationRecords()
  }

  /**
   * 注册迁移策略
   */
  registerStrategy(dataType: string, strategy: MigrationStrategy): void {
    if (!this.strategies.has(dataType)) {
      this.strategies.set(dataType, [])
    }
    this.strategies.get(dataType)?.push(strategy)
  }

  /**
   * 加载迁移记录
   */
  private loadMigrationRecords(): void {
    try {
      const records = localStorage.getItem(this.MIGRATION_RECORD_KEY)
      if (records) {
        this.migrationRecords = JSON.parse(records)
      }
    } catch (error) {
      console.error('[DataMigrator] Failed to load migration records:', error)
      this.migrationRecords = []
    }
  }

  /**
   * 保存迁移记录
   */
  private saveMigrationRecords(): void {
    try {
      localStorage.setItem(this.MIGRATION_RECORD_KEY, JSON.stringify(this.migrationRecords))
    } catch (error) {
      console.error('[DataMigrator] Failed to save migration records:', error)
    }
  }

  /**
   * 记录迁移
   */
  private recordMigration(
    dataType: string,
    fromVersion: number,
    toVersion: number,
    success: boolean,
    error?: string,
  ): void {
    this.migrationRecords.push({
      dataType,
      fromVersion,
      toVersion,
      migratedAt: new Date().toISOString(),
      success,
      error,
    })
    this.saveMigrationRecords()
  }

  /**
   * 检查是否需要迁移
   */
  needsMigration(dataType: string, currentVersion: number): boolean {
    const strategies = this.strategies.get(dataType)
    if (!strategies || strategies.length === 0) {
      return false
    }

    // 获取最新的目标版本
    const latestVersion = Math.max(...strategies.map(s => s.toVersion))
    return currentVersion < latestVersion
  }

  /**
   * 执行迁移
   */
  migrate<T>(
    dataType: string,
    data: T,
    currentVersion: number,
  ): { data: T; migrated: boolean; fromVersion: number; toVersion: number } {
    const strategies = this.strategies.get(dataType)
    if (!strategies || strategies.length === 0) {
      return { data, migrated: false, fromVersion: currentVersion, toVersion: currentVersion }
    }

    // 按版本排序
    const sortedStrategies = strategies
      .filter(s => s.fromVersion >= currentVersion)
      .sort((a, b) => a.fromVersion - b.fromVersion)

    if (sortedStrategies.length === 0) {
      return { data, migrated: false, fromVersion: currentVersion, toVersion: currentVersion }
    }

    let migratedData: unknown = data
    const fromVersion = currentVersion
    let toVersion = currentVersion

    for (const strategy of sortedStrategies) {
      if (strategy.fromVersion === toVersion) {
        try {
          migratedData = strategy.migrate(migratedData)
          toVersion = strategy.toVersion
          this.recordMigration(dataType, strategy.fromVersion, strategy.toVersion, true)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          this.recordMigration(
            dataType,
            strategy.fromVersion,
            strategy.toVersion,
            false,
            errorMessage,
          )
          console.error(`[DataMigrator] Migration failed for ${dataType}:`, error)
          // 继续尝试下一个迁移策略
        }
      }
    }

    return {
      data: migratedData as T,
      migrated: toVersion > fromVersion,
      fromVersion,
      toVersion,
    }
  }

  /**
   * 迁移旧格式的账号数据
   */
  migrateLegacyAccounts(userId: string): boolean {
    try {
      // 检查存储是否已初始化
      try {
        storageManager.getStats()
      } catch {
        console.log('[DataMigrator] Storage not initialized, skipping migration')
        return false
      }

      // 检查旧格式的存储键
      const legacyKeys = [
        `accounts-storage-${userId}`,
        'accounts-storage-current',
        'accounts-storage-dynamic',
      ]

      for (const key of legacyKeys) {
        const data = localStorage.getItem(key)
        if (data) {
          try {
            const parsed = JSON.parse(data)
            // 迁移到新格式
            if (parsed.state) {
              storageManager.set('accounts', parsed.state, {
                level: 'user',
                userId,
              })
              console.log(`[DataMigrator] Migrated legacy accounts data from ${key}`)
              // 可选：删除旧数据
              // localStorage.removeItem(key)
              return true
            }
          } catch (error) {
            console.error(`[DataMigrator] Failed to migrate ${key}:`, error)
          }
        }
      }

      return false
    } catch (error) {
      console.error('[DataMigrator] Failed to migrate legacy accounts:', error)
      return false
    }
  }

  /**
   * 迁移旧格式的偏好设置
   */
  migrateLegacyPreferences(userId: string, accountId?: string): boolean {
    try {
      // 检查存储是否已初始化
      try {
        storageManager.getStats()
      } catch {
        console.log('[DataMigrator] Storage not initialized, skipping migration')
        return false
      }

      const migratedKeys: string[] = []

      // 遍历所有 localStorage 键
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue

        // 匹配旧格式的偏好设置键
        if (accountId) {
          // 账号级偏好：account-pref-{accountId}-{preferenceKey}
          if (key.startsWith(`account-pref-${accountId}-`)) {
            const preferenceKey = key.replace(`account-pref-${accountId}-`, '')
            const value = localStorage.getItem(key)
            if (value) {
              try {
                const parsedValue = JSON.parse(value)
                storageManager.set(
                  'account-pref',
                  { [preferenceKey]: parsedValue },
                  { level: 'account', userId, accountId },
                )
                migratedKeys.push(key)
              } catch {
                // 如果不是 JSON，作为字符串存储
                storageManager.set(
                  'account-pref',
                  { [preferenceKey]: value },
                  { level: 'account', userId, accountId },
                )
                migratedKeys.push(key)
              }
            }
          }
        } else {
          // 用户级偏好：user-pref-{userId}-{preferenceKey}
          if (key.startsWith(`user-pref-${userId}-`)) {
            const preferenceKey = key.replace(`user-pref-${userId}-`, '')
            const value = localStorage.getItem(key)
            if (value) {
              try {
                const parsedValue = JSON.parse(value)
                storageManager.set(
                  'user-pref',
                  { [preferenceKey]: parsedValue },
                  { level: 'user', userId },
                )
                migratedKeys.push(key)
              } catch {
                storageManager.set(
                  'user-pref',
                  { [preferenceKey]: value },
                  { level: 'user', userId },
                )
                migratedKeys.push(key)
              }
            }
          }
        }
      }

      if (migratedKeys.length > 0) {
        console.log(`[DataMigrator] Migrated ${migratedKeys.length} legacy preferences`)
      }

      return migratedKeys.length > 0
    } catch (error) {
      console.error('[DataMigrator] Failed to migrate legacy preferences:', error)
      return false
    }
  }

  /**
   * 获取迁移记录
   */
  getMigrationRecords(): MigrationRecord[] {
    return [...this.migrationRecords]
  }

  /**
   * 清空迁移记录
   */
  clearMigrationRecords(): void {
    this.migrationRecords = []
    this.saveMigrationRecords()
  }
}

/**
 * 全局数据迁移器实例
 */
export const dataMigrator = new DataMigrator()
