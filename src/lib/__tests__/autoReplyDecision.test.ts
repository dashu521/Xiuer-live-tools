import { describe, expect, it } from 'vitest'
import { decideAutoReply } from '@/lib/autoReplyDecision'

describe('autoReplyDecision', () => {
  const items = [
    {
      id: 3,
      title: '胶原修护面霜',
      shortTitle: '修护面霜',
      priceText: '99元',
      promoText: '拍2件减20',
      highlights: ['保湿', '修护屏障'],
      aliases: ['面霜'],
      faq: [{ q: '适合谁', a: '更适合干皮和混干皮哦' }],
    },
  ]

  it('returns product-kb decision for grounded product questions', () => {
    const result = decideAutoReply({
      comment: '介绍下三号链接',
      items,
    })

    expect(result.mode).toBe('product-kb')
    expect(result.replyContent).toContain('3号链接')
    expect(result.diagnostics.source).toBe('product-kb')
    expect(result.diagnostics.factStatus).toBe('grounded')
    expect(result.aiConversationMode).toBe('current-only')
  })

  it('returns safe-fallback decision for product intent without grounded facts', () => {
    const result = decideAutoReply({
      comment: '今天主推什么',
      items: [],
    })

    expect(result.mode).toBe('safe-fallback')
    expect(result.diagnostics.guardrailAction).toBe('rewrite')
    expect(result.diagnostics.factStatus).toBe('missing')
    expect(result.replyContent).toContain('商品')
  })

  it('returns ai decision for non-product chat', () => {
    const result = decideAutoReply({
      comment: '主播今天好漂亮',
      items,
    })

    expect(result.mode).toBe('ai')
    expect(result.aiConversationMode).toBe('latest-turn')
    expect(result.diagnostics.replyIntent).toBe('chat')
    expect(result.diagnostics.factStatus).toBe('not-applicable')
  })
})
