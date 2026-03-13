/**
 * 统一权限上下文 - AccessContext
 *
 * 这是全项目权限判断的唯一数据来源。
 * 聚合 authStore、trialStore、userStatus 等所有权限相关状态。
 *
 * 设计原则：
 * 1. 单一数据源 - 所有权限判断必须通过此上下文
 * 2. 只读 - 此对象一旦创建不可修改
 * 3. 完整 - 包含所有权限判断所需信息
 */

import type { PlanType } from '@/constants/subscription'
import type { UserStatus } from '@/types/auth'

/**
 * 统一权限上下文接口
 */
export interface AccessContext {
  // ===== 认证状态 =====
  /** 是否已登录 */
  isAuthenticated: boolean

  /** 当前用户ID */
  userId: string | null

  /** 用户名 */
  username: string | null

  // ===== 套餐信息 =====
  /**
   * 当前有效套餐类型
   * 已通过 getEffectivePlan 处理，正式套餐优先于试用
   */
  plan: PlanType

  /** 用户状态（来自服务端 /auth/status） */
  userStatus: UserStatus | null

  // ===== 试用状态 =====
  /** 试用是否激活 */
  trialActive: boolean

  /** 试用是否过期 */
  trialExpired: boolean

  /** 试用结束时间戳 */
  trialEndsAt: number | null

  // ===== 功能权限 =====
  /** 是否可以使用全部功能 */
  canUseAllFeatures: boolean

  /** 是否为付费用户 */
  isPaidUser: boolean

  // ===== 资源限制 =====
  /** 最大直播账号数（-1表示无限制） */
  maxLiveAccounts: number

  /** 当前已添加账号数 */
  currentAccountCount: number

  // ===== 环境信息 =====
  /** 是否开发环境 */
  isDevEnvironment: boolean
}

/**
 * 权限判断结果
 */
export interface AccessDecision {
  /** 是否允许 */
  allowed: boolean

  /** 拒绝原因（如不允许） */
  reason?: string

  /** 建议操作 */
  action?: 'login' | 'subscribe' | 'upgrade' | 'none'

  /** 需要升级的套餐 */
  requiredPlan?: PlanType
}

/**
 * 创建空的权限上下文（未登录状态）
 */
export function createEmptyAccessContext(): AccessContext {
  return {
    isAuthenticated: false,
    userId: null,
    username: null,
    plan: 'free',
    userStatus: null,
    trialActive: false,
    trialExpired: false,
    trialEndsAt: null,
    canUseAllFeatures: false,
    isPaidUser: false,
    maxLiveAccounts: 1,
    currentAccountCount: 0,
    isDevEnvironment: false,
  }
}
