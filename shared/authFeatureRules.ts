import authFeatureRulesData from './authFeatureRules.data.json'
import type { PlanType } from './planRules'

export type AuthFeature =
  | 'auto_reply'
  | 'auto_message'
  | 'auto_popup'
  | 'ai_chat'
  | 'live_control'
  | 'settings'
  | 'preview'

export interface AuthFeatureRule {
  requiresAuth: boolean
  requiredPlan: PlanType
}

export const AUTH_FEATURE_RULES = authFeatureRulesData as Record<AuthFeature, AuthFeatureRule>

const DEFAULT_AUTH_FEATURE_RULE: AuthFeatureRule = {
  requiresAuth: false,
  requiredPlan: 'trial',
}

export function isAuthFeature(feature: string): feature is AuthFeature {
  return feature in AUTH_FEATURE_RULES
}

export function getAuthFeatureRule(feature: string): AuthFeatureRule {
  if (isAuthFeature(feature)) {
    return AUTH_FEATURE_RULES[feature]
  }
  return DEFAULT_AUTH_FEATURE_RULE
}

export function requiresAuthentication(feature: string): boolean {
  return getAuthFeatureRule(feature).requiresAuth
}

export function getRequiredPlan(feature: string): PlanType {
  return getAuthFeatureRule(feature).requiredPlan
}
