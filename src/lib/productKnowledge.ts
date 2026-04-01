import type { GoodsItemConfig } from '@/hooks/useAutoPopUp'

export interface ViewerProductSession {
  slotIndex: number
  updatedAt: number
}

export interface ProductKnowledgeHit {
  hit: boolean
  slotIndex?: number
  item?: GoodsItemConfig
  reply?: string
  shouldUpdateSession?: boolean
  questionType?: 'price' | 'stock' | 'usage' | 'general'
  matchedFields?: string[]
  missReason?:
    | 'no-items'
    | 'not-product-query'
    | 'slot-not-found'
    | 'reference-expired'
    | 'keyword-not-found'
}

export function buildProductKnowledgePolishPrompt(params: {
  comment: string
  templateReply: string
  item: GoodsItemConfig
}) {
  const { comment, templateReply, item } = params
  const facts = [
    `链接号：${item.id}`,
    item.title ? `商品标题：${item.title}` : '',
    item.priceText ? `价格信息：${item.priceText}` : '',
    item.promoText ? `优惠信息：${item.promoText}` : '',
    item.stockText ? `库存信息：${item.stockText}` : '',
    item.highlights?.length ? `卖点：${item.highlights.join('、')}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return [
    '你是直播间商品回复润色助手。',
    '你的任务是把已有回复模板润色得更自然、更口语化，但不能改变事实。',
    '不要新增模板里没有的商品信息，不要编造价格、优惠、库存、功效。',
    '只输出最终回复，不要解释。',
    `用户评论：${comment}`,
    `商品事实：\n${facts}`,
    `原始回复模板：${templateReply}`,
    '请输出 20 到 50 个字的自然口语回复。',
  ].join('\n\n')
}

export function buildKnowledgeDraftPrompt(scanResult: {
  id: number
  title?: string
  priceText?: string
  detailText?: string
  source: 'detail-page' | 'list-item'
}) {
  return [
    '你是直播电商商品知识卡整理助手。',
    '请根据给定的商品原始信息，输出一个 JSON 对象，用于自动填写商品知识卡。',
    '不要编造没有出现过的价格、优惠、库存、成分、功效。',
    'highlights 最多输出 5 条，aliases 最多输出 5 条，faq 最多输出 4 条。',
    'faq 请尽量生成 2 到 4 条直播间最常见的问答，优先围绕：这是什么、多少钱、有什么亮点、适合谁。',
    '如果原始信息不足以支持某条 FAQ，就不要编造；但只要能从标题、价格、卖点直接推出，就应该生成。',
    '如果某字段无法确定，就输出空字符串或空数组。',
    '只输出 JSON，不要输出解释。',
    JSON.stringify({
      id: scanResult.id,
      title: scanResult.title ?? '',
      priceText: scanResult.priceText ?? '',
      detailText: scanResult.detailText ?? '',
      source: scanResult.source,
      outputSchema: {
        title: 'string',
        shortTitle: 'string',
        priceText: 'string',
        promoText: 'string',
        stockText: 'string',
        highlights: ['string'],
        aliases: ['string'],
        faq: [{ q: 'string', a: 'string' }],
      },
    }),
  ].join('\n\n')
}

export function parseKnowledgeDraftResponse(text: string): Partial<GoodsItemConfig> | null {
  const fenced = text.replace(/```json|```/g, '').trim()
  const start = fenced.indexOf('{')
  const end = fenced.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    return null
  }

  try {
    const parsed = JSON.parse(fenced.slice(start, end + 1)) as Partial<GoodsItemConfig>
    return {
      title: parsed.title?.trim() || undefined,
      shortTitle: parsed.shortTitle?.trim() || undefined,
      priceText: parsed.priceText?.trim() || undefined,
      promoText: parsed.promoText?.trim() || undefined,
      stockText: parsed.stockText?.trim() || undefined,
      highlights: parsed.highlights?.filter(Boolean).slice(0, 5) ?? [],
      aliases: parsed.aliases?.filter(Boolean).slice(0, 5) ?? [],
      faq:
        parsed.faq
          ?.filter(item => item?.q?.trim() && item?.a?.trim())
          .slice(0, 4)
          .map(item => ({ q: item.q.trim(), a: item.a.trim() })) ?? [],
    }
  } catch {
    return null
  }
}

export function buildFallbackFaqFromKnowledgeDraft(draft: Partial<GoodsItemConfig>) {
  const faq: Array<{ q: string; a: string }> = []

  if (draft.title) {
    faq.push({
      q: '这是什么',
      a: `这款是${draft.title}，可以点链接看详情哦`,
    })
  }

  if (draft.priceText) {
    faq.push({
      q: '多少钱',
      a: `现在${draft.priceText}，具体以链接页显示为准哦`,
    })
  }

  if (draft.highlights?.length) {
    faq.push({
      q: '有什么亮点',
      a: `这款主要是${draft.highlights.slice(0, 3).join('、')}`,
    })
  }

  if (draft.stockText) {
    faq.push({
      q: '还有货吗',
      a: draft.stockText,
    })
  }

  return faq.slice(0, 4)
}

const SLOT_PATTERNS = [
  /([0-9]{1,2})\s*号\s*(?:链接|商品|款)?/i,
  /第\s*([0-9]{1,2})\s*(?:个|款|号)(?:链接|商品)?/i,
  /([一二三四五六七八九十两]{1,3})\s*号\s*(?:链接|商品|款)?/,
  /第\s*([一二三四五六七八九十两]{1,3})\s*(?:个|款|号)(?:链接|商品)?/,
]

const PRODUCT_QUERY_RE =
  /(链接|商品|这款|那个|这个|多少钱|价格|优惠|活动|库存|有货|适合|怎么用|介绍|发货|规格|尺码|成分|功效|材质|颜色|第.+个|几号)/

const REFERENCE_RE = /(这个|那个|它|这款|那款|刚才那个|刚刚那个)/
const PRICE_RE = /(多少|多少钱|价格|优惠|活动|几折|便宜|到手)/
const STOCK_RE = /(有货|库存|还有吗|还能拍|能下单|现货)/
const USAGE_RE = /(怎么用|怎么穿|怎么选|适合|功效|作用|成分|材质|颜色|尺码|规格|介绍|详情)/

function chineseNumberToInt(text: string) {
  const map: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  }

  if (text === '十') return 10
  if (text.length === 2 && text.startsWith('十')) {
    return 10 + (map[text[1]] ?? 0)
  }
  if (text.length === 2 && text.endsWith('十')) {
    return (map[text[0]] ?? 0) * 10
  }
  if (text.length === 3 && text[1] === '十') {
    return (map[text[0]] ?? 0) * 10 + (map[text[2]] ?? 0)
  }
  return map[text] ?? Number.NaN
}

function parseSlotIndex(comment: string) {
  for (const pattern of SLOT_PATTERNS) {
    const match = comment.match(pattern)
    if (!match?.[1]) continue

    const raw = match[1]
    const parsed = /^[0-9]+$/.test(raw) ? Number.parseInt(raw, 10) : chineseNumberToInt(raw)
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }

  return undefined
}

function normalizeText(text: string) {
  return text.trim().toLowerCase()
}

function matchByKeyword(comment: string, items: GoodsItemConfig[]) {
  const normalizedComment = normalizeText(comment)
  const scored = items
    .map(item => {
      const candidates = [
        item.title,
        item.shortTitle,
        ...(item.aliases ?? []),
        ...(item.highlights ?? []),
      ]
        .filter(Boolean)
        .map(text => text!.trim())

      let score = 0
      for (const candidate of candidates) {
        const normalizedCandidate = normalizeText(candidate)
        if (!normalizedCandidate || normalizedCandidate.length < 2) continue
        if (normalizedComment.includes(normalizedCandidate)) {
          score = Math.max(score, normalizedCandidate.length)
        }
      }

      return { item, score }
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored[0]?.item
}

function matchFaqAnswer(comment: string, item: GoodsItemConfig) {
  const normalizedComment = normalizeText(comment)
  return item.faq?.find(
    faq =>
      normalizeText(faq.q).includes(normalizedComment) ||
      normalizedComment.includes(normalizeText(faq.q)),
  )?.a
}

function buildFeatureSummary(item: GoodsItemConfig) {
  return item.highlights?.filter(Boolean).slice(0, 3).join('、')
}

function inferMatchedFields(params: {
  item: GoodsItemConfig
  questionType: NonNullable<ProductKnowledgeHit['questionType']>
}) {
  const { item, questionType } = params
  const fields = ['slotIndex']

  if (item.title) fields.push('title')

  switch (questionType) {
    case 'price':
      if (item.priceText) fields.push('priceText')
      if (item.promoText) fields.push('promoText')
      break
    case 'stock':
      if (item.stockText) fields.push('stockText')
      break
    case 'usage':
      if (item.highlights?.length) fields.push('highlights')
      if (item.faq?.length) fields.push('faq')
      if (item.priceText) fields.push('priceText')
      break
    default:
      if (item.highlights?.length) fields.push('highlights')
      if (item.aliases?.length) fields.push('aliases')
  }

  return fields
}

function buildProductReply(comment: string, item: GoodsItemConfig) {
  const faqAnswer = matchFaqAnswer(comment, item)
  if (faqAnswer) {
    return { reply: faqAnswer, questionType: 'usage' as const }
  }

  const title = item.title || item.shortTitle || `${item.id}号链接这款`
  const featureSummary = buildFeatureSummary(item)

  if (PRICE_RE.test(comment)) {
    if (item.priceText && item.promoText) {
      return {
        reply: `${item.id}号链接是${title}，现在${item.priceText}，${item.promoText}，点链接就能看详情哦`,
        questionType: 'price' as const,
      }
    }
    if (item.priceText) {
      return {
        reply: `${item.id}号链接是${title}，现在${item.priceText}，点链接就能看详情哦`,
        questionType: 'price' as const,
      }
    }
  }

  if (STOCK_RE.test(comment)) {
    if (item.stockText) {
      return {
        reply: `${item.id}号链接${item.stockText}，喜欢的话可以点链接看看哦`,
        questionType: 'stock' as const,
      }
    }
    return {
      reply: `${item.id}号链接现在还挂着呢，点进去就能看实时库存哦`,
      questionType: 'stock' as const,
    }
  }

  if (USAGE_RE.test(comment) || PRODUCT_QUERY_RE.test(comment)) {
    if (featureSummary && item.priceText) {
      return {
        reply: `${item.id}号链接是${title}，主打${featureSummary}，现在${item.priceText}`,
        questionType: 'usage' as const,
      }
    }
    if (featureSummary) {
      return {
        reply: `${item.id}号链接是${title}，主打${featureSummary}，可以点链接看详情哦`,
        questionType: 'usage' as const,
      }
    }
    if (item.priceText) {
      return {
        reply: `${item.id}号链接是${title}，现在${item.priceText}，可以点链接看看详情哦`,
        questionType: 'usage' as const,
      }
    }
    return {
      reply: `${item.id}号链接是${title}，可以点开链接先看看详情，有想了解的我再帮你介绍`,
      questionType: 'general' as const,
    }
  }

  return undefined
}

export function tryProductKnowledgeReply(params: {
  comment: string
  items: GoodsItemConfig[]
  viewerSession?: ViewerProductSession
}) {
  const { comment, items, viewerSession } = params

  if (items.length === 0) {
    return { hit: false, missReason: 'no-items' } satisfies ProductKnowledgeHit
  }

  const slotIndex = parseSlotIndex(comment)
  const keywordMatchedItem = matchByKeyword(comment, items)
  let item =
    (slotIndex ? items.find(candidate => candidate.id === slotIndex) : undefined) ??
    keywordMatchedItem
  let missReason: ProductKnowledgeHit['missReason'] | undefined =
    slotIndex && !item ? 'slot-not-found' : keywordMatchedItem ? undefined : 'keyword-not-found'

  if (
    !item &&
    REFERENCE_RE.test(comment) &&
    viewerSession &&
    Date.now() - viewerSession.updatedAt < 5 * 60 * 1000
  ) {
    const sessionMatchedItem = items.find(candidate => candidate.id === viewerSession.slotIndex)
    if (sessionMatchedItem) {
      item = sessionMatchedItem
      missReason = undefined
    }
  }

  if (
    !item &&
    REFERENCE_RE.test(comment) &&
    viewerSession &&
    Date.now() - viewerSession.updatedAt >= 5 * 60 * 1000
  ) {
    missReason = 'reference-expired'
  }

  if (!item) {
    return {
      hit: false,
      slotIndex,
      missReason,
    } satisfies ProductKnowledgeHit
  }

  if (!slotIndex && !PRODUCT_QUERY_RE.test(comment) && !REFERENCE_RE.test(comment)) {
    return {
      hit: false,
      missReason: 'not-product-query',
    } satisfies ProductKnowledgeHit
  }

  const productReply = buildProductReply(comment, item)

  const questionType = productReply?.questionType ?? 'general'

  return {
    hit: true,
    slotIndex: item.id,
    item,
    reply: productReply?.reply,
    questionType,
    matchedFields: inferMatchedFields({ item, questionType }),
    shouldUpdateSession: true,
  } satisfies ProductKnowledgeHit
}
