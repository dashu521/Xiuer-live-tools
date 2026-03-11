/**
 * 开播自动启动 Hook
 * 当检测到直播状态变为 'live' 时，自动启动所有任务
 *
 * 注意：此功能使用账号隔离的存储，每个账号可以独立设置
 */

import { useEffect, useRef } from 'react'
import { getAccountPreference, setAccountPreference } from './useAccountPreference'
import { useAccounts } from './useAccounts'
import { useCurrentLiveControl } from './useLiveControl'
import { useOneClickStart } from './useOneClickStart'

const AUTO_START_ON_LIVE_KEY = 'auto-start-on-live-enabled'

/**
 * 获取当前账号的开播自动启动设置
 * @deprecated 使用 getAccountAutoStartOnLive 替代
 */
export function getAutoStartOnLive(): boolean {
  try {
    return localStorage.getItem(AUTO_START_ON_LIVE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * 设置开播自动启动（全局，已废弃）
 * @deprecated 使用 setAccountAutoStartOnLive 替代
 */
export function setAutoStartOnLive(value: boolean): void {
  try {
    localStorage.setItem(AUTO_START_ON_LIVE_KEY, value ? 'true' : 'false')
  } catch {
    // ignore
  }
}

/**
 * 获取指定账号的开播自动启动设置
 * @param accountId 账号ID
 * @returns 是否启用开播自动启动
 */
export function getAccountAutoStartOnLive(accountId: string): boolean {
  return getAccountPreference(accountId, AUTO_START_ON_LIVE_KEY, false)
}

/**
 * 设置指定账号的开播自动启动
 * @param accountId 账号ID
 * @param value 是否启用
 */
export function setAccountAutoStartOnLive(accountId: string, value: boolean): void {
  setAccountPreference(accountId, AUTO_START_ON_LIVE_KEY, value)
}

/**
 * 监听直播状态，当变为 'live' 时自动启动任务
 */
export function useAutoStartOnLive() {
  const { currentAccountId } = useAccounts()
  const streamState = useCurrentLiveControl(context => context.streamState)
  const { startAllTasks, state } = useOneClickStart()

  // 使用 ref 记录上一次的直播状态，避免重复触发
  const prevStreamStateRef = useRef(streamState)
  // 使用 ref 记录当前账号是否已经自动启动过，避免重复启动
  const hasAutoStartedRef = useRef(false)

  useEffect(() => {
    // 使用账号隔离的设置
    const isEnabled = currentAccountId
      ? getAccountAutoStartOnLive(currentAccountId)
      : getAutoStartOnLive()

    if (!isEnabled) return

    // 直播状态从非 'live' 变为 'live'
    const wasNotLive = prevStreamStateRef.current !== 'live'
    const isNowLive = streamState === 'live'

    if (wasNotLive && isNowLive && !hasAutoStartedRef.current) {
      // 检查是否可以启动任务
      if (state.canStart) {
        console.log('[AutoStartOnLive] 检测到开播，自动启动任务')
        hasAutoStartedRef.current = true
        startAllTasks()
      }
    }

    // 如果直播结束，重置自动启动标记
    if (streamState === 'ended' || streamState === 'offline') {
      hasAutoStartedRef.current = false
    }

    prevStreamStateRef.current = streamState
  }, [streamState, state.canStart, startAllTasks, currentAccountId])

  // 当切换账号时，重置自动启动标记
  useEffect(() => {
    hasAutoStartedRef.current = false
    prevStreamStateRef.current = streamState
  }, [streamState])
}
