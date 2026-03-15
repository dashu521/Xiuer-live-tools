import { getEffectivePlan, normalizePlan } from '@/domain/access/planRules'
import type { LoginResponseBackend } from '@/services/apiClient'
import type { SafeUser } from '@/types/auth'

/** 从 /me 返回的 username（即 sub）构建前端展示用 SafeUser */
export function safeUserFromUsername(username: string): SafeUser {
  return {
    id: username,
    username,
    email: '',
    createdAt: new Date().toISOString(),
    lastLogin: null,
    status: 'active',
    plan: 'free',
    expire_at: null,
    deviceId: '',
    machineFingerprint: '',
    balance: 0,
  }
}

/** 将后端 /login 返回的 user 转为 SafeUser */
export function backendUserToSafeUser(
  backendUser: LoginResponseBackend['user'] | undefined,
  fallbackUsername: string,
): SafeUser {
  if (!backendUser) return safeUserFromUsername(fallbackUsername)

  const username =
    (backendUser.phone ?? backendUser.email ?? backendUser.id ?? fallbackUsername) ||
    fallbackUsername

  const plan = normalizePlan(backendUser.plan) || 'free'

  return {
    id: String(backendUser.id),
    username,
    email: backendUser.email ?? '',
    createdAt:
      typeof backendUser.created_at === 'string'
        ? backendUser.created_at
        : backendUser.created_at != null
          ? new Date(backendUser.created_at).toISOString()
          : new Date().toISOString(),
    lastLogin:
      backendUser.last_login_at == null
        ? null
        : typeof backendUser.last_login_at === 'string'
          ? backendUser.last_login_at
          : new Date(backendUser.last_login_at).toISOString(),
    status: (backendUser.status as SafeUser['status']) ?? 'active',
    plan,
    expire_at: backendUser.expire_at ?? null,
    deviceId: '',
    machineFingerprint: '',
    balance: 0,
  }
}

/** 生成请求追踪 ID */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/** 统一错误信息提取 */
export function extractErrorMessage(error: unknown, defaultMessage: string): string {
  const err = error as { error?: string; message?: string; code?: string } | null | undefined
  if (err?.error) {
    return err.error
  }
  if (err?.message) {
    return err.message
  }
  if (error instanceof Error) {
    return error.message || defaultMessage
  }
  if (typeof error === 'string') {
    return error
  }
  return defaultMessage
}

/** 提取错误码 */
export function extractErrorCode(error: unknown): string | undefined {
  const err = error as { code?: string; error?: { code?: string } } | null | undefined
  return err?.code ?? err?.error?.code
}

export { getEffectivePlan, normalizePlan }
