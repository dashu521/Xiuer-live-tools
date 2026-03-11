import { BarChart3, HelpCircle, Users } from 'lucide-react'
import { memo, useMemo } from 'react'
import { NavLink } from 'react-router'
import { autoReplyPlatforms } from '@/abilities'
import { useAccounts } from '@/hooks/useAccounts'
import { useCurrentAutoMessage } from '@/hooks/useAutoMessage'
import { useCurrentAutoPopUp } from '@/hooks/useAutoPopUp'
import { useAutoReply } from '@/hooks/useAutoReply'
import { useCurrentLiveControl } from '@/hooks/useLiveControl'
import { useLiveStatsStore } from '@/hooks/useLiveStats'
import { useCurrentSubAccount } from '@/hooks/useSubAccount'
import { cn } from '@/lib/utils'
import {
  CarbonBlockStorage,
  CarbonChat,
  CarbonContentDeliveryNetwork,
  CarbonIbmEventAutomation,
  CarbonIbmWatsonTextToSpeech,
  CarbonSettings,
} from '../icons/carbon'

interface SidebarTab {
  id: string
  name: string
  isRunning?: boolean
  icon: React.ReactNode
  platform?: LiveControlPlatform[]
}

/**
 * Sidebar 组件 - 已优化
 * 1. 使用 memo 避免父组件重渲染时不必要的更新
 * 2. 使用 selector 精确订阅 store 状态
 * 3. 使用 useMemo 缓存 tabs 数组，避免每次渲染都创建新数组
 */
const Sidebar = memo(function Sidebar() {
  const isAutoMessageRunning = useCurrentAutoMessage(context => context.isRunning)
  const isAutoPopupRunning = useCurrentAutoPopUp(context => context.isRunning)
  const { isRunning: isAutoReplyRunning } = useAutoReply()
  const isSubAccountRunning = useCurrentSubAccount(context => context.isRunning)
  const currentAccountId = useAccounts(state => state.currentAccountId)
  // 优化：使用 selector 只订阅需要的值，而不是整个 contexts 对象
  const isLiveStatsListening = useLiveStatsStore(
    state => state.contexts[currentAccountId]?.isListening ?? false,
  )
  const platform = useCurrentLiveControl(context => context.connectState.platform) as
    | LiveControlPlatform
    | undefined

  // 使用 useMemo 缓存 tabs 数组，只在依赖变化时重新创建
  const tabs = useMemo<SidebarTab[]>(
    () => [
      {
        id: '/',
        name: '打开中控台',
        icon: <CarbonContentDeliveryNetwork className="w-5 h-5" />,
      },
      {
        id: '/auto-message',
        name: '自动发言',
        isRunning: isAutoMessageRunning,
        icon: <CarbonChat className="w-5 h-5" />,
      },
      {
        id: '/auto-popup',
        name: '自动弹窗',
        isRunning: isAutoPopupRunning,
        icon: <CarbonBlockStorage className="w-5 h-5" />,
      },
      {
        id: '/auto-reply',
        name: '自动回复',
        isRunning: isAutoReplyRunning,
        icon: <CarbonIbmEventAutomation className="w-5 h-5" />,
        platform: autoReplyPlatforms,
      },
      {
        id: '/sub-account',
        name: '小号互动',
        isRunning: isSubAccountRunning,
        icon: <Users className="w-5 h-5" />,
      },
      {
        id: '/live-stats',
        name: '数据监控',
        isRunning: isLiveStatsListening,
        icon: <BarChart3 className="w-5 h-5" />,
        platform: autoReplyPlatforms,
      },
      {
        id: '/ai-chat',
        name: 'AI 助手',
        icon: <CarbonIbmWatsonTextToSpeech className="w-5 h-5" />,
      },
      {
        id: '/settings',
        name: '应用设置',
        icon: <CarbonSettings className="w-5 h-5" />,
      },
      {
        id: '/help-support',
        name: '帮助与支持',
        icon: <HelpCircle className="w-5 h-5" />,
      },
    ],
    [
      isAutoMessageRunning,
      isAutoPopupRunning,
      isAutoReplyRunning,
      isSubAccountRunning,
      isLiveStatsListening,
    ],
  )

  // 使用 useMemo 缓存过滤后的 tabs
  const filteredTabs = useMemo(
    () =>
      tabs.filter(tab => {
        if (tab.platform) {
          return platform != null && tab.platform.includes(platform)
        }
        return true
      }),
    [tabs, platform],
  )

  return (
    <aside
      data-tour="sidebar"
      className="w-56 min-w-[14rem] relative z-[1]"
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        boxShadow: 'var(--sidebar-edge-shadow)',
      }}
    >
      <div className="py-5 px-4">
        <nav className="space-y-1">
          {filteredTabs.map(tab => (
            <NavLink
              key={tab.id}
              to={tab.id}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150 relative',
                  isActive
                    ? 'bg-[var(--sidebar-active-bg)] text-primary'
                    : 'text-muted-foreground hover:bg-[color:var(--sidebar-item-hover)] hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                  )}
                  <span className="shrink-0 [&>svg]:size-5">{tab.icon}</span>
                  <span className="truncate">{tab.name}</span>
                  {tab.isRunning && (
                    <span className="absolute right-2.5 w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
})

export default Sidebar
