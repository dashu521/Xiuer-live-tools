import { useMemoizedFn } from 'ahooks'
import { useRef } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { providers } from 'shared/providers'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { AUTO_REPLY } from '@/constants'
import {
  buildAutoReplyConversation,
  buildAutoReplySystemPrompt,
  enforceAutoReplyLength,
  sanitizeAutoReplyResponse,
  shouldSkipDuplicateReply,
} from '@/lib/autoReply'
import {
  buildProductKnowledgePolishPrompt,
  tryProductKnowledgeReply,
  type ViewerProductSession,
} from '@/lib/productKnowledge'
import { EVENTS, eventEmitter } from '@/utils/events'
import { matchObject } from '@/utils/filter'
import { useAccounts } from './useAccounts'
import { type AIProvider, useAIChatStore } from './useAIChat'
import { getEffectiveAICredentials, useAITrialStore } from './useAITrial'
import { useAutoPopUpStore } from './useAutoPopUp'
import { type AutoReplyConfig, useAutoReplyConfig } from './useAutoReplyConfig'
import { useErrorHandler } from './useErrorHandler'
import { useCurrentLiveControl, useLiveControlStore } from './useLiveControl'
import { useLiveStatsStore } from './useLiveStats'

interface ReplyPreview {
  id: string
  commentId: string
  replyContent: string
  replyFor: string
  time: string
  isSent: boolean
  source: 'ai' | 'product-kb'
  matchedSlotIndex?: number
  matchedTitle?: string
  questionType?: 'price' | 'stock' | 'usage' | 'general'
  matchedFields?: string[]
  knowledgeMissReason?:
    | 'no-items'
    | 'not-product-query'
    | 'slot-not-found'
    | 'reference-expired'
    | 'keyword-not-found'
  wasDeduplicated?: boolean
}

export type Message = LiveMessage
export type MessageType = Message['msg_type']
export type EventMessageType = Extract<
  MessageType,
  | 'room_enter'
  | 'room_like'
  | 'live_order'
  | 'subscribe_merchant_brand_vip'
  | 'room_follow'
  | 'ecom_fansclub_participate'
>
export type MessageOf<T extends MessageType> = Extract<Message, { msg_type: T }>
type CommentMessage = MessageOf<Exclude<MessageType, EventMessageType>>

type ListeningStatus = 'waiting' | 'listening' | 'stopped' | 'error'

interface AutoReplyContext {
  isRunning: boolean
  isListening: ListeningStatus
  replies: ReplyPreview[]
  comments: Message[]
}

interface AutoReplyState {
  contexts: Record<string, AutoReplyContext>
}
interface AutoReplyAction {
  setIsRunning: (accountId: string, isRunning: boolean) => void
  setIsListening: (accountId: string, isListening: ListeningStatus) => void
  addComment: (accountId: string, comment: Message) => void
  addReply: (
    accountId: string,
    commentId: string,
    nickname: string,
    content: string,
    metadata?: Partial<
      Pick<
        ReplyPreview,
        | 'source'
        | 'matchedSlotIndex'
        | 'matchedTitle'
        | 'questionType'
        | 'matchedFields'
        | 'knowledgeMissReason'
        | 'wasDeduplicated'
      >
    >,
    isSent?: boolean,
  ) => void
  markReplySent: (accountId: string, commentId: string) => void
  removeReply: (accountId: string, commentId: string) => void
}

const createDefaultContext = (): AutoReplyContext => ({
  isRunning: false,
  isListening: 'stopped',
  replies: [],
  comments: [],
})

