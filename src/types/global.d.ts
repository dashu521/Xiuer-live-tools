import type { PlanType } from 'shared/planRules'
import type { User } from './auth'

export interface AuthAPI {
  register: (data: {
    username: string
    email: string
    password: string
    confirmPassword: string
  }) => Promise<{
    success: boolean
    user?: Omit<User, 'passwordHash'>
    token?: string
    error?: string
  }>

  login: (credentials: { username: string; password: string; rememberMe?: boolean }) => Promise<{
    success: boolean
    user?: Omit<User, 'passwordHash'>
    token?: string
    refresh_token?: string
    error?: string
    errorType?: string
    status?: number
    detail?: string
  }>

  loginWithSms: (
    phone: string,
    code: string,
  ) => Promise<{
    success: boolean
    user?: Omit<User, 'passwordHash'>
    token?: string
    refresh_token?: string
    needs_password?: boolean
    error?: string
    status?: number
    responseDetail?: string
  }>

  logout: (token: string) => Promise<boolean>

  validateToken: (token: string) => Promise<Omit<User, 'passwordHash'> | null>

  getCurrentUser: (token: string) => Promise<Omit<User, 'passwordHash'> | null>

  /** 云鉴权：用主进程存储的 refresh_token 恢复会话（启动时调用） */
  restoreSession: () => Promise<{
    success: boolean
    user?: Omit<User, 'passwordHash'>
    token?: string
  }>

  refreshSession: () => Promise<{
    success: boolean
    token?: string
    refreshToken?: string | null
    error?: string
  }>

  getAuthSummary: () => Promise<{ isAuthenticated: boolean; hasToken: boolean }>

  proxyRequest: (requestConfig: {
    endpoint: string
    method?: string
    body?: object
  }) => Promise<{ success: boolean; status?: number; data?: unknown; error?: string }>

  getTokenInternal: () => Promise<{ token: string | null; refreshToken: string | null }>

  checkFeatureAccess: (
    token: string,
    feature: string,
  ) => Promise<{
    featureAccess: {
      can_access: boolean
      requires_auth: boolean
      required_plan: PlanType
    }
    user: Omit<User, 'passwordHash'> | null
  }>

  updateUserProfile: (
    token: string,
    data: {
      username?: string
      email?: string
    },
  ) => Promise<{
    success: boolean
    error?: string
  }>

  changePassword: (
    token: string,
    data: {
      currentPassword: string
      newPassword: string
    },
  ) => Promise<{
    success: boolean
    error?: string
  }>

  onAuthStateChanged: (callback: (user: Omit<User, 'passwordHash'> | null) => void) => void

  onLoginRequired: (callback: (feature: string) => void) => void

  removeAllListeners: () => void

  clearTokens: () => Promise<void>
}

declare global {
  interface Window {
    authAPI: AuthAPI
  }
}
