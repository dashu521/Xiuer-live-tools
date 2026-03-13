/**
 * 权限控制核心 - AccessControl
 *
 * 提供统一权限检查入口和上下文构建器。
 * 这是权限层的门面(Facade)，对外暴露统一的权限API。
 */

import { useMemo } from 'react'
import type { PlanType } from '@/constants/subscription'
import { useAuthStore } from '@/stores/authStore'
import { useTrialStore } from '@/stores/trialStore'
import { useAccounts } from '@/hooks/useAccounts'
import {
  getEffectivePlan,
  isPaidPlan,
  canUseAllFeatures,
  getMaxLiveAccounts,
} from '@/constants/subscription'
import type { AccessContext, AccessDecision } from './AccessContext'
import { createEmptyAccessContext } from './AccessContext'
import * as Policy from './AccessPolicy'

// ===== 功能类型枚举 =====

/**
 * 功能类型 - 所有需要权限控制的功能
 */
export type FeatureType =
  | 'connectLiveControl' // 连接直播中控台
  | 'aiAssistant' // AI助手
  | 'autoReply' // 自动回复
  | 'autoMessage' // 自动发言
  | 'autoPopUp' // 自动弹窗
  | 'addLiveAccount' // 添加直播账号
  | 'useAllFeatures' // 使用全部功能

// ===== 上下文构建器 =====

/**
 * 从各个 Store 构建统一权限上下文
 *
 * 这是唯一允许直接访问 authStore/trialStore/accounts 的地方。
 * 所有权限判断必须通过此函数获取上下文。
 *
 * @returns AccessContext 统一权限上下文
 */
export function buildAccessContext(): AccessContext {
  const authState = useAuthStore.getState()
  const trialState = useTrialStore.getState()
  const accountsState = useAccounts.getState()

  const userStatus = authState.userStatus
  const user = authState.user

  // 计算有效套餐（正式套餐优先于试用）
  const effectivePlan = getEffectivePlan(userStatus?.plan, userStatus?.trial)

  // 判断试用状态（优先使用服务端状态）
  const trialActive = userStatus?.trial?.is_active ?? false
  const trialExpired = userStatus?.trial?.is_expired ?? false
  const trialEndsAt = userStatus?.trial?.end_at
    ? new Date(userStatus.trial.end_at).getTime()
    : null

  // 计算功能权限
  const paidUser = isPaidPlan(effectivePlan)
  const allFeatures = canUseAllFeatures(effectivePlan)

  // 获取账号上限（优先使用服务端返回的值）
  const maxAccounts = userStatus?.max_accounts ?? getMaxLiveAccounts(effectivePlan)

  return {
    isAuthenticated: authState.isAuthenticated,
    userId: user?.id ?? null,
    username: user?.username ?? null,
    plan: effectivePlan,
    userStatus,
    trialActive,
    trialExpired,
    trialEndsAt,
    canUseAllFeatures: allFeatures,
    isPaidUser: paidUser,
    maxLiveAccounts: maxAccounts,
    currentAccountCount: accountsState.accounts.length,
    isDevEnvironment: import.meta.env.DEV === true,
  }
}

/**
 * 构建指定套餐的权限上下文（用于测试或预览）
 *
 * @param plan 指定套餐类型
 * @returns AccessContext 权限上下文
 */
export function buildAccessContextForPlan(plan: PlanType): AccessContext {
  const context = createEmptyAccessContext()

  context.isAuthenticated = true
  context.plan = plan
  context.isPaidUser = isPaidPlan(plan)
  context.canUseAllFeatures = canUseAllFeatures(plan)
  context.maxLiveAccounts = getMaxLiveAccounts(plan)

  return context
}

// ===== 统一权限检查入口 =====

/**
 * 统一权限检查入口
 *
 * 所有权限判断必须通过此函数完成。
 * 根据功能类型调用相应的策略函数。
 *
 * @param context 权限上下文
 * @param feature 功能类型
 * @returns AccessDecision 权限判断结果
 *
 * @example
 * ```typescript
 * const context = buildAccessContext()
 * const decision = checkAccess(context, 'connectLiveControl')
 * if (!decision.allowed) {
 *   showToast(decision.reason)
 * }
 * ```
 */