export const useAutoReplyStore = create<AutoReplyState & AutoReplyAction>()(
  immer(set => {
    eventEmitter.on(EVENTS.ACCOUNT_REMOVED, (accountId: string) => {
      set(state => {
        delete state.contexts[accountId]
      })
    })

    const ensureContext = (state: AutoReplyState, accountId: string) => {
      if (!state.contexts[accountId]) {
        state.contexts[accountId] = createDefaultContext()
      }
      return state.contexts[accountId]
    }

    return {
      contexts: {},
      setIsRunning: (accountId, isRunning) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.isRunning = isRunning
        }),
      setIsListening: (accountId, isListening) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.isListening = isListening
        }),

      addComment: (accountId, comment) =>
        set(state => {
          const context = ensureContext(state, accountId)
          // 限制评论数量，防止内存无限增长
          context.comments = [{ ...comment }, ...context.comments].slice(0, AUTO_REPLY.MAX_COMMENTS)
        }),
      addReply: (accountId, commentId, nickname, content, metadata, isSent = false) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.replies = [
            {
              id: crypto.randomUUID(),
              commentId,
              replyContent: content,
              replyFor: nickname,
              time: new Date().toISOString(),
              isSent,
              source: metadata?.source ?? 'ai',
              matchedSlotIndex: metadata?.matchedSlotIndex,
              matchedTitle: metadata?.matchedTitle,
              questionType: metadata?.questionType,
              matchedFields: metadata?.matchedFields,
              knowledgeMissReason: metadata?.knowledgeMissReason,
              wasDeduplicated: metadata?.wasDeduplicated,
            },
            ...context.replies.filter(
              reply =>
                reply.commentId !== commentId && !(!reply.isSent && reply.replyFor === nickname),
            ),
          ].slice(0, AUTO_REPLY.MAX_REPLIES)
        }),
      markReplySent: (accountId, commentId) =>
        set(state => {
          const context = ensureContext(state, accountId)
          const reply = context.replies.find(item => item.commentId === commentId)
          if (reply) {
            reply.isSent = true
          }
        }),
      removeReply: (accountId, commentId) =>
        set(state => {
          const context = ensureContext(state, accountId)
          context.replies = context.replies.filter(reply => reply.commentId !== commentId)
        }),
    }
  }),
)

function sendConfiguredReply(
  accountId: string,
  config: AutoReplyConfig,
  sourceMessage: Message,
  errorHandler: ReturnType<typeof useErrorHandler>['handleError'],
): void {
  const replyConfig = config[sourceMessage.msg_type as EventMessageType]
  if (replyConfig.enable && replyConfig.messages.length > 0) {
    const filterMessages = []
    const pureMessages = []
    for (const message of replyConfig.messages) {
      if (typeof message === 'string') {
        pureMessages.push(message)
      } else if (matchObject(sourceMessage, message.filter)) {
        filterMessages.push(message.content)
      }
    }
    const replyMessages = filterMessages.length ? filterMessages : pureMessages
    const content = getRandomElement(replyMessages)
    if (content) {
      const message = replaceUsername(content, sourceMessage.nick_name, config.hideUsername)
      sendMessage(accountId, message, errorHandler) // 注意：这里是异步的，但我们不等待它完成
    }
  }
}

function getRandomElement<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined
  const randomIndex = Math.floor(Math.random() * arr.length)
  return arr[randomIndex]
}

async function sendMessage(
  accountId: string,
  content: string,
  errorHandler: ReturnType<typeof useErrorHandler>['handleError'],
): Promise<boolean> {
  if (!content) return false
  try {
    const sent = await window.ipcRenderer.invoke(
      IPC_CHANNELS.tasks.autoReply.sendReply,
      accountId,
      content,
    )
    if (!sent) {
      errorHandler(new Error('send_reply_failed'), '自动发送回复失败')
      return false
    }
    return sent
  } catch (err) {
    errorHandler(err, '自动发送回复失败')
    return false
  }
}

function replaceUsername(content: string, username: string, mask: boolean) {
  if (!content) return ''
  // 把 {用户名} 替换为 username
  const displayedUsername = mask
    ? `${String.fromCodePoint(username.codePointAt(0) ?? 42 /* 42 是星号 */)}***`
    : username
  return content.replace(new RegExp(AUTO_REPLY.USERNAME_PLACEHOLDER, 'g'), displayedUsername)
}

/**
 * 处理关键字回复逻辑
 * @returns boolean - 是否成功匹配并发送了关键字回复
 */
const handleKeywordReply = (
  comment: CommentMessage,
  config: AutoReplyConfig,
  accountId: string,
  errorHandler: ReturnType<typeof useErrorHandler>['handleError'],
): boolean => {
  if (!config.comment.keywordReply.enable || !comment.content) {
    return false
  }

  const rule = config.comment.keywordReply.rules.find(({ keywords }) =>
    keywords.some(kw => comment.content?.includes(kw)),
  )

  if (rule && rule.contents.length > 0) {
    const content = getRandomElement(rule.contents)
    if (content) {
      const message = replaceUsername(content, comment.nick_name, config.hideUsername)
      sendMessage(accountId, message, errorHandler)
      // 注意：关键字回复不通过 addReply 添加到界面，直接发送
      return true // 匹配成功
    }
  }
  return false // 未匹配
}

