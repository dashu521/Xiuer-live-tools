import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// 统一套餐类型
type PlanType = 'free' | 'trial' | 'pro' | 'pro_max' | 'ultra'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET 环境变量未设置')
  }
  return secret
}

// Define types inline to avoid import issues
interface User {
  id: string
  username: string
  email: string
  passwordHash: string
  createdAt: string
  lastLogin: string | null
  status: 'active' | 'inactive' | 'banned'
  plan: PlanType
  expire_at: number | null
  deviceId: string
  machineFingerprint: string
  balance: number
}

interface LoginCredentials {
  username: string
  password: string
  rememberMe?: boolean
}

interface RegisterData {
  username: string
  email: string
  password: string
  confirmPassword: string
}

interface AuthResponse {
  success: boolean
  user?: Omit<User, 'passwordHash'>
  token?: string
  error?: string
  errorType?:
    | 'USER_NOT_FOUND'
    | 'INVALID_PASSWORD'
    | 'ACCOUNT_DISABLED'
    | 'SERVER_ERROR'
    | 'UNKNOWN_ERROR'
}

import { getAuthDatabase } from './AuthDatabase'

/** 套餐等级 (用于比较) */
const PLAN_LEVEL: Record<PlanType, number> = {
  free: 0,
  trial: 1,
  pro: 2,
  pro_max: 3,
  ultra: 4,
}

/** 套餐规则配置 */
const PLAN_RULES: Record<PlanType, { maxLiveAccounts: number; canUseAllFeatures: boolean }> = {
  free: { maxLiveAccounts: 1, canUseAllFeatures: false },
  trial: { maxLiveAccounts: 1, canUseAllFeatures: true },
  pro: { maxLiveAccounts: 1, canUseAllFeatures: true },
  pro_max: { maxLiveAccounts: 3, canUseAllFeatures: true },
  ultra: { maxLiveAccounts: -1, canUseAllFeatures: true }, // -1 表示无限制
}

/**
 * 归一化套餐值
 */
function _normalizePlan(plan: string | null | undefined): PlanType {
  if (!plan) return 'free'

  const normalized = plan.toLowerCase().trim()

  // 直接匹配
  if (['free', 'trial', 'pro', 'pro_max', 'ultra'].includes(normalized)) {
    return normalized as PlanType
  }

  return 'free'
}

export class AuthService {
  private static readonly TOKEN_EXPIRY_HOURS = 24 * 7 // 7 days

  // User registration
  static async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const db = getAuthDatabase()

      // Validate input
      if (data.password !== data.confirmPassword) {
        return { success: false, error: '密码确认不匹配' }
      }

      if (data.password.length < 6) {
        return { success: false, error: '密码长度至少6位' }
      }

      // Check if user already exists
      const existingUser = db.getUserByUsername(data.username) || db.getUserByEmail(data.email)
      if (existingUser) {
        return { success: false, error: '用户名或邮箱已存在' }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, 10)

      // Create user
      const user = db.createUser({
        username: data.username,
        email: data.email,
        passwordHash,
        lastLogin: null,
        status: 'active',
        plan: 'free',
        expire_at: null,
        deviceId: '',
        machineFingerprint: '',
        balance: 0,
      })

      // Generate token
      const token = AuthService.generateToken(user.id)

      // Save token
      db.createToken({
        token,
        userId: user.id,
        expiresAt: new Date(
          Date.now() + AuthService.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
        ).toISOString(),
        deviceInfo: 'Unknown Device',
        lastUsed: new Date().toISOString(),
      })

