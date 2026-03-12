/**
 * [SECURITY-FIX] IPC 输入校验工具
 * 为高权限 IPC 提供统一的输入校验、参数白名单、类型约束
 */

import path from 'node:path'

// ============ URL 校验 ============

const ALLOWED_PROTOCOLS = ['http:', 'https:']
const ALLOWED_HOSTNAMES: string[] = [] // 如需限制特定域名，在此添加

/**
 * 校验 URL 是否安全
 * - 只允许 http/https 协议
 * - 可选：限制特定域名
 */
export function validateUrl(input: unknown): { valid: boolean; url?: string; error?: string } {
  if (typeof input !== 'string') {
    return { valid: false, error: 'URL must be a string' }
  }

  const trimmed = input.trim()
  if (!trimmed) {
    return { valid: false, error: 'URL cannot be empty' }
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(trimmed)
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }

  if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
    return {
      valid: false,
      error: `Protocol "${parsedUrl.protocol}" is not allowed. Only HTTP and HTTPS are supported.`,
    }
  }

  if (ALLOWED_HOSTNAMES.length > 0 && !ALLOWED_HOSTNAMES.includes(parsedUrl.hostname)) {
    return {
      valid: false,
      error: `Domain "${parsedUrl.hostname}" is not in the allowed list`,
    }
  }

  return { valid: true, url: trimmed }
}

// ============ 文件名/路径校验 ============

// 危险字符：路径遍历、控制字符、空字节
const DANGEROUS_CHARS = /[<>:"/\\|?*\x00-\x1f]/
// 路径遍历模式
const PATH_TRAVERSAL = /\.\.(\\|\/)/
// 只允许字母、数字、中文、常见安全符号
const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9\u4e00-\u9fa5._\- ]+$/

/**
 * 校验文件名是否安全
 * - 禁止路径遍历字符 (../)
 * - 禁止危险字符
 * - 限制长度
 */
export function validateFileName(input: unknown): { valid: boolean; name?: string; error?: string } {
  if (typeof input !== 'string') {
    return { valid: false, error: 'Filename must be a string' }
  }

  const trimmed = input.trim()
  if (!trimmed) {
    return { valid: false, error: 'Filename cannot be empty' }
  }

  if (trimmed.length > 255) {
    return { valid: false, error: 'Filename too long (max 255 characters)' }
  }

  if (PATH_TRAVERSAL.test(trimmed)) {
    return { valid: false, error: 'Path traversal detected' }
  }

  if (DANGEROUS_CHARS.test(trimmed)) {
    return { valid: false, error: 'Filename contains dangerous characters' }
  }

  // 可选：强制使用安全字符集
  // if (!SAFE_FILENAME_PATTERN.test(trimmed)) {
  //   return { valid: false, error: 'Filename contains invalid characters' }
  // }

  return { valid: true, name: trimmed }
}

/**
 * 安全路径解析
 * 确保解析后的路径位于 baseDir 内（防止目录逃逸）
 */
export function resolveSafePath(
  baseDir: string,
  fileName: string,
): { valid: boolean; fullPath?: string; error?: string } {
  // 先校验文件名
  const nameValidation = validateFileName(fileName)
  if (!nameValidation.valid) {
    return { valid: false, error: nameValidation.error }
  }

  const resolvedPath = path.resolve(baseDir, nameValidation.name!)
  const resolvedBase = path.resolve(baseDir)

  // 确保解析后的路径以 baseDir 开头（防止 ../ 逃逸）
  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    return { valid: false, error: 'Path escapes base directory' }
  }

  return { valid: true, fullPath: resolvedPath }
}

// ============ JSON 数据校验 ============

/**
 * 安全地解析 JSON，限制大小和深度
 */
