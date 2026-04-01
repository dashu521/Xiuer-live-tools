import { describe, expect, it } from 'vitest'
import { messagesToContext, normalizeContextMessages } from '@/lib/utils'

describe('AI chat context normalization', () => {
  it('drops failed user+error rounds before building context', () => {
    const context = messagesToContext(
      [
        {
          id: '1',
          role: 'user',
          content: 'hello',
          timestamp: 1,
        },
        {
          id: '2',
          role: 'assistant',
          content: 'hi',
          timestamp: 2,
        },
        {
          id: '3',
          role: 'user',
          content: 'broken request',
          timestamp: 3,
        },
        {
          id: '4',
          role: 'assistant',
          content: '402 Insufficient Balance',
          timestamp: 4,
          isError: true,
        },
      ],
      'next question',
    )

    expect(context).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
      { role: 'user', content: 'next question' },
    ])
  })

  it('filters error messages and preserves the partial assistant reply that preceded them', () => {
    const normalized = normalizeContextMessages([
      {
        id: '1',
        role: 'user',
        content: 'explain',
        timestamp: 1,
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Partial answer',
        timestamp: 2,
      },
      {
        id: '3',
        role: 'assistant',
        content: 'request failed',
        timestamp: 3,
        isError: true,
      },
    ])

    expect(normalized).toEqual([
      { role: 'user', content: 'explain' },
      { role: 'assistant', content: 'Partial answer' },
    ])
  })

  it('collapses legacy consecutive assistant messages into a single valid payload entry', () => {
    const normalized = normalizeContextMessages([
      {
        id: '1',
        role: 'user',
        content: 'question',
        timestamp: 1,
      },
      {
        id: '2',
        role: 'assistant',
        content: 'first part',
        timestamp: 2,
      },
      {
        id: '3',
        role: 'assistant',
        content: 'second part',
        timestamp: 3,
      },
    ])

    expect(normalized).toEqual([
      { role: 'user', content: 'question' },
      { role: 'assistant', content: 'first part\n\nsecond part' },
    ])
  })
})
