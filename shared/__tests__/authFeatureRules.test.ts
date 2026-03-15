import { describe, expect, it } from 'vitest'
import {
  AUTH_FEATURE_RULES,
  getAuthFeatureRule,
  getRequiredPlan,
  isAuthFeature,
  requiresAuthentication,
} from '../authFeatureRules'

describe('authFeatureRules', () => {
  it('应为受支持功能提供完整规则', () => {
    expect(AUTH_FEATURE_RULES.auto_reply).toEqual({
      requiresAuth: true,
      requiredPlan: 'trial',
    })
    expect(AUTH_FEATURE_RULES.live_control).toEqual({
      requiresAuth: true,
      requiredPlan: 'trial',
    })
    expect(AUTH_FEATURE_RULES.ai_chat).toEqual({
      requiresAuth: true,
      requiredPlan: 'pro',
    })
  })

  it('应正确识别支持的功能', () => {
    expect(isAuthFeature('auto_message')).toBe(true)
    expect(isAuthFeature('unknown_feature')).toBe(false)
  })

  it('未知功能应回退到默认免费规则', () => {
    expect(getAuthFeatureRule('unknown_feature')).toEqual({
      requiresAuth: false,
      requiredPlan: 'free',
    })
    expect(requiresAuthentication('unknown_feature')).toBe(false)
    expect(getRequiredPlan('unknown_feature')).toBe('free')
  })
})