export function checkAccess(context: AccessContext, feature: FeatureType): AccessDecision {
  // 未登录状态快速返回
  if (!context.isAuthenticated && feature !== 'addLiveAccount') {
    return {
      allowed: false,
      reason: '请先登录',
      action: 'login',
    }
  }

  switch (feature) {
    case 'connectLiveControl':
      return Policy.canConnectLiveControl(context)

    case 'aiAssistant':
      return Policy.canUseAiAssistant(context)

    case 'autoReply':
      return Policy.canUseAutoReply(context)

    case 'autoMessage':
      return Policy.canUseAutoMessage(context)

    case 'autoPopUp':
      return Policy.canUseAutoPopUp(context)

    case 'addLiveAccount':
      return Policy.canAddMoreLiveAccounts(context)

    case 'useAllFeatures':
      if (context.canUseAllFeatures) {
        return { allowed: true }
      }
      return {
        allowed: false,
        reason: '当前套餐不支持使用全部功能',
        action: 'upgrade',
        requiredPlan: 'pro',
      }

    default:
      return {
        allowed: false,
        reason: '未知功能类型',
        action: 'none',
      }
  }
}

// ===== 便捷函数 =====

/**
 * 检查是否可以连接直播中控台（便捷函数）
 *
 * @param context 权限上下文
 * @returns boolean 是否允许
 */
export function canConnectLiveControl(context: AccessContext): boolean {
  return Policy.canConnectLiveControl(context).allowed
}

/**
 * 检查是否可以使用 AI 助手（便捷函数）
 *
 * @param context 权限上下文
 * @returns boolean 是否允许
 */
export function canUseAiAssistant(context: AccessContext): boolean {
  return Policy.canUseAiAssistant(context).allowed
}

/**
 * 检查是否可以添加更多直播账号（便捷函数）
 *
 * @param context 权限上下文
 * @returns boolean 是否允许
 */
export function canAddMoreLiveAccounts(context: AccessContext): boolean {
  return Policy.canAddMoreLiveAccounts(context).allowed
}

/**
 * 获取直播账号上限（便捷函数）
 *
 * @param context 权限上下文
 * @returns number 账号上限（-1表示无限制）
 */
export function getLiveAccountLimit(context: AccessContext): number {
  return Policy.getLiveAccountLimit(context)
}

/**
 * 检查是否为付费用户（便捷函数）
 *
 * @param context 权限上下文
 * @returns boolean 是否为付费用户
 */
export function isPaidUser(context: AccessContext): boolean {
  return Policy.isPaidUser(context)
}

/**
 * 获取有效套餐（便捷函数）
 *
 * @param context 权限上下文
 * @returns PlanType 有效套餐类型
 */
export function getEffectivePlanFromContext(context: AccessContext): PlanType {
  return context.plan
}

// ===== Hook 封装（供React组件使用） =====

/**
 * 使用权限上下文的 Hook
 *
 * 【修复】改造为真正响应式 Hook，订阅相关 store 状态变化
 * 确保当 userStatus / user / isAuthenticated 变化时自动重新计算
 *
 * @returns AccessContext 当前权限上下文
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const access = useAccessContext()
 *   return <div>当前套餐: {access.plan}</div>
 * }
 * ```
 */
export function useAccessContext(): AccessContext {
  // 订阅 authStore 的关键状态，确保变化时重新渲染
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const user = useAuthStore(s => s.user)
  const userStatus = useAuthStore(s => s.userStatus)

  // 订阅 trialStore 的关键状态
  const trialActivated = useTrialStore(s => s.trialActivated)
  const trialEndsAt = useTrialStore(s => s.trialEndsAt)

  // 订阅 accounts 状态
  const accounts = useAccounts(s => s.accounts)

  // 使用 useMemo 缓存计算结果，但依赖状态变化时重新计算
  return useMemo(() => {
    const context = buildAccessContext()

    // DEV 模式下输出调试日志
    if (import.meta.env.DEV) {
      console.log('[useAccessContext] Recomputed:', {
        plan: context.plan,
        trialEndsAt: context.trialEndsAt,
        maxLiveAccounts: context.maxLiveAccounts,
        isAuthenticated: context.isAuthenticated,
        timestamp: Date.now(),
      })
    }

    return context
  }, [
    // 明确列出所有依赖项，确保任何相关状态变化都触发重新计算
    isAuthenticated,
    user?.id,
    user?.plan,
    user?.expire_at,
    userStatus?.plan,
    userStatus?.max_accounts,
    userStatus?.trial?.is_active,
    userStatus?.trial?.is_expired,
    userStatus?.trial?.end_at,
    trialActivated,
    trialEndsAt,
    accounts.length,
  ])
}

/**
 * 使用权限检查的 Hook
 *
 * 【修复】使用响应式的 useAccessContext，确保状态变化时自动重新计算
 *
 * @param feature 功能类型
 * @returns AccessDecision 权限判断结果
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const decision = useAccessCheck('connectLiveControl')
 *   return (
 *     <Button disabled={!decision.allowed}>
 *       连接中控台
 *     </Button>
 *   )
 * }
 * ```
 */
export function useAccessCheck(feature: FeatureType): AccessDecision {
  const context = useAccessContext()
  return useMemo(() => checkAccess(context, feature), [context, feature])
}
