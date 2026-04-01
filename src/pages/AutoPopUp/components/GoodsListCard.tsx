import { useMemoizedFn } from 'ahooks'
import {
  AlertCircle,
  Clock,
  Copy,
  Download,
  Keyboard,
  Loader2,
  Package,
  Plus,
  RefreshCcw,
  ScanSearch,
  Trash2,
} from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAccounts } from '@/hooks/useAccounts'
import { useAIChatStore } from '@/hooks/useAIChat'
import { getEffectiveAICredentials, useAITrialStore } from '@/hooks/useAITrial'
import {
  type GoodsItemConfig,
  useAutoPopUpActions,
  useCurrentAutoPopUp,
} from '@/hooks/useAutoPopUp'
import { useConnectionStatus, useCurrentPlatform } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import {
  buildFallbackFaqFromKnowledgeDraft,
  buildKnowledgeDraftPrompt,
  parseKnowledgeDraftResponse,
} from '@/lib/productKnowledge'
import { MOCK_GOODS_IDS, shouldUseMockGoods } from '@/utils/mockGoodsData'
import ShortcutConfigTab from './ShortcutConfigTab'

function listToText(values?: string[]) {
  return values?.join('\n') ?? ''
}

function parseListText(text: string) {
  return text
    .split(/\n|,|，/)
    .map(item => item.trim())
    .filter(Boolean)
}

function faqToText(
  faq?: Array<{
    q: string
    a: string
  }>,
) {
  return faq?.map(item => `${item.q} => ${item.a}`).join('\n') ?? ''
}

function parseFaqText(text: string) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [q, ...rest] = line.split(/\s*=>\s*|\s*→\s*|\s*:\s*|：/)
      return {
        q: q?.trim() ?? '',
        a: rest.join(' ').trim(),
      }
    })
    .filter(item => item.q && item.a)
}

function parseKnowledgeImportText(text: string): GoodsItemConfig[] {
  return text
    .replace(/\t/g, '\n')
    .split(/\n{2,}|(?=\d+\s*号链接)/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => {
      const lines = block.split('\n').map(line => line.trim())
      const id = Number.parseInt(lines[0]?.replace(/[^0-9]/g, '') ?? '', 10)
      if (!id || Number.isNaN(id)) return null

      const item: GoodsItemConfig = { id }

      const normalizedLines =
        lines.length === 1 && lines[0].includes('标题')
          ? lines[0]
              .replace(/^(\d+\s*号链接?)/, '$1\n')
              .split(/\s+(?=(?:标题|简称|价格|优惠|库存|卖点|别名|FAQ)\s*[:：=])/)
          : lines

      for (const line of normalizedLines.slice(1)) {
        const [rawKey, ...rest] = line.split(/[:：=]/)
        const key = rawKey?.trim()
        const value = rest.join(':').trim()
        if (!key || !value) continue

        switch (key) {
          case '标题':
            item.title = value
            break
          case '简称':
            item.shortTitle = value
            break
          case '价格':
            item.priceText = value
            break
          case '优惠':
            item.promoText = value
            break
          case '库存':
            item.stockText = value
            break
          case '卖点':
            item.highlights = parseListText(value)
            break
          case '别名':
            item.aliases = parseListText(value)
            break
          case 'FAQ':
            item.faq = parseFaqText(value.replace(/\s*\|\s*/g, '\n'))
            break
        }
      }

      return item
    })
    .filter((item): item is GoodsItemConfig => item !== null)
}

