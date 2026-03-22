/**
 * 订阅系统规则中心
 *
 * 当前仅保留兼容入口；基础套餐规则已收敛到 src/domain/access/planRules。
 */

import type { PlanType } from '@/domain/access/planRules'
import {
  canUseAllFeatures as canUseAllFeaturesByPlan,
  comparePlanLevel as comparePlanLevelByPlan,
  PLAN_LEVEL as DOMAIN_PLAN_LEVEL,
  PLAN_RULES as DOMAIN_PLAN_RULES,
  PLAN_TEXT_MAP as DOMAIN_PLAN_TEXT_MAP,
  VALID_PLANS as DOMAIN_VALID_PLANS,
  getEffectivePlan as getEffectivePlanByRule,
  getMaxLiveAccounts as getMaxLiveAccountsByPlan,
  getUpgradeSuggestion as getUpgradePlanSuggestion,
  isPaidPlan as isPaidPlanByPlan,
  meetsMinimumPlan as meetsMinimumPlanByPlan,
  normalizePlan as normalizePlanByRule,
} from '@/domain/access/planRules'
import type { UserStatus } from '@/types/auth'

export type { PlanRule, PlanType } from '@/domain/access/planRules'

export const VALID_PLANS = DOMAIN_VALID_PLANS
export const PLAN_TEXT_MAP = DOMAIN_PLAN_TEXT_MAP
export const PLAN_LEVEL = DOMAIN_PLAN_LEVEL
export const PLAN_RULES = DOMAIN_PLAN_RULES

/**
 * 归一化套餐值
 *
 * @deprecated
 * 使用 AccessControl.buildAccessContext() 获取已归一化的 plan
 * 或直接使用 context.plan
 */
export function normalizePlan(plan: string | null | undefined): PlanType {
  return normalizePlanByRule(plan)
}

/**
 * 判断是否为付费套餐
 *
 * @deprecated
 * 使用 AccessControl.buildAccessContext() + context.isPaidUser
 * 或 checkAccess(context, feature).allowed
 */
export function isPaidPlan(plan: string | null | undefined): boolean {
  return isPaidPlanByPlan(normalizePlan(plan))
}

/**
 * 判断是否可以使用全部功能
 *
 * @deprecated
 * 使用 AccessControl.buildAccessContext() + context.canUseAllFeatures
 * 或 checkAccess(context, 'useAllFeatures').allowed
 */
export function canUseAllFeatures(plan: string | null | undefined): boolean {
  return canUseAllFeaturesByPlan(normalizePlan(plan))
}

/**
 * 获取最大直播账号数
 *
 * @deprecated
 * 使用 AccessControl.buildAccessContext() + context.maxLiveAccounts
 */
export function getMaxLiveAccounts(plan: string | null | undefined): number {
  return getMaxLiveAccountsByPlan(normalizePlan(plan))
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
  return comparePlanLevelByPlan(normalizePlan(planA), normalizePlan(planB))
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
  return meetsMinimumPlanByPlan(normalizePlan(currentPlan), requiredPlan)
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
  return getEffectivePlanByRule(plan, trialStatus)
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
      plan: 'trial' as PlanType,
      expireAt: null as number | null,
      maxAccounts: 1,
      isExpired: false,
    }
  }

  // 服务端 userStatus.plan 已经是套餐真相源；
  // 这里只保留兼容出口，不再在前端重新推导正式套餐与试用优先级。
  const plan = normalizePlan(userStatus.plan)

  let expireAt: number | null = null
  let isExpired = false

  if (plan === 'trial' && userStatus.trial?.end_at) {
    expireAt = new Date(userStatus.trial.end_at).getTime()
    isExpired = userStatus.trial.is_expired || false
  }

  return {
    plan,
    expireAt,
    maxAccounts:
      userStatus.capabilities?.max_live_accounts ??
      userStatus.max_accounts ??
      getMaxLiveAccounts(plan),
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
  const targetPlan = getUpgradePlanSuggestion(normalized)

  if (!targetPlan) {
    return ''
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

  return `升级 ${PLAN_TEXT_MAP[targetPlan]} 可获得更多权益`
}
