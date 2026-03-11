/**
 * 数据隔离系统测试用例
 *
 * 验证用户级和账号级的数据隔离效果
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateStorageKey, STORAGE_PREFIXES } from '../storageIsolation'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock useAuthStore
vi.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      isAuthenticated: true,
      user: { id: 'test-user-001' },
    }),
  },
}))

// Mock useAccounts
vi.mock('@/hooks/useAccounts', () => ({
  useAccounts: {
    getState: () => ({
      accounts: [
        { id: 'account-001', name: '账号1' },
        { id: 'account-002', name: '账号2' },
      ],
    }),
  },
}))

describe('数据隔离系统测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.length = 0
  })

  describe('用户级数据隔离', () => {
    it('用户A的数据不应被用户B访问', () => {
      // 模拟用户A存储数据
      const userAKey = generateStorageKey(STORAGE_PREFIXES.AUTO_REPLY, 'user-a', 'account-001')

      // 验证存储键名包含用户ID
      expect(userAKey).toContain('user-a')
      expect(userAKey).not.toContain('user-b')

      // 验证不同用户的存储键不同
      const userBKey = generateStorageKey(STORAGE_PREFIXES.AUTO_REPLY, 'user-b', 'account-001')
      expect(userAKey).not.toBe(userBKey)
    })

    it('应生成正确的隔离存储键名', () => {
      const key1 = generateStorageKey(STORAGE_PREFIXES.CHROME_CONFIG, 'user-001')
      expect(key1).toBe('chrome-config-user-001')

      const key2 = generateStorageKey(STORAGE_PREFIXES.AUTO_REPLY, 'user-001', 'account-001')
      expect(key2).toBe('auto-reply-user-001-account-001')

      const key3 = generateStorageKey(
        STORAGE_PREFIXES.AUTO_MESSAGE,
        'user-001',
        'account-001',
        'suffix',
      )
      expect(key3).toBe('auto-message-user-001-account-001-suffix')
    })
  })

  describe('账号级数据隔离', () => {
    it('同一用户下不同账号的数据应相互隔离', () => {
      const userId = 'test-user'

      // 账号1的数据键
      const key1 = generateStorageKey(STORAGE_PREFIXES.AUTO_REPLY, userId, 'account-001')

      // 账号2的数据键
      const key2 = generateStorageKey(STORAGE_PREFIXES.AUTO_REPLY, userId, 'account-002')

      // 验证两个账号的存储键不同
      expect(key1).not.toBe(key2)
      expect(key1).toContain('account-001')
      expect(key2).toContain('account-002')
    })
  })

  describe('存储键生成规则', () => {
    it('应正确生成各种存储键', () => {
      const testCases = [
        {
          prefix: STORAGE_PREFIXES.CHROME_CONFIG,
          userId: 'user-001',
          expected: 'chrome-config-user-001',
        },
        {
          prefix: STORAGE_PREFIXES.AUTO_REPLY,
          userId: 'user-001',
          accountId: 'acc-001',
          expected: 'auto-reply-user-001-acc-001',
        },
        {
          prefix: STORAGE_PREFIXES.AUTO_MESSAGE,
          userId: 'user-001',
          accountId: 'acc-001',
          suffix: 'config',
          expected: 'auto-message-user-001-acc-001-config',
        },
      ]

      testCases.forEach(({ prefix, userId, accountId, suffix, expected }) => {
        const key = generateStorageKey(prefix, userId, accountId, suffix)
        expect(key).toBe(expected)
      })
    })

    it('存储键应包含用户ID作为隔离标识', () => {
      const userIds = ['user-a', 'user-b', 'user-c']

      userIds.forEach(userId => {
        const key = generateStorageKey(STORAGE_PREFIXES.AUTO_REPLY, userId, 'account-001')
        expect(key).toContain(userId)
      })
    })
  })

  describe('数据隔离验证', () => {
    it('不同用户的数据存储键完全不同', () => {
      const users = ['alice', 'bob', 'charlie']
      const keys: string[] = []

      users.forEach(userId => {
        const key = generateStorageKey(STORAGE_PREFIXES.CHROME_CONFIG, userId, 'account-001')
        keys.push(key)
      })

      // 验证所有键都是唯一的
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(keys.length)
    })

    it('同一用户的不同账号数据存储键不同', () => {
      const userId = 'test-user'
      const accounts = ['acc-1', 'acc-2', 'acc-3']
      const keys: string[] = []

      accounts.forEach(accountId => {
        const key = generateStorageKey(STORAGE_PREFIXES.AUTO_REPLY, userId, accountId)
        keys.push(key)
      })

      // 验证所有键都是唯一的
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(keys.length)
    })
  })
})

describe('多用户多账号场景测试', () => {
  it('应正确处理多用户多账号的复杂场景', () => {
    // 用户A的数据
    const userAData = {
      'user-a': {
        'account-a1': { name: '用户A-账号1' },
        'account-a2': { name: '用户A-账号2' },
      },
    }

    // 用户B的数据
    const userBData = {
      'user-b': {
        'account-b1': { name: '用户B-账号1' },
        'account-b2': { name: '用户B-账号2' },
      },
    }

    const allKeys: string[] = []

    // 生成用户A的存储键
    Object.entries(userAData['user-a']).forEach(([accountId]) => {
      const key = generateStorageKey(STORAGE_PREFIXES.AUTO_REPLY, 'user-a', accountId)
      allKeys.push(key)
      expect(key).toContain('user-a')
      expect(key).not.toContain('user-b')
    })

    // 生成用户B的存储键
    Object.entries(userBData['user-b']).forEach(([accountId]) => {
      const key = generateStorageKey(STORAGE_PREFIXES.AUTO_REPLY, 'user-b', accountId)
      allKeys.push(key)
      expect(key).toContain('user-b')
      expect(key).not.toContain('user-a')
    })

    // 验证所有键都是唯一的（无冲突）
    const uniqueKeys = new Set(allKeys)
    expect(uniqueKeys.size).toBe(allKeys.length)
    expect(allKeys.length).toBe(4) // 2用户 x 2账号
  })

  it('应确保不同用户无法访问对方数据', () => {
    const userAKey = generateStorageKey(STORAGE_PREFIXES.AUTO_REPLY, 'user-alice', 'account-001')
    const userBKey = generateStorageKey(STORAGE_PREFIXES.AUTO_REPLY, 'user-bob', 'account-001')

    // 即使账号ID相同，不同用户的存储键也不同
    expect(userAKey).not.toBe(userBKey)
    expect(userAKey).toContain('user-alice')
    expect(userBKey).toContain('user-bob')
  })
})
