import { useMemoizedFn } from 'ahooks'
import { Clock, Settings2, Timer } from 'lucide-react'
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAutoPopUpActions, useCurrentAutoPopUp } from '@/hooks/useAutoPopUp'

// 弹窗设置卡片组件
const PopUpSettingsCard = React.memo(() => {
  const { scheduler } = useCurrentAutoPopUp(context => context.config)
  const { setScheduler } = useAutoPopUpActions()

  const handleIntervalChange = useMemoizedFn((index: 0 | 1, value: string) => {
    const numValue = Number(value) * 1000
    setScheduler({
      interval: index === 0 ? [numValue, scheduler.interval[1]] : [scheduler.interval[0], numValue],
    })
  })

  const minInterval = Math.round(scheduler.interval[0] / 1000)
  const maxInterval = Math.round(scheduler.interval[1] / 1000)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/50 px-6 py-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          弹窗设置
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* 弹窗间隔设置 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <div className="h-4 w-1 rounded-full bg-primary" />
              弹窗间隔
            </div>

            <div className="pl-3">
              <div className="p-4 bg-muted/30 rounded-lg space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Timer className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">时间范围</div>
                      <div className="text-xs text-muted-foreground">秒</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-8">最小</Label>
                      <Input
                        type="number"
                        value={minInterval}
                        onChange={e => handleIntervalChange(0, e.target.value)}
                        className="w-20 h-9 text-sm text-center"
                        min="1"
                        placeholder="最小"
                      />
                    </div>
                    <span className="text-muted-foreground">-</span>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-8">最大</Label>
                      <Input
                        type="number"
                        value={maxInterval}
                        onChange={e => handleIntervalChange(1, e.target.value)}
                        className="w-20 h-9 text-sm text-center"
                        min="1"
                        placeholder="最大"
                      />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  系统在最小值和最大值之间随机选择弹窗时机，使弹窗行为更自然。
                </p>
              </div>
            </div>
          </div>

          {/* 当前设置预览 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <div className="h-4 w-1 rounded-full bg-primary" />
              当前设置
            </div>

            <div className="pl-3">
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">弹窗频率</div>
                  <div className="text-xs text-muted-foreground">
                    每 {minInterval} - {maxInterval} 秒弹出一次商品
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

export default PopUpSettingsCard
