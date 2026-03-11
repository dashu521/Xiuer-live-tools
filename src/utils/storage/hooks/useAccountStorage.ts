/**
 * 账号存储 Hook
 * 提供账号数据的 React 接口
 */

import { useCallback, useState } from 'react'
import { createAccountStorageService } from '../services/AccountStorageService'
import type { AccountData, UserData } from '../types'

/**
 * 使用账号存储的 Hook
 */
export function useAccountStorage(userId: string) {
  const [service] = useState(() => createAccountStorageService(userId))
  const [userData, setUserData] = useState<UserData>(() => service.getUserData())
  const [isLoaded, _setIsLoaded] = useState(true)

  // 重新加载数据
  const reload = useCallback(() => {
    const data = service.getUserData()
    setUserData(data)
  }, [service])

  // 保存账号列表
  const saveAccounts = useCallback(
    (accounts: AccountData[]) => {
      service.saveAccounts(accounts)
      reload()
    },
    [service, reload],
  )

  // 添加账号
  const addAccount = useCallback(
    (account: AccountData) => {
      service.addAccount(account)
      reload()
    },
    [service, reload],
  )

  // 更新账号
  const updateAccount = useCallback(
    (accountId: string, updates: Partial<AccountData>) => {
      service.updateAccount(accountId, updates)
      reload()
    },
    [service, reload],
  )

  // 删除账号
  const removeAccount = useCallback(
    (accountId: string) => {
      service.removeAccount(accountId)
      reload()
    },
    [service, reload],
  )

  // 设置当前账号
  const setCurrentAccountId = useCallback(
    (accountId: string) => {
      service.setCurrentAccountId(accountId)
      reload()
    },
    [service, reload],
  )

  // 设置默认账号
  const setDefaultAccountId = useCallback(
    (accountId: string | null) => {
      service.setDefaultAccountId(accountId)
      reload()
    },
    [service, reload],
  )

  // 获取用户偏好
  const getUserPreference = useCallback(
    <T>(key: string, defaultValue: T): T => {
      return service.getUserPreference(key, defaultValue)
    },
    [service],
  )

  // 设置用户偏好
  const setUserPreference = useCallback(
    <T>(key: string, value: T) => {
      service.setUserPreference(key, value)
      reload()
    },
    [service, reload],
  )

  return {
    accounts: userData.accounts,
    currentAccountId: userData.currentAccountId,
    defaultAccountId: userData.defaultAccountId,
    preferences: userData.preferences,
    saveAccounts,
    addAccount,
    updateAccount,
    removeAccount,
    setCurrentAccountId,
    setDefaultAccountId,
    getUserPreference,
    setUserPreference,
    reload,
    isLoaded,
  }
}

/**
 * 使用当前账号的 Hook
 */
export function useCurrentAccount(userId: string) {
  const accountStorage = useAccountStorage(userId)

  const currentAccount = accountStorage.accounts.find(
    acc => acc.id === accountStorage.currentAccountId,
  )

  return {
    ...accountStorage,
    currentAccount,
    hasAccounts: accountStorage.accounts.length > 0,
  }
}
