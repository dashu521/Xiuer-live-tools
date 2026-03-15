/**
 * 运行时任务监控系统
 * 用于多账号并发测试时的诊断和验证
 */

export interface TaskRuntimeInfo {
  accountId: string
  taskType: string
  startedAt: number
  stoppedAt?: number
  status: 'running' | 'stopped'
}

export interface RuntimeStatistics {
  totalTasks: number
  runningTasks: number
  stoppedTasks: number
  tasksByAccount: Map<string, TaskRuntimeInfo[]>
  activeTimers: number
  activeListeners: number
}

class TaskRuntimeMonitor {
  private taskRegistry = new Map<string, TaskRuntimeInfo>()
  private accountTasks = new Map<string, Set<string>>()
  private timerCount = 0
  private listenerCount = 0
  private eventTimestamps: {
    key: string
    accountId: string
    timestamp: number
    data?: any
  }[] = []

  registerTask(accountId: string, taskType: string): string {
    const taskId = `${accountId}:${taskType}:${Date.now()}`
    const info: TaskRuntimeInfo = {
      accountId,
      taskType,
      startedAt: Date.now(),
      status: 'running',
    }
    this.taskRegistry.set(taskId, info)

    if (!this.accountTasks.has(accountId)) {
      this.accountTasks.set(accountId, new Set())
    }
    this.accountTasks.get(accountId)!.add(taskId)

    this.logEvent('TASK_REGISTERED', accountId, { taskId, taskType })
    console.log(
      `[RuntimeMonitor][${accountId}] 📝 Task registered: ${taskType}, total: ${this.getStatistics().runningTasks}`,
    )

    return taskId
  }

  unregisterTask(taskId: string) {
    const info = this.taskRegistry.get(taskId)
    if (info) {
      info.stoppedAt = Date.now()
      info.status = 'stopped'

      this.logEvent('TASK_UNREGISTERED', info.accountId, {
        taskId,
        taskType: info.taskType,
        duration: info.stoppedAt - info.startedAt,
      })
      console.log(
        `[RuntimeMonitor][${info.accountId}] 🧹 Task unregistered: ${info.taskType}, remaining: ${this.getStatistics().runningTasks}`,
      )
    }
  }

  incrementTimer(accountId: string) {
    this.timerCount++
    this.logEvent('TIMER_CREATED', accountId, { timerCount: this.timerCount })
  }

  decrementTimer(accountId: string) {
    this.timerCount--
    this.logEvent('TIMER_CLEARED', accountId, { timerCount: this.timerCount })
  }

  incrementListener(accountId: string) {
    this.listenerCount++
    this.logEvent('LISTENER_CREATED', accountId, { listenerCount: this.listenerCount })
  }

  decrementListener(accountId: string) {
    this.listenerCount--
    this.logEvent('LISTENER_CLEARED', accountId, { listenerCount: this.listenerCount })
  }

  private logEvent(key: string, accountId: string, data?: any) {
    this.eventTimestamps.push({
      key,
      accountId,
      timestamp: Date.now(),
      data,
    })
    // 保留最近 1000 条事件
    if (this.eventTimestamps.length > 1000) {
      this.eventTimestamps.shift()
    }
  }

  logEventCustom(eventName: string, accountId: string, data?: any) {
    this.logEvent(eventName, accountId, data)
  }

  getStatistics(): RuntimeStatistics {
    const tasksByAccount = new Map<string, TaskRuntimeInfo[]>()
    let runningTasks = 0
    let stoppedTasks = 0

    for (const [_taskId, info] of this.taskRegistry) {
      if (!tasksByAccount.has(info.accountId)) {
        tasksByAccount.set(info.accountId, [])
      }
      tasksByAccount.get(info.accountId)!.push(info)

      if (info.status === 'running') {
        runningTasks++
      } else {
        stoppedTasks++
      }
    }

    return {
      totalTasks: this.taskRegistry.size,
      runningTasks,
      stoppedTasks,
      tasksByAccount,
      activeTimers: this.timerCount,
      activeListeners: this.listenerCount,
    }
  }

  getAccountTasks(accountId: string): TaskRuntimeInfo[] {
    const result: TaskRuntimeInfo[] = []
    for (const [_taskId, info] of this.taskRegistry) {
      if (info.accountId === accountId) {
        result.push(info)
      }
    }
    return result
  }

  getRecentEvents(accountId?: string, limit = 50) {
    const events = accountId
      ? this.eventTimestamps.filter(e => e.accountId === accountId)
      : this.eventTimestamps
    return events.slice(-limit)
  }

  getTimeline() {
    return this.eventTimestamps.map(e => ({
      time: new Date(e.timestamp).toISOString(),
      event: e.key,
      accountId: e.accountId,
      data: e.data,
    }))
  }

  printSummary() {
    const stats = this.getStatistics()
    console.log('=============================================')
    console.log('📊 Runtime Task Monitor Summary')
    console.log('=============================================')
    console.log(`Total Tasks: ${stats.totalTasks}`)
    console.log(`Running: ${stats.runningTasks}`)
    console.log(`Stopped: ${stats.stoppedTasks}`)
    console.log(`Active Timers: ${stats.activeTimers}`)
    console.log(`Active Listeners: ${stats.activeListeners}`)
    console.log('--------------------------------------------')
    console.log('Tasks by Account:')
    for (const [accountId, tasks] of stats.tasksByAccount) {
      const running = tasks.filter(t => t.status === 'running').length
      const stopped = tasks.filter(t => t.status === 'stopped').length
      console.log(`  ${accountId}: running=${running}, stopped=${stopped}`)
    }
    console.log('=============================================')
  }

  reset() {
    this.taskRegistry.clear()
    this.accountTasks.clear()
    this.timerCount = 0
    this.listenerCount = 0
    this.eventTimestamps = []
  }
}

export const taskRuntimeMonitor = new TaskRuntimeMonitor()
