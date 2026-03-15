import { describe, expect, it } from 'vitest'
import type { AccessContext } from '../AccessContext'
import { canConnectLiveControl, canUseAiAssistant, canUseAutoReply } from '../AccessPolicy'

function createContext(): AccessContext {
  return {
    isAuthenticated: true,
    userId: 'user-1',
    username: 'tester',
    plan: 'trial',
    userStatus: null,
    capabilities: {
      is_paid_user: false,
      can_use_all_features: true,
      max_live_accounts: 1,
      feature_access: {
        live_control: {
          requires_auth: true,
          required_plan: 'trial',
          can_access: true,
        },
        auto_reply: {
          requires_auth: true,
          required_plan: 'trial',
          can_access: true,
        },
        ai_chat: {
          requires_auth: true,
          required_plan: 'pro',
          can_access: false,
        },
      },
    },
    trialActive: true,
    trialExpired: false,
    trialEndsAt: null,
    expiresAt: null,
    canUseAllFeatures: true,
    isPaidUser: false,
    maxLiveAccounts: 1,
    currentAccountCount: 0,
    isDevEnvironment: false,
  }
}

describe('AccessPolicy server capabilities', () => {
  it('allows auto reply when server capability allows it', () => {
    expect(canUseAutoReply(createContext())).toEqual({ allowed: true })
  })

  it('allows live control when server capability allows it', () => {
    expect(canConnectLiveControl(createContext())).toEqual({ allowed: true })
  })

  it('uses server capability required plan for AI assistant', () => {
    expect(canUseAiAssistant(createContext())).toEqual({
      allowed: false,
      reason: '此功能需要 专业版 权限',
      action: 'upgrade',
      requiredPlan: 'pro',
    })
  })
})
