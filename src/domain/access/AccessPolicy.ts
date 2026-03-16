/**
 * 权限策略定义 - AccessPolicy
 *
 * 统一定义所有权限判断策略和套餐规则。
 * 所有权限判断函数必须是纯函数，只依赖 AccessContext。
 */

import type { AccessContext, AccessDecision } from './AccessContext'
import { type CapabilityFeatureType, getAuthFeatureForCapabilityFeature } from './featureAccessMap'

export type { PlanRule, PlanType } from './planRules'
export {
  canUseAllFeatures,
  comparePlanLevel,
  getEffectivePlan,
  getMaxLiveAccounts,
  getUpgradeSuggestion,
  isPaidPlan,
  meetsMinimumPlan,
  normalizePlan,
  PLAN_LEVEL,
  PLAN_RULES,
  PLAN_TEXT_MAP,
  VALID_PLANS,
} from './planRules'

import { getUpgradeSuggestion, normalizePlan, PLAN_TEXT_MAP } from './planRules'

function getServerFeatureDecision(
  context: AccessContext,
  feature: CapabilityFeatureType,
): AccessDecision | null {
  const authFeature = getAuthFeatureForCapabilityFeature(feature)
  const serverDecision = context.capabilities?.feature_access?.[authFeature]

  if (!serverDecision) {
    return null
  }

  if (serverDecision.can_access) {
    return { allowed: true }
  }

  if (serverDecision.requires_auth && !context.isAuthenticated) {
    return {
      allowed: false,
      reason: '请先登录',
      action: 'login',
    }
  }

  const requiredPlan = normalizePlan(serverDecision.required_plan)
  if (requiredPlan === 'trial') {
    return {
      allowed: false,
      reason:
        context.plan === 'trial' && context.trialExpired
          ? '试用已经结束，升级会员后就能继续使用这个功能'
          : '开通免费试用或升级会员后，就可以使用这个功能了',
      action: 'subscribe',
      requiredPlan,
    }
  }

  return {
    allowed: false,
    reason: `此功能需要 ${PLAN_TEXT_MAP[requiredPlan]} 权限`,
    action: 'upgrade',
    requiredPlan,
  }
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
  const serverDecision = getServerFeatureDecision(context, 'connectLiveControl')
  if (serverDecision) {
    return serverDecision
  }

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
  return getServerFeatureDecision(context, 'aiAssistant') ?? canConnectLiveControl(context)
}

/**
 * 是否可以使用自动回复功能
 * 规则：与连接直播中控台相同
 */
export function canUseAutoReply(context: AccessContext): AccessDecision {
  return getServerFeatureDecision(context, 'autoReply') ?? canConnectLiveControl(context)
}

/**
 * 是否可以使用自动发言功能
 * 规则：与连接直播中控台相同
 */
export function canUseAutoMessage(context: AccessContext): AccessDecision {
  return getServerFeatureDecision(context, 'autoMessage') ?? canConnectLiveControl(context)
}

/**
 * 是否可以使用自动弹窗功能
 * 规则：与连接直播中控台相同
 */
export function canUseAutoPopUp(context: AccessContext): AccessDecision {
  return getServerFeatureDecision(context, 'autoPopUp') ?? canConnectLiveControl(context)
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

  const reason = `${planName}最多可添加 ${maxLiveAccounts} 个直播账号${requiredPlan ? `，升级到${nextPlanName}可以添加更多` : ''}`

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
