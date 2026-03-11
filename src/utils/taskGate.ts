/**
 * 任务运行守门人机制
 * 统一管理所有直播相关任务的运行前置条件
 */
import type { StreamStatus } from 'shared/streamStatus'

export type TaskStopReason =
  | 'disconnected'
  | 'stream_ended'
  | 'auth_lost'
  | 'manual'
  | 'gate_failed'
  | 'error'

export type TaskStartReasonCode = 'NOT_CONNECTED' | 'NOT_LIVE' | 'AUTH_LOST'

export type TaskAction = 'CONNECT' | 'GO_LIVE' | 'RELOGIN'

export interface TaskStartCheckResult {
  ok: boolean
  reason?: TaskStartReasonCode
  message: string
  action?: TaskAction
}

/**
 * 任务名称映射
 */
const TASK_NAMES: Record<string, string> = {
  'auto-reply': '自动回复',
  'auto-comment': '自动发言',
  'auto-popup': '自动弹窗',
}

interface TaskGateContext {
  status: string
  streamState?: StreamStatus
}

/**
 * 检查是否可以启动任务（统一前置校验）
 *
 * @param connectState - 连接状态
 * @param taskName - 任务名称（'auto-reply' | 'auto-comment' | 'auto-popup'）
 * @returns TaskStartCheckResult
 */
export function ensureCanStartTask(
  connectState: TaskGateContext,
  taskName: 'auto-reply' | 'auto-comment' | 'auto-popup',
): TaskStartCheckResult {
  const displayName = TASK_NAMES[taskName] || taskName

  // 前置条件1：中控台必须已连接
  if (connectState.status !== 'connected') {
    if (connectState.status === 'disconnected') {
      return {
        ok: false,
        reason: 'NOT_CONNECTED',
        message: `请先连接直播中控台\n连接成功后才能使用【${displayName}】`,
        action: 'CONNECT',
      }
    }
    if (connectState.status === 'connecting') {
      return {
        ok: false,
        reason: 'NOT_CONNECTED',
        message: `正在连接中控台，请稍候\n连接成功后才能使用【${displayName}】`,
        action: 'CONNECT',
      }
    }
    return {
      ok: false,
      reason: 'NOT_CONNECTED',
      message: `中控台连接异常，请重新连接\n连接成功后才能使用【${displayName}】`,
      action: 'CONNECT',
    }
  }

  // 前置条件2：直播状态检查（streamStatus === 'live'）
  const streamState = connectState.streamState ?? 'unknown'
  if (streamState !== 'live') {
    const stateMessages: Record<StreamStatus, string> = {
      unknown: '直播状态未知',
      offline: '当前未开播',
      live: '直播中',
      ended: '直播已结束',
    }
    return {
      ok: false,
      reason: 'NOT_LIVE',
      message: `${stateMessages[streamState]}\n请先开播，再启动【${displayName}】`,
      action: 'GO_LIVE',
    }
  }

  // TODO: 前置条件3：登录状态检查（authState !== 'invalid'）
  // if (authState === 'invalid') {
  //   return {
  //     ok: false,
  //     reason: 'AUTH_LOST',
  //     message: `登录已失效\n请重新扫码登录后再启动【${displayName}】`,
  //     action: 'RELOGIN'
  //   }
  // }

  return { ok: true, message: '' }
}

/**
 * 检查是否可以运行直播相关任务（向后兼容）
 *
 * @deprecated 使用 ensureCanStartTask 代替
 */
export function canRunLiveTasks(connectState: { status: string }): {
  canRun: boolean
  reason?: string
} {
  const check = ensureCanStartTask(connectState, 'auto-reply')
  return {
    canRun: check.ok,
    reason: check.message,
  }
}

/**
 * 获取任务停止原因的描述文本（用于强制停止时的提示）
 */
export function getStopReasonText(reason: TaskStopReason, taskName?: string): string {
  const displayName = taskName ? TASK_NAMES[taskName] || taskName : '任务'

  const reasonMap: Record<TaskStopReason, string> = {
    disconnected: `连接已断开，${displayName}已停止`,
    stream_ended: `直播已结束，${displayName}已停止`,
    auth_lost: `登录已失效，${displayName}已停止\n请重新扫码登录后再启动任务`,
    manual: `${displayName}已停止`,
    gate_failed: `条件不满足，${displayName}已停止`,
    error: `发生错误，${displayName}已停止`,
  }
  return reasonMap[reason] || `${displayName}已停止`
}
