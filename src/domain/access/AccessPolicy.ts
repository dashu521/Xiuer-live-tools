/**
 * 权限策略定义 - AccessPolicy
 *
 * 统一定义所有权限判断策略和套餐规则。
 * 所有权限判断函数必须是纯函数，只依赖 AccessContext。
 */

import type { PlanType } from '@/constants/subscription'
import type { AccessContext, AccessDecision } from './AccessContext'

// ===== 套餐规则定义 =====

/** 套餐等级 (用于比较) */
export const PLAN_LEVEL: Record<PlanType, number> = {
  free: 0,
  trial: 1,
  pro: 2,
  pro_max: 3,
  ultra: 4,
}

/** 套餐显示文案映射 */
export const PLAN_TEXT_MAP: Record<PlanType, string> = {
  free: '免费版',
  trial: '试用版',
  pro: '专业版',
  pro_max: '专业增强版',
  ultra: '旗舰版',
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
    maxLiveAccounts: -1, // -1 表示无限制
    canUseAllFeatures: true,
    isPaid: true,
    themeColor: 'purple',
    iconType: 'ultra',
  },
}

/** 所有合法套餐值 */
export const VALID_PLANS: PlanType[] = ['free', 'trial', 'pro', 'pro_max', 'ultra']

// ===== 套餐判断函数 =====

/**
 * 归一化套餐值
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
 */
export function isPaidPlan(plan: PlanType): boolean {
  return PLAN_RULES[plan]?.isPaid || false
}

/**
 * 判断是否可以使用全部功能
 */
export function canUseAllFeatures(plan: PlanType): boolean {
  return PLAN_RULES[plan]?.canUseAllFeatures || false
}

/**
 * 获取最大直播账号数
 */
export function getMaxLiveAccounts(plan: PlanType): number {
  return PLAN_RULES[plan]?.maxLiveAccounts ?? 1
}

/**
 * 比较两个套餐的等级
 * @returns 正数表示 planA 等级更高，负数表示 planB 等级更高，0 表示相等
 */
export function comparePlanLevel(planA: PlanType, planB: PlanType): number {
  return PLAN_LEVEL[planA] - PLAN_LEVEL[planB]
}

/**
 * 判断是否满足最低套餐要求
 */
export function meetsMinimumPlan(currentPlan: PlanType, requiredPlan: PlanType): boolean {
  return comparePlanLevel(currentPlan, requiredPlan) >= 0
}

/**
 * 获取有效套餐
 * 规则：正式套餐(pro/pro_max/ultra) > 试用(trial) > 免费(free)
 */
export function getEffectivePlan(
  plan: string | null | undefined,
  trialStatus?: { is_active?: boolean; is_expired?: boolean } | null,
): PlanType {
  const normalizedPlan = normalizePlan(plan)

  // 正式套餐直接返回
  if (['pro', 'pro_max', 'ultra'].includes(normalizedPlan)) {
    return normalizedPlan as PlanType
  }

  // 试用状态判断
  if (normalizedPlan === 'trial' || (trialStatus?.is_active && !trialStatus?.is_expired)) {
    return 'trial'
  }

  return 'free'
}

/**
 * 获取套餐升级建议
 */
export function getUpgradeSuggestion(currentPlan: PlanType): PlanType | undefined {
  const upgradeMap: Record<PlanType, PlanType | undefined> = {
    free: 'pro',
    trial: 'pro',
    pro: 'pro_max',
    pro_max: 'ultra',
    ultra: undefined,
  }
  return upgradeMap[currentPlan]
}

// ===== 用户类型判断 =====

/**
 * 是否为付费用户
 */
export function isPaidUser(context: AccessContext): boolean {
  return context.isPaidUser
}

/**
 * 是否为试用用户（且试用有效）
 */
export function isActiveTrialUser(context: AccessContext): boolean {
  return context.plan === 'trial' && context.trialActive && !context.trialExpired
}

/**
 * 是否为免费用户
 */
export function isFreeUser(context: AccessContext): boolean {
  return context.plan === 'free'
}

// ===== 功能权限判断 =====

/**
 * 是否可以连接直播中控台
 * 规则：已登录 + (付费用户 | 试用有效)
 */
export function canConnectLiveControl(context: AccessContext): AccessDecision {
  if (!context.isAuthenticated) {
    return {
      allowed: false,
      reason: '请先登录',
      action: 'login',
    }
  }

  if (context.isPaidUser) {
    return { allowed: true }
  }

  if (context.plan === 'trial') {
    if (context.trialExpired) {
      return {
        allowed: false,
        reason: '试用已经结束，升级会员后就能继续使用全部功能',
        action: 'subscribe',
      }
    }
    if (context.trialActive) {
      return { allowed: true }
    }
  }

  return {
    allowed: false,
    reason: '开通免费试用或升级会员后，就可以使用这个功能了',
    action: 'subscribe',
  }
}

/**
 * 是否可以使用 AI 助手
 * 规则：与连接直播中控台相同
 */
export function canUseAiAssistant(context: AccessContext): AccessDecision {
  return canConnectLiveControl(context)
}

/**
 * 是否可以使用自动回复功能
 * 规则：与连接直播中控台相同
 */
export function canUseAutoReply(context: AccessContext): AccessDecision {
  return canConnectLiveControl(context)
}

/**
 * 是否可以使用自动发言功能
 * 规则：与连接直播中控台相同
 */
export function canUseAutoMessage(context: AccessContext): AccessDecision {
  return canConnectLiveControl(context)
}

/**
 * 是否可以使用自动弹窗功能
 * 规则：与连接直播中控台相同
 */
export function canUseAutoPopUp(context: AccessContext): AccessDecision {
  return canConnectLiveControl(context)
}

// ===== 资源限制判断 =====

/**
 * 获取直播账号上限
 * 规则：
 * - Pro → 1个
 * - ProMax → 3个
 * - Ultra → 无限制(-1)
 */
export function getLiveAccountLimit(context: AccessContext): number {
  return context.maxLiveAccounts
}

/**
 * 是否可以添加更多直播账号
 */
export function canAddMoreLiveAccounts(context: AccessContext): AccessDecision {
  const { maxLiveAccounts, currentAccountCount } = context

  if (maxLiveAccounts < 0) {
    return { allowed: true }
  }

  if (currentAccountCount < maxLiveAccounts) {
    return { allowed: true }
  }

  const requiredPlan = getUpgradeSuggestion(context.plan)
  const planName = PLAN_TEXT_MAP[context.plan]
  const nextPlanName = requiredPlan ? PLAN_TEXT_MAP[requiredPlan] : ''
  
  let reason = ''
  if (context.plan === 'pro') {
    reason = '当前专业版最多可添加 1 个直播账号。想添加更多账号，可以升级到 Pro Max。'
  } else if (context.plan === 'pro_max') {
    reason = '当前 Pro Max 最多可添加 3 个直播账号。想添加更多账号，可以升级到 Ultra。'
  } else {
    reason = `${planName}最多可添加 ${maxLiveAccounts} 个直播账号${requiredPlan ? `，升级到${nextPlanName}可以添加更多` : ''}`
  }
  
  return {
    allowed: false,
    reason,
    action: 'upgrade',
    requiredPlan,
  }
}

/**
 * 获取添加账号的限制提示文案
 */
export function getAccountLimitMessage(context: AccessContext): string {
  const maxAccounts = context.maxLiveAccounts

  if (maxAccounts < 0) {
    return '当前会员不限制直播账号数量'
  }

  const planName = PLAN_TEXT_MAP[context.plan]
  return `${planName}最多可添加 ${maxAccounts} 个直播账号`
}
