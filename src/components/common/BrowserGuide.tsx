import { ArrowRight, CheckIcon, HelpCircle, Monitor, QrCode, RotateCcw } from 'lucide-react'
import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface BrowserGuideStep {
  id: string
  icon: React.ReactNode
  title: string
  description: string
}

export interface BrowserGuideProps {
  platform: string
  currentStep: number
  onComplete: () => void
  onRetry: () => void
  onHelp: () => void
  className?: string
}

const getGuideSteps = (platform: string): BrowserGuideStep[] => {
  const baseSteps: BrowserGuideStep[] = [
    {
      id: 'scan',
      icon: <QrCode className="w-6 h-6" />,
      title: '扫码登录',
      description: '使用手机扫描浏览器中显示的二维码',
    },
    {
      id: 'confirm',
      icon: <CheckIcon className="w-6 h-6" />,
      title: '确认授权',
      description: '在手机上确认登录授权',
    },
    {
      id: 'return',
      icon: <Monitor className="w-6 h-6" />,
      title: '返回应用',
      description: '完成登录后，返回本应用继续操作',
    },
  ]

  // 针对不同平台的特殊提示
  if (platform === 'taobao') {
    return [
      {
        id: 'prepare',
        icon: <Monitor className="w-6 h-6" />,
        title: '准备登录',
        description: '浏览器已打开，请完成人机验证',
      },
      ...baseSteps,
    ]
  }

  if (platform === 'wxchannel') {
    return [
      {
        id: 'prepare',
        icon: <Monitor className="w-6 h-6" />,
        title: '开播准备',
        description: '请确保已在视频号助手开播',
      },
      ...baseSteps,
    ]
  }

  return baseSteps
}

export const BrowserGuide = React.memo(
  ({ platform, currentStep, onComplete, onRetry, onHelp, className }: BrowserGuideProps) => {
    const steps = getGuideSteps(platform)
    const _platformNames: Record<string, string> = {
      douyin: '抖音',
      taobao: '淘宝',
      wxchannel: '视频号',
      kuaishou: '快手',
      xiaohongshu: '小红书',
    }

    return (
      <Card className={cn('w-full', className)}>
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" />
            浏览器已打开，请按以下步骤操作
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {/* 步骤流程 */}
          <div className="relative">
            {/* 连接线 */}
            <div className="absolute top-6 left-6 right-6 h-0.5 bg-muted" />

            {/* 步骤 */}
            <div className="relative flex justify-between">
              {steps.map((step, index) => {
                const isCompleted = index < currentStep
                const isCurrent = index === currentStep
                const isPending = index > currentStep

                return (
                  <div key={step.id} className="flex flex-col items-center relative z-10">
                    {/* 步骤图标 */}
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-background',
                        isCompleted && 'border-primary bg-primary text-primary-foreground',
                        isCurrent && 'border-primary border-dashed animate-pulse text-primary',
                        isPending && 'border-muted text-muted-foreground',
                      )}
                    >
                      {step.icon}
                    </div>

                    {/* 步骤标题 */}
                    <div className="mt-3 text-center">
                      <div
                        className={cn(
                          'text-sm font-medium',
                          isCompleted && 'text-primary',
                          isCurrent && 'text-foreground',
                          isPending && 'text-muted-foreground',
                        )}
                      >
                        {step.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 max-w-[100px]">
                        {step.description}
                      </div>
                    </div>

                    {/* 箭头（除了最后一个） */}
                    {index < steps.length - 1 && (
                      <div className="absolute top-5 left-full ml-2">
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 平台特殊提示 */}
          {platform === 'taobao' && (
            <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <HelpCircle className="mt-0.5 h-5 w-5 text-amber-300" />
                <div>
                  <div className="text-sm font-medium text-amber-100">淘宝平台特别提示</div>
                  <ul className="mt-1 space-y-1 text-sm text-amber-100/85">
                    <li>• 除登录和人机验证外，请尽量不要操作浏览器</li>
                    <li>• 如遇人机验证，请按要求完成验证</li>
                    <li>• 验证完成后请等待自动跳转</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {platform === 'wxchannel' && (
            <div className="mt-6 rounded-lg border border-sky-500/20 bg-sky-500/10 p-4">
              <div className="flex items-start gap-3">
                <HelpCircle className="mt-0.5 h-5 w-5 text-sky-300" />
                <div>
                  <div className="text-sm font-medium text-sky-100">视频号平台特别提示</div>
                  <ul className="mt-1 space-y-1 text-sm text-sky-100/85">
                    <li>• 请确保已在视频号助手开播</li>
                    <li>• 视频号助手不支持一号多登</li>
                    <li>• 在别处登录会中断当前连接</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <Button variant="outline" onClick={onRetry} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              重新连接
            </Button>
            <Button onClick={onComplete} className="gap-2">
              <CheckIcon className="w-4 h-4" />
              我已完成登录
            </Button>
            <Button variant="ghost" onClick={onHelp} className="gap-2">
              <HelpCircle className="w-4 h-4" />
              遇到问题
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  },
)

BrowserGuide.displayName = 'BrowserGuide'
