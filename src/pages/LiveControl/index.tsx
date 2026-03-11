import AccountStatusDock from '@/components/account/AccountStatusDock'
import { Title } from '@/components/common/Title'
import { useAutoLoadPlatformPreference } from '@/hooks/usePlatformPreference'
import InstructionsCard from './components/InstructionsCard'
import StatusCard from './components/StatusCard'

export default function BrowserControl() {
  // 自动加载当前账号的默认平台偏好
  useAutoLoadPlatformPreference()

  return (
    <div
      data-tour="live-control"
      className="w-full py-6 flex flex-col gap-6 min-h-0 overflow-auto pb-24"
    >
      <div className="shrink-0">
        <Title title="直播控制台" description="连接并管理您的直播控制台" />
      </div>

      <div className="flex flex-col gap-6 min-w-0 flex-1 min-h-0">
        {/* 控制台状态卡片 */}
        <StatusCard />

        {/* 使用说明卡片 */}
        <InstructionsCard />
      </div>

      {/* 账号状态悬浮栏 */}
      <AccountStatusDock />
    </div>
  )
}
