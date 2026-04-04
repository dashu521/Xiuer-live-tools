import { describe, expect, it } from 'vitest'
import { buildAutoReplyAnomalyInsights } from '@/lib/autoReplyInsights'

describe('buildAutoReplyAnomalyInsights', () => {
  it('aggregates anomaly stats and samples', () => {
    const result = buildAutoReplyAnomalyInsights(
      [
        {
          msg_id: 'c-1',
          nick_name: '秀儿',
          content: '今天主推什么',
        },
        {
          msg_id: 'c-2',
          nick_name: '秀儿',
          content: '三号链接多少钱',
        },
      ],
      [
        {
          commentId: 'c-1',
          replyContent: '今天有几款在上架，您想先看哪号我给您介绍',
          replyIntent: 'product-list',
          factStatus: 'missing',
          guardrailAction: 'rewrite',
          guardrailReason: 'safe-fallback',
          knowledgeMissReason: 'no-items',
        },
        {
          commentId: 'c-2',
          replyContent: '3号链接现在99元',
          replyIntent: 'single-product',
          factStatus: 'grounded',
          guardrailAction: 'pass',
        },
      ],
    )

    expect(result.anomalyCount).toBe(1)
    expect(result.rewrittenCount).toBe(1)
    expect(result.missingFactCount).toBe(1)
    expect(result.knowledgeFallbackCount).toBe(1)
    expect(result.topGuardrailReasons[0]).toEqual(['safe-fallback', 1])
    expect(result.topKnowledgeMissReasons[0]).toEqual(['no-items', 1])
    expect(result.anomalySamples[0]?.commentContent).toBe('今天主推什么')
    expect(result.suggestions[0]?.title).toBe('先建立商品知识卡')
  })
})
