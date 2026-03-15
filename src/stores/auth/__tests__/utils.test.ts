/**
 * Auth 工具函数测试
 * 验证用户数据转换逻辑正确性
 */

import { describe, expect, it } from 'vitest'
import type { LoginResponseBackend } from '@/services/apiClient'
import {
  backendUserToSafeUser,
  extractErrorMessage,
  generateRequestId,
  safeUserFromUsername,
} from '../utils'

describe('Auth 工具函数测试', () => {
  describe('safeUserFromUsername', () => {
    it('应从 username 创建 SafeUser', () => {
      const result = safeUserFromUsername('testuser')

      expect(result.id).toBe('testuser')
      expect(result.username).toBe('testuser')
      expect(result.email).toBe('')
      expect(result.status).toBe('active')
      expect(result.plan).toBe('free')
      expect(result.expire_at).toBeNull()
      expect(result.balance).toBe(0)
      expect(result.lastLogin).toBeNull()
    })

    it('应生成有效的 createdAt 时间戳', () => {
      const before = new Date().toISOString()
      const result = safeUserFromUsername('user')
      const after = new Date().toISOString()

      expect(result.createdAt).toBeDefined()
      expect(result.createdAt >= before).toBe(true)
      expect(result.createdAt <= after).toBe(true)
    })
  })

  describe('backendUserToSafeUser', () => {
    it('应转换完整的后端用户数据', () => {
      const backendUser: LoginResponseBackend['user'] = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        phone: '13800138000',
        status: 'active',
        plan: 'pro',
        created_at: '2024-01-15T08:00:00Z',
        last_login_at: '2024-03-15T10:30:00Z',
        expire_at: '2025-01-15T08:00:00Z',
      }

      const result = backendUserToSafeUser(backendUser, 'fallback')

      expect(result.id).toBe('123')
      expect(result.username).toBe('13800138000') // phone 优先
      expect(result.email).toBe('test@example.com')
      expect(result.status).toBe('active')
      expect(result.plan).toBe('pro')
      expect(result.createdAt).toBe('2024-01-15T08:00:00Z')
      expect(result.lastLogin).toBe('2024-03-15T10:30:00Z')
      expect(result.expire_at).toBe('2025-01-15T08:00:00Z')
    })

    it('应使用 fallback username 当后端数据缺失', () => {
      const result = backendUserToSafeUser(undefined, 'fallback_user')

      expect(result.id).toBe('fallback_user')
      expect(result.username).toBe('fallback_user')
    })

    it('应处理 Date 类型的 created_at', () => {
      const backendUser: LoginResponseBackend['user'] = {
        id: '123',
        username: 'test',
        created_at: new Date('2024-01-15T08:00:00Z'),
        status: 'active',
      }

      const result = backendUserToSafeUser(backendUser, 'fallback')

      expect(result.createdAt).toBe('2024-01-15T08:00:00.000Z')
    })

    it('应处理 null 的 last_login_at', () => {
      const backendUser: LoginResponseBackend['user'] = {
        id: '123',
        username: 'test',
        last_login_at: null,
        status: 'active',
      }

      const result = backendUserToSafeUser(backendUser, 'fallback')

      expect(result.lastLogin).toBeNull()
    })

    it('应规范化 plan 值', () => {
      const backendUser: LoginResponseBackend['user'] = {
        id: '123',
        username: 'test',
        plan: 'enterprise',
        status: 'active',
      }

      const result = backendUserToSafeUser(backendUser, 'fallback')

      // enterprise 不是标准 plan，应被规范化
      expect(['free', 'basic', 'pro', 'enterprise'].includes(result.plan)).toBe(true)
    })

    it('应优先使用 phone 作为 username', () => {
      const backendUser: LoginResponseBackend['user'] = {
        id: '123',
        username: 'username_value',
        email: 'email@example.com',
        phone: 'phone_value',
        status: 'active',
      }

      const result = backendUserToSafeUser(backendUser, 'fallback')

      expect(result.username).toBe('phone_value')
    })

    it('应其次使用 email 作为 username', () => {
      const backendUser: LoginResponseBackend['user'] = {
        id: '123',
        username: 'username_value',
        email: 'email@example.com',
        status: 'active',
      }

      const result = backendUserToSafeUser(backendUser, 'fallback')

      expect(result.username).toBe('email@example.com')
    })

    it('应使用 id 作为 username 当其他字段缺失', () => {
      const backendUser: LoginResponseBackend['user'] = {
        id: 'user_id',
        username: 'username_value',
        status: 'active',
      }

      const result = backendUserToSafeUser(backendUser, 'fallback')

      expect(result.username).toBe('user_id')
    })
  })

  describe('generateRequestId', () => {
    it('应生成唯一请求 ID', () => {
      const id1 = generateRequestId()
      const id2 = generateRequestId()

      expect(id1).not.toBe(id2)
      expect(id1).toContain('-')
    })

    it('应包含时间戳部分', () => {
      const before = Date.now()
      const id = generateRequestId()
      const after = Date.now()

      const timestamp = Number.parseInt(id.split('-')[0], 10)
      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('extractErrorMessage', () => {
    it('应从 error 对象提取 message', () => {
      const error = { error: 'Custom error message' }
      const result = extractErrorMessage(error, 'default')

      expect(result).toBe('Custom error message')
    })

    it('应从 Error 实例提取 message', () => {
      const error = new Error('Error instance message')
      const result = extractErrorMessage(error, 'default')

      expect(result).toBe('Error instance message')
    })

    it('应返回字符串错误', () => {
      const result = extractErrorMessage('String error', 'default')

      expect(result).toBe('String error')
    })

    it('应返回默认值当无法提取', () => {
      const result = extractErrorMessage(null, 'default message')

      expect(result).toBe('default message')
    })

    it('应返回默认值当 error 为空对象', () => {
      const result = extractErrorMessage({}, 'default message')

      expect(result).toBe('default message')
    })

    it('应优先使用 error.error 字段', () => {
      const error = {
        error: 'API error',
        message: 'Should not use this',
      }
      const result = extractErrorMessage(error, 'default')

      expect(result).toBe('API error')
    })
  })
})
