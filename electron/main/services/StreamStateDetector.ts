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

  constructor(
    private platform: IPlatform,
    private browserSession: BrowserSession | null,
    private accountId: string,
    private logger: ScopedLogger,
  ) {}

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
    const intervalMs = this.lastState === 'live' ? POLL_INTERVAL_LIVE_MS : POLL_INTERVAL_OFFLINE_MS
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
      const newState: StreamStatus = isLive ? 'live' : 'offline'

      // 记录每次检测结果（用于调试）
      this.logger.debug(
        `[stream] isLive=${isLive}, currentState=${this.lastState}, newState=${newState}`,
      )

      // 状态变化时发送事件
      if (newState !== this.lastState) {
        this.logger.info(
          `[stream] Stream state changed: ${this.lastState} -> ${newState} (isLive=${isLive})`,
        )
        this.lastState = newState
        windowManager.send(
          IPC_CHANNELS.tasks.liveControl.streamStateChanged,
          this.accountId,
          newState,
        )
      } else {
        this.logger.debug(`[stream] Stream state unchanged: ${newState} (isLive=${isLive})`)
      }
    } catch (error) {
      this.logger.error('[stream] Failed to check stream state:', error)
      // 检测失败时，如果之前是 live，则设为 offline（保守策略）
      if (this.lastState === 'live') {
        const newState: StreamStatus = 'offline'
        this.logger.warn('[stream] Stream state set to offline due to detection error')
        this.lastState = newState
        windowManager.send(
          IPC_CHANNELS.tasks.liveControl.streamStateChanged,
          this.accountId,
          newState,
        )
      }
    }
  }

  /**
   * 手动设置状态（用于断开连接时）
   */
  setState(state: StreamStatus) {
    if (state !== this.lastState) {
      this.logger.info(`[stream] Stream state manually set: ${this.lastState} -> ${state}`)
      this.lastState = state
      windowManager.send(IPC_CHANNELS.tasks.liveControl.streamStateChanged, this.accountId, state)
    }
  }
}
