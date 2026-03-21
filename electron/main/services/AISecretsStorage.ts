import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { providers } from 'shared/providers'

const ALG = 'aes-256-gcm'
const KEY_LEN = 32
const IV_LEN = 16
const SALT_LEN = 32
const TAG_LEN = 16

let cachedStoragePath: string | null = null
let cachedSecretKey: Buffer | null = null

export type StoredAIApiKeys = Partial<Record<keyof typeof providers, string>>

function getPrimaryStoragePath(): string {
  const userData = app.getPath('userData')
  const dir = path.join(userData, 'auth')
  return path.join(dir, 'ai-api-keys.enc')
}

function getFallbackStoragePath(): string {
  const tmpDir = app.getPath('temp')
  const dir = path.join(tmpDir, 'tashi-auth')
  return path.join(dir, 'ai-api-keys.enc')
}

function ensureDir(filePath: string): boolean {
  try {
    const dir = path.dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o755 })
    }
    const testFile = path.join(dir, '.write-test')
    writeFileSync(testFile, Buffer.from('test'))
    unlinkSync(testFile)
    return true
  } catch {
    return false
  }
}

function getStoragePath(): string {
  if (cachedStoragePath) {
    return cachedStoragePath
  }

  const primaryPath = getPrimaryStoragePath()
  if (ensureDir(primaryPath)) {
    cachedStoragePath = primaryPath
    return primaryPath
  }

  const fallbackPath = getFallbackStoragePath()
  if (ensureDir(fallbackPath)) {
    cachedStoragePath = fallbackPath
    return fallbackPath
  }

  throw new Error('Unable to find writable storage location')
}

function getSecretKey(): Buffer {
  if (cachedSecretKey) {
    return cachedSecretKey
  }

  const secret = process.env.AUTH_STORAGE_SECRET

  if (secret) {
    cachedSecretKey = scryptSync(secret, 'salt', KEY_LEN)
    return cachedSecretKey
  }

  const isProduction = app.isPackaged || process.env.NODE_ENV === 'production'
  const keyFilePath = path.join(app.getPath('userData'), 'auth', '.key')

  try {
    if (existsSync(keyFilePath)) {
      const storedKey = readFileSync(keyFilePath, 'utf8').trim()
      if (storedKey && storedKey.length >= 32) {
        cachedSecretKey = scryptSync(storedKey, 'salt', KEY_LEN)
        return cachedSecretKey
      }
    }
  } catch (err) {
    console.warn('[AISecretsStorage] Failed to read stored key:', err)
  }

  const newKey = randomBytes(32).toString('hex')

  try {
    const keyDir = path.dirname(keyFilePath)
    if (!existsSync(keyDir)) {
      mkdirSync(keyDir, { recursive: true, mode: 0o755 })
    }
    writeFileSync(keyFilePath, newKey, { mode: 0o600 })
  } catch (err) {
    if (isProduction) {
      throw new Error(
        `[SECURITY] Failed to generate encryption key: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    console.error('[AISecretsStorage] Failed to store key, using fallback:', err)
  }

  if (existsSync(keyFilePath)) {
    cachedSecretKey = scryptSync(newKey, 'salt', KEY_LEN)
    return cachedSecretKey
  }

  if (isProduction) {
    throw new Error(
      '[SECURITY] AUTH_STORAGE_SECRET environment variable is required in production. ' +
        'AI key storage cannot be initialized without a secure key.',
    )
  }

  console.error(
    '[AISecretsStorage] [SECURITY WARNING] AUTH_STORAGE_SECRET not set! ' +
      'Using development-only default key. NEVER use this in production!',
  )

  const devFallbackKey = `dev-key-${app.getPath('userData')}-insecure-fallback`
  cachedSecretKey = scryptSync(devFallbackKey, 'salt', KEY_LEN)
  return cachedSecretKey
}

function sanitizeApiKeys(apiKeys: StoredAIApiKeys): StoredAIApiKeys {
  return Object.fromEntries(
    Object.entries(apiKeys).filter(
      ([, value]) => typeof value === 'string' && value.trim().length > 0,
    ),
  ) as StoredAIApiKeys
}

export function getStoredAIApiKeys(): StoredAIApiKeys {
  const filePath = getStoragePath()
  if (!existsSync(filePath)) return {}

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
    return sanitizeApiKeys(JSON.parse(text) as StoredAIApiKeys)
  } catch (error) {
    console.error('[AISecretsStorage] Failed to get stored API keys:', error)
    return {}
  }
}

export function setStoredAIApiKeys(apiKeys: StoredAIApiKeys): void {
  const sanitized = sanitizeApiKeys(apiKeys)

  if (Object.keys(sanitized).length === 0) {
    clearStoredAIApiKeys()
    return
  }

  try {
    const filePath = getStoragePath()
    const key = getSecretKey()
    const salt = randomBytes(SALT_LEN)
    const keyDerived = scryptSync(key.toString('hex'), salt, KEY_LEN)
    const iv = randomBytes(IV_LEN)
    const enc = createCipheriv(ALG, keyDerived, iv)
    const plain = JSON.stringify(sanitized)
    const encBuf = Buffer.concat([enc.update(plain, 'utf8'), enc.final()])
    const tag = enc.getAuthTag()
    writeFileSync(filePath, Buffer.concat([salt, iv, encBuf, tag]), { mode: 0o600 })
  } catch (err) {
    console.error('[AISecretsStorage] Failed to store API keys:', err)
    throw err
  }
}

export function clearStoredAIApiKeys(): void {
  const filePath = getStoragePath()
  if (!existsSync(filePath)) return

  try {
    unlinkSync(filePath)
  } catch (error) {
    console.warn('[AISecretsStorage] Failed to clear stored API keys:', error)
  }
}
