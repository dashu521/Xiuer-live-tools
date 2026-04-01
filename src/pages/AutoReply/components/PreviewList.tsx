import { SendHorizontalIcon } from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
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
  const { replies, comments, markReplySent } = useAutoReply()
  const currentAccountId = useAccounts(state => state.currentAccountId)
  const navigate = useNavigate()

  const questionTypeLabelMap: Record<'price' | 'stock' | 'usage' | 'general', string> = {
    price: '价格问答',
    stock: '库存问答',
    usage: '商品介绍',
    general: '商品问答',
  }
  const missReasonLabelMap: Record<
    'no-items' | 'not-product-query' | 'slot-not-found' | 'reference-expired' | 'keyword-not-found',
    string
  > = {
    'no-items': '当前未配置商品知识卡',
    'not-product-query': '普通闲聊，未走商品知识库',
    'slot-not-found': '提到的链接号未配置',
    'reference-expired': '商品指代已过期',
    'keyword-not-found': '未匹配到商品关键词',
  }
  type KnowledgeMissReason = keyof typeof missReasonLabelMap

  const handleSendReply = useCallback(
    async (replyContent: string, commentId: string) => {
      try {
        await window.ipcRenderer.invoke(
          IPC_CHANNELS.tasks.autoReply.sendReply,
          currentAccountId,
          replyContent,
        )
        markReplySent(commentId)
      } catch (error) {
        console.error('发送回复失败:', error)
      }
    },
    [currentAccountId, markReplySent],
  )

  const knowledgeStats = useMemo(() => {
    const total = replies.length
    const kbHits = replies.filter(reply => reply.source === 'product-kb').length
    const genericAi = replies.filter(reply => reply.source === 'ai').length
    const faqHits = replies.filter(
      reply => reply.source === 'product-kb' && reply.matchedFields?.includes('faq'),
    ).length
    const hitRate = total > 0 ? Math.round((kbHits / total) * 100) : 0
    const faqHitRate = kbHits > 0 ? Math.round((faqHits / kbHits) * 100) : 0

    const missReasonCounts = new Map<string, number>()
    const slotCounts = new Map<number, number>()

    for (const reply of replies) {
      if (reply.knowledgeMissReason) {
        missReasonCounts.set(
          reply.knowledgeMissReason,
          (missReasonCounts.get(reply.knowledgeMissReason) ?? 0) + 1,
        )
      }
      if (reply.matchedSlotIndex) {
        slotCounts.set(reply.matchedSlotIndex, (slotCounts.get(reply.matchedSlotIndex) ?? 0) + 1)
      }
    }

    const topMissReason = [...missReasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.at(0) as
      | KnowledgeMissReason
      | undefined
    const topSlot = [...slotCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

    return {
      total,
      kbHits,
      genericAi,
      faqHits,
      hitRate,
      faqHitRate,
      topMissReason,
      topSlot,
    }
  }, [replies])

  const knowledgeSuggestions = useMemo(() => {
    const suggestions: Array<{ title: string; description: string; slotIndex?: number }> = []

    const noItemsCount = replies.filter(reply => reply.knowledgeMissReason === 'no-items').length
    if (noItemsCount > 0) {
      suggestions.push({
        title: '先建立商品知识卡',
        description: `有 ${noItemsCount} 条回复因为当前未配置商品知识卡而回退到通用 AI，建议先补商品标题、价格、FAQ。`,
      })
    }

    const slotMissCounts = new Map<number, number>()
    for (const reply of replies) {
      if (reply.knowledgeMissReason === 'slot-not-found' && reply.matchedSlotIndex) {
        slotMissCounts.set(
          reply.matchedSlotIndex,
          (slotMissCounts.get(reply.matchedSlotIndex) ?? 0) + 1,
        )
      }
    }
    for (const [slotIndex, count] of [...slotMissCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)) {
      suggestions.push({
        title: `补充 ${slotIndex} 号链接`,
        description: `有 ${count} 次提到了 ${slotIndex} 号链接，但当前没有对应知识卡，建议优先补这条商品信息。`,
        slotIndex,
      })
    }

    const keywordMissReplies = replies
      .filter(reply => reply.knowledgeMissReason === 'keyword-not-found')
      .map(reply => {
        const comment = comments.find(item => item.msg_id === reply.commentId)
        if (comment && 'content' in comment && typeof comment.content === 'string') {
          return comment.content.trim()
        }
        return undefined
      })
      .filter((content): content is string => Boolean(content))
    if (keywordMissReplies.length > 0) {
      const sampleQuestion = keywordMissReplies[0]
      suggestions.push({
        title: '补充商品别名或 FAQ',
        description: `像“${sampleQuestion}”这类问题没命中商品知识库，建议给商品补别名关键词或常见问答。`,
      })
    }

    const referenceExpiredCount = replies.filter(
      reply => reply.knowledgeMissReason === 'reference-expired',
    ).length
    if (referenceExpiredCount > 0) {
      suggestions.push({
        title: '补强连续追问场景',
        description: `有 ${referenceExpiredCount} 条回复因商品指代过期回退，建议给高频商品补 FAQ，让“这个/那个”类追问更容易命中。`,
      })
    }

    return suggestions.slice(0, 4)
  }, [comments, replies])

  return (
    <Card className="shadow-sm flex h-full flex-col min-h-0 overflow-hidden">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm">回复预览</CardTitle>
        <CardDescription className="text-xs">AI 生成的回复内容</CardDescription>
      </CardHeader>
      <Separator className="shrink-0" />
      <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="border-b px-3 py-2 bg-muted/20">
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-6">
            <div className="rounded-md bg-background/60 px-2.5 py-2">
              <div className="text-[11px] text-muted-foreground">总回复数</div>
              <div className="text-sm font-medium">{knowledgeStats.total}</div>
            </div>
            <div className="rounded-md bg-background/60 px-2.5 py-2">
              <div className="text-[11px] text-muted-foreground">知识库命中</div>
              <div className="text-sm font-medium">{knowledgeStats.kbHits}</div>
            </div>
            <div className="rounded-md bg-background/60 px-2.5 py-2">
              <div className="text-[11px] text-muted-foreground">命中率</div>
              <div className="text-sm font-medium">{knowledgeStats.hitRate}%</div>
            </div>
            <div className="rounded-md bg-background/60 px-2.5 py-2">
              <div className="text-[11px] text-muted-foreground">FAQ 命中率</div>
              <div className="text-sm font-medium">
                {knowledgeStats.faqHits}/{knowledgeStats.kbHits || 0}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({knowledgeStats.faqHitRate}%)
                </span>
              </div>
            </div>
            <div className="rounded-md bg-background/60 px-2.5 py-2">
              <div className="text-[11px] text-muted-foreground">高频商品号</div>
              <div className="text-sm font-medium">
                {knowledgeStats.topSlot ? `${knowledgeStats.topSlot}号` : '暂无'}
              </div>
            </div>
            <div className="rounded-md bg-background/60 px-2.5 py-2">
              <div className="text-[11px] text-muted-foreground">常见回退原因</div>
              <div className="text-sm font-medium">
                {knowledgeStats.topMissReason
                  ? missReasonLabelMap[knowledgeStats.topMissReason]
                  : '暂无'}
              </div>
            </div>
          </div>
          {knowledgeSuggestions.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="text-[11px] font-medium text-muted-foreground">知识补全建议</div>
              <div className="grid gap-1.5">
                {knowledgeSuggestions.map(suggestion => (
                  <div
                    key={`${suggestion.title}-${suggestion.description}`}
                    className="rounded-md bg-background/60 px-2.5 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-foreground">
                          {suggestion.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {suggestion.description}
                        </div>
                      </div>
                      {suggestion.slotIndex ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0 text-[11px]"
                          onClick={() =>
                            navigate(`/auto-popup?editGoodsId=${suggestion.slotIndex}`)
                          }
                        >
                          去补充
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
                    className="ui-hover-item group rounded-lg px-2 py-1.5 text-sm"
                    onMouseEnter={() => setHighLight(reply.commentId)}
                    onMouseLeave={() => setHighLight(null)}
                    onFocus={() => setHighLight(reply.commentId)}
                    onBlur={() => setHighLight(null)}
                  >
                    <div className="flex flex-col gap-0.5">
                      {relatedComment && (
                        <div className="text-xs text-muted-foreground">
                          回复：{relatedComment.nick_name} - {relatedComment.content}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {reply.source === 'product-kb' ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                            商品知识库
                            {reply.matchedSlotIndex ? ` · ${reply.matchedSlotIndex}号` : ''}
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5">AI 通用回复</span>
                        )}
                        {reply.isSent ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                            已发送
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-400">
                            待发送
                          </span>
                        )}
                        {reply.wasDeduplicated ? (
                          <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-400">
                            已去重
                          </span>
                        ) : null}
                      </div>
                      {reply.source === 'product-kb' && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          {reply.matchedTitle ? (
                            <span className="rounded-full bg-background/60 px-2 py-0.5">
                              {reply.matchedTitle}
                            </span>
                          ) : null}
                          {reply.questionType ? (
                            <span className="rounded-full bg-background/60 px-2 py-0.5">
                              {questionTypeLabelMap[reply.questionType]}
                            </span>
                          ) : null}
                          {reply.matchedFields?.map(field => (
                            <span key={field} className="rounded-full bg-background/60 px-2 py-0.5">
                              {field}
                            </span>
                          ))}
                        </div>
                      )}
                      {reply.source === 'ai' && reply.knowledgeMissReason && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="rounded-full bg-background/60 px-2 py-0.5">
                            回退通用 AI
                          </span>
                          <span className="rounded-full bg-background/60 px-2 py-0.5">
                            {missReasonLabelMap[reply.knowledgeMissReason]}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-foreground/90 flex-1 leading-relaxed text-xs">
                          {reply.replyContent}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`发送回复给${relatedComment?.nick_name ?? '当前用户'}`}
                          className="h-8 w-8 shrink-0 opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                          disabled={reply.isSent}
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
