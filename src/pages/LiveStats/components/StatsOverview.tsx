import {
  Download,
  FolderOpen,
  Heart,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  UserPlus,
  Users,
} from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { GateButton } from '@/components/GateButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { useLiveFeatureGate } from '@/hooks/useLiveFeatureGate'
import { formatCount, formatDuration, type MessageStats } from '@/hooks/useLiveStats'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  subValue?: string
  icon: React.ReactNode
}

/**
 * StatsCard 组件 - 已优化
 * 使用 memo 避免不必要的重渲染
 */
const StatsCard = memo(function StatsCard({ title, value, subValue, icon }: StatsCardProps) {
  return (
    <Card className="relative overflow-hidden border-primary/20 bg-card/90 shadow-[0_14px_30px_-22px_rgba(0,0,0,0.55)]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
            {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
          </div>
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/8 text-primary shadow-sm',
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

interface StatsOverviewProps {
  stats: MessageStats
  isListening: boolean
  onStart: () => void
  onStop: () => void
  onReset: () => void
  onExport: () => void
  onOpenFolder: () => void
  isExporting?: boolean
  gate: ReturnType<typeof useLiveFeatureGate>
}

/**
 * StatsOverview 组件 - 已优化
 * 1. 使用 memo 避免不必要的重渲染
 * 2. 修复 useState 存储 ref 的问题，改用 useRef
 * 3. 使用 useCallback 缓存事件处理函数
 */
const StatsOverview = memo(function StatsOverview({
  stats,
  isListening,
  onStart,
  onStop,
  onReset,
  onExport,
  onOpenFolder,
  isExporting = false,
  gate,
}: StatsOverviewProps) {
  const [duration, setDuration] = useState(0)
  // 修复：使用 useRef 替代 useState 存储可变引用
  const startTimeRef = useRef<number | null>(null)

  // 计时器
  useEffect(() => {
    if (isListening) {
      // 监听开始时记录开始时间
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now()
      }
      const timer = setInterval(() => {
        if (startTimeRef.current !== null) {
          setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
        }
      }, 1000)
      return () => clearInterval(timer)
    }
    // 监听停止时重置
    startTimeRef.current = null
    setDuration(0)
  }, [isListening])

  const handleStart = useCallback(() => {
    startTimeRef.current = Date.now()
    setDuration(0)
    onStart()
  }, [onStart])

  const handleStop = useCallback(() => {
    onStop()
  }, [onStop])

  const handleReset = useCallback(() => {
    startTimeRef.current = isListening ? Date.now() : null
    setDuration(0)
    onReset()
  }, [isListening, onReset])

  return (
    <div className="space-y-4">
      {/* 控制栏 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-h-7 items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">监控总览</span>
          {isListening ? (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              </span>
              <span className="text-sm text-muted-foreground">
                监听中 · {formatDuration(duration)}
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">尚未开始监控</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isListening ? (
            <Button variant="outline" size="sm" onClick={handleStop}>
              <Pause className="h-4 w-4 mr-1" />
              停止监控
            </Button>
          ) : (
            <GateButton gate={gate} onClick={handleStart} size="sm">
              <Play className="h-4 w-4 mr-1" />
              开始监控
            </GateButton>
          )}
          <TooltipProvider>
            {/* 导出数据按钮 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="导出数据"
                  onClick={onExport}
                  disabled={isExporting || stats.commentCount === 0}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>导出数据</p>
              </TooltipContent>
            </Tooltip>

            {/* 打开导出目录按钮 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="打开导出目录" onClick={onOpenFolder}>
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>打开导出目录</p>
              </TooltipContent>
            </Tooltip>

            {/* 重置数据按钮 */}
            {stats.commentCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="重置数据" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>重置数据</p>
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      </div>

      {/* 统计卡片网格 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          title="点赞"
          value={formatCount(stats.likeCount)}
          subValue="次"
          icon={<Heart className="h-5 w-5" />}
        />
        <StatsCard
          title="弹幕"
          value={formatCount(stats.commentCount)}
          subValue="条"
          icon={<MessageSquare className="h-5 w-5" />}
        />
        <StatsCard
          title="进入直播间"
          value={formatCount(stats.enterCount)}
          subValue="人次"
          icon={<Users className="h-5 w-5" />}
        />
        <StatsCard
          title="新增关注"
          value={formatCount(stats.followCount)}
          subValue="人"
          icon={<UserPlus className="h-5 w-5" />}
        />
      </div>

      {/* 第二行统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          title="粉丝团"
          value={formatCount(stats.fansClubCount)}
          subValue="新加入"
          icon={<Users className="h-5 w-5" />}
        />
        <StatsCard
          title="品牌会员"
          value={formatCount(stats.brandVipCount)}
          subValue="新加入"
          icon={<UserPlus className="h-5 w-5" />}
        />
        <StatsCard
          title="订单"
          value={formatCount(stats.orderCount)}
          subValue={`已付款 ${stats.paidOrderCount}`}
          icon={<MessageSquare className="h-5 w-5" />}
        />
        <StatsCard
          title="监控时长"
          value={formatDuration(duration)}
          subValue={isListening ? '实时更新' : '未开始'}
          icon={<Play className="h-5 w-5" />}
        />
      </div>
    </div>
  )
})

export default StatsOverview