function serializeKnowledgeItems(items: GoodsItemConfig[]) {
  return items
    .map(item =>
      [
        `${item.id}号链接`,
        item.title ? `标题: ${item.title}` : '',
        item.shortTitle ? `简称: ${item.shortTitle}` : '',
        item.priceText ? `价格: ${item.priceText}` : '',
        item.promoText ? `优惠: ${item.promoText}` : '',
        item.stockText ? `库存: ${item.stockText}` : '',
        item.highlights?.length ? `卖点: ${item.highlights.join(', ')}` : '',
        item.aliases?.length ? `别名: ${item.aliases.join(', ')}` : '',
        item.faq?.length ? `FAQ: ${item.faq.map(faq => `${faq.q} => ${faq.a}`).join(' | ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n')
}

const KNOWLEDGE_TEMPLATE = [
  '3号链接',
  '标题: 胶原修护面霜',
  '简称: 修护面霜',
  '价格: 99元',
  '优惠: 拍2件减20',
  '库存: 现货充足',
  '卖点: 保湿, 修护屏障, 适合干皮',
  '别名: 面霜, 修护霜',
  'FAQ: 适合谁 => 更适合干皮和混干皮 | 怎么用 => 洁面后取适量涂抹',
  '',
  '4号链接',
  '标题: 舒缓精华',
  '简称: 修护精华',
  '价格: 129元',
  '优惠: 第二件半价',
  '卖点: 舒缓, 维稳, 敏感肌友好',
].join('\n')

function getKnowledgeFieldDiffs(current: GoodsItemConfig, draft: Partial<GoodsItemConfig>) {
  const fields: Array<{
    key: string
    label: string
    currentValue: string
    draftValue: string
  }> = []

  const pushField = (key: string, label: string, currentValue?: string, draftValue?: string) => {
    const currentText = currentValue?.trim() ?? ''
    const draftText = draftValue?.trim() ?? ''
    if (!draftText || currentText === draftText) return
    fields.push({ key, label, currentValue: currentText, draftValue: draftText })
  }

  pushField('title', '商品标题', current.title, draft.title)
  pushField('shortTitle', '商品简称', current.shortTitle, draft.shortTitle)
  pushField('priceText', '价格信息', current.priceText, draft.priceText)
  pushField('promoText', '优惠信息', current.promoText, draft.promoText)
  pushField('stockText', '库存/状态', current.stockText, draft.stockText)
  pushField('aliases', '别名关键词', listToText(current.aliases), listToText(draft.aliases))
  pushField('highlights', '卖点/亮点', listToText(current.highlights), listToText(draft.highlights))
  pushField('faq', '商品 FAQ', faqToText(current.faq), faqToText(draft.faq))

  return fields
}

// 【P1-3】商品列表项编辑弹窗
interface GoodsItemEditDialogProps {
  item: GoodsItemConfig
  allGoods: GoodsItemConfig[]
  defaultInterval: [number, number]
  onSave: (item: GoodsItemConfig) => void
  onClose: () => void
  onScanKnowledge?: (id: number) => Promise<Partial<GoodsItemConfig> | null>
}

type FaqItem = {
  id: string
  q: string
  a: string
}

function toFaqItems(
  faq?: Array<{
    q: string
    a: string
  }>,
): FaqItem[] {
  if (!faq?.length) {
    return [{ id: crypto.randomUUID(), q: '', a: '' }]
  }

  return faq.map(item => ({
    id: crypto.randomUUID(),
    q: item.q,
    a: item.a,
  }))
}

const GoodsItemEditDialog: React.FC<GoodsItemEditDialogProps> = ({
  item,
  allGoods,
  defaultInterval,
  onSave,
  onClose,
  onScanKnowledge,
}) => {
  const [selectedId, setSelectedId] = useState(item.id)
  const selectedItem = allGoods.find(g => g.id === selectedId) || item

  const [useCustomInterval, setUseCustomInterval] = useState(!!selectedItem.interval)
  const [minInterval, setMinInterval] = useState(
    selectedItem.interval
      ? Math.round(selectedItem.interval[0] / 1000)
      : Math.round(defaultInterval[0] / 1000),
  )
  const [maxInterval, setMaxInterval] = useState(
    selectedItem.interval
      ? Math.round(selectedItem.interval[1] / 1000)
      : Math.round(defaultInterval[1] / 1000),
  )
  const [title, setTitle] = useState(selectedItem.title ?? '')
  const [shortTitle, setShortTitle] = useState(selectedItem.shortTitle ?? '')
  const [priceText, setPriceText] = useState(selectedItem.priceText ?? '')
  const [promoText, setPromoText] = useState(selectedItem.promoText ?? '')
  const [stockText, setStockText] = useState(selectedItem.stockText ?? '')
  const [aliasesText, setAliasesText] = useState(listToText(selectedItem.aliases))
  const [highlightsText, setHighlightsText] = useState(listToText(selectedItem.highlights))
  const [faqItems, setFaqItems] = useState<FaqItem[]>(toFaqItems(selectedItem.faq))
  const [isScanningKnowledge, setIsScanningKnowledge] = useState(false)
  const [draftKnowledge, setDraftKnowledge] = useState<Partial<GoodsItemConfig> | null>(null)

  // 当切换商品时更新状态
  const handleSelectChange = (id: number) => {
    setSelectedId(id)
    const newItem = allGoods.find(g => g.id === id)
    if (newItem) {
      setUseCustomInterval(!!newItem.interval)
      setMinInterval(
        newItem.interval
          ? Math.round(newItem.interval[0] / 1000)
          : Math.round(defaultInterval[0] / 1000),
      )
      setMaxInterval(
        newItem.interval
          ? Math.round(newItem.interval[1] / 1000)
          : Math.round(defaultInterval[1] / 1000),
      )
      setTitle(newItem.title ?? '')
      setShortTitle(newItem.shortTitle ?? '')
      setPriceText(newItem.priceText ?? '')
      setPromoText(newItem.promoText ?? '')
      setStockText(newItem.stockText ?? '')
      setAliasesText(listToText(newItem.aliases))
      setHighlightsText(listToText(newItem.highlights))
      setFaqItems(toFaqItems(newItem.faq))
      setDraftKnowledge(null)
    }
  }

  const handleSave = () => {
    onSave({
      id: selectedId,
      interval: useCustomInterval ? [minInterval * 1000, maxInterval * 1000] : undefined,
      title: title.trim() || undefined,
      shortTitle: shortTitle.trim() || undefined,
      priceText: priceText.trim() || undefined,
      promoText: promoText.trim() || undefined,
      stockText: stockText.trim() || undefined,
      aliases: parseListText(aliasesText),
      highlights: parseListText(highlightsText),
      faq: faqItems
        .map(item => ({ q: item.q.trim(), a: item.a.trim() }))
        .filter(item => item.q && item.a),
    })
    onClose()
  }

  const handleScanKnowledge = async () => {
    if (!onScanKnowledge) return
    setIsScanningKnowledge(true)
    try {
      const draft = await onScanKnowledge(selectedId)
      if (!draft) {
        return
      }
      setDraftKnowledge(draft)
    } finally {
      setIsScanningKnowledge(false)
    }
  }

  const currentEditingItem: GoodsItemConfig = {
    id: selectedId,
    interval: useCustomInterval ? [minInterval * 1000, maxInterval * 1000] : undefined,
    title,
    shortTitle,
    priceText,
    promoText,
    stockText,
    aliases: parseListText(aliasesText),
    highlights: parseListText(highlightsText),
    faq: faqItems
      .map(item => ({ q: item.q.trim(), a: item.a.trim() }))
      .filter(item => item.q && item.a),
  }

  const knowledgeDiffs = draftKnowledge
    ? getKnowledgeFieldDiffs(currentEditingItem, draftKnowledge)
    : []

  const handleApplyDraft = () => {
    if (!draftKnowledge) return
    setTitle(draftKnowledge.title ?? title)
    setShortTitle(draftKnowledge.shortTitle ?? shortTitle)
    setPriceText(draftKnowledge.priceText ?? priceText)
    setPromoText(draftKnowledge.promoText ?? promoText)
    setStockText(draftKnowledge.stockText ?? stockText)
    setAliasesText(draftKnowledge.aliases ? listToText(draftKnowledge.aliases) : aliasesText)
    setHighlightsText(
      draftKnowledge.highlights ? listToText(draftKnowledge.highlights) : highlightsText,
    )
    setFaqItems(draftKnowledge.faq ? toFaqItems(draftKnowledge.faq) : faqItems)
    setDraftKnowledge(null)
  }

  const handleDiscardDraft = () => {
    setDraftKnowledge(null)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-[44rem] max-h-[85vh] overflow-y-auto shadow-xl border">
        <h3 className="text-lg font-bold mb-4">设置商品弹窗时间</h3>

        <div className="space-y-4">
          {/* 商品选择 */}
          <div className="space-y-2">
            <Label className="text-sm">选择商品</Label>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 border rounded-md">
              {allGoods.map(g => (
                <button
                  key={g.id}
                  onClick={() => handleSelectChange(g.id)}
                  className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
                    selectedId === g.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  #{g.id}
                  {g.interval && <Clock className="inline-block ml-1 h-3 w-3" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="custom-interval"
              checked={useCustomInterval}
              onCheckedChange={checked => setUseCustomInterval(checked === true)}
            />
            <Label htmlFor="custom-interval" className="text-sm cursor-pointer">
              使用自定义弹窗间隔
            </Label>
          </div>

          {useCustomInterval && (
            <div className="space-y-2 pl-6">
              <Label className="text-xs text-muted-foreground">弹窗间隔（秒）</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={minInterval}
                  onChange={e => setMinInterval(Number(e.target.value))}
                  className="w-20 text-center"
                  min={1}
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  value={maxInterval}
                  onChange={e => setMaxInterval(Number(e.target.value))}
                  className="w-20 text-center"
                  min={1}
                />
                <span className="text-xs text-muted-foreground">秒</span>
              </div>
            </div>
          )}

          {!useCustomInterval && (
            <p className="text-xs text-muted-foreground pl-6">
              使用全局默认间隔：{Math.round(defaultInterval[0] / 1000)}-
              {Math.round(defaultInterval[1] / 1000)} 秒
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-2">
              <Label className="text-sm">商品标题</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="例如：胶原修护面霜"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">商品简称</Label>
              <Input
                value={shortTitle}
                onChange={e => setShortTitle(e.target.value)}
                placeholder="例如：修护面霜"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">价格信息</Label>
              <Input
                value={priceText}
                onChange={e => setPriceText(e.target.value)}
                placeholder="例如：99元 / 到手89元"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">优惠信息</Label>
              <Input
                value={promoText}
                onChange={e => setPromoText(e.target.value)}
                placeholder="例如：拍2件减20"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label className="text-sm">库存/状态</Label>
              <Input
                value={stockText}
                onChange={e => setStockText(e.target.value)}
                placeholder="例如：现货充足 / 正在补货"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">别名关键词</Label>
              <Textarea
                value={aliasesText}
                onChange={e => setAliasesText(e.target.value)}
                placeholder={'每行一个，例如：\n面霜\n修护霜'}
                className="min-h-[7rem]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">卖点/亮点</Label>
              <Textarea
                value={highlightsText}
                onChange={e => setHighlightsText(e.target.value)}
                placeholder={'每行一个，例如：\n保湿\n修护屏障\n适合干皮'}
                className="min-h-[7rem]"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label className="text-sm">商品 FAQ</Label>
              <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
                {faqItems.map((faqItem, index) => (
                  <div key={faqItem.id} className="grid gap-2 md:grid-cols-[1fr_1.6fr_auto]">
                    <Input
                      value={faqItem.q}
                      onChange={e =>
                        setFaqItems(items =>
                          items.map(item =>
                            item.id === faqItem.id ? { ...item, q: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder={index === 0 ? '例如：适合谁' : '问题'}
                    />
                    <Input
                      value={faqItem.a}
                      onChange={e =>
                        setFaqItems(items =>
                          items.map(item =>
                            item.id === faqItem.id ? { ...item, a: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder={index === 0 ? '例如：更适合干皮和混干皮' : '回答'}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setFaqItems(items =>
                          items.length > 1
                            ? items.filter(item => item.id !== faqItem.id)
                            : [{ id: crypto.randomUUID(), q: '', a: '' }],
                        )
                      }
                      aria-label="删除 FAQ"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex justify-between gap-2 pt-1">
                  <p className="text-xs text-muted-foreground">
                    建议维护 2 到 4 条高频问答，例如价格、适合谁、怎么用。
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFaqItems(items => [...items, { id: crypto.randomUUID(), q: '', a: '' }])
                    }
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    添加 FAQ
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {draftKnowledge && (
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">扫描候选内容</div>
                  <p className="text-xs text-muted-foreground">
                    先确认以下差异，再决定是否应用到当前商品知识卡。
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDiscardDraft}>
                    丢弃候选
                  </Button>
                  <Button size="sm" onClick={handleApplyDraft}>
                    应用候选
                  </Button>
                </div>
              </div>
              {knowledgeDiffs.length > 0 ? (
                <div className="space-y-2">
                  {knowledgeDiffs.map(diff => (
                    <div key={diff.key} className="rounded-md border bg-background/60 p-3">
                      <div className="text-xs font-medium text-primary">{diff.label}</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div>
                          <div className="text-[11px] text-muted-foreground">当前值</div>
                          <div className="whitespace-pre-wrap text-xs text-foreground/80">
                            {diff.currentValue || '空'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-muted-foreground">候选值</div>
                          <div className="whitespace-pre-wrap text-xs text-foreground">
                            {diff.draftValue}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  扫描成功，但没有发现需要更新的字段。
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" size="sm" onClick={() => void handleScanKnowledge()}>
            {isScanningKnowledge ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
            )}
            扫描详情生成
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave}>
            保存
          </Button>
        </div>
      </div>
    </div>
  )
}

// 商品列表卡片组件
const GoodsListCard = React.memo(
  ({ initialEditingGoodsId }: { initialEditingGoodsId?: number | null }) => {
    // 【P1-3】使用 goods 替代 goodsIds
    const goods = useCurrentAutoPopUp(context => context.config.goods) ?? []
    const goodsAutoFillAttempted = useCurrentAutoPopUp(
      context => context.goodsAutoFillAttempted ?? false,
    )
    const goodsAutoFillLocked = useCurrentAutoPopUp(context => context.goodsAutoFillLocked ?? false)
    const defaultInterval = useCurrentAutoPopUp(context => context.config.scheduler.interval)
    const { setGoods, setGoodsAutoFillState } = useAutoPopUpActions()
    const { toast } = useToast()
    const platform = useCurrentPlatform()
    const connectionStatus = useConnectionStatus()
    const { currentAccountId } = useAccounts()
    const provider = useAIChatStore(state => state.config.provider)
    const model = useAIChatStore(state => state.config.model)
    const apiKeys = useAIChatStore(state => state.apiKeys)
    const customBaseURL = useAIChatStore(state => state.customBaseURL)
    const ensureTrialSession = useAITrialStore(state => state.ensureSession)
    const reportTrialUse = useAITrialStore(state => state.reportUse)
    const [inputValue, setInputValue] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [editingItem, setEditingItem] = useState<GoodsItemConfig | null>(null)
    const [isAutoFilling, setIsAutoFilling] = useState(false)
    const [importText, setImportText] = useState('')
    const autoFillRequestRef = useRef(false)

    // 当账号切换时，重置编辑状态
    useEffect(() => {
      void currentAccountId
      setIsEditing(false)
      setInputValue('')
      setEditingItem(null)
      autoFillRequestRef.current = false
    }, [currentAccountId])

    useEffect(() => {
      if (!initialEditingGoodsId) return
      const existing = goods.find(item => item.id === initialEditingGoodsId)
      setEditingItem(existing ?? { id: initialEditingGoodsId })
    }, [goods, initialEditingGoodsId])

    // 【测试模式检查】仅在测试平台或开发模式下启用 Mock 数据
    const isTestMode = shouldUseMockGoods(platform)
    const showSampleAction = import.meta.env.DEV || platform === 'dev'

    // 【自动注入测试商品】仅在测试模式下执行
    React.useEffect(() => {
      console.log(
        `[MockGoods] Check: platform=${platform}, isTestMode=${isTestMode}, goods.length=${goods.length}`,
      )
      if (isTestMode && goods.length === 0) {
        console.log(`[MockGoods] Auto-injecting test goods for platform: ${platform}`)
        setGoods(MOCK_GOODS_IDS.map(id => ({ id })))
      }
    }, [isTestMode, goods.length, setGoods, platform])

    // 将商品数组转换为文本（仅提取ID）
    const goodsToText = (items: GoodsItemConfig[]) => items.map(g => g.id).join(', ')

    const mergeGoodsByIds = useMemoizedFn((ids: number[]) =>
      ids.map(id => goods.find(item => item.id === id) ?? { id }),
    )

    const mergeGoodsByScanResult = useMemoizedFn(
      (scannedGoods: Array<{ id: number; title?: string }>) =>
        scannedGoods.map(scannedItem => {
          const existing = goods.find(item => item.id === scannedItem.id)
          return existing
            ? {
                ...existing,
                title: existing.title || scannedItem.title || existing.title,
              }
            : {
                id: scannedItem.id,
                title: scannedItem.title,
              }
        }),
    )

    const persistManualGoods = useMemoizedFn((nextGoods: GoodsItemConfig[]) => {
      setGoods(nextGoods)
      setGoodsAutoFillState({
        goodsAutoFillAttempted: true,
        goodsAutoFillLocked: true,
      })
    })

    // 将文本解析为商品配置数组
    const parseGoods = (text: string): GoodsItemConfig[] => {
      // 支持逗号、空格、换行分隔
      const separators = /[,，\s\n]+/
      const parts = text.split(separators).filter(Boolean)
      const items: GoodsItemConfig[] = []
      const seen = new Set<number>()

      for (const part of parts) {
        const num = Number.parseInt(part.trim(), 10)
        if (!Number.isNaN(num) && num > 0 && !seen.has(num)) {
          items.push({ id: num })
          seen.add(num)
        }
      }

      return items
    }

    // 开始编辑
    const handleStartEdit = () => {
      setInputValue(goodsToText(goods))
      setIsEditing(true)
    }

    // 保存编辑
    const handleSave = useMemoizedFn(() => {
      const newItems = parseGoods(inputValue)
      if (newItems.length === 0) {
        toast.error('请输入有效的商品序号')
        return
      }
      // 保留原有商品的 interval 配置
      const mergedItems = newItems.map(newItem => {
        const existing = goods.find(g => g.id === newItem.id)
        return existing ? { ...existing } : newItem
      })
      persistManualGoods(mergedItems)
      setIsEditing(false)
      toast.success(`已保存 ${newItems.length} 个商品`)
    })

    // 取消编辑
    const handleCancel = () => {
      setIsEditing(false)
      setInputValue('')
    }

    // 清空列表
    const handleClear = useMemoizedFn(() => {
      persistManualGoods([])
      setInputValue('')
      toast.success('已清空商品列表')
    })

    // 添加示例商品
    const handleAddSample = useMemoizedFn(() => {
      const samples = [1, 2, 3, 4, 5].map(id => ({ id }))
      const newItems = [...goods]
      for (const sample of samples) {
        if (!newItems.find(g => g.id === sample.id)) {
          newItems.push(sample)
        }
      }
      persistManualGoods(newItems)
      toast.success('已添加示例商品')
    })

    const handleImportKnowledge = useMemoizedFn(() => {
      const importedItems = parseKnowledgeImportText(importText)
      if (importedItems.length === 0) {
        toast.error('没有识别到有效的商品知识模板')
        return
      }

      const mergedItems = importedItems.map(importedItem => {
        const existing = goods.find(item => item.id === importedItem.id)
        return existing ? { ...existing, ...importedItem } : importedItem
      })

      const untouchedItems = goods.filter(
        existing => !mergedItems.some(imported => imported.id === existing.id),
      )

      persistManualGoods([...mergedItems, ...untouchedItems].sort((a, b) => a.id - b.id))
      setImportText('')
      toast.success(`已导入 ${importedItems.length} 个商品知识卡`)
    })

    const handleScanKnowledge = useMemoizedFn(async (goodsId: number) => {
      if (!currentAccountId) {
        toast.error('请先选择账号')
        return null
      }

      if (connectionStatus !== 'connected') {
        toast.error('请先连接直播中控台，再扫描商品详情')
        return null
      }

      const scanResult = await window.ipcRenderer.invoke(
        IPC_CHANNELS.tasks.autoPopUp.scanGoodsKnowledge,
        currentAccountId,
        goodsId,
      )

      if (!scanResult.success || !scanResult.data) {
        toast.error(scanResult.error || '扫描商品详情失败')
        return null
      }

      if (!apiKeys[provider]) {
        await ensureTrialSession('knowledge_draft')
      }

      const credentials = getEffectiveAICredentials({
        feature: 'knowledge_draft',
        userProvider: provider,
        userModel: model,
        userApiKey: apiKeys[provider],
        userCustomBaseURL: customBaseURL,
      })

      if (!credentials) {
        const fallbackDraft = {
          title: scanResult.data.title,
          priceText: scanResult.data.priceText,
        }
        toast.success('已回填基础信息，可继续手动补充知识内容')
        return fallbackDraft
      }

      const rawDraft = await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.aiChat.normalChat, {
        messages: [
          {
            role: 'system',
            content: buildKnowledgeDraftPrompt(scanResult.data),
          },
        ],
        provider: credentials.provider,
        model: credentials.model,
        apiKey: credentials.apiKey,
        customBaseURL: credentials.customBaseURL,
      })

      if (typeof rawDraft !== 'string') {
        toast.error('知识草稿生成失败')
        return null
      }

      const parsed = parseKnowledgeDraftResponse(rawDraft)
      if (!parsed) {
        toast.error('知识草稿解析失败')
        return null
      }

      toast.success('已生成商品知识候选内容，请确认后保存')
      if (credentials.credentialMode === 'trial') {
        await reportTrialUse({ feature: 'knowledge_draft', model: credentials.model })
      }
      const draftWithFallbackFaq = {
        ...parsed,
        faq: parsed.faq?.length ? parsed.faq : buildFallbackFaqFromKnowledgeDraft(parsed),
      }
      return {
        ...draftWithFallbackFaq,
        title: draftWithFallbackFaq.title || scanResult.data.title,
        priceText: draftWithFallbackFaq.priceText || scanResult.data.priceText,
      }
    })

    const handleCopyTemplate = useMemoizedFn(async () => {
      try {
        await navigator.clipboard.writeText(KNOWLEDGE_TEMPLATE)
        toast.success('知识卡模板已复制到剪贴板')
      } catch {
        toast.error('复制模板失败，请重试')
      }
    })

    const handleExportKnowledge = useMemoizedFn(() => {
      if (goods.length === 0) {
        toast.error('当前没有可导出的商品知识卡')
        return
      }

      const text = serializeKnowledgeItems(goods)
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `商品知识卡-${new Date().toISOString().slice(0, 10)}.txt`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('商品知识卡已导出')
    })

    const handleAutoFill = useMemoizedFn(async (source: 'manual' | 'init' = 'manual') => {
      if (!currentAccountId) {
        if (source === 'manual') {
          toast.error('请先选择账号')
        }
        return
      }
      if (connectionStatus !== 'connected') {
        if (source === 'manual') {
          toast.error('请先连接直播中控台，再自动读取商品序号')
        }
        return
      }

      setIsAutoFilling(true)
      try {
        const result = await window.ipcRenderer.invoke(
          IPC_CHANNELS.tasks.autoPopUp.fetchGoodsIds,
          currentAccountId,
        )
        if (!result.success || !result.goodsIds || result.goodsIds.length === 0) {
          if (source === 'manual') {
            toast.error(result.error || '未读取到商品序号')
          }
          return
        }

        const mergedGoods =
          result.goods && result.goods.length > 0
            ? mergeGoodsByScanResult(result.goods)
            : mergeGoodsByIds(result.goodsIds)
        setGoods(mergedGoods)
        setGoodsAutoFillState({
          goodsAutoFillAttempted: true,
        })
        setInputValue(goodsToText(mergedGoods))
        setIsEditing(false)
        if (source === 'manual') {
          toast.success(`已自动填充 ${result.goodsIds.length} 个商品序号`)
        }
      } catch (error) {
        if (source === 'manual') {
          toast.error(error instanceof Error ? error.message : '自动填充失败')
        }
      } finally {
        setIsAutoFilling(false)
        autoFillRequestRef.current = false
      }
    })

    // 【P1-3】更新单个商品配置
    const handleUpdateItem = useMemoizedFn((updatedItem: GoodsItemConfig) => {
      const newGoods = goods.map(g => (g.id === updatedItem.id ? updatedItem : g))
      persistManualGoods(newGoods)
      toast.success(`商品 #${updatedItem.id} 设置已更新`)
    })

    useEffect(() => {
      if (goods.length > 0) return
      if (goodsAutoFillAttempted || goodsAutoFillLocked) return
      if (connectionStatus !== 'connected') return
      if (!currentAccountId) return
      if (isAutoFilling || autoFillRequestRef.current) return

      autoFillRequestRef.current = true
      void handleAutoFill('init')
    }, [
      goods.length,
      goodsAutoFillAttempted,
      goodsAutoFillLocked,
      connectionStatus,
      currentAccountId,
      isAutoFilling,
      handleAutoFill,
    ])

    return (
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50 px-6 py-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            商品列表
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs defaultValue="goods-list" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-9 mb-4">
              <TabsTrigger value="goods-list" className="text-sm">
                <Package className="mr-2 h-4 w-4" />
                商品列表
              </TabsTrigger>
              <TabsTrigger value="shortcuts" className="text-sm">
                <Keyboard className="mr-2 h-4 w-4" />
                快捷键配置
              </TabsTrigger>
            </TabsList>

            <TabsContent value="goods-list" className="space-y-4">
              {/* 商品列表编辑区 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">商品序号</Label>
                    <p className="text-xs text-muted-foreground">
                      {isEditing
                        ? '支持逗号、空格或换行分隔多个序号'
                        : '点击商品标签可设置单独的弹窗时间'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <>
                        {goods.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => setEditingItem(goods[0])}
                          >
                            <Clock className="mr-1.5 h-3.5 w-3.5" />
                            设置时间
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => void handleAutoFill()}
                          disabled={isAutoFilling}
                        >
                          {isAutoFilling ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          自动填充
                        </Button>
                        {showSampleAction && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={handleAddSample}
                          >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            添加示例
                          </Button>
                        )}
                        {goods.length > 0 && (
                          <Button variant="subtle" size="sm" className="h-8" onClick={handleClear}>
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            清空
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm" className="h-8" onClick={handleCancel}>
                          取消
                        </Button>
                        <Button size="sm" className="h-8" onClick={handleSave}>
                          保存
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <Textarea
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder="输入商品序号，如：1, 2, 3, 4, 5"
                    className="min-h-[120px] font-mono text-sm"
                  />
                ) : (
                  <div
                    onClick={handleStartEdit}
                    className="ui-hover-surface min-h-[120px] cursor-text rounded-lg border bg-muted/30 p-4"
                  >
                    {goods.length > 0 ? (
                      <TooltipProvider>
                        <div className="flex flex-wrap gap-2">
                          {goods.map(item => (
                            <Tooltip key={item.id}>
                              <TooltipTrigger asChild>
                                <div
                                  onClick={e => {
                                    e.stopPropagation()
                                    setEditingItem(item)
                                  }}
                                  className="ui-hover-item inline-flex max-w-[16rem] cursor-pointer items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary"
                                >
                                  <span>#{item.id}</span>
                                  {item.title ? (
                                    <span className="max-w-28 truncate text-primary/80">
                                      {item.title}
                                    </span>
                                  ) : (
                                    <span className="text-primary/60">未命名商品</span>
                                  )}
                                  {item.priceText ? (
                                    <span className="max-w-20 truncate rounded bg-background/50 px-1.5 py-0.5 text-[11px] text-foreground/80">
                                      {item.priceText}
                                    </span>
                                  ) : null}
                                  {item.faq?.length ? (
                                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-400">
                                      FAQ {item.faq.length}
                                    </span>
                                  ) : null}
                                  {item.interval && <Clock className="h-3 w-3 text-primary/70" />}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <p>商品 #{item.id}</p>
                                {item.title ? (
                                  <p className="text-xs text-foreground/90">{item.title}</p>
                                ) : null}
                                {item.priceText ? (
                                  <p className="text-xs text-muted-foreground">
                                    价格: {item.priceText}
                                  </p>
                                ) : null}
                                {item.promoText ? (
                                  <p className="text-xs text-muted-foreground">
                                    优惠: {item.promoText}
                                  </p>
                                ) : null}
                                {item.highlights?.length ? (
                                  <p className="text-xs text-muted-foreground">
                                    卖点: {item.highlights.slice(0, 3).join('、')}
                                  </p>
                                ) : null}
                                {item.interval ? (
                                  <p className="text-xs text-muted-foreground">
                                    间隔: {Math.round(item.interval[0] / 1000)}-
                                    {Math.round(item.interval[1] / 1000)}秒
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground">使用默认间隔</p>
                                )}
                                <p className="text-xs text-primary mt-1">点击设置</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </TooltipProvider>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <Package className="h-8 w-8 opacity-50" />
                        <span className="text-sm">点击此处添加商品序号</span>
                        <span className="text-xs">支持批量粘贴，如：1, 2, 3, 4, 5</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 提示信息 */}
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    商品序号对应直播中控台中的商品顺序。连接中控台后可点“自动填充”读取当前商品序号；点击商品标签可设置单独的弹窗间隔。
                  </span>
                </div>

                <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm">批量导入商品知识</Label>
                    <p className="text-xs text-muted-foreground">
                      每个商品用空行分隔，首行写商品号，后面按“字段: 内容”填写。
                    </p>
                  </div>
                  <Textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    className="min-h-[12rem] font-mono text-xs"
                    placeholder={
                      '3号链接\n标题: 胶原修护面霜\n简称: 修护面霜\n价格: 99元\n优惠: 拍2件减20\n卖点: 保湿, 修护屏障, 适合干皮\n别名: 面霜, 修护霜\nFAQ: 适合谁 => 更适合干皮和混干皮 | 怎么用 => 洁面后取适量涂抹\n\n4号链接 标题=舒缓精华 价格=129元 卖点=舒缓,维稳 FAQ=适合谁 => 敏感肌也可用'
                    }
                  />
                  <div className="flex justify-end">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopyTemplate}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        复制模板
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportKnowledge}>
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        导出知识卡
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleImportKnowledge}>
                        批量导入知识卡
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="shortcuts">
              <ShortcutConfigTab />
            </TabsContent>
          </Tabs>
        </CardContent>

        {/* 【P1-3】商品编辑弹窗 */}
        {editingItem && (
          <GoodsItemEditDialog
            item={editingItem}
            allGoods={goods}
            defaultInterval={defaultInterval}
            onSave={handleUpdateItem}
            onClose={() => setEditingItem(null)}
            onScanKnowledge={handleScanKnowledge}
          />
        )}
      </Card>
    )
  },
)

export default GoodsListCard