      return {
        success: true,
        user: AuthService.sanitizeUser(user),
        token,
      }
    } catch (error) {
      console.error('Registration error:', error)
      return { success: false, error: '注册失败，请稍后重试' }
    }
  }

  // User login
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const db = getAuthDatabase()

      // Find user
      const user = db.getUserByUsername(credentials.username)
      if (!user) {
        return { success: false, error: '该账号未注册，请先注册', errorType: 'USER_NOT_FOUND' }
      }

      // Check user status
      if (user.status !== 'active') {
        return { success: false, error: '账户已被禁用', errorType: 'ACCOUNT_DISABLED' }
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash)
      if (!isValidPassword) {
        return { success: false, error: '密码错误，请重试', errorType: 'INVALID_PASSWORD' }
      }

      // Update last login
      db.updateUserLastLogin(user.id)

      // Generate token
      const token = AuthService.generateToken(user.id)

      // Save token
      db.createToken({
        token,
        userId: user.id,
        expiresAt: new Date(
          Date.now() + AuthService.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
        ).toISOString(),
        deviceInfo: 'Unknown Device',
        lastUsed: new Date().toISOString(),
      })

      return {
        success: true,
        user: AuthService.sanitizeUser(user),
        token,
      }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: '登录失败，请稍后重试', errorType: 'SERVER_ERROR' }
    }
  }

  // Validate token
  static validateToken(token: string): User | null {
    try {
      const db = getAuthDatabase()

      // Check if token exists and is not expired
      const tokenData = db.getToken(token)
      if (!tokenData || new Date(tokenData.expiresAt) < new Date()) {
        if (tokenData) {
          db.deleteToken(token)
        }
        return null
      }

      // Verify JWT
      const decoded = jwt.verify(token, getJwtSecret()) as { userId: string }
      const user = db.getUserById(decoded.userId)

      if (!user || user.status !== 'active') {
        db.deleteToken(token)
        return null
      }

      // Update token last used
      db.updateTokenLastUsed(token)

      return user
    } catch (error) {
      console.error('Token validation error:', error)
      return null
    }
  }

  // Logout
  static logout(token: string): boolean {
    try {
      const db = getAuthDatabase()
      db.deleteToken(token)
      return true
    } catch (error) {
      console.error('Logout error:', error)
      return false
    }
  }

  // Get current user
  static getCurrentUser(token: string): User | null {
    return AuthService.validateToken(token)
  }

  // Clean up expired tokens
  static cleanupExpiredTokens(): void {
    try {
      const db = getAuthDatabase()
      db.deleteExpiredTokens()
    } catch (error) {
      console.error('Token cleanup error:', error)
    }
  }

  // Generate JWT token
  private static generateToken(userId: string): string {
    return jwt.sign({ userId }, getJwtSecret(), {
      expiresIn: `${AuthService.TOKEN_EXPIRY_HOURS}h`,
    })
  }

  /** 供 IPC 等边界使用：User → SafeUser，不暴露 passwordHash */
  static sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitizedUser } = user
    return sanitizedUser
  }

  /**
   * 判断用户套餐等级是否满足最低要求
   */
  static hasPlanLevel(user: Omit<User, 'passwordHash'> | null, requiredPlan: PlanType): boolean {
    if (!user) return requiredPlan === 'free'

    const userPlan = user.plan
    const userLevel = PLAN_LEVEL[userPlan] ?? 0
    const requiredLevel = PLAN_LEVEL[requiredPlan] ?? 0

    // 检查试用是否过期
    if (userPlan === 'trial' && user.expire_at) {
      return Date.now() < user.expire_at && userLevel >= requiredLevel
    }

    return userLevel >= requiredLevel
  }

  /**
   * 判断是否可以使用全部功能
   * Pro / ProMax / Ultra / Trial 都可以使用全部功能
   */
  static canUseAllFeatures(user: Omit<User, 'passwordHash'> | null): boolean {
    if (!user) return false

    const userPlan = user.plan

    // 检查试用是否过期
    if (userPlan === 'trial' && user.expire_at) {
      if (Date.now() >= user.expire_at) return false
    }

    return PLAN_RULES[userPlan]?.canUseAllFeatures ?? false
  }

  /**
   * 获取最大直播账号数
   */
  static getMaxLiveAccounts(user: Omit<User, 'passwordHash'> | null): number {
    if (!user) return 1
    return PLAN_RULES[user.plan]?.maxLiveAccounts ?? 1
  }

  /**
   * 判断是否还可以添加更多直播账号
   */
  static canAddMoreLiveAccounts(
    user: Omit<User, 'passwordHash'> | null,
    currentCount: number,
  ): boolean {
    const maxAccounts = AuthService.getMaxLiveAccounts(user)
    if (maxAccounts < 0) return true // 无限制
    return currentCount < maxAccounts
  }

  // Check if feature requires authentication
  static requiresAuthentication(feature: string): boolean {
    const featuresRequiringAuth: Record<string, boolean> = {
      auto_reply: true,
      auto_message: true,
      auto_popup: true,
      ai_chat: true,
      live_control: false,
      settings: false,
      preview: false,
    }

    return featuresRequiringAuth[feature] || false
  }

  /**
   * 获取功能所需的最低套餐等级
   * Pro / ProMax / Ultra 功能权限相同，都返回 'pro'
   * 只有免费版和试用版有功能限制
   */
  static getRequiredPlan(feature: string): PlanType {
    const featurePlans: Record<string, PlanType> = {
      auto_reply: 'trial',
      auto_message: 'trial',
      auto_popup: 'trial',
      ai_chat: 'pro',
      live_control: 'free',
      settings: 'free',
      preview: 'free',
    }

    return featurePlans[feature] || 'free'
  }

  static getUserById(userId: string): User | null {
    const db = getAuthDatabase()
    return db.getUserById(userId)
  }

  static updateUserAccount(
    userId: string,
    data: {
      balance?: number
      plan?: PlanType
      expire_at?: number | null
    },
  ): void {
    const db = getAuthDatabase()
    db.updateUserAccount(userId, data)
  }
}
