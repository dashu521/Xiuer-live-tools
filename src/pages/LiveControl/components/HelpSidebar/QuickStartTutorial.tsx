import { Activity, CheckCircle2, Link2, Monitor, Play, ScanLine, X, Zap } from 'lucide-react'
import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * QuickStartTutorial - 3分钟快速上手教程组件
 *
 * 新手引导教程，展示最小使用闭环的5个步骤
 * 从右侧滑出的抽屉形式展示
 */

interface QuickStartTutorialProps {
  /** 是否打开 */
  isOpen: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 点击"开始设置"后的回调 */
  onStart?: () => void
}

interface TutorialStep {
  number: number
  title: string
  description: string
  action: string
  tip?: string
  icon: React.ReactNode
}

const tutorialSteps: TutorialStep[] = [
  {
    number: 1,
    title: '选择直播平台',
    description: '在首页"直播平台"下拉框中选择你的直播平台',
    action: '选择平台（抖音/视频号/淘宝等）',
    tip: '不同平台登录方式不同，选择后会有对应提示',
    icon: <Monitor className="h-5 w-5" />,
  },
  {
    number: 2,
    title: '连接中控台',
    description: '点击"连接直播中控台"按钮',
    action: '点击连接按钮',
    tip: '软件会自动打开浏览器窗口，准备进入中控台',
    icon: <Link2 className="h-5 w-5" />,
  },
  {
    number: 3,
    title: '扫码登录账号',
    description: '在弹出的浏览器窗口中，用手机扫码登录你的直播账号',
    action: '手机扫码登录',
    tip: '视频号需先开播再连接；淘宝可能触发人机验证，属于正常情况',
    icon: <ScanLine className="h-5 w-5" />,
  },
  {
    number: 4,
    title: '确认连接成功',
    description: '回到本软件，查看"控制台状态"是否显示"已连接"',
    action: '检查状态卡片',
    tip: '成功标志：状态卡片显示绿色圆点 + 你的账号名称',
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  {
    number: 5,
    title: '开启自动功能',
    description: '点击左侧菜单进入对应功能页，或点击首页"一键开启"',
    action: '选择功能开始使用',
    tip: '自动发言、自动弹窗、自动回复等功能在左侧菜单',
    icon: <Zap className="h-5 w-5" />,
  },
]

export const QuickStartTutorial = React.memo(
  ({ isOpen, onClose, onStart }: QuickStartTutorialProps) => {
    const handleStart = () => {
      onClose()
      onStart?.()
    }

    return (
      <>
        {/* 遮罩层 */}
        <div
          className={cn(
            'fixed inset-0 z-50 bg-black/50 transition-opacity duration-300',
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
          onClick={onClose}
          aria-hidden="true"
        />

        {/* 抽屉面板 */}
        <div
          className={cn(
            'fixed top-0 right-0 z-50 h-full transition-transform duration-300 ease-out',
            'w-full sm:w-[480px]',
            'bg-[hsl(var(--background))]',
            'border-l border-[hsl(var(--border))]',
            'shadow-2xl',
            isOpen ? 'translate-x-0' : 'translate-x-full',
          )}
          style={{
            boxShadow: isOpen ? 'var(--shadow-modal)' : 'none',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="3分钟快速上手教程"
        >
          {/* 头部 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Play className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">3分钟快速上手</h2>
                <p className="text-xs text-muted-foreground">跟着这5步，快速完成首次直播配置</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 内容区 - 可滚动 */}
          <div className="h-[calc(100%-140px)] overflow-y-auto p-5">
            <div className="flex flex-col gap-4">
              {tutorialSteps.map((step, index) => (
                <Card
                  key={step.number}
                  className={cn(
                    'overflow-hidden transition-all duration-200',
                    'hover:border-primary/30',
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      {/* 步骤编号和图标 */}
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          {step.icon}
                        </div>
                        {index < tutorialSteps.length - 1 && (
                          <div className="w-0.5 flex-1 bg-border/50 min-h-[20px]" />
                        )}
                      </div>

                      {/* 步骤内容 */}
                      <div className="flex-1 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-primary">
                            步骤 {step.number}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-foreground mb-1">{step.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                          {step.description}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                          <Play className="h-3 w-3 text-primary" />
                          {step.action}
                        </div>
                        {step.tip && (
                          <p className="text-[11px] text-muted-foreground/70 mt-2 leading-relaxed">
                            💡 {step.tip}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* 结尾总结 */}
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                      <Activity className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-1">完成以上5步</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        你的直播间自动化助手就已就绪。后续可在左侧菜单探索更多功能。
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 底部按钮区 */}
          <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]">
            <div className="flex gap-3">
              <Button onClick={handleStart} className="flex-1">
                知道了，开始设置
              </Button>
              <Button variant="secondary" onClick={onClose} className="flex-1">
                稍后再说
              </Button>
            </div>
          </div>
        </div>
      </>
    )
  },
)

QuickStartTutorial.displayName = 'QuickStartTutorial'
