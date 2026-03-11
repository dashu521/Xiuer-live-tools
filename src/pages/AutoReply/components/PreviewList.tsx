import { SendHorizontalIcon } from 'lucide-react'
import { memo, useCallback } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAccounts } from '@/hooks/useAccounts'
import { type MessageOf, useAutoReply } from '@/hooks/useAutoReply'

/**
 * PreviewList 组件 - 已优化
 * 使用 memo 避免父组件重渲染时不必要的更新
 */
const PreviewList = memo(function PreviewList({
  setHighLight,
}: {
  setHighLight: (commentId: string | null) => void
}) {
  const { replies, comments } = useAutoReply()
  const currentAccountId = useAccounts(state => state.currentAccountId)

  const handleSendReply = useCallback(
    async (replyContent: string, _commentId: string) => {
      try {
        await window.ipcRenderer.invoke(
          IPC_CHANNELS.tasks.autoReply.sendReply,
          currentAccountId,
          replyContent,
        )
        // removeReply(commentId)
      } catch (error) {
        console.error('发送回复失败:', error)
      }
    },
    [currentAccountId],
  )

  return (
    <Card className="shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm">回复预览</CardTitle>
        <CardDescription className="text-xs">AI 生成的回复内容</CardDescription>
      </CardHeader>
      <Separator className="shrink-0" />
      <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto py-2">
          <div className="space-y-1 px-2">
            {replies.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">暂无回复数据</div>
            ) : (
              replies.map(reply => {
                const relatedComment = comments.find(
                  c => c.msg_id === reply.commentId,
                ) as MessageOf<'comment'>
                return (
                  <div
                    key={reply.commentId}
                    className="group px-2 py-1.5 text-sm hover:bg-muted/50 rounded-lg transition-all hover:-translate-y-0.5"
                    onMouseEnter={() => setHighLight(reply.commentId)}
                    onMouseLeave={() => setHighLight(null)}
                  >
                    <div className="flex flex-col gap-0.5">
                      {relatedComment && (
                        <div className="text-xs text-muted-foreground">
                          回复：{relatedComment.nick_name} - {relatedComment.content}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-foreground/90 flex-1 leading-relaxed text-xs">
                          {reply.replyContent}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="invisible group-hover:visible h-6 w-6 shrink-0"
                          title="发送"
                          onClick={() => handleSendReply(reply.replyContent, reply.commentId)}
                        >
                          <SendHorizontalIcon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

export default PreviewList
