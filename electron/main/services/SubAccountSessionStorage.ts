import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

const ALG = 'aes-256-gcm'
const KEY_LEN = 32
const IV_LEN = 16
const SALT_LEN = 32
const TAG_LEN = 16

let cachedSecretKey: Buffer | null = null
let cachedBaseDir: string | null = null

interface StoredSubAccountSession {
  storageState: string
  platform?: LiveControlPlatform
  updatedAt: number
}

function getBaseDir(): string {
  if (cachedBaseDir) {
    return cachedBaseDir
  }

  const dir = path.join(app.getPath('userData'), 'sub-account-sessions')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o755 })
  }
  cachedBaseDir = dir
  return dir
}

function getFilePath(subAccountId: string): string {
  return path.join(getBaseDir(), `${subAccountId}.enc`)
}

function getSecretKey(): Buffer {
  if (cachedSecretKey) {
    return cachedSecretKey
  }

  const keyFilePath = path.join(getBaseDir(), '.key')

  try {
    if (existsSync(keyFilePath)) {
      const storedKey = readFileSync(keyFilePath, 'utf8').trim()
      if (storedKey && storedKey.length >= 32) {
        cachedSecretKey = scryptSync(storedKey, 'salt', KEY_LEN)
        return cachedSecretKey
      }
    }
  } catch (error) {
    console.warn('[SubAccountSessionStorage] Failed to read key file:', error)
  }

  const generatedKey = randomBytes(32).toString('hex')
  writeFileSync(keyFilePath, generatedKey, { mode: 0o600 })
  cachedSecretKey = scryptSync(generatedKey, 'salt', KEY_LEN)
  return cachedSecretKey
}

function encryptPayload(payload: StoredSubAccountSession): Buffer {
  const key = getSecretKey()
  const salt = randomBytes(SALT_LEN)
  const keyDerived = scryptSync(key.toString('hex'), salt, KEY_LEN)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALG, keyDerived, iv)
  const plain = JSON.stringify(payload)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([salt, iv, encrypted, tag])
}

function decryptPayload(buffer: Buffer): StoredSubAccountSession {
  const key = getSecretKey()
  const salt = buffer.subarray(0, SALT_LEN)
  const iv = buffer.subarray(SALT_LEN, SALT_LEN + IV_LEN)
  const tag = buffer.subarray(buffer.length - TAG_LEN)
  const encrypted = buffer.subarray(SALT_LEN + IV_LEN, buffer.length - TAG_LEN)
  const keyDerived = scryptSync(key.toString('hex'), salt, KEY_LEN)
  const decipher = createDecipheriv(ALG, keyDerived, iv)
  decipher.setAuthTag(tag)
  const text = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  return JSON.parse(text) as StoredSubAccountSession
}

export function loadSubAccountStorageState(
  subAccountId: string,
  platform?: LiveControlPlatform,
): string | undefined {
  const filePath = getFilePath(subAccountId)
  if (!existsSync(filePath)) {
    return undefined
  }

  try {
    const payload = decryptPayload(readFileSync(filePath))
    if (platform && payload.platform && payload.platform !== platform) {
      console.warn(
        `[SubAccountSessionStorage] Platform mismatch for ${subAccountId}, ignoring stored session`,
      )
      return undefined
    }
    return payload.storageState
  } catch (error) {
    console.warn(`[SubAccountSessionStorage] Failed to load ${subAccountId}:`, error)
    try {
      unlinkSync(filePath)
    } catch {
      // ignore cleanup errors
    }
    return undefined
  }
}

export function saveSubAccountStorageState(
  subAccountId: string,
  storageState: string,
  platform?: LiveControlPlatform,
): void {
  const filePath = getFilePath(subAccountId)
  const payload: StoredSubAccountSession = {
    storageState,
    platform,
    updatedAt: Date.now(),
  }
  writeFileSync(filePath, encryptPayload(payload), { mode: 0o600 })
}

export function clearSubAccountStorageState(subAccountId: string): void {
  const filePath = getFilePath(subAccountId)
  if (!existsSync(filePath)) {
    return
  }

  try {
    unlinkSync(filePath)
  } catch (error) {
    console.warn(`[SubAccountSessionStorage] Failed to clear ${subAccountId}:`, error)
  }
}
