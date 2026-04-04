/**
 * 账号存储服务
 * 统一管理账号相关数据的存储
 */

import { storageManager } from '../StorageManager'
import type { AccountData, UserData } from '../types'

const ACCOUNTS_DATA_TYPE = 'accounts' as const

/**
 * 获取默认用户数据
 */
function getDefaultUserData(): UserData {
  return {
    accounts: [],
    currentAccountId: '',
    defaultAccountId: null,
    preferences: {},
    lastLoginAt: null,
  }
}

/**
 * 账号存储服务
 */
export class AccountStorageService {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * 获取用户完整数据
   */
  getUserData(): UserData {
    const data = storageManager.get<UserData>(ACCOUNTS_DATA_TYPE, {
      level: 'user',
      userId: this.userId,
    })

    return data || getDefaultUserData()
  }

  /**
   * 保存用户完整数据
   */
  saveUserData(data: UserData): void {
    storageManager.set(ACCOUNTS_DATA_TYPE, data, {
      level: 'user',
      userId: this.userId,
    })
  }

  /**
   * 获取账号列表
   */
  getAccounts(): AccountData[] {
    const userData = this.getUserData()
    return userData.accounts
  }

  /**
   * 保存账号列表
   */
  saveAccounts(accounts: AccountData[]): void {
    const userData = this.getUserData()
    userData.accounts = accounts
    userData.lastLoginAt = new Date().toISOString()
    this.saveUserData(userData)
  }

  /**
   * 添加账号
   */
  addAccount(account: AccountData): void {
    const userData = this.getUserData()
    userData.accounts.push(account)
    userData.lastLoginAt = new Date().toISOString()
    this.saveUserData(userData)
  }

  /**
   * 更新账号
   */
  updateAccount(accountId: string, updates: Partial<AccountData>): void {
    const userData = this.getUserData()
    const index = userData.accounts.findIndex(acc => acc.id === accountId)

    if (index !== -1) {
      userData.accounts[index] = {
        ...userData.accounts[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      this.saveUserData(userData)
    }
  }

  /**
   * 删除账号
   */
  removeAccount(accountId: string): void {
    const userData = this.getUserData()
    userData.accounts = userData.accounts.filter(acc => acc.id !== accountId)
    userData.defaultAccountId = null

    // 如果删除的是当前账号，更新当前账号ID
    if (userData.currentAccountId === accountId) {
      userData.currentAccountId = userData.accounts[0]?.id || ''
    }

    this.saveUserData(userData)
  }

  /**
   * 获取当前账号ID
   */
  getCurrentAccountId(): string {
    const userData = this.getUserData()
    return userData.currentAccountId
  }

  /**
   * 设置当前账号ID
   */
  setCurrentAccountId(accountId: string): void {
    const userData = this.getUserData()
    userData.currentAccountId = accountId
    this.saveUserData(userData)
  }

  /**
   * 获取默认账号ID
   */
  getDefaultAccountId(): string | null {
    return null
  }

  /**
   * 设置默认账号ID
   */
  setDefaultAccountId(_accountId: string | null): void {
    const userData = this.getUserData()
    userData.defaultAccountId = null
    this.saveUserData(userData)
  }

  /**
   * 获取指定账号
   */
  getAccount(accountId: string): AccountData | undefined {
    const userData = this.getUserData()
    return userData.accounts.find(acc => acc.id === accountId)
  }

  /**
   * 检查账号是否存在
   */
  hasAccount(accountId: string): boolean {
    const userData = this.getUserData()
    return userData.accounts.some(acc => acc.id === accountId)
  }

  /**
   * 获取用户偏好
   */
  getUserPreference<T>(key: string, defaultValue: T): T {
    const userData = this.getUserData()
    return (userData.preferences[key] as T) ?? defaultValue
  }

  /**
   * 设置用户偏好
   */
  setUserPreference<T>(key: string, value: T): void {
    const userData = this.getUserData()
    userData.preferences[key] = value
    this.saveUserData(userData)
  }

  /**
   * 清空用户数据
   */
  clear(): void {
    storageManager.remove(ACCOUNTS_DATA_TYPE, {
      level: 'user',
      userId: this.userId,
    })
  }
}

/**
 * 创建账号存储服务实例
 */
export function createAccountStorageService(userId: string): AccountStorageService {
  return new AccountStorageService(userId)
}
