/**
 * 云鉴权 Token 存储：主进程读写，优先安全存储。
 * 当前实现：加密文件（AES 简单封装）。可选接入 keytar（系统凭据库），见文档说明。
 * 风险：加密文件仍可能被提取后离线破解，生产建议接入 keytar 或系统钥匙串。
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

const ALG = 'aes-256-gcm'
const KEY_LEN = 32
const IV_LEN = 16
const SALT_LEN = 32
const TAG_LEN = 16

let cachedStoragePath: string | null = null
const _useFallbackPath = false

function getPrimaryStoragePath(): string {
  const userData = app.getPath('userData')
  const dir = path.join(userData, 'auth')
  return path.join(dir, 'tokens.enc')
}

function getFallbackStoragePath(): string {
  const tmpDir = app.getPath('temp')
  const dir = path.join(tmpDir, 'tashi-auth')
  return path.join(dir, 'tokens.enc')
}

function ensureDir(filePath: string): boolean {
  try {
    const dir = path.dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o755 })
    }
    // 测试目录是否可写
    const testFile = path.join(dir, '.write-test')
    writeFileSync(testFile, Buffer.from('test'))
    unlinkSync(testFile)
    return true
  } catch {
    return false
  }
}

function getStoragePath(): string {
  // 如果已缓存路径，直接返回
  if (cachedStoragePath) {
    return cachedStoragePath
  }

  // 尝试主路径
  const primaryPath = getPrimaryStoragePath()
  if (ensureDir(primaryPath)) {
    cachedStoragePath = primaryPath
    return primaryPath
  }

  // 主路径失败，使用备用路径
  const fallbackPath = getFallbackStoragePath()
  if (ensureDir(fallbackPath)) {
    cachedStoragePath = fallbackPath
    return fallbackPath
  }

  // 如果备用路径也失败，抛出错误
  throw new Error('Unable to find writable storage location')
}

/**
 * [SECURITY-FIX] 获取加密密钥
 * 修复内容：
 * 1. 生产环境优先使用 AUTH_STORAGE_SECRET 环境变量
 * 2. 如果未设置，自动生成随机密钥并存储到 userData 目录
 * 3. 开发环境允许使用默认密钥，但会发出警告
 * 4. 使用持久化 salt 进行密钥派生
 */
function getSecretKey(): Buffer {
  const secret = process.env.AUTH_STORAGE_SECRET

  if (secret) {
    return scryptSync(secret, 'salt', KEY_LEN)
  }

  const isProduction = app.isPackaged || process.env.NODE_ENV === 'production'
  
  const keyFilePath = path.join(app.getPath('userData'), 'auth', '.key')
  
  try {
    if (existsSync(keyFilePath)) {
      const storedKey = readFileSync(keyFilePath, 'utf8').trim()
      if (storedKey && storedKey.length >= 32) {
        return scryptSync(storedKey, 'salt', KEY_LEN)
      }
    }
  } catch (err) {
    console.warn('[CloudAuthStorage] Failed to read stored key:', err)
  }

  const newKey = randomBytes(32).toString('hex')
  
  try {
    const keyDir = path.dirname(keyFilePath)
    if (!existsSync(keyDir)) {
      mkdirSync(keyDir, { recursive: true, mode: 0o755 })
    }
    writeFileSync(keyFilePath, newKey, { mode: 0o600 })
    console.log('[CloudAuthStorage] Generated new encryption key at:', keyFilePath)
  } catch (err) {
    if (isProduction) {
      throw new Error(
        '[SECURITY] Failed to generate encryption key: ' + (err instanceof Error ? err.message : String(err))
      )
    }
    console.error('[CloudAuthStorage] Failed to store key, using fallback:', err)
  }

  if (existsSync(keyFilePath)) {
    return scryptSync(newKey, 'salt', KEY_LEN)
  }

  if (isProduction) {
    throw new Error(
      '[SECURITY] AUTH_STORAGE_SECRET environment variable is required in production. ' +
        'Token storage cannot be initialized without a secure key.',
    )
  }

  console.error(
    '[CloudAuthStorage] [SECURITY WARNING] AUTH_STORAGE_SECRET not set! ' +
      'Using development-only default key. NEVER use this in production!',
  )

  const devFallbackKey = `dev-key-${app.getPath('userData')}-insecure-fallback`
  return scryptSync(devFallbackKey, 'salt', KEY_LEN)
}

export interface StoredTokens {
  access_token: string | null
  refresh_token: string | null
}

export function getStoredTokens(): StoredTokens {
  const filePath = getStoragePath()
  if (!existsSync(filePath)) return { access_token: null, refresh_token: null }
  try {
    const raw = readFileSync(filePath)
    const key = getSecretKey()
    const salt = raw.subarray(0, SALT_LEN)
    const iv = raw.subarray(SALT_LEN, SALT_LEN + IV_LEN)
    const tag = raw.subarray(raw.length - TAG_LEN)
    const enc = raw.subarray(SALT_LEN + IV_LEN, raw.length - TAG_LEN)
    const keyDerived = scryptSync(key.toString('hex'), salt, KEY_LEN)
    const dec = createDecipheriv(ALG, keyDerived, iv)
    dec.setAuthTag(tag)
    const text = Buffer.concat([dec.update(enc), dec.final()]).toString('utf8')
    const data = JSON.parse(text) as StoredTokens
    return {
      access_token: data.access_token ?? null,
      refresh_token: data.refresh_token ?? null,
    }
  } catch (error) {
    console.error('[CloudAuthStorage] Failed to get stored tokens:', error)
    return { access_token: null, refresh_token: null }
  }
}

export function setStoredTokens(tokens: StoredTokens): void {
  try {
    const filePath = getStoragePath()
    const key = getSecretKey()
    const salt = randomBytes(SALT_LEN)
    const keyDerived = scryptSync(key.toString('hex'), salt, KEY_LEN)
    const iv = randomBytes(IV_LEN)
    const enc = createCipheriv(ALG, keyDerived, iv)
    const plain = JSON.stringify(tokens)
    const encBuf = Buffer.concat([enc.update(plain, 'utf8'), enc.final()])
    const tag = enc.getAuthTag()
    writeFileSync(filePath, Buffer.concat([salt, iv, encBuf, tag]), { mode: 0o644 })
  } catch (err) {
    console.error('[CloudAuthStorage] Failed to store tokens:', err)
    throw err
  }
}

export function clearStoredTokens(): void {
  const filePath = getStoragePath()
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath)
    } catch (error) {
      console.warn('[CloudAuthStorage] Failed to clear stored tokens:', error)
    }
  }
}
