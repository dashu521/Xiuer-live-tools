import { describe, expect, it } from 'vitest'
import {
  buildFallbackFaqFromKnowledgeDraft,
  tryProductKnowledgeReply,
} from '@/lib/productKnowledge'

describe('productKnowledge', () => {
  const items = [
    {
      id: 3,
      title: '胶原修护面霜',
      priceText: '99元',
      promoText: '拍2件减20',
      highlights: ['保湿', '修护屏障', '适合干皮'],
      aliases: ['面霜', '修护霜'],
      faq: [{ q: '适合谁', a: '这款更适合干皮和混干皮哦' }],
    },
  ]

  it('matches explicit slot questions', () => {
    const result = tryProductKnowledgeReply({
      comment: '介绍下三号链接',
      items,
    })

    expect(result.hit).toBe(true)
    expect(result.slotIndex).toBe(3)
    expect(result.matchedFields).toContain('title')
    expect(result.reply).toContain('3号链接')
  })

  it('matches keyword questions', () => {
    const result = tryProductKnowledgeReply({
      comment: '这个面霜多少钱',
      items,
    })

    expect(result.hit).toBe(true)
    expect(result.questionType).toBe('price')
    expect(result.reply).toContain('99元')
  })

  it('uses viewer session for reference questions', () => {
    const result = tryProductKnowledgeReply({
      comment: '这个适合谁',
      items,
      viewerSession: {
        slotIndex: 3,
        updatedAt: Date.now(),
      },
    })

    expect(result.hit).toBe(true)
    expect(result.reply).toBe('这款更适合干皮和混干皮哦')
  })

  it('does not hijack non-product compliments', () => {
    const result = tryProductKnowledgeReply({
      comment: '我好喜欢主播啊',
      items,
    })

    expect(result.hit).toBe(false)
  })

  it('treats inventory questions as stock questions', () => {
    const result = tryProductKnowledgeReply({
      comment: '三号链接还有货吗',
      items: [
        {
          id: 3,
          title: '胶原修护面霜',
          stockText: '现货充足',
        },
      ],
    })

    expect(result.hit).toBe(true)
    expect(result.questionType).toBe('stock')
    expect(result.reply).toContain('现货充足')
  })

  it('returns miss reason when asked slot is not configured', () => {
    const result = tryProductKnowledgeReply({
      comment: '介绍下九号链接',
      items,
    })

    expect(result.hit).toBe(false)
    expect(result.missReason).toBe('slot-not-found')
  })

  it('builds fallback faq from extracted draft fields', () => {
    const faq = buildFallbackFaqFromKnowledgeDraft({
      title: '胶原修护面霜',
      priceText: '99元',
      highlights: ['保湿', '修护屏障'],
    })

    expect(faq).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ q: '这是什么' }),
        expect.objectContaining({ q: '多少钱' }),
        expect.objectContaining({ q: '有什么亮点' }),
      ]),
    )
  })
})
