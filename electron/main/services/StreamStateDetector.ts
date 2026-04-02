/**
 * 直播状态检测器
 * 轮询检测直播状态并发送事件通知前端
 * 优化：直播中 2s 轮询，未开播 5s 轮询；多账号错峰避免同时触发
 */

import { IPC_CHANNELS } from 'shared/ipcChannels'
import type { StreamStatus } from 'shared/streamStatus'
import type { ScopedLogger } from '#/logger'
import type { BrowserSession } from '#/managers/BrowserSessionManager'
import type { IPlatform } from '#/platforms/IPlatform'
import windowManager from '#/windowManager'

const POLL_INTERVAL_LIVE_MS = 2000 // 直播中 2 秒
const POLL_INTERVAL_OFFLINE_MS = 5000 // 未开播 5 秒，降低 CPU
const STAGGER_MAX_MS = 1500 // 多账号错峰：按 accountId 哈希得到 0～1.5s 的初始延迟
const OFFLINE_CONFIRMATION_THRESHOLD = 2 // 连续 2 次异常/离线才真正判定为离线

/** 用 accountId 得到 0～maxMs 的稳定偏移，用于多账号错峰 */
function staggerDelayMs(accountId: string, maxMs: number): number {
  let h = 0
  for (let i = 0; i < accountId.length; i++) {
    h = (h * 31 + accountId.charCodeAt(i)) >>> 0
  }
  return h % (maxMs + 1)
}

export class StreamStateDetector {
  private pollTimer: NodeJS.Timeout | null = null
  private lastState: StreamStatus = 'unknown'
  private isPolling = false
  private onStreamEnded: ((reason: string) => void) | null = null
  private consecutiveOfflineSignals = 0

  constructor(
    private platform: IPlatform,
    private browserSession: BrowserSession | null,
    private accountId: string,
    private logger: ScopedLogger,
  ) {}

  /**
   * 【P0-1 防护机制】获取 detector 是否正在运行
   * 用于外部检查 detector 状态，确保关播时 detector 不被意外停止
   */
  get isRunning(): boolean {
    return this.isPolling
  }

  /**
   * 【P0-1 防护机制】强制保持 detector 运行
   * 当检测到 detector 意外停止时，立即重启
   * 符合规范§4.4：关播不停止 StreamStateDetector
   */
  keepAlive(): boolean {
    if (this.isPolling) {
      this.logger.debug('[keepAlive] Detector is already running')
      return true
    }

    this.logger.warn('[keepAlive] Detector was stopped unexpectedly, restarting...')

    // 只有在有 browserSession 的情况下才能重启
    if (!this.browserSession) {
      this.logger.error('[keepAlive] Cannot restart: browser session is null')
      return false
    }

    this.start()
    return this.isPolling
  }

  /**
   * 设置直播结束时的回调（由 AccountSession 调用）
   */
  setOnStreamEndedCallback(callback: (reason: string) => void) {
    this.onStreamEnded = callback
  }

  /**
   * 开始轮询检测直播状态（自适应间隔 + 错峰）
   */
  start() {
    if (this.isPolling) {
      this.logger.warn('Stream state detector is already polling')
      return
    }

    if (!this.browserSession) {
      this.logger.warn('Cannot start stream state detector: browser session is null')
      return
    }

    this.isPolling = true
    const initialDelayMs = staggerDelayMs(this.accountId, STAGGER_MAX_MS)
    this.logger.info(
      `Starting stream state detector (live=${POLL_INTERVAL_LIVE_MS}ms, offline=${POLL_INTERVAL_OFFLINE_MS}ms, stagger=${initialDelayMs}ms)`,
    )

    // 错峰：延迟首次检测，避免多账号同时触发；首次检测后再进入按间隔轮询
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null
      this.checkStreamState().then(() => {
        if (this.isPolling) this.scheduleCheck()
      })
    }, initialDelayMs)
  }

  /** 根据当前状态决定下次轮询间隔并调度 */
  private scheduleCheck() {
    if (!this.isPolling) return
    const intervalMs =
      this.lastState === 'live' || this.consecutiveOfflineSignals > 0
        ? POLL_INTERVAL_LIVE_MS
        : POLL_INTERVAL_OFFLINE_MS
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null
      this.checkStreamState().then(() => {
        if (this.isPolling) this.scheduleCheck()
      })
    }, intervalMs)
  }

  /**
   * 停止轮询检测
   */
  stop() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    this.isPolling = false
    this.logger.info('Stream state detector stopped')
  }

  /**
   * 更新浏览器会话（连接/重连时调用）
   */
  updateBrowserSession(session: BrowserSession | null) {
    this.browserSession = session
  }

  /**
   * 检测直播状态
   */
  private async checkStreamState() {
    if (!this.browserSession) {
      this.logger.debug('[stream] Browser session is null, skipping check')
      return
    }

    try {
      const isLive = await this.platform.isLive(this.browserSession)
      this.logger.debug(
        `[stream] isLive=${isLive}, currentState=${this.lastState}, consecutiveOfflineSignals=${this.consecutiveOfflineSignals}`,
      )

      if (isLive) {
        this.resetOfflineConfirmation()
        this.updateState('live')
        return
      }

      this.handleOfflineSignal('isLive=false')
    } catch (error) {
      this.logger.error('[stream] Failed to check stream state:', error)
      this.handleOfflineSignal('detection_error')
    }
  }

  private resetOfflineConfirmation() {
    if (this.consecutiveOfflineSignals > 0) {
      this.logger.info(
        `[stream] Offline confirmation reset after live recovery (count=${this.consecutiveOfflineSignals})`,
      )
    }
    this.consecutiveOfflineSignals = 0
  }

  private handleOfflineSignal(reason: 'isLive=false' | 'detection_error') {
    const prevState = this.lastState

    if (prevState === 'offline') {
      this.logger.debug(`[stream] Stream state unchanged: offline (${reason})`)
      return
    }

    this.consecutiveOfflineSignals += 1

    if (this.consecutiveOfflineSignals < OFFLINE_CONFIRMATION_THRESHOLD) {
      this.logger.warn(
        `[stream] Pending offline confirmation ${this.consecutiveOfflineSignals}/${OFFLINE_CONFIRMATION_THRESHOLD}, state stays ${prevState}, reason=${reason}`,
      )
      return
    }

    this.resetOfflineConfirmation()
    this.updateState('offline')

    if (prevState === 'live' && this.onStreamEnded) {
      const callbackReason =
        reason === 'detection_error' ? '检测出错，直播可能已结束' : '直播已结束'
      this.logger.info(
        `[stream][${this.accountId}] Stream ended confirmed after ${OFFLINE_CONFIRMATION_THRESHOLD} checks, reason=${callbackReason}`,
      )
      this.onStreamEnded(callbackReason)
    }
  }

  private updateState(newState: StreamStatus) {
    if (newState === this.lastState) {
      this.logger.debug(`[stream] Stream state unchanged: ${newState}`)
      return
    }

    const prevState = this.lastState
    this.logger.info(`[stream] Stream state changed: ${prevState} -> ${newState}`)
    this.lastState = newState
    windowManager.send(IPC_CHANNELS.tasks.liveControl.streamStateChanged, this.accountId, newState)
  }

  /**
   * 手动设置状态（用于断开连接时）
   */
  setState(state: StreamStatus) {
    this.resetOfflineConfirmation()
    if (state !== this.lastState) {
      this.logger.info(`[stream] Stream state manually set: ${this.lastState} -> ${state}`)
      this.lastState = state
      windowManager.send(IPC_CHANNELS.tasks.liveControl.streamStateChanged, this.accountId, state)
    }
  }
}