export function safeJsonParse(
  input: unknown,
  maxSize = 10 * 1024 * 1024, // 10MB
): { valid: boolean; data?: unknown; error?: string } {
  if (typeof input !== 'string') {
    return { valid: false, error: 'Input must be a string' }
  }

  if (input.length > maxSize) {
    return { valid: false, error: `JSON data too large (max ${maxSize} bytes)` }
  }

  try {
    const data = JSON.parse(input)
    return { valid: true, data }
  } catch (error) {
    return { valid: false, error: 'Invalid JSON format' }
  }
}

// 简单的 JSON Schema 校验
export interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required?: boolean
  pattern?: RegExp
  minLength?: number
  maxLength?: number
  items?: SchemaField // for array
  properties?: Record<string, SchemaField> // for object
}

/**
 * 校验数据是否符合简单 schema
 */
export function validateSchema(
  data: unknown,
  schema: SchemaField,
  path = '',
): { valid: boolean; error?: string } {
  // 检查类型
  const actualType = Array.isArray(data) ? 'array' : typeof data

  if (actualType !== schema.type) {
    return {
      valid: false,
      error: `Expected ${schema.type} at ${path || 'root'}, got ${actualType}`,
    }
  }

  // 字符串校验
  if (schema.type === 'string' && typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      return { valid: false, error: `String at ${path} too short (min ${schema.minLength})` }
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      return { valid: false, error: `String at ${path} too long (max ${schema.maxLength})` }
    }
    if (schema.pattern && !schema.pattern.test(data)) {
      return { valid: false, error: `String at ${path} does not match pattern` }
    }
  }

  // 数组校验
  if (schema.type === 'array' && Array.isArray(data) && schema.items) {
    for (let i = 0; i < data.length; i++) {
      const itemResult = validateSchema(data[i], schema.items, `${path}[${i}]`)
      if (!itemResult.valid) return itemResult
    }
  }

  // 对象校验
  if (schema.type === 'object' && typeof data === 'object' && data !== null && schema.properties) {
    for (const [key, fieldSchema] of Object.entries(schema.properties)) {
      const value = (data as Record<string, unknown>)[key]
      if (value === undefined) {
        if (fieldSchema.required) {
          return { valid: false, error: `Missing required field: ${path}.${key}` }
        }
        continue
      }
      const propResult = validateSchema(value, fieldSchema, `${path}.${key}`)
      if (!propResult.valid) return propResult
    }
  }

  return { valid: true }
}

// ============ ID 校验 ============

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 校验是否为有效的 UUID
 */
export function validateUuid(input: unknown): { valid: boolean; uuid?: string; error?: string } {
  if (typeof input !== 'string') {
    return { valid: false, error: 'UUID must be a string' }
  }

  const trimmed = input.trim().toLowerCase()
  if (!UUID_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Invalid UUID format' }
  }

  return { valid: true, uuid: trimmed }
}

// ============ 账号 ID 校验 ============

const ACCOUNT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/

/**
 * 校验账号 ID 格式
 */
export function validateAccountId(input: unknown): { valid: boolean; id?: string; error?: string } {
  if (typeof input !== 'string') {
    return { valid: false, error: 'Account ID must be a string' }
  }

  const trimmed = input.trim()
  if (!ACCOUNT_ID_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Invalid account ID format' }
  }

  return { valid: true, id: trimmed }
}

// ============ 平台类型校验 ============

const ALLOWED_PLATFORMS = ['douyin', 'kuaishou', 'taobao', 'xiaohongshu', 'wechat_channel']

/**
 * 校验平台类型
 */
export function validatePlatform(input: unknown): { valid: boolean; platform?: string; error?: string } {
  if (typeof input !== 'string') {
    return { valid: false, error: 'Platform must be a string' }
  }

  const trimmed = input.trim().toLowerCase()
  if (!ALLOWED_PLATFORMS.includes(trimmed)) {
    return { valid: false, error: `Invalid platform. Allowed: ${ALLOWED_PLATFORMS.join(', ')}` }
  }

  return { valid: true, platform: trimmed }
}
