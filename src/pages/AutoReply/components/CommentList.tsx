import { motion } from 'framer-motion'
import { memo, useId, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { type Message, useAutoReply } from '@/hooks/useAutoReply'
import { useCurrentLiveControl } from '@/hooks/useLiveControl'
import { cn } from '@/lib/utils'

const getMessageColor = (type: Message['msg_type']) => {
  switch (type) {
    case 'room_enter':
      return 'text-blue-500'
    case 'room_like':
      return 'text-pink-500'
    case 'room_follow':
      return 'text-purple-500'
    case 'subscribe_merchant_brand_vip':
      return 'text-amber-500'
    case 'live_order':
      return 'text-green-500'
    case 'ecom_fansclub_participate':
      return 'text-purple-500'
    default:
      return 'text-foreground'
  }
}

const getMessageText = (message: Message) => {
  switch (message.msg_type) {
    case 'room_enter':
      return '进入直播间'
    case 'room_like':
      return '点赞了直播间'
    case 'room_follow':
      return '关注了直播间'
    case 'subscribe_merchant_brand_vip':
      return '加入了品牌会员'
    case 'live_order':
      return message.product_title
    case 'ecom_fansclub_participate':
      return '加入了粉丝团'
    default:
      return message.content
  }
}

const getOrderStatusColor = (status: LiveOrderMessage['order_status']) => {
  switch (status) {
    case '已下单':
      return 'text-blue-600 border border-blue-500/30' // 待付款状态显示蓝色
    case '已付款':
      return 'text-green-600 border border-green-500/30' // 已付款状态显示绿色
    default:
      return 'text-foreground'
  }
}

const MessageItem = memo(
  ({ message, isHighlighted }: { message: Message; isHighlighted: boolean }) => {
    const displayName = message.nick_name

    return (
      <div
        className={cn(
          'flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors',
          isHighlighted ? 'border border-primary/30 bg-primary/5' : 'hover:bg-muted/50',
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm text-muted-foreground">{displayName}</span>
            {message.msg_type === 'live_order' && (
              <Badge
                variant="outline"
                className={cn('text-xs px-1.5 py-0', getOrderStatusColor(message.order_status))}
              >
                {message.order_status}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{message.time}</span>
          </div>

          <div className="mt-0.5 text-sm">
            <p
              className={cn(
                getMessageColor(message.msg_type),
                message.msg_type === 'live_order' ? 'font-medium' : '',
              )}
            >
              {getMessageText(message)}
            </p>
          </div>
        </div>
      </div>
    )
  },
  (prevProps, nextProps) => {
    // 只有当 message.msg_id 或 isHighlighted 发生变化时才重新渲染
    return (
      prevProps.message.msg_id === nextProps.message.msg_id &&
      prevProps.isHighlighted === nextProps.isHighlighted
    )
  },
)

const _EnterRoomMessage = ({ message }: { message: Message }) => {
  const displayName = message.nick_name

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-2 p-2 rounded-md border border-primary/30 bg-primary/5"
    >
      <span className="font-medium">{displayName}</span>
      <span className="text-sm text-blue-500">进入直播间</span>
    </motion.div>
  )
}

export default function CommentList({
  highlight: highlightedCommentId,
}: {
  highlight: string | null
}) {
  const { comments, isListening } = useAutoReply()
  const [hideHost, setHideHost] = useState(false)

  const accountName = useCurrentLiveControl(ctx => ctx.accountName)

  // 纯文字评论类型
  const commentTypes: Message['msg_type'][] = [
    'comment',
    'wechat_channel_live_msg',
    'xiaohongshu_comment',
    'taobao_comment',
  ]

  const filteredComments = useMemo(() => {
    if (!hideHost) return comments

    // 开启"仅用户评论"时：过滤掉主播评论 + 只保留文字弹幕类型
    return comments.filter(
      comment => comment.nick_name !== accountName && commentTypes.includes(comment.msg_type),
    )
  }, [comments, hideHost, accountName, commentTypes.includes])

  const statusLabel =
    isListening === 'listening'
      ? '监听中'
      : isListening === 'waiting'
        ? '连接中'
        : isListening === 'error'
          ? '连接异常'
          : '未监听'
  const statusVariant =
    isListening === 'listening'
      ? 'success'
      : isListening === 'waiting'
        ? 'warning'
        : isListening === 'error'
          ? 'destructive'
          : 'outline'

  const userCommentOnlyId = useId()

  return (
    <Card className="shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm">评论列表</CardTitle>
            <CardDescription className="text-xs">实时显示直播间的评论内容</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {isListening === 'listening' && (
              <div className="flex items-center gap-1.5">
                <Switch id={userCommentOnlyId} checked={hideHost} onCheckedChange={setHideHost} />
                <Label htmlFor={userCommentOnlyId} className="text-xs">
                  仅用户评论
                </Label>
              </div>
            )}
          </div>
        </div>
        <div className="mt-2">
          <Badge variant={statusVariant} className="text-xs">
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <Separator className="shrink-0" />
      <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto py-2">
          <div className="space-y-0.5 px-2">
            {filteredComments.length === 0 ? (
              <div className="flex items-center justify-center h-16 text-muted-foreground text-sm">
                {isListening === 'listening'
                  ? '暂无评论数据'
                  : '请点击右上角"开始任务"开始接收评论'}
              </div>
            ) : (
              filteredComments.map(comment => (
                <MessageItem
                  key={comment.msg_id}
                  message={comment}
                  isHighlighted={highlightedCommentId === comment.msg_id}
                />
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
