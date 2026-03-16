import { BarChart3, Bot, ChevronRight, Image, MessageCircle, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface WelcomeDialogProps {
  isOpen: boolean
  onClose: () => void
  onStart: () => void
}

const features = [
  {
    icon: MessageCircle,
    title: '自动发言',
    desc: '智能循环发送预设话术，解放你的双手',
    color: 'text-orange-300',
  },
  {
    icon: Image,
    title: '自动弹窗',
    desc: '商品自动弹窗展示，提升转化率',
    color: 'text-amber-200',
  },
  {
    icon: Bot,
    title: 'AI 自动回复',
    desc: '智能识别评论并自动回复，互动不间断',
    color: 'text-orange-100',
  },
  {
    icon: BarChart3,
    title: '数据监控',
    desc: '实时直播数据分析，助你优化直播策略',
    color: 'text-yellow-200',
  },
]

export function WelcomeDialog({ isOpen, onClose, onStart }: WelcomeDialogProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleNext = () => {
    if (currentStep < features.length - 1) {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentStep(prev => prev + 1)
        setIsAnimating(false)
      }, 200)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentStep(prev => prev - 1)
        setIsAnimating(false)
      }, 200)
    }
  }

  const currentFeature = features[currentStep]
  const Icon = currentFeature.icon

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent
        aria-describedby="welcome-dialog-description"
        className="w-full max-w-md overflow-hidden rounded-2xl border p-0"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'hsla(var(--border), 0.95)',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        {/* 顶部装饰 */}
        <div
          className="relative h-32"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,107,53,0.98) 0%, rgba(247,147,30,0.92) 100%)',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
          </div>
          {/* 波浪装饰 */}
          <svg
            className="absolute bottom-0 left-0 right-0"
            viewBox="0 0 1440 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              fill="white"
            />
          </svg>
        </div>

        {/* 内容区域 */}
        <div className="px-6 pb-6 pt-2">
          {/* 欢迎文案 */}
          {currentStep === 0 && (
            <div className="mb-6 text-center">
              <h2 className="mb-2 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                欢迎使用秀儿直播助手
              </h2>
              <p id="welcome-dialog-description" style={{ color: 'var(--text-secondary)' }}>
                先用四步快速了解产品能力，再决定是否立即开始连接和配置。
              </p>
            </div>
          )}

          {/* 功能展示 */}
          <div
            className={cn(
              'mb-6 rounded-xl p-6 transition-all duration-200',
              isAnimating && 'opacity-0 scale-95',
            )}
            style={{
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid hsla(var(--border), 0.9)',
            }}
          >
            <div
              className={cn(
                'mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white/8 shadow-sm',
              )}
            >
              <Icon className={cn('h-7 w-7', currentFeature.color)} />
            </div>
            <h3 className="mb-2 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {currentFeature.title}
            </h3>
            <p style={{ color: 'var(--text-secondary)' }}>{currentFeature.desc}</p>
          </div>

          {/* 进度指示器 */}
          <div className="mb-6 flex justify-center gap-2">
            {features.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`切换到欢迎步骤 ${index + 1}`}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  index === currentStep ? 'w-6 bg-primary' : 'w-2 bg-white/20 hover:bg-white/35',
                )}
              />
            ))}
          </div>

          {/* 按钮区域 */}
          <div className="flex gap-3">
            {currentStep > 0 ? (
              <Button variant="outline" className="flex-1" onClick={handlePrev}>
                上一步
              </Button>
            ) : (
              <Button variant="outline" className="flex-1" onClick={onClose}>
                稍后再说
              </Button>
            )}
            {currentStep < features.length - 1 ? (
              <Button className="flex-1 gap-1" onClick={handleNext}>
                下一步
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button className="flex-1" onClick={onStart}>
                开始使用
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
