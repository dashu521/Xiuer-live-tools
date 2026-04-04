export interface AutoReplyInsightComment {
  msg_id: string
  content?: string
  nick_name: string
}

export interface AutoReplyInsightReply {
  commentId: string
  replyContent: string
  replyIntent?: string
  factStatus?: 'grounded' | 'missing' | 'not-applicable'
  guardrailAction?: 'pass' | 'rewrite'
  guardrailReason?: string
  knowledgeMissReason?: string
  matchedSlotIndex?: number
}

export interface AutoReplyOptimizationSuggestion {
  kind: 'build-kb' | 'alias-faq' | 'missing-slot' | 'price-promo-stock' | 'featured-config'
  title: string
  description: string
  slotIndex?: number
  sampleQuestion?: string
}

export function buildAutoReplyAnomalyInsights(
  comments: AutoReplyInsightComment[],
  replies: AutoReplyInsightReply[],
) {
  const anomalyReplies = replies.filter(reply => {
    const isChatLike = reply.replyIntent === 'chat' || reply.replyIntent === 'not-product'
    if (isChatLike) {
      return false
    }

    return (
      reply.guardrailAction === 'rewrite' ||
      reply.factStatus === 'missing' ||
      Boolean(reply.knowledgeMissReason)
    )
  })

  const guardrailReasonCounts = new Map<string, number>()
  const knowledgeMissCounts = new Map<string, number>()
  const replyIntentCounts = new Map<string, number>()
  const slotMissCounts = new Map<number, number>()

  for (const reply of anomalyReplies) {
    if (reply.guardrailReason) {
      guardrailReasonCounts.set(
        reply.guardrailReason,
        (guardrailReasonCounts.get(reply.guardrailReason) ?? 0) + 1,
      )
    }
    if (reply.knowledgeMissReason) {
      knowledgeMissCounts.set(
        reply.knowledgeMissReason,
        (knowledgeMissCounts.get(reply.knowledgeMissReason) ?? 0) + 1,
      )
    }
    if (reply.replyIntent) {
      replyIntentCounts.set(reply.replyIntent, (replyIntentCounts.get(reply.replyIntent) ?? 0) + 1)
    }
    if (reply.knowledgeMissReason === 'slot-not-found' && reply.matchedSlotIndex) {
      slotMissCounts.set(
        reply.matchedSlotIndex,
        (slotMissCounts.get(reply.matchedSlotIndex) ?? 0) + 1,
      )
    }
  }

  const topGuardrailReasons = [...guardrailReasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  const topKnowledgeMissReasons = [...knowledgeMissCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  const topReplyIntents = [...replyIntentCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

  const anomalySamples = anomalyReplies.slice(0, 5).map(reply => {
    const relatedComment = comments.find(comment => comment.msg_id === reply.commentId)
    return {
      commentId: reply.commentId,
      nickname: relatedComment?.nick_name ?? '',
      commentContent: relatedComment?.content ?? '',
      replyContent: reply.replyContent,
      guardrailReason: reply.guardrailReason,
      knowledgeMissReason: reply.knowledgeMissReason,
      replyIntent: reply.replyIntent,
      matchedSlotIndex: reply.matchedSlotIndex,
    }
  })

  const suggestions: AutoReplyOptimizationSuggestion[] = []

  const noItemsCount = knowledgeMissCounts.get('no-items') ?? 0
  if (noItemsCount > 0) {
    suggestions.push({
      kind: 'build-kb',
      title: '先建立商品知识卡',
      description: `有 ${noItemsCount} 条异常样本因为当前没有商品知识卡，建议先补商品标题、价格和 FAQ。`,
    })
  }

  const keywordMissCount = knowledgeMissCounts.get('keyword-not-found') ?? 0
  const keywordMissSample = anomalySamples.find(
    sample => sample.knowledgeMissReason === 'keyword-not-found',
  )
  if (keywordMissCount > 0) {
    suggestions.push({
      kind: 'alias-faq',
      title: '补商品别名或 FAQ',
      description: keywordMissSample?.commentContent
        ? `像“${keywordMissSample.commentContent}”这类问法没命中知识库，建议补商品别名或常见问答。`
        : `有 ${keywordMissCount} 条样本未命中商品关键词，建议补商品别名或 FAQ。`,
      sampleQuestion: keywordMissSample?.commentContent,
    })
  }

  for (const [slotIndex, count] of [...slotMissCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)) {
    const slotSample = anomalySamples.find(sample => sample.matchedSlotIndex === slotIndex)
    suggestions.push({
      kind: 'missing-slot',
      title: `补充 ${slotIndex} 号链接`,
      description: `有 ${count} 条异常样本提到了 ${slotIndex} 号链接，但当前没有对应知识卡。`,
      slotIndex,
      sampleQuestion: slotSample?.commentContent,
    })
  }

  const factFieldReasons = [
    'price-mismatch',
    'promo-mismatch',
    'stock-mismatch',
    'other-item-price',
    'other-item-promo',
    'other-item-stock',
  ]
  const factFieldIssueCount = factFieldReasons.reduce(
    (sum, reason) => sum + (guardrailReasonCounts.get(reason) ?? 0),
    0,
  )
  if (factFieldIssueCount > 0) {
    suggestions.push({
      kind: 'price-promo-stock',
      title: '补齐价格/优惠/库存字段',
      description: `有 ${factFieldIssueCount} 条异常样本涉及价格、优惠或库存事实不一致，建议补齐商品卡字段。`,
    })
  }

  const featuredClaimCount = guardrailReasonCounts.get('featured-claim') ?? 0
  if (featuredClaimCount > 0) {
    suggestions.push({
      kind: 'featured-config',
      title: '补主推商品配置',
      description: `有 ${featuredClaimCount} 条异常样本提到了“主推”，建议补真实主推来源后再放开相关话术。`,
    })
  }

  return {
    anomalyCount: anomalyReplies.length,
    rewrittenCount: replies.filter(reply => reply.guardrailAction === 'rewrite').length,
    missingFactCount: replies.filter(reply => reply.factStatus === 'missing').length,
    knowledgeFallbackCount: replies.filter(reply => Boolean(reply.knowledgeMissReason)).length,
    topGuardrailReasons,
    topKnowledgeMissReasons,
    topReplyIntents,
    anomalySamples,
    suggestions: suggestions.slice(0, 5),
  }
}
