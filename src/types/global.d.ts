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
    error?: string | { code?: string; message?: string }
    status?: number
    detail?: string
  }>

  login: (credentials: { username: string; password: string; rememberMe?: boolean }) => Promise<{
    success: boolean
    user?: Omit<User, 'passwordHash'>
    error?: string | { code?: string; message?: string }
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
    needs_password?: boolean
    error?: string | { code?: string; message?: string }
    status?: number
    responseDetail?: string
  }>

  logout: () => Promise<boolean>

  validateToken: () => Promise<Omit<User, 'passwordHash'> | null>

  getCurrentUser: () => Promise<Omit<User, 'passwordHash'> | null>

  /** 云鉴权：用主进程存储的 refresh_token 恢复会话（启动时调用） */
  restoreSession: () => Promise<{
    success: boolean
    user?: Omit<User, 'passwordHash'>
  }>

  refreshSession: () => Promise<{
    success: boolean
    error?: string | { code?: string; message?: string }
  }>

  getAuthSummary: () => Promise<{ isAuthenticated: boolean; hasToken: boolean }>

  proxyRequest: (requestConfig: {
    endpoint: string
    method?: string
    body?: object | null
  }) => Promise<{
    success: boolean
    status?: number
    data?: unknown
    error?: string | { code?: string; message?: string }
  }>

  startMessageStream: () => Promise<{ success: boolean; error?: string }>

  stopMessageStream: () => Promise<{ success: boolean }>

  onMessageStreamSnapshot: (
    callback: (payload: {
      success: boolean
      items: Array<{
        id: string
        title: string
        content: string
        type: 'notice' | 'update' | 'warning' | 'marketing'
        is_pinned: boolean
        is_read: boolean
        created_at: string | null
        published_at: string | null
        expires_at: string | null
      }>
      unread_count: number
      fetched_at: string | null
    }) => void,
  ) => () => void

  onMessageStreamState: (
    callback: (payload: { connected: boolean; reason?: string }) => void,
  ) => () => void

  checkFeatureAccess: (feature: string) => Promise<{
    featureAccess: {
      can_access: boolean
      requires_auth: boolean
      required_plan: PlanType
    }
    user: Omit<User, 'passwordHash'> | null
  }>

  updateUserProfile: (data: { username?: string; email?: string }) => Promise<{
    success: boolean
    error?: string
  }>

  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<{
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
