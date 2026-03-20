import type { AuthResponse, SafeUser, UserStatus } from '@/types/auth'

export type LoginResponseExtended = AuthResponse & {
  data?: { username: string; password: string; rememberMe?: boolean }
  status?: number
  requestUrl?: string
  detail?: string
}

export type RegisterResponseExtended = AuthResponse & {
  data?: { username: string; email: string; password: string; confirmPassword: string }
  status?: number
  requestUrl?: string
  detail?: string
}

export interface AuthStoreState {
  isAuthenticated: boolean
  user: SafeUser | null
  token: string | null
  refreshToken: string | null
  isLoading: boolean
  error: string | null
  authCheckDone: boolean
  isOffline: boolean
  userStatus: UserStatus | null
}

export interface AuthStoreActions {
  login: (credentials: {
    username: string
    password: string
    rememberMe?: boolean
  }) => Promise<{ success: boolean; error?: string; rawError?: string; showRegisterHint?: boolean }>
  register: (data: {
    username: string
    email: string
    password: string
    confirmPassword: string
  }) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  setUser: (user: SafeUser | null) => void
  setToken: (token: string | null) => void
  setRefreshToken: (refreshToken: string | null) => void
  clearTokensAndUnauth: () => Promise<void>
  setUserStatus: (userStatus: UserStatus | null) => void
  refreshUserStatus: () => Promise<UserStatus | null>
  startTrialAndRefresh: () => Promise<
    { success: true; status: UserStatus } | { success: false; errorCode?: string; message?: string }
  >
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

export interface AuthStore extends AuthStoreState, AuthStoreActions {}
