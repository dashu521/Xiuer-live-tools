import React from 'react'
import { useCurrentLiveControl } from '@/hooks/useLiveControl'
import { cn } from '@/lib/utils'

const INSTRUCTION_AUTO_REPLY_BY_PLATFORM: Record<string, string> = {
  dev: '测试平台支持全部监听源，可用于功能体验',
  douyin: '自动回复功能目前仅对抖音小店和巨量百应开放',
  buyin: '自动回复功能目前仅对抖音小店和巨量百应开放',
}

const DEFAULT_AUTO_REPLY_INSTRUCTION = '自动回复功能依所选平台不同，请以实际可用为准'

export const LiveControlInstructions = React.memo(function LiveControlInstructions({
  className,
}: {
  className?: string
}) {
  const platform = useCurrentLiveControl(c => c.connectState.platform)
  const instructionAutoReply =
    (platform && INSTRUCTION_AUTO_REPLY_BY_PLATFORM[platform]) || DEFAULT_AUTO_REPLY_INSTRUCTION

  const instructions = [
    '选择平台并点击"连接直播控制台"按钮，等待登录',
    '登录成功后，即可使用自动发言和自动弹窗功能',
    instructionAutoReply,
  ]

  return (
    <div className={cn('relative', className)}>
      {instructions.map((instruction, index) => {
        const isLast = index === instructions.length - 1
        return (
          <div className={cn('relative flex gap-3', !isLast && 'pb-5')} key={index}>
            {!isLast && (
              <div className="absolute left-[11px] top-6 bottom-0 w-px bg-primary/20" aria-hidden />
            )}
            <div className="relative z-10 h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold bg-primary text-primary-foreground">
              {index + 1}
            </div>
            <p className="text-sm text-muted-foreground leading-6 pt-0.5 flex-1 min-w-0">
              {instruction}
            </p>
          </div>
        )
      })}
    </div>
  )
})
