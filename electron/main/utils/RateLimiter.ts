/**
 * 智能发送频率控制器
 * 根据平台规则和历史发送情况动态调整发送频率
 */

export interface RateLimitConfig {
  /** 平台名称 */
  platform: LiveControlPlatform
  /** 基础发送间隔（毫秒） */
  baseInterval: number
  /** 最小发送间隔（毫秒） */
  minInterval: number
  /** 最大发送间隔（毫秒） */
  maxInterval: number
  /** 连续成功次数阈值，超过则降低间隔 */
  successThreshold: number
  /** 连续失败次数阈值，超过则增加间隔 */
  failThreshold: number
  /** 间隔调整步长（毫秒） */
  adjustStep: number
}

/**
 * 平台默认配置
 */
const PLATFORM_DEFAULTS: Record<LiveControlPlatform, RateLimitConfig> = {
  douyin: {
    platform: 'douyin',
    baseInterval: 30000,
    minInterval: 15000,
    maxInterval: 120000,
    successThreshold: 5,
    failThreshold: 3,
    adjustStep: 5000,
  },
  buyin: {
    platform: 'buyin',
    baseInterval: 30000,
    minInterval: 15000,
    maxInterval: 120000,
    successThreshold: 5,
    failThreshold: 3,
    adjustStep: 5000,
  },
  xiaohongshu: {
    platform: 'xiaohongshu',
    baseInterval: 25000,
    minInterval: 10000,
    maxInterval: 90000,
    successThreshold: 5,
    failThreshold: 2,
    adjustStep: 5000,
  },
  wxchannel: {
    platform: 'wxchannel',
    baseInterval: 35000,
    minInterval: 20000,
    maxInterval: 120000,
    successThreshold: 5,
    failThreshold: 3,
    adjustStep: 5000,
  },
  taobao: {
    platform: 'taobao',
    baseInterval: 30000,
    minInterval: 15000,
    maxInterval: 120000,
    successThreshold: 5,
    failThreshold: 3,
    adjustStep: 5000,
  },
  // 其他平台使用默认配置
  eos: {
    platform: 'eos',
    baseInterval: 30000,
    minInterval: 15000,
    maxInterval: 120000,
    successThreshold: 5,
    failThreshold: 3,
    adjustStep: 5000,
  },
  pgy: {
    platform: 'pgy',
    baseInterval: 30000,
    minInterval: 15000,
    maxInterval: 120000,
    successThreshold: 5,
    failThreshold: 3,
    adjustStep: 5000,
  },
  kuaishou: {
    platform: 'kuaishou',
    baseInterval: 30000,
    minInterval: 15000,
    maxInterval: 120000,
    successThreshold: 5,
    failThreshold: 3,
    adjustStep: 5000,
  },
  dev: {
    platform: 'dev',
    baseInterval: 5000,
    minInterval: 1000,
    maxInterval: 30000,
    successThreshold: 3,
    failThreshold: 2,
    adjustStep: 1000,
  },
}

/**
 * 发送记录
 */
interface SendRecord {
  timestamp: number
  success: boolean
}

export class RateLimiter {
  private config: RateLimitConfig
  private currentInterval: number
  private sendHistory: SendRecord[] = []
  private consecutiveSuccess = 0
  private consecutiveFail = 0
  private readonly historyWindow = 5 * 60 * 1000 // 5分钟窗口

  constructor(platform: LiveControlPlatform, customConfig?: Partial<RateLimitConfig>) {
    this.config = { ...PLATFORM_DEFAULTS[platform], ...customConfig }
    this.currentInterval = this.config.baseInterval
  }

  /**
   * 获取当前建议的发送间隔
   */
  getInterval(): number {
    return this.currentInterval
  }

  /**
   * 获取当前配置
   */
  getConfig(): RateLimitConfig {
    return { ...this.config }
  }

  /**
   * 记录发送结果并调整频率
   */
  recordSend(success: boolean): void {
    const now = Date.now()

    // 清理过期记录
    this.sendHistory = this.sendHistory.filter(
      record => now - record.timestamp < this.historyWindow,
    )

    // 添加新记录
    this.sendHistory.push({ timestamp: now, success })

    if (success) {
      this.consecutiveSuccess++
      this.consecutiveFail = 0

      // 连续成功多次，可以适当降低间隔
      if (this.consecutiveSuccess >= this.config.successThreshold) {
        this.decreaseInterval()
        this.consecutiveSuccess = 0
      }
    } else {
      this.consecutiveFail++
      this.consecutiveSuccess = 0

      // 连续失败多次，增加间隔
      if (this.consecutiveFail >= this.config.failThreshold) {
        this.increaseInterval()
        this.consecutiveFail = 0
      }
    }
  }

  /**
   * 降低发送间隔（加速）
   */
  private decreaseInterval(): void {
    const newInterval = Math.max(
      this.config.minInterval,
      this.currentInterval - this.config.adjustStep,
    )
    if (newInterval !== this.currentInterval) {
      this.currentInterval = newInterval
      console.log(`[RateLimiter] 发送间隔降低至 ${newInterval}ms`)
    }
  }

  /**
   * 增加发送间隔（减速）
   */
  private increaseInterval(): void {
    const newInterval = Math.min(
      this.config.maxInterval,
      this.currentInterval + this.config.adjustStep,
    )
    if (newInterval !== this.currentInterval) {
      this.currentInterval = newInterval
      console.log(`[RateLimiter] 发送间隔增加至 ${newInterval}ms`)
    }
  }

  /**
   * 计算下次可发送时间
   */
  getNextAvailableTime(lastSendTime?: number): number {
    if (!lastSendTime) return Date.now()
    return lastSendTime + this.currentInterval
  }

  /**
   * 检查是否可以发送
   */
  canSend(lastSendTime?: number): boolean {
    return Date.now() >= this.getNextAvailableTime(lastSendTime)
  }

  /**
   * 获取发送统计
   */
  getStats(): {
    totalInWindow: number
    successRate: number
    currentInterval: number
    consecutiveSuccess: number
    consecutiveFail: number
  } {
    const now = Date.now()
    const windowRecords = this.sendHistory.filter(
      record => now - record.timestamp < this.historyWindow,
    )

    const total = windowRecords.length
    const successCount = windowRecords.filter(r => r.success).length
    const successRate = total > 0 ? successCount / total : 1

    return {
      totalInWindow: total,
      successRate,
      currentInterval: this.currentInterval,
      consecutiveSuccess: this.consecutiveSuccess,
      consecutiveFail: this.consecutiveFail,
    }
  }

  /**
   * 重置为初始状态
   */
  reset(): void {
    this.currentInterval = this.config.baseInterval
    this.sendHistory = []
    this.consecutiveSuccess = 0
    this.consecutiveFail = 0
  }
}
