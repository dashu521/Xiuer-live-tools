import { useMemoizedFn } from 'ahooks'
import { Clock, Settings2, Shuffle, Space, Timer } from 'lucide-react'
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAutoMessageActions, useCurrentAutoMessage } from '@/hooks/useAutoMessage'

const MessageSettingsCard = React.memo(() => {
  const { scheduler, random, extraSpaces } = useCurrentAutoMessage(context => context.config)
  const { setScheduler, setRandom, setExtraSpaces } = useAutoMessageActions()

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
          发送设置
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* 发送间隔设置 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <div className="h-4 w-1 rounded-full bg-primary" />
            发送间隔
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
                系统在最小值和最大值之间随机选择发送时机，使发言行为更自然。
              </p>
            </div>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="h-px bg-border" />

        {/* 高级选项 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <div className="h-4 w-1 rounded-full bg-primary" />
            高级选项
          </div>

          <div className="pl-3 space-y-3">
            {/* 随机发送 */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shuffle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">随机发送</div>
                  <div className="text-xs text-muted-foreground">随机选择消息列表中的内容发送</div>
                </div>
              </div>
              <Switch checked={random} onCheckedChange={setRandom} />
            </div>

            {/* 插入随机空格 */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Space className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">插入随机空格</div>
                  <div className="text-xs text-muted-foreground">
                    在消息中随机插入空格，避免被检测
                  </div>
                </div>
              </div>
              <Switch checked={extraSpaces} onCheckedChange={setExtraSpaces} />
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
              <div className="h-10 w-10 rounded-lg border border-green-500/30 flex items-center justify-center">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">发送频率</div>
                <div className="text-xs text-muted-foreground">
                  每 {minInterval} - {maxInterval} 秒发送一条消息
                  {random && ' · 随机选择消息'}
                  {extraSpaces && ' · 插入随机空格'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

export default MessageSettingsCard
