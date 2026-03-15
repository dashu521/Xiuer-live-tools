import planRulesData from './planRules.data.json'

export type PlanType = 'free' | 'trial' | 'pro' | 'pro_max' | 'ultra'
export type MembershipStatus = PlanType | 'expired'

export interface PlanRule {
  name: string
  level: number
  maxLiveAccounts: number
  canUseAllFeatures: boolean
  isPaid: boolean
  themeColor: string
  iconType: PlanType
}

type TierBenefit = {
  max_accounts: number
  features: string[]
  duration_days: number | null
  plan: PlanType
}

export const VALID_PLANS = [...planRulesData.validPlans] as PlanType[]
export const PAID_PLANS = [...planRulesData.paidPlans] as PlanType[]
export const PLAN_TEXT_MAP = planRulesData.planTextMap as Record<PlanType, string>
export const MEMBERSHIP_LABELS = planRulesData.membershipLabels as Record<MembershipStatus, string>
export const PLAN_RULES = planRulesData.planRules as Record<PlanType, PlanRule>
export const LEGACY_MEMBERSHIP_TYPE_TO_TIER = planRulesData.legacyMembershipTypeToTier as Record<
  string,
  PlanType
>
export const TIER_BENEFITS = planRulesData.tierBenefits as Record<
  Exclude<PlanType, 'free' | 'trial'>,
  TierBenefit
>

export const PLAN_LEVEL: Record<PlanType, number> = Object.fromEntries(
  VALID_PLANS.map(plan => [plan, PLAN_RULES[plan].level]),
) as Record<PlanType, number>

export function normalizePlan(plan: string | null | undefined): PlanType {
  if (!plan) return 'free'

  const normalized = plan.toLowerCase().trim()
  if (VALID_PLANS.includes(normalized as PlanType)) {
    return normalized as PlanType
  }

  return 'free'
}

export function isPaidPlan(plan: PlanType): boolean {
  return PAID_PLANS.includes(plan)
}

export function canUseAllFeatures(plan: PlanType): boolean {
  return PLAN_RULES[plan]?.canUseAllFeatures || false
}

export function getMaxLiveAccounts(plan: PlanType): number {
  return PLAN_RULES[plan]?.maxLiveAccounts ?? 1
}

export function comparePlanLevel(planA: PlanType, planB: PlanType): number {
  return PLAN_LEVEL[planA] - PLAN_LEVEL[planB]
}

export function meetsMinimumPlan(currentPlan: PlanType, requiredPlan: PlanType): boolean {
  return comparePlanLevel(currentPlan, requiredPlan) >= 0
}

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
