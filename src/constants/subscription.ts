/**
 * 订阅系统规则中心
 * 
 * 【重构说明】
 * 本文件的权限判断函数已迁移至 src/domain/access
 * 新代码请使用：
 * - buildAccessContext() - 构建权限上下文
 * - checkAccess(context, feature) - 检查功能权限
 * - useAccessCheck(feature) - React Hook
 * 
 * 本文件保留用于：
 * - 类型定义 (PlanType, PlanRule)
 * - 常量定义 (PLAN_RULES, PLAN_TEXT_MAP)
 * - 向后兼容（已标记废弃的函数）
 */

import type { UserStatus } from '@/types/auth'

/** 套餐类型 */
export type PlanType = 'free' | 'trial' | 'pro' | 'pro_max' | 'ultra'

/** 所有合法套餐值 */
export const VALID_PLANS: PlanType[] = ['free', 'trial', 'pro', 'pro_max', 'ultra']

/** 套餐显示文案映射 */
export const PLAN_TEXT_MAP: Record<PlanType, string> = {
  free: '免费版',
  trial: '试用版',
  pro: '专业版',
  pro_max: '专业增强版',
  ultra: '旗舰版',
}

/** 套餐等级 (用于比较) */
export const PLAN_LEVEL: Record<PlanType, number> = {
  free: 0,
  trial: 1,
  pro: 2,
  pro_max: 3,
  ultra: 4,
}

/** 套餐规则配置 */
export interface PlanRule {
  name: string
  level: number
  maxLiveAccounts: number
  canUseAllFeatures: boolean
  isPaid: boolean
  themeColor: string
  iconType: PlanType
}

/** 套餐规则表 - 单一事实来源 */
export const PLAN_RULES: Record<PlanType, PlanRule> = {
  free: {
    name: '免费版',
    level: 0,
    maxLiveAccounts: 1,
    canUseAllFeatures: false,
    isPaid: false,
    themeColor: 'gray',
    iconType: 'free',
  },
  trial: {
    name: '试用版',
    level: 1,
    maxLiveAccounts: 1,
    canUseAllFeatures: true,
    isPaid: false,
    themeColor: 'blue',
    iconType: 'trial',
  },
  pro: {
    name: '专业版',
    level: 2,
    maxLiveAccounts: 1,
    canUseAllFeatures: true,
    isPaid: true,
    themeColor: 'green',
    iconType: 'pro',
  },
  pro_max: {
    name: '专业增强版',
    level: 3,
    maxLiveAccounts: 3,
    canUseAllFeatures: true,
    isPaid: true,
    themeColor: 'orange',
    iconType: 'pro_max',
  },
  ultra: {
    name: '旗舰版',
    level: 4,
    maxLiveAccounts: -1,
    canUseAllFeatures: true,
    isPaid: true,
    themeColor: 'purple',
    iconType: 'ultra',
  },
}

/**
 * 归一化套餐值
 * 
 * @deprecated
 * 使用 AccessControl.buildAccessContext() 获取已归一化的 plan
 * 或直接使用 context.plan
 */
export function normalizePlan(plan: string | null | undefined): PlanType {
  if (!plan) return 'free'

  const normalized = plan.toLowerCase().trim()

  if (VALID_PLANS.includes(normalized as PlanType)) {
    return normalized as PlanType
  }

  return 'free'
}

/**
 * 判断是否为付费套餐
 * 
 * @deprecated
 * 使用 AccessControl.buildAccessContext() + context.isPaidUser
 * 或 checkAccess(context, feature).allowed
 */
export function isPaidPlan(plan: string | null | undefined): boolean {
  const normalized = normalizePlan(plan)
  return PLAN_RULES[normalized]?.isPaid || false
}

/**
 * 判断是否可以使用全部功能
 * 
 * @deprecated
 * 使用 AccessControl.buildAccessContext() + context.canUseAllFeatures
 * 或 checkAccess(context, 'useAllFeatures').allowed
 */
export function canUseAllFeatures(plan: string | null | undefined): boolean {
  const normalized = normalizePlan(plan)
  return PLAN_RULES[normalized]?.canUseAllFeatures || false
}

/**
 * 获取最大直播账号数
 * 
 * @deprecated
 * 使用 AccessControl.buildAccessContext() + context.maxLiveAccounts
 */
