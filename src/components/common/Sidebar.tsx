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
  type?: 'main' | 'system'
}

const Sidebar = memo(function Sidebar() {
  const isAutoMessageRunning = useCurrentAutoMessage(context => context.isRunning)
  const isAutoPopupRunning = useCurrentAutoPopUp(context => context.isRunning)
  const { isRunning: isAutoReplyRunning } = useAutoReply()
  const isSubAccountRunning = useCurrentSubAccount(context => context.isRunning)
  const currentAccountId = useAccounts(state => state.currentAccountId)
  const isLiveStatsListening = useLiveStatsStore(
    state => state.contexts[currentAccountId]?.isListening ?? false,
  )
  const platform = useCurrentLiveControl(context => context.connectState.platform) as
    | LiveControlPlatform
    | undefined

  const tabs = useMemo<SidebarTab[]>(
    () => [
      {
        id: '/',
        name: '打开中控台',
        icon: <CarbonContentDeliveryNetwork className="w-5 h-5" />,
        type: 'main',
      },
      {
        id: '/auto-message',
        name: '自动发言',
        isRunning: isAutoMessageRunning,
        icon: <CarbonChat className="w-5 h-5" />,
        type: 'main',
      },
      {
        id: '/auto-popup',
        name: '自动弹窗',
        isRunning: isAutoPopupRunning,
        icon: <CarbonBlockStorage className="w-5 h-5" />,
        type: 'main',
      },
      {
        id: '/auto-reply',
        name: '自动回复',
        isRunning: isAutoReplyRunning,
        icon: <CarbonIbmEventAutomation className="w-5 h-5" />,
        platform: autoReplyPlatforms,
        type: 'main',
      },
      {
        id: '/sub-account',
        name: '小号互动',
        isRunning: isSubAccountRunning,
        icon: <Users className="w-5 h-5" />,
        type: 'main',
      },
      {
        id: '/live-stats',
        name: '数据监控',
        isRunning: isLiveStatsListening,
        icon: <BarChart3 className="w-5 h-5" />,
        platform: autoReplyPlatforms,
        type: 'main',
      },
      {
        id: '/ai-chat',
        name: 'AI 助手',
        icon: <CarbonIbmWatsonTextToSpeech className="w-5 h-5" />,
        type: 'main',
      },
      {
        id: '/settings',
        name: '应用设置',
        icon: <CarbonSettings className="w-5 h-5" />,
        type: 'system',
      },
      {
        id: '/help-support',
        name: '帮助与支持',
        icon: <HelpCircle className="w-5 h-5" />,
        type: 'system',
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

  const { mainTabs, systemTabs } = useMemo(() => {
    const main = tabs.filter(tab => tab.type === 'main')
    const system = tabs.filter(tab => tab.type === 'system')
    return { mainTabs: main, systemTabs: system }
  }, [tabs])

  const filteredMainTabs = useMemo(
    () =>
      mainTabs.filter(tab => {
        if (tab.platform) {
          return platform != null && tab.platform.includes(platform)
        }
        return true
      }),
    [mainTabs, platform],
  )

  const filteredSystemTabs = useMemo(
    () =>
      systemTabs.filter(tab => {
        if (tab.platform) {
          return platform != null && tab.platform.includes(platform)
        }
        return true
      }),
    [systemTabs, platform],
  )

  return (
    <aside
      data-tour="sidebar"
      className="relative z-[1] flex w-16 min-w-16 flex-col md:w-56 md:min-w-[14rem]"
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        boxShadow: 'var(--sidebar-edge-shadow)',
      }}
    >
      <div className="flex-1 px-2 py-5 md:px-4">
        <nav className="space-y-1">
          {filteredMainTabs.map(tab => (
            <NavLink
              key={tab.id}
              to={tab.id}
              aria-label={tab.name}
              title={tab.name}
              className={({ isActive }) =>
                cn(
                  'ui-hover-nav group relative flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 md:justify-start',
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
                  <span className="hidden truncate md:block">{tab.name}</span>
                  {tab.isRunning && (
                    <span
                      className="absolute right-2 top-2 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 animate-pulse md:right-2.5 md:top-1/2 md:h-3 md:w-3 md:-translate-y-1/2"
                      aria-label="运行中"
                      role="status"
                      aria-live="polite"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="shrink-0 border-t border-border/40 px-2 py-3 md:px-4">
        <nav className="space-y-0.5">
          {filteredSystemTabs.map(tab => (
            <NavLink
              key={tab.id}
              to={tab.id}
              aria-label={tab.name}
              title={tab.name}
              className={({ isActive }) =>
                cn(
                  'ui-hover-nav group relative flex items-center justify-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 md:justify-start',
                  isActive
                    ? 'text-primary bg-[var(--sidebar-active-bg)]/50'
                    : 'text-muted-foreground/70 hover:text-muted-foreground hover:bg-[color:var(--sidebar-item-hover)]/50',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary/60" />
                  )}
                  <span className="shrink-0 [&>svg]:size-4">{tab.icon}</span>
                  <span className="hidden truncate text-sm md:block">{tab.name}</span>
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
