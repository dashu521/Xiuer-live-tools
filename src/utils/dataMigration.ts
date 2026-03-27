/**
 * 数据迁移工具
 * 用于处理 localStorage 中旧格式的账号数据
 */

const OLD_STORAGE_KEYS = ['accounts-storage-current', 'accounts-storage-dynamic']

const NEW_STORAGE_KEY_PREFIX = 'accounts-storage-'

export interface MigrationResult {
  success: boolean
  migrated: boolean
  message: string
  userId?: string
  accountCount?: number
}

/**
 * 迁移旧数据到新格式
 * 将 accounts-storage-current 或 accounts-storage-dynamic 中的数据迁移到 accounts-storage-{userId}
 */
export function migrateAccountsData(userId: string): MigrationResult {
  try {
    if (!userId) {
      return {
        success: false,
        migrated: false,
        message: '用户ID不能为空',
      }
    }

    const newKey = `${NEW_STORAGE_KEY_PREFIX}${userId}`

    const existingNewData = localStorage.getItem(newKey)
    if (existingNewData) {
      console.log('[Migration] 新格式数据已存在，跳过迁移:', newKey)
      const parsed = JSON.parse(existingNewData)
      return {
        success: true,
        migrated: false,
        message: '新格式数据已存在',
        userId,
        accountCount: parsed.state?.accounts?.length || 0,
      }
    }

    let migratedData: {
      accounts: unknown[]
      currentAccountId: string
      defaultAccountId: string | null
    } | null = null

    for (const oldKey of OLD_STORAGE_KEYS) {
      const oldData = localStorage.getItem(oldKey)
      if (oldData) {
        try {
          const parsed = JSON.parse(oldData)
          if (parsed.state && Array.isArray(parsed.state.accounts)) {
            migratedData = {
              accounts: parsed.state.accounts || [],
              currentAccountId: parsed.state.currentAccountId || '',
              defaultAccountId: parsed.state.defaultAccountId || null,
            }
            console.log(
              '[Migration] 从旧键迁移数据:',
              oldKey,
              '账号数:',
              migratedData.accounts.length,
            )
            break
          }
        } catch (e) {
          console.warn('[Migration] 解析旧数据失败:', oldKey, e)
        }
      }
    }

    if (!migratedData) {
      console.log('[Migration] 无旧数据需要迁移')
      return {
        success: true,
        migrated: false,
        message: '无旧数据需要迁移',
      }
    }

    const newData = {
      state: {
        accounts: migratedData.accounts,
        currentAccountId: migratedData.currentAccountId,
        defaultAccountId: migratedData.defaultAccountId,
      },
      version: 0,
    }

    localStorage.setItem(newKey, JSON.stringify(newData))
    console.log('[Migration] 数据迁移成功:', newKey, '账号数:', newData.state.accounts.length)

    return {
      success: true,
      migrated: true,
      message: `成功迁移 ${newData.state.accounts.length} 个账号数据`,
      userId,
      accountCount: newData.state.accounts.length,
    }
  } catch (error) {
    console.error('[Migration] 迁移失败:', error)
    return {
      success: false,
      migrated: false,
      message: `迁移失败: ${error}`,
    }
  }
}

/**
 * 检查是否需要迁移
 */
export function checkMigrationNeeded(): boolean {
  for (const oldKey of OLD_STORAGE_KEYS) {
    const data = localStorage.getItem(oldKey)
    if (data) {
      try {
        const parsed = JSON.parse(data)
        if (
          parsed.state &&
          Array.isArray(parsed.state.accounts) &&
          parsed.state.accounts.length > 0
        ) {
          return true
        }
      } catch {}
    }
  }
  return false
}

/**
 * 清理旧数据（迁移成功后可调用）
 */
export function cleanupOldData(): void {
  for (const oldKey of OLD_STORAGE_KEYS) {
    localStorage.removeItem(oldKey)
  }
  console.log('[Migration] 旧数据已清理')
}

/**
 * 获取调试信息
 */
export function getStorageDebugInfo(): Record<string, { exists: boolean; accountCount?: number }> {
  const result: Record<string, { exists: boolean; accountCount?: number }> = {}

  const allKeys = Object.keys(localStorage).filter(k => k.startsWith('accounts-storage-'))

  for (const key of allKeys) {
    const data = localStorage.getItem(key)
    if (data) {
      try {
        const parsed = JSON.parse(data)
        result[key] = {
          exists: true,
          accountCount: parsed.state?.accounts?.length || 0,
        }
      } catch {
        result[key] = { exists: true }
      }
    } else {
      result[key] = { exists: false }
    }
  }

  return result
}
