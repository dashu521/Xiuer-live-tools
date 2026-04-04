import type { GoodsItemConfig } from '@/hooks/useAutoPopUp'
import {
  buildSafeProductFallbackReply,
  type ProductIntent,
  type ProductKnowledgeHit,
  tryProductKnowledgeReply,
} from '@/lib/productKnowledge'
import type { ViewerProductSession } from './productKnowledge'

export interface AutoReplyDecision {
  mode: 'product-kb' | 'safe-fallback' | 'ai'
  productKnowledgeHit: ProductKnowledgeHit
  replyContent?: string
  shouldPolishWithAi: boolean
  aiConversationMode: 'latest-turn' | 'current-only'
  diagnostics: {
    replyIntent: ProductIntent | 'chat'
    factStatus: 'grounded' | 'missing' | 'not-applicable'
    source: 'product-kb' | 'ai'
    guardrailAction: 'pass' | 'rewrite'
    guardrailReason?: string
    questionType?: ProductKnowledgeHit['questionType']
    matchedFields?: string[]
    knowledgeMissReason?: ProductKnowledgeHit['missReason']
  }
}

function toReplyIntent(intent?: ProductIntent) {
  return intent === 'not-product' || !intent ? 'chat' : intent
}

export function decideAutoReply(params: {
  comment: string
  items: GoodsItemConfig[]
  viewerSession?: ViewerProductSession
}) {
  const { comment, items, viewerSession } = params
  const productKnowledgeHit = tryProductKnowledgeReply({
    comment,
    items,
    viewerSession,
  })

  if (productKnowledgeHit.hit && productKnowledgeHit.reply) {
    const shouldPolishWithAi =
      Boolean(productKnowledgeHit.item) &&
      productKnowledgeHit.questionType !== 'price' &&
      productKnowledgeHit.questionType !== 'stock'

    return {
      mode: 'product-kb',
      productKnowledgeHit,
      replyContent: productKnowledgeHit.reply,
      shouldPolishWithAi,
      aiConversationMode: 'current-only',
      diagnostics: {
        replyIntent: toReplyIntent(productKnowledgeHit.intent),
        factStatus: 'grounded',
        source: 'product-kb',
        guardrailAction: 'pass',
        questionType: productKnowledgeHit.questionType,
        matchedFields: productKnowledgeHit.matchedFields,
      },
    } satisfies AutoReplyDecision
  }

  if (!productKnowledgeHit.hit && productKnowledgeHit.intent !== 'not-product') {
    return {
      mode: 'safe-fallback',
      productKnowledgeHit,
      replyContent: buildSafeProductFallbackReply(comment, items),
      shouldPolishWithAi: false,
      aiConversationMode: 'current-only',
      diagnostics: {
        replyIntent: toReplyIntent(productKnowledgeHit.intent),
        factStatus: 'missing',
        source: 'ai',
        guardrailAction: 'rewrite',
        guardrailReason: 'safe-fallback',
        knowledgeMissReason: productKnowledgeHit.missReason,
      },
    } satisfies AutoReplyDecision
  }

  return {
    mode: 'ai',
    productKnowledgeHit,
    shouldPolishWithAi: false,
    aiConversationMode:
      productKnowledgeHit.intent === 'not-product' ? 'latest-turn' : 'current-only',
    diagnostics: {
      replyIntent: toReplyIntent(productKnowledgeHit.intent),
      factStatus: productKnowledgeHit.intent === 'not-product' ? 'not-applicable' : 'missing',
      source: 'ai',
      guardrailAction: 'pass',
      knowledgeMissReason:
        productKnowledgeHit.intent === 'not-product' ? undefined : productKnowledgeHit.missReason,
    },
  } satisfies AutoReplyDecision
}
