/**
 * 加密工具类
 * 提供本地存储数据的加密和解密功能
 * 使用浏览器兼容的 API，不依赖 Node.js 的 buffer 模块
 */

function getEncryptionKey(): string {
  const key = import.meta.env.VITE_ENCRYPTION_KEY
  if (!key) {
    throw new Error('VITE_ENCRYPTION_KEY 环境变量未设置')
  }
  return key
}

export class EncryptionUtils {
  private static readonly IV_LENGTH = 16

  /**
   * 将字符串转换为 Uint8Array
   */
  private static stringToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str)
  }

  /**
   * 将 Uint8Array 转换为字符串
   */
  private static bytesToString(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes)
  }

  /**
   * 将 Uint8Array 转换为 base64 字符串
   */
  private static bytesToBase64(bytes: Uint8Array): string {
    const binString = Array.from(bytes, byte => String.fromCharCode(byte)).join('')
    return btoa(binString)
  }

  /**
   * 将 base64 字符串转换为 Uint8Array
   */
  private static base64ToBytes(base64: string): Uint8Array {
    const binString = atob(base64)
    return Uint8Array.from(binString, char => char.charCodeAt(0))
  }

  /**
   * 简单的加密函数（XOR 加密）
   * @param data 要加密的数据
   * @param key 加密密钥
   * @returns 加密后的数据（base64格式）
   */
  static encrypt(data: string, key?: string): string {
    try {
      const encryptionKey = key || getEncryptionKey()
      const keyBytes = EncryptionUtils.stringToBytes(encryptionKey)
      const dataBytes = EncryptionUtils.stringToBytes(data)
      const encrypted = new Uint8Array(dataBytes.length)

      for (let i = 0; i < dataBytes.length; i++) {
        encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length]
      }

      return EncryptionUtils.bytesToBase64(encrypted)
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  /**
   * 简单的解密函数
   * @param encryptedData 加密的数据（base64格式）
   * @param key 解密密钥
   * @returns 解密后的原始数据
   */
  static decrypt(encryptedData: string, key?: string): string {
    try {
      const encryptionKey = key || getEncryptionKey()
      const keyBytes = EncryptionUtils.stringToBytes(encryptionKey)
      const encryptedBytes = EncryptionUtils.base64ToBytes(encryptedData)
      const decrypted = new Uint8Array(encryptedBytes.length)

      for (let i = 0; i < encryptedBytes.length; i++) {
        decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length]
      }

      return EncryptionUtils.bytesToString(decrypted)
    } catch (error) {
      console.error('Decryption failed:', error)
      throw new Error('Failed to decrypt data')
    }
  }

  /**
   * 生成随机 IV（初始化向量）
   * @returns 16字节的随机数据
   */
  static generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(EncryptionUtils.IV_LENGTH))
  }

  /**
   * 使用 Web Crypto API 进行更安全的加密（推荐用于生产环境）
   * @param data 要加密的数据
   * @param password 密码
   * @returns 加密后的数据
   */
  static async encryptWithWebCrypto(data: string, password: string): Promise<string> {
    try {
      const encoder = new TextEncoder()
      const dataBuffer = encoder.encode(data)

      // 导入密码
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey'],
      )

      // 派生密钥
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('xiuer-salt'), // 实际使用时应该使用随机盐值
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt'],
      )

      // 生成随机 IV
      const iv = EncryptionUtils.generateIV()

      // 加密数据
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        key,
        dataBuffer,
      )

      // 组合 IV 和加密数据
      const result = new Uint8Array(iv.length + encrypted.byteLength)
      result.set(iv)
      result.set(new Uint8Array(encrypted), iv.length)

      return EncryptionUtils.bytesToBase64(result)
    } catch (error) {
      console.error('Web Crypto encryption failed:', error)
      throw new Error('Failed to encrypt data with Web Crypto')
    }
  }

  /**
   * 使用 Web Crypto API 进行解密
   * @param encryptedData 加密的数据
   * @param password 密码
   * @returns 解密后的数据
   */
  static async decryptWithWebCrypto(encryptedData: string, password: string): Promise<string> {
    try {
      const encoder = new TextEncoder()
      const dataBuffer = EncryptionUtils.base64ToBytes(encryptedData)

      // 分离 IV 和加密数据
      const iv = dataBuffer.subarray(0, EncryptionUtils.IV_LENGTH)
      const encrypted = dataBuffer.subarray(EncryptionUtils.IV_LENGTH)

      // 导入密码
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey'],
      )

      // 派生密钥
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('xiuer-salt'),
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt'],
      )

      // 解密数据
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        key,
        encrypted.buffer as ArrayBuffer,
      )

      return new TextDecoder().decode(decrypted)
    } catch (error) {
      console.error('Web Crypto decryption failed:', error)
      throw new Error('Failed to decrypt data with Web Crypto')
    }
  }
}

