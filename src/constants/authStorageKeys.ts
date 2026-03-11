/**
 * 登录相关 localStorage / 持久化 Key，集中管理便于修改与文档一致。
 * 参见 docs/LOGIN_FIRST_RUN_AND_CLEAR_DATA.md
 */

/** 是否记住登录状态："true" | "false" */
export const AUTH_REMEMBER_ME_KEY = 'auth.rememberMe'

/** 上次成功登录且勾选“记住”时的账号（手机/邮箱），仅当 AUTH_REMEMBER_ME_KEY === 'true' 时有效 */
export const AUTH_LAST_IDENTIFIER_KEY = 'auth.lastIdentifier'

/** 禁止用于预填的测试/占位账号，读取到则清除并视为空（不预填） */
export const BLOCKED_TEST_IDENTIFIERS: ReadonlySet<string> = new Set(['19999999999'])

/**
 * 读取上次登录账号用于预填；若为测试账号则从 storage 清除并返回空字符串。
 */
export function getSanitizedLastIdentifier(): string {
  if (typeof localStorage === 'undefined') return ''
  const raw = localStorage.getItem(AUTH_LAST_IDENTIFIER_KEY) || ''
  const trimmed = raw.trim()
  if (!trimmed || BLOCKED_TEST_IDENTIFIERS.has(trimmed)) {
    if (trimmed) localStorage.removeItem(AUTH_LAST_IDENTIFIER_KEY)
    return ''
  }
  return trimmed
}

/** Zustand persist 存储 key（token、refreshToken、user、isAuthenticated） */
export const AUTH_ZUSTAND_PERSIST_KEY = 'auth-storage'

/** 引导相关 localStorage Key */

/** 是否已完成首次欢迎引导 */
export const ONBOARDING_WELCOME_COMPLETED_KEY = 'onboarding.welcomeCompleted'

/** 是否已完成首次登录后的快速开始引导 */
export const ONBOARDING_QUICKSTART_COMPLETED_KEY = 'onboarding.quickStartCompleted'

/** 获取欢迎引导完成状态 */
export function getWelcomeCompleted(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(ONBOARDING_WELCOME_COMPLETED_KEY) === 'true'
}

/** 设置欢迎引导完成状态 */
export function setWelcomeCompleted(completed: boolean): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(ONBOARDING_WELCOME_COMPLETED_KEY, completed ? 'true' : 'false')
}

/** 获取快速开始引导完成状态 */
export function getQuickStartCompleted(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(ONBOARDING_QUICKSTART_COMPLETED_KEY) === 'true'
}

/** 设置快速开始引导完成状态 */
export function setQuickStartCompleted(completed: boolean): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(ONBOARDING_QUICKSTART_COMPLETED_KEY, completed ? 'true' : 'false')
}

/** 重置所有引导状态（用于测试） */
export function resetAllOnboarding(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(ONBOARDING_WELCOME_COMPLETED_KEY)
  localStorage.removeItem(ONBOARDING_QUICKSTART_COMPLETED_KEY)
}
