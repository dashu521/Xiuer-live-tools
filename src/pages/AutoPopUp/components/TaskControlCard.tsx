import { useMemoizedFn } from 'ahooks'
import { Activity, Timer } from 'lucide-react'
import { TaskControlButton } from '@/components/business/TaskControlButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAutoPopUpActions, useCurrentAutoPopUp } from '@/hooks/useAutoPopUp'
import type { LiveFeatureGate } from '@/hooks/useLiveFeatureGate'

interface TaskControlCardProps {
  isRunning: boolean
  gate: LiveFeatureGate
  onStartStop: () => void
}

export default function TaskControlCard({ isRunning, gate, onStartStop }: TaskControlCardProps) {
  const { scheduler, random } = useCurrentAutoPopUp(context => context.config)
  const { setScheduler, setRandom } = useAutoPopUpActions()

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
          <Activity className="h-4 w-4 text-primary" />
          任务控制
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className={`h-12 w-12 rounded-xl flex items-center justify-center border ${isRunning ? 'border-green-500/30' : 'border-primary/30'}`}
            >
              {isRunning ? (
                <div className="h-4 w-4 rounded-full border-2 border-green-500 animate-pulse" />
              ) : (
                <Activity className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <div className="text-sm font-medium">{isRunning ? '任务运行中' : '任务已停止'}</div>
              <div className="text-xs text-muted-foreground">
                {isRunning ? '自动弹窗功能正在工作' : '点击开始任务启动自动弹窗'}
              </div>
            </div>
          </div>

          <TooltipProvider>
            <div className="flex items-center gap-5">
              {/* 弹窗间隔 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2.5 cursor-pointer border rounded-lg px-4 py-3 bg-muted/30 -my-1.5">
                    <Timer className="h-5 w-5 text-muted-foreground" />
                    <Input
                      type="number"
                      value={minInterval}
                      onChange={e => handleIntervalChange(0, e.target.value)}
                      className="w-16 h-8 text-base text-center bg-background"
                      min="1"
                    />
                    <span className="text-base text-muted-foreground">-</span>
                    <Input
                      type="number"
                      value={maxInterval}
                      onChange={e => handleIntervalChange(1, e.target.value)}
                      className="w-16 h-8 text-base text-center bg-background"
                      min="1"
                    />
                    <span className="text-base text-muted-foreground">秒</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>弹窗间隔时间范围（秒）</p>
                </TooltipContent>
              </Tooltip>

              {/* 随机弹窗 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-pointer">
                    <Switch
                      id="random-popup"
                      checked={random}
                      onCheckedChange={setRandom}
                      className="scale-110"
                    />
                    <Label htmlFor="random-popup" className="text-sm cursor-pointer">
                      随机弹窗
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>随机选择商品进行弹窗</p>
                </TooltipContent>
              </Tooltip>

              <TaskControlButton
                isRunning={isRunning}
                onStart={onStartStop}
                onStop={onStartStop}
                gate={gate}
                size="sm"
                startText="开始任务"
                stopText="停止任务"
              />
            </div>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  )
}
