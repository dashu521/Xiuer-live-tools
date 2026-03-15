/**
 * 统一权限中心 - Access Layer
 *
 * 这是全项目权限判断的唯一入口。
 * 所有权限相关的判断必须通过此模块完成。
 *
 * 快速开始：
 * ```typescript
 * import { buildAccessContext, checkAccess, useAccessCheck } from '@/domain/access'
 *
 * // 方法1：使用 Hook（React组件中）
 * function MyComponent() {
 *   const decision = useAccessCheck('connectLiveControl')
 *   return <Button disabled={!decision.allowed}>连接</Button>
 * }
 *
 * // 方法2：使用上下文（需要详细信息时）
 * const context = buildAccessContext()
 * console.log(context.plan, context.isPaidUser)
 *
 * // 方法3：使用检查函数（需要决策信息时）
 * const decision = checkAccess(context, 'addLiveAccount')
 * if (!decision.allowed) {
 *   showUpgradeDialog(decision.requiredPlan)
 * }
 * ```
 *
 * 架构说明：
 * - AccessContext: 统一权限上下文，聚合所有权限数据
 * - AccessPolicy: 权限策略定义，包含所有判断规则
 * - AccessControl: 权限控制核心，提供统一检查入口
 */

export type { PlanType } from '@/constants/subscription'
// ===== 类型导出 =====
export type { AccessContext, AccessDecision } from './AccessContext'
// ===== 工具函数导出 =====
export { createEmptyAccessContext } from './AccessContext'
export type { FeatureType } from './AccessControl'

// ===== 核心函数导出 =====
export {
  // 上下文构建
  buildAccessContext,
  buildAccessContextForPlan,
  canAddMoreLiveAccounts,
  // 便捷函数
  canConnectLiveControl,
  canUseAiAssistant,
  // 权限检查
  checkAccess,
  getEffectivePlanFromContext,
  getLiveAccountLimit,
  isPaidUser,
  useAccessCheck,
  // Hooks
  useAccessContext,
} from './AccessControl'
export type { PlanRule } from './AccessPolicy'
// ===== 策略函数导出（高级使用） =====
export {
  canAddMoreLiveAccounts as checkAddMoreLiveAccounts,
  // 功能权限
  canConnectLiveControl as checkConnectLiveControl,
  canUseAiAssistant as checkAiAssistant,
  canUseAllFeatures as canUseAllFeaturesByType,
  canUseAutoMessage,
  canUseAutoPopUp,
  canUseAutoReply,
  comparePlanLevel,
  getAccountLimitMessage,
  getEffectivePlan,
  // 资源限制
  getLiveAccountLimit as checkLiveAccountLimit,
  getMaxLiveAccounts,
  getUpgradeSuggestion,
  isActiveTrialUser,
  isFreeUser,
  isPaidPlan as isPaidPlanByType,
  // 用户类型判断
  isPaidUser as checkPaidUser,
  meetsMinimumPlan,
  // 套餐判断
  normalizePlan,
  PLAN_LEVEL,
  // 套餐规则
  PLAN_RULES,
  PLAN_TEXT_MAP,
  VALID_PLANS,
} from './AccessPolicy'
