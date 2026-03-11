/**
 * 存储监控器
 * 监控存储使用情况，提供统计和告警功能
 */

import type { StorageEvent, StorageEventType, StorageStats } from '../types'

/**
 * 告警配置
 */
export interface AlertConfig {
  /** 存储大小阈值（字节） */
  sizeThreshold?: number
  /** 条目数阈值 */
  entryThreshold?: number
  /** 错误率阈值（0-1） */
  errorRateThreshold?: number
}

/**
 * 告警信息
 */
export interface Alert {
  type: 'size' | 'entries' | 'error-rate' | 'quota-exceeded'
  message: string
  timestamp: number
  metadata?: Record<string, unknown>
}

/**
 * 存储监控器
 */
export class StorageMonitor {
  private events: StorageEvent[] = []
  private alertConfig: AlertConfig
  private alertListeners: Set<(alert: Alert) => void> = new Set()
  private maxEvents = 1000
  private errorCount = 0
  private totalOperations = 0

  constructor(config: AlertConfig = {}) {
    this.alertConfig = {
      sizeThreshold: 4 * 1024 * 1024, // 4MB
      entryThreshold: 1000,
      errorRateThreshold: 0.1, // 10%
      ...config,
    }
  }

  /**
   * 记录事件
   */
  recordEvent(event: StorageEvent): void {
    this.events.push(event)
    this.totalOperations++

    if (event.type === 'error') {
      this.errorCount++
    }

    // 限制事件数量
    if (this.events.length > this.maxEvents) {
      this.events.shift()
    }

    // 检查是否需要触发告警
    this.checkAlerts(event)
  }

  /**
   * 检查告警条件
   */
  private checkAlerts(event: StorageEvent): void {
    // 检查存储配额超限
    if (event.type === 'quota-exceeded') {
      this.emitAlert({
        type: 'quota-exceeded',
        message: 'Storage quota exceeded',
        timestamp: event.timestamp,
        metadata: event.metadata,
      })
    }

    // 检查错误率
    if (this.totalOperations > 10) {
      const errorRate = this.errorCount / this.totalOperations
      if (errorRate > (this.alertConfig.errorRateThreshold || 0.1)) {
        this.emitAlert({
          type: 'error-rate',
          message: `High error rate detected: ${(errorRate * 100).toFixed(2)}%`,
          timestamp: event.timestamp,
          metadata: { errorRate, totalOperations: this.totalOperations },
        })
      }
    }
  }

  /**
   * 检查存储统计告警
   */
  checkStatsAlerts(stats: StorageStats): void {
    // 检查存储大小
    if (this.alertConfig.sizeThreshold && stats.totalSize > this.alertConfig.sizeThreshold) {
      this.emitAlert({
        type: 'size',
        message: `Storage size exceeded threshold: ${this.formatBytes(stats.totalSize)}`,
        timestamp: Date.now(),
        metadata: {
          currentSize: stats.totalSize,
          threshold: this.alertConfig.sizeThreshold,
        },
      })
    }

    // 检查条目数
    if (this.alertConfig.entryThreshold && stats.totalEntries > this.alertConfig.entryThreshold) {
      this.emitAlert({
        type: 'entries',
        message: `Storage entries exceeded threshold: ${stats.totalEntries}`,
        timestamp: Date.now(),
        metadata: {
          currentEntries: stats.totalEntries,
          threshold: this.alertConfig.entryThreshold,
        },
      })
    }
  }

  /**
   * 触发告警
   */
  private emitAlert(alert: Alert): void {
    this.alertListeners.forEach(listener => {
      try {
        listener(alert)
      } catch (error) {
        console.error('[StorageMonitor] Alert listener error:', error)
      }
    })
  }

  /**
   * 添加告警监听器
   */
  addAlertListener(listener: (alert: Alert) => void): () => void {
    this.alertListeners.add(listener)
    return () => {
      this.alertListeners.delete(listener)
    }
  }

  /**
   * 移除告警监听器
   */
  removeAlertListener(listener: (alert: Alert) => void): void {
    this.alertListeners.delete(listener)
  }

  /**
   * 获取事件统计
   */
  getEventStats(): {
    total: number
    byType: Record<StorageEventType, number>
    recentErrors: StorageEvent[]
  } {
    const byType: Record<StorageEventType, number> = {
      get: 0,
      set: 0,
      remove: 0,
      clear: 0,
      migrate: 0,
      error: 0,
      'quota-exceeded': 0,
    }

    this.events.forEach(event => {
      byType[event.type]++
    })

    const recentErrors = this.events.filter(e => e.type === 'error').slice(-10)

    return {
      total: this.events.length,
      byType,
      recentErrors,
    }
  }

  /**
   * 获取最近的事件
   */
  getRecentEvents(limit = 50): StorageEvent[] {
    return this.events.slice(-limit)
  }

  /**
   * 获取错误率
   */
  getErrorRate(): number {
    if (this.totalOperations === 0) return 0
    return this.errorCount / this.totalOperations
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.events = []
    this.errorCount = 0
    this.totalOperations = 0
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
  }

  /**
   * 生成监控报告
   */
  generateReport(): {
    stats: {
      total: number
      byType: Record<StorageEventType, number>
      recentErrors: StorageEvent[]
    }
    errorRate: number
    recommendations: string[]
  } {
    const stats = this.getEventStats()
    const errorRate = this.getErrorRate()
    const recommendations: string[] = []

    // 生成建议
    if (errorRate > 0.05) {
      recommendations.push('Error rate is high. Consider checking storage integrity.')
    }

    if (stats.byType['quota-exceeded'] > 0) {
      recommendations.push('Storage quota has been exceeded. Consider cleaning up old data.')
    }

    if (stats.byType.clear > stats.total * 0.1) {
      recommendations.push(
        'Frequent clear operations detected. Consider optimizing data lifecycle.',
      )
    }

    return {
      stats,
      errorRate,
      recommendations,
    }
  }
}

/**
 * 全局存储监控器实例
 */
export const storageMonitor = new StorageMonitor()
