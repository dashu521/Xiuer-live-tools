import type { PlanType } from '@/domain/access/planRules'

/**
 * 用户类型
 */
export interface User {
  id: string
  username: string
  email: string
  phone?: string
  passwordHash: string
  createdAt: string
  lastLogin: string | null
  status: 'active' | 'inactive' | 'banned'
  plan: PlanType
  expire_at: string | null
  deviceId: string
  machineFingerprint: string
  balance: number
}

export interface AuthToken {
  token: string
  userId: string
  expiresAt: string
  deviceInfo: string
  lastUsed: string
}

export interface UserConfig {
  id: string
  userId: string
  configData: string
  platform: string
  createdAt: string
  updatedAt: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: SafeUser | null
  token: string | null
  isLoading: boolean
  error: string | null
}

export interface LoginCredentials {
  username: string
  password: string
  rememberMe?: boolean
}

export interface RegisterData {
  username: string
  email: string
  password: string
  confirmPassword: string
}

/** 前端展示用用户类型（不含密码哈希） */
export type SafeUser = Omit<User, 'passwordHash'>

export interface AuthResponse {
  success: boolean
  user?: SafeUser
  token?: string
  refresh_token?: string
  error?: string
}

// ----- 云 API 类型 -----
export interface CloudUserOut {
  id: string
  email: string | null
  phone: string | null
  created_at: string
  last_login_at: string | null
  status: string
}

export interface CloudSubscriptionOut {
  plan: PlanType
  status: string
  current_period_end: number | null
  features: string[]
}

export interface CloudAuthResponse {
  user: CloudUserOut
  access_token: string
  refresh_token: string
  token_type?: string
}

export interface CloudRefreshResponse {
  access_token: string
  token_type?: string
}

export interface CloudMeResponse {
  user: CloudUserOut
  subscription: CloudSubscriptionOut
}

/** 云 API 错误详情 */
export interface CloudErrorDetail {
  code: string
  message: string
}

/** 登录错误类型 */
export type LoginErrorType =
  | 'USER_NOT_FOUND'
  | 'INVALID_PASSWORD'
  | 'ACCOUNT_DISABLED'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR'

/** 带错误类型的认证响应 */
export interface AuthResponseWithErrorType extends AuthResponse {
  errorType?: LoginErrorType
}

/** GET /auth/status 返回：用户状态 */
export interface UserStatus {
  user_id?: string
  username: string
  status: 'active' | 'disabled'
  plan: PlanType
  max_accounts?: number
  has_password?: boolean
  created_at?: string
  last_login_at?: string
  expire_at?: string | null
  trial?: {
    start_at?: string | null
    end_at?: string | null
    is_active?: boolean
    is_expired?: boolean
  }
  capabilities?: {
    is_paid_user?: boolean
    can_use_all_features?: boolean
    max_live_accounts?: number
    feature_access?: Record<
      string,
      {
        requires_auth?: boolean
        required_plan?: PlanType
        can_access?: boolean
      }
    >
  }
}

/** 发送验证码请求 */
export interface SendCodeRequest {
  phone: string
  purpose: 'login' | 'register' | 'reset_password'
}

/** 发送验证码响应 */
export interface SendCodeResponse {
  success: boolean
  message: string
  expires_in: number
}

/** 手机验证码登录请求 */
export interface PhoneLoginRequest {
  phone: string
  code: string
}

/** 手机验证码注册请求 */
export interface PhoneRegisterRequest {
  phone: string
  code: string
  password: string
}
