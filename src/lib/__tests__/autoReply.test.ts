import { describe, expect, it } from 'vitest'
import {
  buildAutoReplyConversation,
  buildAutoReplySystemPrompt,
  enforceAutoReplyLength,
  sanitizeAutoReplyResponse,
  shouldSkipDuplicateReply,
} from '@/lib/autoReply'

describe('autoReply helpers', () => {
  it('adds strict output rules to the system prompt', () => {
    const prompt = buildAutoReplySystemPrompt('语气更活泼一点', '你是一个 helpful assistant')

    expect(prompt).toContain('你只需要输出最终要发送给观众的一句话回复')
    expect(prompt).toContain('不要输出 JSON')
    expect(prompt).toContain('每次只回复一句')
    expect(prompt).toContain('用户补充要求：\n语气更活泼一点')
    expect(prompt).toContain('你是一个 helpful assistant')
  })

  it('treats the legacy default prompt as empty user supplement', () => {
    const prompt = buildAutoReplySystemPrompt(
      '你是一个直播间的助手，负责回复观众的评论。请用简短友好的语气回复，不要超过50个字。',
    )

    expect(prompt).not.toContain('用户补充要求')
    expect(prompt).toContain('你是直播间口播助手')
  })

  it('removes echoed comment JSON and keeps the final natural-language reply', () => {
    const response =
      '{"nickname":"秀儿","content":"主播晚上好"} {"nickname":"秀儿","content":"主播真漂亮"} 晚上好秀儿！谢谢夸奖，三号链接马上展示！'

    expect(sanitizeAutoReplyResponse(response)).toBe('晚上好秀儿！谢谢夸奖，三号链接马上展示！')
  })

  it('unwraps common output labels', () => {
    expect(sanitizeAutoReplyResponse('建议回复：晚上好秀儿，链接马上展示！')).toBe(
      '晚上好秀儿，链接马上展示！',
    )
  })

  it('rejects pure JSON echo responses', () => {
    const response =
      '{"nickname":"秀儿","content":"主播好漂亮"} {"nickname":"秀儿","content":"看看三号链接"}'

    expect(sanitizeAutoReplyResponse(response)).toBeNull()
  })

  it('truncates overlong replies to the platform send limit', () => {
    const reply =
      '3号链接是豪园OVITEN 100%椰子水饮料清爽解腻电解质245ml*10袋运动补水，主打100%椰子水、清爽解腻、含电解质，现在¥29.90'

    const trimmed = enforceAutoReplyLength(reply)

    expect(trimmed.length).toBe(50)
    expect(reply.startsWith(trimmed)).toBe(true)
    expect(trimmed).toBe(
      '3号链接是豪园OVITEN 100%椰子水饮料清爽解腻电解质245ml*10袋运动补水，主打100%',
    )
  })

  it('builds context from the latest sent turn plus the current comment', () => {
    const messages = buildAutoReplyConversation(
      {
        msg_id: 'c-2',
        nick_name: '秀儿',
        content: '介绍下三号链接',
        time: '2026-03-31T21:00:00.000Z',
      },
      [
        {
          msg_id: 'c-1',
          nick_name: '秀儿',
          content: '主播今天好漂亮',
          time: '2026-03-31T20:59:00.000Z',
        },
        {
          msg_id: 'c-2',
          nick_name: '秀儿',
          content: '介绍下三号链接',
          time: '2026-03-31T21:00:00.000Z',
        },
      ],
      [
        {
          commentId: 'c-1',
          replyFor: '秀儿',
          replyContent: '谢谢夸奖呀',
          time: '2026-03-31T20:59:10.000Z',
          isSent: true,
        },
      ],
    )

    expect(messages).toEqual([
      {
        role: 'user',
        content: '{"nickname":"秀儿","content":"主播今天好漂亮"}',
      },
      {
        role: 'assistant',
        content: '谢谢夸奖呀',
      },
      {
        role: 'user',
        content: '{"nickname":"秀儿","content":"介绍下三号链接"}',
      },
    ])
  })

  it('ignores unsent preview replies when building context', () => {
    const messages = buildAutoReplyConversation(
      {
        msg_id: 'c-2',
        nick_name: '秀儿',
        content: '主播你在干嘛',
        time: '2026-03-31T21:00:00.000Z',
      },
      [
        {
          msg_id: 'c-1',
          nick_name: '秀儿',
          content: '我好喜欢主播啊',
          time: '2026-03-31T20:59:00.000Z',
        },
        {
          msg_id: 'c-2',
          nick_name: '秀儿',
          content: '主播你在干嘛',
          time: '2026-03-31T21:00:00.000Z',
        },
      ],
      [
        {
          commentId: 'c-1',
          replyFor: '秀儿',
          replyContent: '主播在的，今天想了解什么产品呢？',
          time: '2026-03-31T20:59:10.000Z',
          isSent: false,
        },
      ],
    )

    expect(messages).toEqual([
      {
        role: 'user',
        content: '{"nickname":"秀儿","content":"主播你在干嘛"}',
      },
    ])
  })

  it('skips duplicate replies within cooldown window', () => {
    expect(
      shouldSkipDuplicateReply({
        replyContent: '现在99元，点链接看详情哦！',
        lastReplyContent: '现在99元，点链接看详情哦',
        lastReplyAt: Date.now() - 10_000,
      }),
    ).toBe(true)
  })
})
