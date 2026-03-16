import { BarChart3, Bot, ChevronLeft, ChevronRight, Image, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const features = [
  {
    icon: MessageCircle,
    title: '自动发言',
    desc: '预设话术自动循环发送，告别重复打字',
    gradient: 'from-[#ff6b35] to-[#f7931e]',
  },
  {
    icon: Image,
    title: '自动弹窗',
    desc: '商品自动展示，提升转化超简单',
    gradient: 'from-[#ff7f50] to-[#ff9f43]',
  },
  {
    icon: Bot,
    title: 'AI 智能回复',
    desc: '评论自动识别回复，互动永不停歇',
    gradient: 'from-[#fb923c] to-[#f97316]',
  },
  {
    icon: BarChart3,
    title: '数据监控',
    desc: '实时数据分析，直播效果一目了然',
    gradient: 'from-[#f59e0b] to-[#ea580c]',
  },
]

export function FeatureCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches)
    syncPreference()
    mediaQuery.addEventListener('change', syncPreference)
    return () => mediaQuery.removeEventListener('change', syncPreference)
  }, [])

  useEffect(() => {
    if (!isAutoPlaying || prefersReducedMotion) return
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % features.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [isAutoPlaying, prefersReducedMotion])

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
      className="relative overflow-hidden rounded-2xl border p-6 text-white shadow-lg"
      style={{
        backgroundColor: 'var(--surface-elevated)',
        borderColor: 'hsla(var(--border), 0.9)',
        boxShadow: 'var(--shadow-card-hover)',
      }}
    >
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-90 transition-all duration-500',
          currentFeature.gradient,
        )}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_45%)]" />

      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            功能亮点 {currentIndex + 1}/{features.length}
          </span>
          <div className="flex gap-1">
            {features.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`切换到第 ${index + 1} 个功能亮点`}
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
            type="button"
            aria-label="查看上一个功能亮点"
            onClick={handlePrev}
            className="rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="查看下一个功能亮点"
            onClick={handleNext}
            className="rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
