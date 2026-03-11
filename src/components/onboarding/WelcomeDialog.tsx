import { BarChart3, Bot, ChevronRight, Image, MessageCircle, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
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
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
  },
  {
    icon: Image,
    title: '自动弹窗',
    desc: '商品自动弹窗展示，提升转化率',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
  },
  {
    icon: Bot,
    title: 'AI 自动回复',
    desc: '智能识别评论并自动回复，互动不间断',
    color: 'text-green-500',
    bgColor: 'bg-green-50',
  },
  {
    icon: BarChart3,
    title: '数据监控',
    desc: '实时直播数据分析，助你优化直播策略',
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 顶部装饰 */}
        <div className="relative h-32 bg-gradient-to-br from-pink-400 via-purple-400 to-indigo-400">
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
              <h2 className="mb-2 text-2xl font-bold text-gray-800">嗨！我是秀儿 ✨</h2>
              <p className="text-gray-600">很高兴认识你！让我带你快速了解直播助手的神奇功能吧～</p>
            </div>
          )}

          {/* 功能展示 */}
          <div
            className={cn(
              'mb-6 rounded-xl p-6 transition-all duration-200',
              currentFeature.bgColor,
              isAnimating && 'opacity-0 scale-95',
            )}
          >
            <div
              className={cn(
                'mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white shadow-sm',
              )}
            >
              <Icon className={cn('h-7 w-7', currentFeature.color)} />
            </div>
            <h3 className="mb-2 text-xl font-bold text-gray-800">{currentFeature.title}</h3>
            <p className="text-gray-600">{currentFeature.desc}</p>
          </div>

          {/* 进度指示器 */}
          <div className="mb-6 flex justify-center gap-2">
            {features.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  index === currentStep ? 'w-6 bg-purple-500' : 'w-2 bg-gray-300 hover:bg-gray-400',
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
                开始使用 🚀
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
