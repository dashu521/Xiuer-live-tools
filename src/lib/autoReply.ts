const AUTO_REPLY_OUTPUT_RULES = [
  '你只需要输出最终要发送给观众的一句话回复。',
  '不要输出 JSON，不要复述输入，不要解释分析过程，不要添加“回复：”“建议回复：”“最终回复：”等前缀。',
  '不要包含 nickname、content 等字段名，不要输出代码块。',
  '回复要口语化、自然、简短，默认不超过 50 个字。',
  '只回答最后一条评论，前面的内容只作为参考，不要机械重复之前的话术。',
  '如果最后一条评论是在夸主播、打招呼或闲聊，就自然回应，不要强行转成商品导购。',
].join('\n')

const JSON_COMMENT_PATTERN =
  /\{[^{}]*"nickname"\s*:\s*"[^"]*"[^{}]*"content"\s*:\s*"[^"]*"[^{}]*\}/g

const OUTPUT_LABEL_PATTERN = /^(?:回复内容|最终回复|建议回复|回复|输出)[:：]\s*/i

function stripMarkdownCodeFence(text: string) {
  return text.replace(/```[\s\S]*?```/g, block => block.replace(/```/g, ' '))
}

function isJsonEchoLine(line: string) {
  const normalized = line.trim()
  if (!normalized) return false
  if (normalized.includes('"nickname"') || normalized.includes('"content"')) {
    return true
  }
  return normalized.startsWith('{') || normalized.startsWith('[')
}

function cleanCandidateText(text: string) {
  return text
    .replace(JSON_COMMENT_PATTERN, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !isJsonEchoLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function unwrapOutputLabel(text: string) {
  const lines = text.split('\n')
  const normalizedLines = lines.map(line => line.trim()).filter(Boolean)
  const lastLine = normalizedLines.at(-1) ?? ''
  const unwrappedLastLine = lastLine.replace(OUTPUT_LABEL_PATTERN, '').trim()

  if (unwrappedLastLine && unwrappedLastLine !== lastLine) {
    return unwrappedLastLine
  }

  return text
}

export interface AutoReplyCommentInput {
  msg_id: string
  nick_name: string
  content: string
  time: string
}

export interface AutoReplyPreviewInput {
  commentId: string
  replyFor: string
  replyContent: string
  time: string
  isSent: boolean
}

export interface AutoReplyConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

function toCommentPayload(comment: Pick<AutoReplyCommentInput, 'nick_name' | 'content'>) {
  return JSON.stringify({
    nickname: comment.nick_name,
    content: comment.content ?? '',
  })
}

export function buildAutoReplyConversation(
  currentComment: AutoReplyCommentInput,
  allComments: AutoReplyCommentInput[],
  allReplies: AutoReplyPreviewInput[],
): AutoReplyConversationMessage[] {
  const latestSentReply = allReplies
    .filter(reply => reply.replyFor === currentComment.nick_name && reply.isSent)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    .at(-1)

  const messages: AutoReplyConversationMessage[] = []

  if (latestSentReply) {
    const repliedComment = allComments.find(comment => comment.msg_id === latestSentReply.commentId)
    if (repliedComment && repliedComment.msg_id !== currentComment.msg_id) {
      messages.push({
        role: 'user',
        content: toCommentPayload(repliedComment),
      })
    }

    messages.push({
      role: 'assistant',
      content: latestSentReply.replyContent,
    })
  }

  messages.push({
    role: 'user',
    content: toCommentPayload(currentComment),
  })

  return messages
}

export function buildAutoReplySystemPrompt(prompt: string, sharedSystemPrompt?: string) {
  const sections = [
    sharedSystemPrompt?.trim(),
    '你将接收到一个或多个 JSON 字符串，每个字符串代表用户评论，格式为 {"nickname": "用户昵称", "content": "评论内容"}。',
    AUTO_REPLY_OUTPUT_RULES,
    `回复要求：\n${prompt.trim()}`,
  ]

  return sections.filter(Boolean).join('\n\n')
}

export function sanitizeAutoReplyResponse(replyContent: string) {
  const normalized = stripMarkdownCodeFence(replyContent).trim()
  if (!normalized) {
    return null
  }

  const cleaned = cleanCandidateText(normalized)
  if (!cleaned) {
    return null
  }

  const unwrapped = unwrapOutputLabel(cleaned)
  const finalReply = unwrapped.trim()

  if (!finalReply) {
    return null
  }

  if (
    finalReply.includes('"nickname"') ||
    finalReply.includes('"content"') ||
    /^[{[]/.test(finalReply)
  ) {
    return null
  }

  return finalReply
}

export function createReplyFingerprint(replyContent: string) {
  return replyContent
    .trim()
    .replace(/[！!。,.，？?~～\s]+/g, '')
    .toLowerCase()
}

export function shouldSkipDuplicateReply(params: {
  replyContent: string
  lastReplyContent?: string
  lastReplyAt?: number
  cooldownMs?: number
}) {
  const { replyContent, lastReplyContent, lastReplyAt, cooldownMs = 90_000 } = params
  if (!lastReplyContent || !lastReplyAt) {
    return false
  }

  const withinCooldown = Date.now() - lastReplyAt < cooldownMs
  if (!withinCooldown) {
    return false
  }

  return createReplyFingerprint(replyContent) === createReplyFingerprint(lastReplyContent)
}