export function getMaxLiveAccounts(plan: string | null | undefined): number {
  const normalized = normalizePlan(plan)
  return PLAN_RULES[normalized]?.maxLiveAccounts ?? 1
}

/**
 * 判断是否还可以添加更多直播账号
 * 
 * @deprecated
 * 使用 AccessControl.checkAccess(context, 'addLiveAccount')
 */
export function canAddMoreLiveAccounts(
  plan: string | null | undefined,
  currentCount: number,
): boolean {
  const maxAccounts = getMaxLiveAccounts(plan)
  if (maxAccounts < 0) return true
  return currentCount < maxAccounts
}

/**
 * 获取添加账号的限制提示文案
 * 
 * @deprecated
 * 使用 AccessControl.Policy.getAccountLimitMessage(context)
 */
export function getAccountLimitMessage(plan: string | null | undefined): string {
  const normalized = normalizePlan(plan)
  const maxAccounts = getMaxLiveAccounts(normalized)

  if (maxAccounts < 0) {
    return '当前套餐不限制直播账号数量'
  }

  const planName = PLAN_TEXT_MAP[normalized]
  return `${planName}最多可添加 ${maxAccounts} 个直播账号`
}

/**
 * 比较两个套餐的等级
 * 
 * @deprecated
 * 使用 AccessControl.Policy.comparePlanLevel(planA, planB)
 */
export function comparePlanLevel(planA: string, planB: string): number {
  const levelA = PLAN_LEVEL[normalizePlan(planA)]
  const levelB = PLAN_LEVEL[normalizePlan(planB)]
  return levelA - levelB
}

/**
 * 判断是否满足最低套餐要求
 * 
 * @deprecated
 * 使用 AccessControl.Policy.meetsMinimumPlan(currentPlan, requiredPlan)
 */
export function meetsMinimumPlan(
  currentPlan: string | null | undefined,
  requiredPlan: PlanType,
): boolean {
  return comparePlanLevel(currentPlan || 'free', requiredPlan) >= 0
}

/**
 * 获取有效套餐
 * 
 * @deprecated
 * 使用 AccessControl.buildAccessContext() + context.plan
 * context.plan 已经通过 getEffectivePlan 处理
 */
export function getEffectivePlan(
  plan: string | null | undefined,
  trialStatus?: { is_active?: boolean; is_expired?: boolean } | null,
): PlanType {
  const normalizedPlan = normalizePlan(plan)

  if (['pro', 'pro_max', 'ultra'].includes(normalizedPlan)) {
    return normalizedPlan as PlanType
  }

  if (normalizedPlan === 'trial' || (trialStatus?.is_active && !trialStatus?.is_expired)) {
    return 'trial'
  }

  return 'free'
}

/**
 * 从 UserStatus 获取统一订阅信息
 * 
 * @deprecated
 * 使用 AccessControl.buildAccessContext() 获取完整的权限上下文
 */
export function getSubscriptionFromUserStatus(userStatus: UserStatus | null) {
  if (!userStatus) {
    return {
      plan: 'free' as PlanType,
      expireAt: null as number | null,
      maxAccounts: 1,
      isExpired: false,
    }
  }

  const plan = getEffectivePlan(userStatus.plan, userStatus.trial)

  let expireAt: number | null = null
  let isExpired = false

  if (plan === 'trial' && userStatus.trial?.end_at) {
    expireAt = new Date(userStatus.trial.end_at).getTime()
    isExpired = userStatus.trial.is_expired || false
  }

  return {
    plan,
    expireAt,
    maxAccounts: userStatus.max_accounts ?? getMaxLiveAccounts(plan),
    isExpired,
  }
}

/**
 * 获取套餐升级建议
 * 
 * @deprecated
 * 使用 AccessControl.Policy.getUpgradeSuggestion(currentPlan)
 */
export function getUpgradeSuggestion(currentPlan: string): string {
  const normalized = normalizePlan(currentPlan)

  if (normalized === 'free') {
    return '升级专业版可使用全部功能'
  }
  if (normalized === 'trial') {
    return '试用期结束后，升级专业版可继续使用全部功能'
  }
  if (normalized === 'pro') {
    return '升级专业增强版可添加最多3个直播账号'
  }
  if (normalized === 'pro_max') {
    return '升级旗舰版可无限制添加直播账号'
  }

  return ''
}
