import { BarChart3, Bot, ChevronLeft, ChevronRight, Image, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const features = [
  {
    icon: MessageCircle,
    title: '自动发言',
    desc: '预设话术自动循环发送，告别重复打字',
    color: 'from-blue-400 to-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    icon: Image,
    title: '自动弹窗',
    desc: '商品自动展示，提升转化超简单',
    color: 'from-purple-400 to-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    icon: Bot,
    title: 'AI 智能回复',
    desc: '评论自动识别回复，互动永不停歇',
    color: 'from-green-400 to-green-600',
    bgColor: 'bg-green-50',
  },
  {
    icon: BarChart3,
    title: '数据监控',
    desc: '实时数据分析，直播效果一目了然',
    color: 'from-orange-400 to-orange-600',
    bgColor: 'bg-orange-50',
  },
]

export function FeatureCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  useEffect(() => {
    if (!isAutoPlaying) return
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % features.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [isAutoPlaying])

  const handlePrev = () => {
    setIsAutoPlaying(false)
    setCurrentIndex(prev => (prev - 1 + features.length) % features.length)
  }

  const handleNext = () => {
    setIsAutoPlaying(false)
    setCurrentIndex(prev => (prev + 1) % features.length)
  }

  const currentFeature = features[currentIndex]
  const Icon = currentFeature.icon

  return (
    <div
      className="relative overflow-hidden rounded-xl bg-gradient-to-br p-6 text-white shadow-lg"
      style={{ background: 'linear-gradient(135deg, var(--tw-gradient-stops))' }}
    >
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-90 transition-all duration-500',
          currentFeature.color,
        )}
      />

      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            功能亮点 {currentIndex + 1}/{features.length}
          </span>
          <div className="flex gap-1">
            {features.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setIsAutoPlaying(false)
                  setCurrentIndex(index)
                }}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  index === currentIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60',
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h4 className="mb-1 text-lg font-bold">{currentFeature.title}</h4>
            <p className="text-sm text-white/90">{currentFeature.desc}</p>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={handlePrev}
            className="rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={handleNext}
            className="rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