/**
 * 【P1-1 AI联动最小可用】获取 AI 对话的共享配置
 * 在渲染进程中直接读取 useAIChatStore 的状态
 */
export function getAISharedConfig(feature: 'chat' | 'auto_reply' | 'knowledge_draft' = 'chat') {
  const store = useAIChatStore.getState()
  const provider = store.config.provider
  const providerConfig = providers[provider]
  const credentials = getEffectiveAICredentials({
    feature,
    userProvider: provider,
    userModel: store.config.model,
    userApiKey: store.apiKeys[provider] || '',
    userCustomBaseURL: store.customBaseURL || providerConfig.baseURL,
  })

  return {
    // 基础配置
    provider: credentials?.provider ?? provider,
    model: credentials?.model ?? store.config.model,
    apiKey: credentials?.apiKey ?? (store.apiKeys[provider] || ''),
    baseURL: credentials?.customBaseURL ?? (store.customBaseURL || providerConfig.baseURL),

    // 生成参数
    temperature: store.config.temperature ?? 0.7,

    // 系统提示词
    systemPrompt: store.systemPrompt || '你是一个 helpful assistant',

    // 自动回复不复用 AI 助手聊天历史，避免任务边界被污染
    recentMessages: [],
  }
}

/**
 * 处理 AI 回复逻辑
 *
 * 【P1-1 AI联动最小可用】支持使用 AI 对话的共享配置
 * - 共用模型、API Key、BaseURL
 * - 共用 system prompt
 * - 共用 temperature
 * - 读取最近3轮 AI 对话上下文
 */
const handleAIReply = async (
  accountId: string,
  comment: CommentMessage,
  allComments: Message[],
  allReplies: ReplyPreview[],
  config: AutoReplyConfig,
  {
    provider,
    model,
    apiKey,
    customBaseURL,
  }: {
    provider: AIProvider
    model: string
    apiKey: string
    customBaseURL: string
  },
  onReply: (content: string, isSent?: boolean) => void,
  errorHandler: ReturnType<typeof useErrorHandler>['handleError'],
) => {
  if (!config.comment.aiReply.enable) return

  const { prompt, autoSend } = config.comment.aiReply

  // 【P1-1】判断是否使用 AI 对话的共享配置
  const useSharedConfig = config.comment.aiReply.useSharedConfig ?? false

  let aiConfig: {
    provider: AIProvider
    model: string
    apiKey: string
    customBaseURL: string
    temperature?: number
    systemPrompt?: string
    recentMessages?: Array<{ role: string; content: string }>
  }

  if (useSharedConfig) {
    // 使用 AI 对话的共享配置
    const sharedConfig = getAISharedConfig('auto_reply')
    aiConfig = {
      provider: sharedConfig.provider as AIProvider,
      model: sharedConfig.model,
      apiKey: sharedConfig.apiKey,
      customBaseURL: sharedConfig.baseURL,
      temperature: sharedConfig.temperature,
      systemPrompt: sharedConfig.systemPrompt,
      recentMessages: sharedConfig.recentMessages,
    }
  } else {
    // 使用自动回复的独立配置
    aiConfig = {
      provider,
      model,
      apiKey,
      customBaseURL,
    }
  }

  if (!aiConfig.apiKey?.trim()) {
    console.warn('[AutoReply] Missing effective AI credentials, skipping AI reply generation')
    return
  }

  // 筛选与该用户相关的评论和回复
  const userComments = [comment, ...allComments].filter(
    cmt =>
      (cmt.msg_type === 'comment' || cmt.msg_type === 'wechat_channel_live_msg') &&
      cmt.nick_name === comment.nick_name,
  ) as CommentMessage[]
  const userReplies = allReplies.filter(reply => reply.replyFor === comment.nick_name)

  // 生成 AI 请求的消息体
  const plainMessages = buildAutoReplyConversation(comment, userComments, userReplies)

  // 构造系统提示
  const systemPrompt = buildAutoReplySystemPrompt(
    prompt,
    useSharedConfig ? aiConfig.systemPrompt : undefined,
  )

  // 构建消息列表
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ]

  messages.push(...plainMessages)

  try {
    const rawReplyContent = await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.aiChat.normalChat, {
      messages,
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey: aiConfig.apiKey,
      customBaseURL: aiConfig.customBaseURL,
    })

    if (rawReplyContent && typeof rawReplyContent === 'string') {
      const replyContent = sanitizeAutoReplyResponse(rawReplyContent)
      if (!replyContent) {
        console.warn('[AutoReply] Discarded invalid AI reply:', rawReplyContent)
        return
      }

      let isSent = false
      // 自动发送
      if (autoSend) {
        isSent = await sendMessage(accountId, replyContent, errorHandler)
      }
      onReply(replyContent, isSent)
    }
  } catch (err) {
    errorHandler(err, 'AI 生成回复失败')
  }
}

