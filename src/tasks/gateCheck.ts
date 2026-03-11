/**
 * Gate 检查纯函数
 * 用于 TaskManager 中判断是否可以启动任务
 */

import type { StreamStatus } from 'shared/streamStatus'

export type GateCheckResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_CONNECTED' | 'NOT_LIVE' | 'AUTH_LOST'; message: string }

/**
 * 检查 Gate 条件
 * @param connectionState - 连接状态
 * @param streamState - 直播状态
 * @returns Gate 检查结果
 */
export function gateCanRun(
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error',
  streamState: StreamStatus,
): GateCheckResult {
  // 前置条件1：中控台必须已连接
  if (connectionState !== 'connected') {
    if (connectionState === 'disconnected') {
      return {
        ok: false,
        reason: 'NOT_CONNECTED',
        message: '请先连接直播中控台',
      }
    }
    if (connectionState === 'connecting') {
      return {
        ok: false,
        reason: 'NOT_CONNECTED',
        message: '正在连接中控台，请稍候',
      }
    }
    return {
      ok: false,
      reason: 'NOT_CONNECTED',
      message: '中控台连接异常，请重新连接',
    }
  }

  // 前置条件2：必须已开播
  if (streamState !== 'live') {
    return {
      ok: false,
      reason: 'NOT_LIVE',
      message: '当前未开播，请先开始直播后再启用该功能',
    }
  }

  // 前置条件2已完成：直播状态检查
  // TODO: 前置条件3：登录状态检查（authState !== 'invalid'）

  return { ok: true }
}