/**
 * 安全的本地存储类
 * 对敏感数据进行自动加密存储
 */
export class SecureStorage {
  private static readonly STORAGE_KEY_PREFIX = 'secure_'

  /**
   * 存储加密数据
   * @param key 存储键名
   * @param data 要存储的数据
   * @param useWebCrypto 是否使用 Web Crypto API（更安全但需要异步）
   */
  static setItem(key: string, data: unknown, useWebCrypto = false): void {
    try {
      const storageKey = SecureStorage.STORAGE_KEY_PREFIX + key
      const serializedData = JSON.stringify(data)

      let encryptedData: string
      if (useWebCrypto) {
        // 注意：Web Crypto 是异步的，这里需要特殊处理
        console.warn('Web Crypto requires async operation, using simple encryption instead')
        encryptedData = EncryptionUtils.encrypt(serializedData)
      } else {
        encryptedData = EncryptionUtils.encrypt(serializedData)
      }

      localStorage.setItem(storageKey, encryptedData)
    } catch (error) {
      console.error('Failed to store encrypted data:', error)
      throw new Error('Failed to store data securely')
    }
  }

  /**
   * 获取解密数据
   * @param key 存储键名
   * @param useWebCrypto 是否使用 Web Crypto API
   * @returns 解密后的数据
   */
  static getItem<T = unknown>(key: string, useWebCrypto = false): T | null {
    try {
      const storageKey = SecureStorage.STORAGE_KEY_PREFIX + key
      const encryptedData = localStorage.getItem(storageKey)

      if (!encryptedData) {
        return null
      }

      let decryptedData: string
      if (useWebCrypto) {
        // 注意：Web Crypto 是异步的，这里需要特殊处理
        console.warn('Web Crypto requires async operation, using simple decryption instead')
        decryptedData = EncryptionUtils.decrypt(encryptedData)
      } else {
        decryptedData = EncryptionUtils.decrypt(encryptedData)
      }

      return JSON.parse(decryptedData) as T
    } catch (error) {
      console.error('Failed to retrieve encrypted data:', error)
      // 如果解密失败，删除损坏的数据
      SecureStorage.removeItem(key)
      return null
    }
  }

  /**
   * 删除存储项
   * @param key 存储键名
   */
  static removeItem(key: string): void {
    const storageKey = SecureStorage.STORAGE_KEY_PREFIX + key
    localStorage.removeItem(storageKey)
  }

  /**
   * 清除所有安全存储的数据
   */
  static clear(): void {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(SecureStorage.STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
  }

  /**
   * 检查是否存在指定的键
   * @param key 存储键名
   * @returns 是否存在
   */
  static hasItem(key: string): boolean {
    const storageKey = SecureStorage.STORAGE_KEY_PREFIX + key
    return localStorage.getItem(storageKey) !== null
  }
}

// 导出常用的类型
export type SecureStorageOptions = {
  useWebCrypto?: boolean
  expiration?: number // 过期时间（毫秒）
}

// 敏感数据类型定义
export const SENSITIVE_KEYS = {
  ACCOUNT_TOKENS: 'account_tokens',
  USER_CREDENTIALS: 'user_credentials',
  API_KEYS: 'api_keys',
  PERSONAL_INFO: 'personal_info',
} as const

export type SensitiveKey = (typeof SENSITIVE_KEYS)[keyof typeof SENSITIVE_KEYS]
