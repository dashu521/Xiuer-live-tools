import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LEN = 32
const IV_LEN = 16
const SALT_LEN = 32

const DEFAULT_KEY = 'xiuer-live-giftcard-secret-key-2025'

function deriveKey(key: string, salt: Buffer): Buffer {
  return scryptSync(key, salt, KEY_LEN)
}

export function encrypt(text: string, customKey?: string): string {
  const key = customKey || DEFAULT_KEY
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)

  const cipherKey = deriveKey(key, salt)
  const cipher = createCipheriv(ALGORITHM, cipherKey, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return (
    salt.toString('hex') +
    ':' +
    iv.toString('hex') +
    ':' +
    authTag.toString('hex') +
    ':' +
    encrypted
  )
}

export function decrypt(encryptedText: string, customKey?: string): string {
  const key = customKey || DEFAULT_KEY

  const parts = encryptedText.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format')
  }

  const salt = Buffer.from(parts[0], 'hex')
  const iv = Buffer.from(parts[1], 'hex')
  const authTag = Buffer.from(parts[2], 'hex')
  const encrypted = parts[3]

  const cipherKey = deriveKey(key, salt)
  const decipher = createDecipheriv(ALGORITHM, cipherKey, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

export function hashCode(code: string): string {
  const salt = 'giftcard-hash-salt'
  return scryptSync(code, salt, 32).toString('hex')
}
