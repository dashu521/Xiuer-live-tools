/**
 * 新用户引导数据分析
 * 追踪引导完成率和用户行为
 */

// 引导事件类型
export type OnboardingEvent =
  | 'welcome_shown'
  | 'welcome_completed'
  | 'welcome_skipped'
  | 'login_shown'
  | 'login_completed'
  | 'quickstart_shown'
  | 'quickstart_completed'
  | 'quickstart_skipped'
  | 'feature_tour_started'
  | 'feature_tour_completed'
  | 'feature_tour_skipped'
  | 'first_connection_attempt'
  | 'first_connection_success'
  | 'first_feature_used'

// 引导分析数据接口
interface OnboardingAnalyticsData {
  userId?: string
  timestamp: number
  event: OnboardingEvent
  step?: number
  totalSteps?: number
  duration?: number // 毫秒
  metadata?: Record<string, unknown>
}

const ANALYTICS_KEY = 'onboarding_analytics'
const SESSION_START_KEY = 'onboarding_session_start'

/**
 * 获取或初始化分析数据
 */
function getAnalyticsData(): OnboardingAnalyticsData[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const data = localStorage.getItem(ANALYTICS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

/**
 * 保存分析数据
 */
function saveAnalyticsData(data: OnboardingAnalyticsData[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data))
  } catch {
    // 存储失败时静默处理
  }
}

/**
 * 记录引导事件
 */
export function trackOnboardingEvent(
  event: OnboardingEvent,
  metadata?: Record<string, unknown>,
): void {
  const data = getAnalyticsData()
  const newEvent: OnboardingAnalyticsData = {
    timestamp: Date.now(),
    event,
    metadata,
  }
  data.push(newEvent)
  saveAnalyticsData(data)

  // 开发环境下打印日志
  if (import.meta.env.DEV) {
    console.log('[Onboarding Analytics]', event, metadata)
  }
}

/**
 * 开始引导会话计时
 */
export function startOnboardingSession(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(SESSION_START_KEY, Date.now().toString())
  trackOnboardingEvent('welcome_shown')
}

/**
 * 结束引导会话并记录时长
 */
export function completeOnboardingSession(): void {
  if (typeof localStorage === 'undefined') return
  const startTime = localStorage.getItem(SESSION_START_KEY)
  if (startTime) {
    const duration = Date.now() - Number.parseInt(startTime, 10)
    trackOnboardingEvent('feature_tour_completed', { duration })
    localStorage.removeItem(SESSION_START_KEY)
  }
}

/**
 * 获取引导完成率统计
 */
export function getOnboardingStats(): {
  welcomeCompletionRate: number
  quickStartCompletionRate: number
  featureTourCompletionRate: number
  averageTimeToComplete: number
  totalEvents: number
} {
  const data = getAnalyticsData()

  const welcomeShown = data.filter(e => e.event === 'welcome_shown').length
  const welcomeCompleted = data.filter(e => e.event === 'welcome_completed').length
  const _welcomeSkipped = data.filter(e => e.event === 'welcome_skipped').length

  const quickStartShown = data.filter(e => e.event === 'quickstart_shown').length
  const quickStartCompleted = data.filter(e => e.event === 'quickstart_completed').length
  const _quickStartSkipped = data.filter(e => e.event === 'quickstart_skipped').length

  const tourStarted = data.filter(e => e.event === 'feature_tour_started').length
  const tourCompleted = data.filter(e => e.event === 'feature_tour_completed').length

  // 计算平均完成时间
  const completedEvents = data.filter(
    e => e.event === 'feature_tour_completed' && e.metadata?.duration,
  )
  const totalDuration = completedEvents.reduce(
    (sum, e) => sum + ((e.metadata?.duration as number) || 0),
    0,
  )
  const averageTimeToComplete =
    completedEvents.length > 0 ? totalDuration / completedEvents.length : 0

  return {
    welcomeCompletionRate: welcomeShown > 0 ? (welcomeCompleted / welcomeShown) * 100 : 0,
    quickStartCompletionRate:
      quickStartShown > 0 ? (quickStartCompleted / quickStartShown) * 100 : 0,
    featureTourCompletionRate: tourStarted > 0 ? (tourCompleted / tourStarted) * 100 : 0,
    averageTimeToComplete,
    totalEvents: data.length,
  }
}

/**
 * 获取引导漏斗数据
 */
export function getOnboardingFunnel(): {
  step: string
  users: number
  dropOff: number
}[] {
  const data = getAnalyticsData()

  const steps = [
    { name: '欢迎页展示', event: 'welcome_shown' },
    { name: '欢迎页完成', event: 'welcome_completed' },
    { name: '登录完成', event: 'login_completed' },
    { name: '快速开始展示', event: 'quickstart_shown' },
    { name: '快速开始完成', event: 'quickstart_completed' },
    { name: '功能导览开始', event: 'feature_tour_started' },
    { name: '功能导览完成', event: 'feature_tour_completed' },
  ]

  return steps.map((step, index) => {
    const count = data.filter(e => e.event === step.event).length
    const prevCount =
      index > 0 ? data.filter(e => e.event === steps[index - 1].event).length : count
    const dropOff = prevCount > 0 ? ((prevCount - count) / prevCount) * 100 : 0

    return {
      step: step.name,
      users: count,
      dropOff: Math.round(dropOff * 100) / 100,
    }
  })
}

/**
 * 导出分析数据（用于上报）
 */
export function exportOnboardingAnalytics(): {
  events: OnboardingAnalyticsData[]
  stats: ReturnType<typeof getOnboardingStats>
  funnel: ReturnType<typeof getOnboardingFunnel>
  exportedAt: number
} {
  return {
    events: getAnalyticsData(),
    stats: getOnboardingStats(),
    funnel: getOnboardingFunnel(),
    exportedAt: Date.now(),
  }
}

/**
 * 清空分析数据
 */
export function clearOnboardingAnalytics(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(ANALYTICS_KEY)
  localStorage.removeItem(SESSION_START_KEY)
}

/**
 * 获取用户在引导中的当前状态
 */
export function getUserOnboardingStatus(): {
  hasSeenWelcome: boolean
  hasCompletedWelcome: boolean
  hasCompletedLogin: boolean
  hasSeenQuickStart: boolean
  hasCompletedQuickStart: boolean
  hasStartedFeatureTour: boolean
  hasCompletedFeatureTour: boolean
} {
  const data = getAnalyticsData()

  return {
    hasSeenWelcome: data.some(e => e.event === 'welcome_shown'),
    hasCompletedWelcome: data.some(e => e.event === 'welcome_completed'),
    hasCompletedLogin: data.some(e => e.event === 'login_completed'),
    hasSeenQuickStart: data.some(e => e.event === 'quickstart_shown'),
    hasCompletedQuickStart: data.some(e => e.event === 'quickstart_completed'),
    hasStartedFeatureTour: data.some(e => e.event === 'feature_tour_started'),
    hasCompletedFeatureTour: data.some(e => e.event === 'feature_tour_completed'),
  }
}
