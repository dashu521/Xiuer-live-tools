import { ChevronLeft, ChevronRight, Sparkles, Target, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TourStep {
  target: string
  title: string
  content: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

const tourSteps: TourStep[] = [
  {
    target: '[data-tour="sidebar"]',
    title: '功能导航栏 📍',
    content: '这里是你操控直播间的指挥中心！自动发言、自动弹窗、AI回复，想用什么点这里～',
    position: 'right',
  },
  {
    target: '[data-tour="live-control"]',
    title: '直播中控台 🎛️',
    content: '连接你的直播平台，这是使用其他功能的前提哦！已经帮你连好啦～',
    position: 'bottom',
  },
  {
    target: '[data-tour="auto-message"]',
    title: '自动发言 💬',
    content: '设置好话术，让助手帮你自动发送，告别重复打字！',
    position: 'right',
  },
  {
    target: '[data-tour="auto-popup"]',
    title: '自动弹窗 🖼️',
    content: '商品自动展示，提升转化率，让观众一眼看到好物！',
    position: 'right',
  },
  {
    target: '[data-tour="auto-reply"]',
    title: 'AI 智能回复 🤖',
    content: '评论自动识别并回复，互动永不停歇，粉丝更粘你！',
    position: 'right',
  },
  {
    target: '[data-tour="live-stats"]',
    title: '数据监控 📊',
    content: '实时查看直播数据，弹幕、粉丝团变化一目了然！',
    position: 'right',
  },
]

interface FeatureTourProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

export function FeatureTour({ isOpen, onClose, onComplete }: FeatureTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)

  const currentTourStep = tourSteps[currentStep]

  useEffect(() => {
    if (!isOpen) return

    // 查找目标元素
    const targetElement = document.querySelector(currentTourStep.target)
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect()
      setHighlightRect(rect)

      // 滚动到目标元素
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isOpen, currentTourStep.target])

  if (!isOpen) return null

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      onComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleSkip = () => {
    onClose()
  }

  // 计算提示框位置
  const getTooltipPosition = () => {
    if (!highlightRect) return { top: '50%', left: '50%' }

    const tooltipWidth = 320
    const tooltipHeight = 150
    const gap = 16

    let top = 0
    let left = 0

    switch (currentTourStep.position) {
      case 'top':
        top = highlightRect.top - tooltipHeight - gap
        left = highlightRect.left + highlightRect.width / 2 - tooltipWidth / 2
        break
      case 'bottom':
        top = highlightRect.bottom + gap
        left = highlightRect.left + highlightRect.width / 2 - tooltipWidth / 2
        break
      case 'left':
        top = highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2
        left = highlightRect.left - tooltipWidth - gap
        break
      case 'right':
        top = highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2
        left = highlightRect.right + gap
        break
    }

    // 边界检查
    const padding = 16
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding))
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding))

    return { top: `${top}px`, left: `${left}px` }
  }

  const tooltipPosition = getTooltipPosition()

  return (
    <div className="fixed inset-0 z-[100]">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/50" onClick={handleSkip} />

      {/* 高亮区域 */}
      {highlightRect && (
        <div
          className="absolute rounded-lg ring-4 ring-purple-500/50 animate-pulse"
          style={{
            top: highlightRect.top - 8,
            left: highlightRect.left - 8,
            width: highlightRect.width + 16,
            height: highlightRect.height + 16,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          }}
        />
      )}

      {/* 提示框 */}
      <div
        className="absolute w-80 rounded-xl bg-white shadow-2xl p-5"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        {/* 关闭按钮 */}
        <button
          onClick={handleSkip}
          className="absolute right-3 top-3 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 进度指示器 */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex gap-1">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  index === currentStep ? 'w-4 bg-purple-500' : 'w-1.5 bg-gray-300',
                )}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400 ml-auto">
            {currentStep + 1} / {tourSteps.length}
          </span>
        </div>

        {/* 标题 */}
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
            <Target className="h-4 w-4 text-purple-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">{currentTourStep.title}</h3>
        </div>

        {/* 内容 */}
        <p className="mb-5 text-sm leading-relaxed text-gray-600">{currentTourStep.content}</p>

        {/* 按钮区域 */}
        <div className="flex gap-2">
          {currentStep > 0 ? (
            <Button variant="outline" size="sm" className="flex-1" onClick={handlePrev}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              上一步
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="flex-1" onClick={handleSkip}>
              跳过
            </Button>
          )}
          <Button size="sm" className="flex-1 gap-1" onClick={handleNext}>
            {currentStep === tourSteps.length - 1 ? (
              <>
                <Sparkles className="h-4 w-4" />
                完成
              </>
            ) : (
              <>
                下一步
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
