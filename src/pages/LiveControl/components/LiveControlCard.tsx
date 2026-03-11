import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import PlatformSelect from './PlatformSelect'
import { ConnectToLiveControl, HeadlessSetting, StatusAlert } from './StatusCard'

export const LiveControlCard = React.memo(() => {
  return (
    <Card className="w-full rounded-2xl shadow-xl border-0 overflow-hidden">
      <CardContent className="p-5 flex flex-col gap-4">
        {/* 第一行：直播平台下拉框，拉满宽度 */}
        <div className="w-full">
          <span className="text-xs font-medium text-muted-foreground mb-1.5 block">直播平台</span>
          <PlatformSelect fullWidth />
        </div>

        {/* 第二行：无头模式 + 连接按钮并排，按钮突出 */}
        <div className="flex items-center gap-3 flex-wrap">
          <HeadlessSetting />
          <div className="flex-1 min-w-[12.5rem] flex justify-end">
            <ConnectToLiveControl />
          </div>
        </div>

        {/* 平台提示 */}
        <StatusAlert />
      </CardContent>
    </Card>
  )
})
