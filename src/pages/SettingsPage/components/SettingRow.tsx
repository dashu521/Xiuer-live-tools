import type React from 'react'
import { cn } from '@/lib/utils'

/** 列表式设置行：左侧标题/说明，右侧控件，紧凑间距 */
export function SettingRow({
  label,
  description,
  children,
  className,
}: {
  label: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 py-2 min-h-0',
        description ? 'items-start' : 'items-center',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-tight">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
