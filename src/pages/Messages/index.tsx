import { Bell, CheckCheck, Pin, RefreshCw } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { MessageRichContent } from '@/components/common/MessageRichContent'
import { Title } from '@/components/common/Title'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMessageCenterStore } from '@/hooks/useMessageCenter'
import { cn } from '@/lib/utils'

function formatDateTime(value: string | null) {
  if (!value) return '未设置'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未设置'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const items = useMessageCenterStore(state => state.items)
  const unreadCount = useMessageCenterStore(state => state.unreadCount)
  const isLoading = useMessageCenterStore(state => state.isLoading)
  const initialized = useMessageCenterStore(state => state.initialized)
  const streamConnected = useMessageCenterStore(state => state.streamConnected)
  const refresh = useMessageCenterStore(state => state.refresh)
  const markRead = useMessageCenterStore(state => state.markRead)
  const markAllRead = useMessageCenterStore(state => state.markAllRead)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selectedId = searchParams.get('id')

  useEffect(() => {
    if (items.length === 0) {
      return
    }

    const fallbackId =
      selectedId && items.some(item => item.id === selectedId) ? selectedId : items[0]?.id
    if (!fallbackId) {
      return
    }

    if (fallbackId !== selectedId) {
      setSearchParams({ id: fallbackId }, { replace: true })
      return
    }

    const selectedItem = items.find(item => item.id === fallbackId)
    if (selectedItem && !selectedItem.is_read) {
      void markRead(selectedItem.id)
    }
  }, [items, markRead, selectedId, setSearchParams])

  const selectedMessage = useMemo(
    () => items.find(item => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  )

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex min-h-full flex-col gap-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="shrink-0">
              <Title title="消息中心" description="查看服务器下发的通知、更新和运营消息。" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    streamConnected ? 'bg-emerald-500' : 'bg-amber-500',
                  )}
                />
                <span>{streamConnected ? '实时同步中' : '实时连接重连中'}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refresh()}>
                <RefreshCw className={cn(isLoading && 'animate-spin')} />
                刷新
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={unreadCount === 0}
                onClick={() => void markAllRead()}
              >
                <CheckCheck />
                全部已读
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
            <Card className="min-h-[26rem] overflow-hidden">
              <CardHeader className="border-b border-border/60">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="h-4 w-4" />
                  消息列表
                </CardTitle>
                <CardDescription>
                  {unreadCount > 0 ? `当前有 ${unreadCount} 条未读` : '当前没有未读消息'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[34rem]">
                  <div className="p-2">
                    {!initialized && isLoading ? (
                      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                        正在加载消息...
                      </div>
                    ) : items.length === 0 ? (
                      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                        暂无消息内容。
                      </div>
                    ) : (
                      items.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          className={cn(
                            'mb-2 flex w-full flex-col rounded-xl border px-3 py-3 text-left transition-colors duration-150',
                            selectedMessage?.id === item.id
                              ? 'border-primary/40 bg-primary/8'
                              : 'border-transparent hover:border-border/70 hover:bg-muted/50',
                          )}
                          onClick={() => {
                            setSearchParams({ id: item.id })
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {item.title}
                            </span>
                            {item.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-600" />}
                            {!item.is_read && <span className="h-2 w-2 rounded-full bg-primary" />}
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {item.content}
                          </p>
                          <div className="mt-2 text-[11px] text-muted-foreground/80">
                            {formatDateTime(item.published_at ?? item.created_at)}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="min-h-[26rem] overflow-hidden">
              <CardHeader className="border-b border-border/60">
                <CardTitle className="text-base">{selectedMessage?.title ?? '消息详情'}</CardTitle>
                <CardDescription>
                  {selectedMessage
                    ? `发布时间：${formatDateTime(selectedMessage.published_at ?? selectedMessage.created_at)}`
                    : '选择一条消息查看完整内容'}
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 p-0">
                <ScrollArea className="h-[34rem]">
                  {selectedMessage ? (
                    <div className="space-y-5 p-6">
                      {selectedMessage.is_pinned && (
                        <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/12 px-3 py-1 text-xs font-medium text-amber-700">
                          <Pin className="h-3.5 w-3.5" />
                          <span>置顶消息</span>
                        </div>
                      )}
                      <MessageRichContent content={selectedMessage.content} />
                    </div>
                  ) : (
                    <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                      暂无可展示的消息详情。
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