const maybePolishProductKnowledgeReply = async ({
  comment,
  templateReply,
  knowledgeItem,
  config,
  productPrompt,
  provider,
  model,
  apiKey,
  customBaseURL,
}: {
  comment: CommentMessage
  templateReply: string
  knowledgeItem: NonNullable<ReturnType<typeof tryProductKnowledgeReply>['item']>
  config: AutoReplyConfig
  productPrompt?: string
  provider: AIProvider
  model: string
  apiKey: string
  customBaseURL: string
}) => {
  if (!config.comment.aiReply.enable || !apiKey) {
    return templateReply
  }

  try {
    const polished = await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.aiChat.normalChat, {
      messages: [
        {
          role: 'system',
          content: buildProductKnowledgePolishPrompt({
            comment: comment.content,
            templateReply,
            item: knowledgeItem,
            userPrompt: productPrompt,
          }),
        },
      ],
      provider,
      model,
      apiKey,
      customBaseURL,
    })

    if (typeof polished !== 'string' || !polished.trim()) {
      return templateReply
    }

    return sanitizeAutoReplyResponse(polished) ?? templateReply
  } catch {
    return templateReply
  }
}

export function useAutoReply() {
  const currentAccountId = useAccounts(state => state.currentAccountId)
  const accountName = useCurrentLiveControl(ctx => ctx.accountName)
  const defaultContextRef = useRef(createDefaultContext())
  const context = useAutoReplyStore(
    state => state.contexts[currentAccountId] ?? defaultContextRef.current,
  )
  const addComment = useAutoReplyStore(state => state.addComment)
  const addReply = useAutoReplyStore(state => state.addReply)
  const markReplySent = useAutoReplyStore(state => state.markReplySent)
  const setIsRunning = useAutoReplyStore(state => state.setIsRunning)
  const setIsListening = useAutoReplyStore(state => state.setIsListening)
  const removeReply = useAutoReplyStore(state => state.removeReply)
  const provider = useAIChatStore(state => state.config.provider)
  const model = useAIChatStore(state => state.config.model)
  const apiKeys = useAIChatStore(state => state.apiKeys)
  const customBaseURL = useAIChatStore(state => state.customBaseURL)
  const ensureTrialSession = useAITrialStore(state => state.ensureSession)
  const reportTrialUse = useAITrialStore(state => state.reportUse)
  const { config } = useAutoReplyConfig()
  const { handleError } = useErrorHandler()

  const { isListening, comments, replies } = context
  const latestAiRequestVersionRef = useRef<Record<string, number>>({})
  const viewerProductSessionRef = useRef<Record<string, ViewerProductSession>>({})
  const recentReplyCacheRef = useRef<Record<string, { content: string; at: number }>>({})

  const handleComment = useMemoizedFn((comment: Message, accountId: string) => {
    // const context = contexts[accountId] || createDefaultContext()
    const currentContext =
      useAutoReplyStore.getState().contexts[accountId] || createDefaultContext()
    const {
      isRunning,
      isListening: autoReplyListening,
      comments: allComments,
      replies: allReplies,
    } = currentContext

    // 只在监听状态时添加评论到列表
    if (autoReplyListening === 'listening') {
      addComment(accountId, comment)
    }

    // 同步到 LiveStats 统计模块（仅在监听时）
    const liveStatsContext = useLiveStatsStore.getState().contexts[accountId]
    if (liveStatsContext?.isListening) {
      useLiveStatsStore.getState().handleMessage(accountId, comment)
    }

    if (!isRunning) {
      return
    }

    // 检查前置条件：如果连接已断开，停止处理评论
    // 获取对应账号的连接状态
    const liveControlState = useLiveControlStore.getState()
    const accountConnectState = liveControlState.contexts[accountId]?.connectState
    const streamState = liveControlState.contexts[accountId]?.streamState
    if (!accountConnectState || accountConnectState.status !== 'connected') {
      console.log(
        `[TaskGate] Comment received but connection is ${accountConnectState?.status || 'unknown'} for account ${accountId}, ignoring`,
      )
      return
    }

    // 检查直播状态：未开播时不处理自动回复
    if (streamState !== 'live') {
      console.log(
        `[TaskGate] Comment received but stream is not live (state: ${streamState}) for account ${accountId}, ignoring`,
      )
      return
    }

    void (async function handleReply() {
      if (
        // 如果是主播评论就跳过
        comment.nick_name === accountName ||
        // 在黑名单也跳过
        config.blockList?.includes(comment.nick_name)
      ) {
        return
      }
      switch (comment.msg_type) {
        case 'taobao_comment':
        case 'xiaohongshu_comment':
        case 'wechat_channel_live_msg':
        case 'comment': {
          // 优先尝试关键字回复
          const keywordReplied = handleKeywordReply(comment, config, accountId, handleError)
          // 如果关键字未回复，且 AI 回复已启用，则尝试 AI 回复
          if (!keywordReplied && config.comment.aiReply.enable) {
            if (!apiKeys[provider]) {
              await ensureTrialSession('auto_reply')
            }

            const productKnowledgeItems =
              useAutoPopUpStore.getState().contexts[accountId]?.config.goods ?? []
            const viewerSessionKey = `${accountId}:${comment.nick_name}`
            const productKnowledgeHit = tryProductKnowledgeReply({
              comment: comment.content,
              items: productKnowledgeItems,
              viewerSession: viewerProductSessionRef.current[viewerSessionKey],
            })

            if (productKnowledgeHit.hit) {
              const templateReply = productKnowledgeHit.reply
              const matchedKnowledgeItem = productKnowledgeHit.item

              if (productKnowledgeHit.shouldUpdateSession && productKnowledgeHit.slotIndex) {
                viewerProductSessionRef.current[viewerSessionKey] = {
                  slotIndex: productKnowledgeHit.slotIndex,
                  updatedAt: Date.now(),
                }
              }

              if (templateReply) {
                const shouldSkipPolish =
                  productKnowledgeHit.questionType === 'price' ||
                  productKnowledgeHit.questionType === 'stock'

                const finalReply =
                  matchedKnowledgeItem && !shouldSkipPolish
                    ? await maybePolishProductKnowledgeReply({
                        comment,
                        templateReply,
                        knowledgeItem: matchedKnowledgeItem,
                        config,
                        productPrompt: config.comment.aiReply.productPrompt,
                        provider,
                        model,
                        apiKey: apiKeys[provider],
                        customBaseURL,
                      })
                    : templateReply

                const sendableReply = enforceAutoReplyLength(finalReply)
                const recentReplyKey = `${accountId}:${comment.nick_name}`
                const lastReply = recentReplyCacheRef.current[recentReplyKey]
                if (
                  shouldSkipDuplicateReply({
                    replyContent: sendableReply,
                    lastReplyContent: lastReply?.content,
                    lastReplyAt: lastReply?.at,
                  })
                ) {
                  addReply(
                    accountId,
                    comment.msg_id,
                    comment.nick_name,
                    sendableReply,
                    {
                      source: 'product-kb',
                      matchedSlotIndex: productKnowledgeHit.slotIndex,
                      matchedTitle: productKnowledgeHit.item?.title,
                      questionType: productKnowledgeHit.questionType,
                      matchedFields: productKnowledgeHit.matchedFields,
                      wasDeduplicated: true,
                    },
                    false,
                  )
                  return
                }

                let isSent = false
                if (config.comment.aiReply.autoSend) {
                  void sendMessage(accountId, sendableReply, handleError).then(sent => {
                    if (sent) {
                      markReplySent(accountId, comment.msg_id)
                    }
                  })
                  isSent = false
                }

                recentReplyCacheRef.current[recentReplyKey] = {
                  content: sendableReply,
                  at: Date.now(),
                }

                addReply(
                  accountId,
                  comment.msg_id,
                  comment.nick_name,
                  sendableReply,
                  {
                    source: 'product-kb',
                    matchedSlotIndex: productKnowledgeHit.slotIndex,
                    matchedTitle: productKnowledgeHit.item?.title,
                    questionType: productKnowledgeHit.questionType,
                    matchedFields: productKnowledgeHit.matchedFields,
                  },
                  isSent,
                )
                return
              }
            }

            const credentials = getEffectiveAICredentials({
              feature: 'auto_reply',
              userProvider: provider,
              userModel: model,
              userApiKey: apiKeys[provider],
              userCustomBaseURL: customBaseURL,
            })
            if (!credentials) {
              return
            }
            const requestKey = `${accountId}:${comment.nick_name}`
            const requestVersion = (latestAiRequestVersionRef.current[requestKey] ?? 0) + 1
            latestAiRequestVersionRef.current[requestKey] = requestVersion
            handleAIReply(
              accountId,
              comment,
              allComments,
              allReplies,
              config,
              {
                provider: credentials.provider,
                model: credentials.model,
                apiKey: credentials.apiKey,
                customBaseURL: credentials.customBaseURL,
              },
              (replyContent: string, isSent = false) => {
                if (latestAiRequestVersionRef.current[requestKey] !== requestVersion) {
                  return
                }
                const recentReplyKey = `${accountId}:${comment.nick_name}`
                const lastReply = recentReplyCacheRef.current[recentReplyKey]
                if (
                  shouldSkipDuplicateReply({
                    replyContent,
                    lastReplyContent: lastReply?.content,
                    lastReplyAt: lastReply?.at,
                  })
                ) {
                  addReply(
                    accountId,
                    comment.msg_id,
                    comment.nick_name,
                    replyContent,
                    {
                      source: 'ai',
                      matchedSlotIndex: productKnowledgeHit.slotIndex,
                      knowledgeMissReason: productKnowledgeHit.missReason,
                      wasDeduplicated: true,
                    },
                    false,
                  )
                  return
                }
                const viewerSessionKey = `${accountId}:${comment.nick_name}`
                recentReplyCacheRef.current[recentReplyKey] = {
                  content: replyContent,
                  at: Date.now(),
                }
                addReply(
                  accountId,
                  comment.msg_id,
                  comment.nick_name,
                  replyContent,
                  {
                    source: 'ai',
                    matchedSlotIndex: productKnowledgeHit.slotIndex,
                    knowledgeMissReason: productKnowledgeHit.missReason,
                  },
                  isSent,
                )
                if (isSent) {
                  const knowledgeHit = tryProductKnowledgeReply({
                    comment: comment.content,
                    items: useAutoPopUpStore.getState().contexts[accountId]?.config.goods ?? [],
                  })
                  if (knowledgeHit.hit && knowledgeHit.slotIndex) {
                    viewerProductSessionRef.current[viewerSessionKey] = {
                      slotIndex: knowledgeHit.slotIndex,
                      updatedAt: Date.now(),
                    }
                  }
                }
              },
              handleError,
            )
            if (credentials.credentialMode === 'trial') {
              await reportTrialUse({ feature: 'auto_reply', model: credentials.model })
            }
          }
          break
        }
        case 'live_order': {
          /* 如果设置了仅已支付回复且当前非已支付时不回复 */
          if (!config.live_order.options?.onlyReplyPaid || comment.order_status === '已付款') {
            sendConfiguredReply(accountId, config, comment, handleError)
          }
          break
        }
        default:
          sendConfiguredReply(accountId, config, comment, handleError)
      }
    })()

    ;(function handlePinComment() {
      // 视频号上墙
      if (comment.msg_type === 'wechat_channel_live_msg' && config.pinComment.enable) {
        if (!config.pinComment.includeHost && comment.nick_name === accountName) {
          return
        }
        const { matchStr } = config.pinComment
        // 把平台表情去掉，表情为 [xx]
        const pureTextContent = comment.content.replace(/\[[^\]]{1,3}\]/g, '')
        if (matchStr.some(str => pureTextContent.includes(str))) {
          window.ipcRenderer.invoke(IPC_CHANNELS.tasks.pinComment, {
            accountId,
            content: pureTextContent,
          })
        }
      }
    })()
  })

  // 【Phase 2A】绿点只基于真实运行态：isListening === 'listening'
  const isEffectivelyRunning = isListening === 'listening'

  return {
    // 当前账户的状态
    // 【Phase 2A】isRunning 对外暴露为 isEffectivelyRunning，绿点只基于真实运行态
    isRunning: isEffectivelyRunning,
    isListening,
    comments, // 当前账户的评论
    replies, // 当前账户的回复

    // Actions (绑定到当前账户)
    handleComment,
    // 【Phase 2A】内部状态设置保持原样，供任务内部使用
    setIsRunning: (running: boolean) => setIsRunning(currentAccountId, running),
    setIsListening: (listening: ListeningStatus) => setIsListening(currentAccountId, listening),
    markReplySent: (commentId: string) => markReplySent(currentAccountId, commentId),
    removeReply: (commentId: string) => removeReply(currentAccountId, commentId),
  }
}
