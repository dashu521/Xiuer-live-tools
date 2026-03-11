import { Heart, LogIn, MessageSquare, ShoppingCart, Star, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { type LiveEvent, useLiveStats } from '@/hooks/useLiveStats'
import { cn } from '@/lib/utils'

type EventFilter = 'all' | 'comment' | 'enter' | 'follow' | 'fansclub' | 'order' | 'like'

const EVENT_CONFIG: Record<
  string,
  {
    label: string
    icon: React.ReactNode
    color: string
    bgColor: string
  }
> = {
  comment: {
    label: '评论',
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'text-blue-600',
    bgColor: 'border border-blue-500/30',
  },
  wechat_channel_live_msg: {
    label: '评论',
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'text-blue-600',
    bgColor: 'border border-blue-500/30',
  },
  xiaohongshu_comment: {
    label: '评论',
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'text-blue-600',
    bgColor: 'border border-blue-500/30',
  },
  taobao_comment: {
    label: '评论',
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'text-blue-600',
    bgColor: 'border border-blue-500/30',
  },
  room_enter: {
    label: '进入直播间',
    icon: <LogIn className="h-4 w-4" />,
    color: 'text-green-600',
    bgColor: 'border border-green-500/30',
  },
  room_like: {
    label: '点赞',
    icon: <Heart className="h-4 w-4" />,
    color: 'text-pink-600',
    bgColor: 'border border-pink-500/30',
  },
  room_follow: {
    label: '关注',
    icon: <UserPlus className="h-4 w-4" />,
    color: 'text-purple-600',
    bgColor: 'border border-purple-500/30',
  },
  ecom_fansclub_participate: {
    label: '加入粉丝团',
    icon: <Users className="h-4 w-4" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  live_order: {
    label: '下单',
    icon: <ShoppingCart className="h-4 w-4" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
  },
  subscribe_merchant_brand_vip: {
    label: '品牌会员',
    icon: <Star className="h-4 w-4" />,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
}

interface EventItemProps {
  event: LiveEvent
}

function EventItem({ event }: EventItemProps) {
  const config = EVENT_CONFIG[event.type] || {
    label: '未知事件',
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  }

  const orderStatus = event.extra?.orderStatus as string | undefined

  return (
    <div className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className={cn('flex items-center justify-center w-8 h-8 rounded-full', config.bgColor)}>
        <span className={config.color}>{config.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate max-w-[120px]">
            {event.nickName}
          </span>
          <Badge variant="secondary" className={cn('text-xs', config.bgColor, config.color)}>
            {config.label}
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto shrink-0">{event.time}</span>
        </div>
        {event.content && (
          <p className="mt-0.5 text-sm text-muted-foreground truncate">{event.content}</p>
        )}
        {orderStatus && (
          <Badge
            variant="outline"
            className={cn(
              'mt-1 text-xs',
              orderStatus === '已付款'
                ? 'border-green-500/30 text-green-600'
                : 'border-blue-500/30 text-blue-600',
            )}
          >
            {orderStatus}
          </Badge>
        )}
      </div>
    </div>
  )
}

const FILTER_OPTIONS: { value: EventFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'comment', label: '评论' },
  { value: 'enter', label: '进入' },
  { value: 'follow', label: '关注' },
  { value: 'fansclub', label: '粉丝团' },
  { value: 'order', label: '订单' },
  { value: 'like', label: '点赞' },
]

export default function EventTimeline() {
  const { events, isListening } = useLiveStats()
  const [filter, setFilter] = useState<EventFilter>('all')

  // 过滤事件
  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events

    const typeMap: Record<EventFilter, string[]> = {
      all: [],
      comment: ['comment', 'wechat_channel_live_msg', 'xiaohongshu_comment', 'taobao_comment'],
      enter: ['room_enter'],
      follow: ['room_follow'],
      fansclub: ['ecom_fansclub_participate'],
      order: ['live_order'],
      like: ['room_like'],
    }

    return events.filter(event => typeMap[filter].includes(event.type))
  }, [events, filter])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              事件时间线
              <Badge variant={isListening ? 'default' : 'outline'}>{events.length} 条</Badge>
            </CardTitle>
            <CardDescription>按时间顺序显示所有直播事件</CardDescription>
          </div>
        </div>
        {/* 筛选按钮 */}
        <div className="flex flex-wrap gap-1 mt-3">
          {FILTER_OPTIONS.map(option => (
            <Button
              key={option.value}
              variant={filter === option.value ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 min-h-0">
        <ScrollArea className="h-[22.5rem]">
          <div className="py-2 space-y-0.5 px-4">
            {filteredEvents.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                {isListening ? '等待事件数据...' : '请先开始监控'}
              </div>
            ) : (
              filteredEvents.map(event => <EventItem key={event.id} event={event} />)
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
