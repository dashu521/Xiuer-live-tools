/**
 * 直播功能 Gate Hook
 * 统一管理所有直播相关功能的运行前置条件
 */

import { useMemo } from 'react'
import type { StreamStatus } from 'shared/streamStatus'
import { useCurrentLiveControl } from './useLiveControl'

export type GateReason = 'NOT_CONNECTED' | 'NOT_LIVE' | 'AUTH_LOST' | 'UNKNOWN'
export type GateAction = 'CONNECT' | 'GO_LIVE' | 'RELOGIN' | null

export interface LiveFeatureGate {
  canUse: boolean
  disabled: boolean
  reason: GateReason | null
  message: string
  action: GateAction
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error'
  streamState: StreamStatus
}

/**
 * 直播功能 Gate Hook
 *
 * @returns LiveFeatureGate
 */
export function useLiveFeatureGate(): LiveFeatureGate {
  const connectState = useCurrentLiveControl(context => context.connectState)
  const streamState = useCurrentLiveControl(context => context.streamState)

  return useMemo(() => {
    const connectionStatus = connectState.status
    const isConnected = connectionStatus === 'connected'
    const isLive = streamState === 'live'

    // 记录 Gate 状态计算（用于调试）
    console.log(
      `[gate] Gate calculation: connectionStatus=${connectionStatus}, streamState=${streamState}, isConnected=${isConnected}, isLive=${isLive}`,
    )

    // 检查前置条件
    let reason: GateReason | null = null
    let message = ''
    let action: GateAction = null

    // 前置条件1：中控台必须已连接
    if (!isConnected) {
      if (connectionStatus === 'disconnected') {
        reason = 'NOT_CONNECTED'
        message = '请先连接直播中控台'
        action = 'CONNECT'
      } else if (connectionStatus === 'connecting') {
        reason = 'NOT_CONNECTED'
        message = '正在连接中控台，请稍候'
        action = 'CONNECT'
      } else {
        reason = 'NOT_CONNECTED'
        message = '中控台连接异常，请重新连接'
        action = 'CONNECT'
      }
    }
    // 前置条件2：必须已开播
    else if (!isLive) {
      if (streamState === 'unknown') {
        reason = 'NOT_LIVE'
        message = '当前未开播，请先开始直播后再启用该功能'
        action = 'GO_LIVE'
      } else if (streamState === 'offline') {
        reason = 'NOT_LIVE'
        message = '当前未开播，请先开始直播后再启用该功能'
        action = 'GO_LIVE'
      } else if (streamState === 'ended') {
        reason = 'NOT_LIVE'
        message = '直播已结束，请重新开播后再启用该功能'
        action = 'GO_LIVE'
      } else {
        reason = 'NOT_LIVE'
        message = '当前未开播，请先开始直播后再启用该功能'
        action = 'GO_LIVE'
      }
    }
    // 前置条件2已完成：直播状态检查
    // TODO: 前置条件3：登录状态检查（authState !== 'invalid'）
    // else if (authState === 'invalid') {
    //   reason = 'AUTH_LOST'
    //   message = '登录已失效，请重新扫码登录'
    //   action = 'RELOGIN'
    // }

    const canUse = isConnected && isLive && reason === null
    const disabled = !canUse

    // 如果没有特定原因，但不可用，则设为 UNKNOWN
    if (!canUse && reason === null) {
      reason = 'UNKNOWN'
      message = '当前状态不可用，请稍后重试'
    }

    const gateResult = {
      canUse,
      disabled,
      reason,
      message,
      action,
      connectionState: connectionStatus,
      streamState,
    }

    // 记录 Gate 计算结果（仅在状态变化时）
    console.log(
      `[gate] Gate result: canUse=${canUse}, reason=${reason}, connectionState=${connectionStatus}, streamState=${streamState}`,
    )

    return gateResult
  }, [connectState.status, streamState])
}
