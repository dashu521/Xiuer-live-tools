import { useMemoizedFn } from 'ahooks'
import { AlertCircle, Keyboard, Package, Plus, Trash2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAccounts } from '@/hooks/useAccounts'
import { useAutoPopUpActions, useCurrentAutoPopUp } from '@/hooks/useAutoPopUp'
import { useCurrentPlatform } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import { MOCK_GOODS_IDS, shouldUseMockGoods } from '@/utils/mockGoodsData'
import ShortcutConfigTab from './ShortcutConfigTab'

// 商品列表卡片组件
const GoodsListCard = React.memo(() => {
  const goodsIds = useCurrentAutoPopUp(context => context.config.goodsIds)
  const { setGoodsIds } = useAutoPopUpActions()
  const { toast } = useToast()
  const platform = useCurrentPlatform()
  const { currentAccountId } = useAccounts()
  const [inputValue, setInputValue] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // 当账号切换时，重置编辑状态
  useEffect(() => {
    void currentAccountId
    setIsEditing(false)
    setInputValue('')
  }, [currentAccountId])

  // 【测试模式检查】仅在测试平台或开发模式下启用 Mock 数据
  const isTestMode = shouldUseMockGoods(platform)

  // 【自动注入测试商品】仅在测试模式下执行
  React.useEffect(() => {
    console.log(
      `[MockGoods] Check: platform=${platform}, isTestMode=${isTestMode}, goodsIds.length=${goodsIds.length}`,
    )
    if (isTestMode && goodsIds.length === 0) {
      console.log(`[MockGoods] Auto-injecting test goods for platform: ${platform}`)
      setGoodsIds([...MOCK_GOODS_IDS])
    }
  }, [isTestMode, goodsIds.length, setGoodsIds, platform])

  // 将商品ID数组转换为文本
  const goodsIdsToText = (ids: number[]) => ids.join(', ')

  // 将文本解析为商品ID数组
  const parseGoodsIds = (text: string): number[] => {
    // 支持逗号、空格、换行分隔
    const separators = /[,，\s\n]+/
    const parts = text.split(separators).filter(Boolean)
    const ids: number[] = []
    const seen = new Set<number>()

    for (const part of parts) {
      const num = Number.parseInt(part.trim(), 10)
      if (!Number.isNaN(num) && num > 0 && !seen.has(num)) {
        ids.push(num)
        seen.add(num)
      }
    }

    return ids
  }

  // 开始编辑
  const handleStartEdit = () => {
    setInputValue(goodsIdsToText(goodsIds))
    setIsEditing(true)
  }

  // 保存编辑
  const handleSave = useMemoizedFn(() => {
    const newIds = parseGoodsIds(inputValue)
    if (newIds.length === 0) {
      toast.error('请输入有效的商品序号')
      return
    }
    setGoodsIds(newIds)
    setIsEditing(false)
    toast.success(`已保存 ${newIds.length} 个商品`)
  })

  // 取消编辑
  const handleCancel = () => {
    setIsEditing(false)
    setInputValue('')
  }

  // 清空列表
  const handleClear = useMemoizedFn(() => {
    setGoodsIds([])
    setInputValue('')
    toast.success('已清空商品列表')
  })

  // 添加示例商品
  const handleAddSample = useMemoizedFn(() => {
    const samples = [1, 2, 3, 4, 5]
    const newIds = [...new Set([...goodsIds, ...samples])]
    setGoodsIds(newIds)
    toast.success('已添加示例商品')
  })

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
                  <p className="text-xs text-muted-foreground">支持逗号、空格或换行分隔多个序号</p>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <>
                      <Button variant="outline" size="sm" className="h-8" onClick={handleAddSample}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        添加示例
                      </Button>
                      {goodsIds.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:text-destructive"
                          onClick={handleClear}
                        >
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
                  className="min-h-[120px] p-4 border rounded-lg bg-muted/30 cursor-text hover:bg-muted/50 transition-colors"
                >
                  {goodsIds.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {goodsIds.map(id => (
                        <span
                          key={id}
                          className="inline-flex items-center px-2.5 py-1 rounded-md bg-primary/10 text-primary text-sm font-medium"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
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
                  商品序号对应直播中控台中的商品顺序。自动弹窗时将按顺序或随机弹出这些商品。
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="shortcuts">
            <ShortcutConfigTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
})

export default GoodsListCard
