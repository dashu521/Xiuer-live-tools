import { useMemoizedFn } from 'ahooks'
import {
  AlertCircle,
  Clock,
  Keyboard,
  Loader2,
  Package,
  Plus,
  RefreshCcw,
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
import {
  type GoodsItemConfig,
  useAutoPopUpActions,
  useCurrentAutoPopUp,
} from '@/hooks/useAutoPopUp'
import { useConnectionStatus, useCurrentPlatform } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import { MOCK_GOODS_IDS, shouldUseMockGoods } from '@/utils/mockGoodsData'
import ShortcutConfigTab from './ShortcutConfigTab'

// 【P1-3】商品列表项编辑弹窗
interface GoodsItemEditDialogProps {
  item: GoodsItemConfig
  allGoods: GoodsItemConfig[]
  defaultInterval: [number, number]
  onSave: (item: GoodsItemConfig) => void
  onClose: () => void
}

const GoodsItemEditDialog: React.FC<GoodsItemEditDialogProps> = ({
  item,
  allGoods,
  defaultInterval,
  onSave,
  onClose,
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
    }
  }

  const handleSave = () => {
    onSave({
      id: selectedId,
      interval: useCustomInterval ? [minInterval * 1000, maxInterval * 1000] : undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-96 shadow-xl border">
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
        </div>

        <div className="flex justify-end gap-2 mt-6">
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
const GoodsListCard = React.memo(() => {
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
  const [inputValue, setInputValue] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editingItem, setEditingItem] = useState<GoodsItemConfig | null>(null)
  const [isAutoFilling, setIsAutoFilling] = useState(false)
  const autoFillRequestRef = useRef(false)

  // 当账号切换时，重置编辑状态
  useEffect(() => {
    void currentAccountId
    setIsEditing(false)
    setInputValue('')
    setEditingItem(null)
    autoFillRequestRef.current = false
  }, [currentAccountId])

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

      const mergedGoods = mergeGoodsByIds(result.goodsIds)
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
                              <span
                                onClick={e => {
                                  e.stopPropagation()
                                  setEditingItem(item)
                                }}
                                className="ui-hover-item inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary"
                              >
                                {item.id}
                                {item.interval && <Clock className="h-3 w-3 text-primary/70" />}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p>商品 #{item.id}</p>
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
        />
      )}
    </Card>
  )
})

export default GoodsListCard
