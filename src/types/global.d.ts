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
    error?: string
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

  checkFeatureAccess: (
    token: string,
    feature: string,
  ) => Promise<{
    canAccess: boolean
    requiresAuth: boolean
    requiredLicense: string
    user: Omit<User, 'passwordHash'> | null
  }>

  requiresAuthentication: (feature: string) => Promise<boolean>

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

  // Token 管理
  getTokens: () => Promise<{ token: string | null; refreshToken: string | null }>

  setTokens: (tokens: { token: string | null; refreshToken: string | null }) => Promise<void>

  clearTokens: () => Promise<void>
}

declare global {
  interface Window {
    authAPI: AuthAPI
  }
}
