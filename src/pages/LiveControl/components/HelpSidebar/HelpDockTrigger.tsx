import { HelpCircle } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * HelpDockTrigger - 帮助抽屉触发器
 *
 * 吸附在页面右侧的触发按钮
 * 点击后展开帮助抽屉
 */

interface HelpDockTriggerProps {
  /** 点击回调 */
  onClick: () => void
  /** 是否打开（用于样式状态） */
  isOpen?: boolean
  /** 是否有新内容提示（首发期可用） */
  hasNotification?: boolean
}

const DOCK_LABELS = ['帮助反馈', '联系作者', '功能开发', '新手教程'] as const
const LABEL_ROTATE_INTERVAL = 2400

export const HelpDockTrigger = React.memo(
  ({ onClick, isOpen = false, hasNotification = false }: HelpDockTriggerProps) => {
    const [labelIndex, setLabelIndex] = useState(0)
    const [isHovered, setIsHovered] = useState(false)
    const [isReducedMotion, setIsReducedMotion] = useState(false)
    const [isLabelVisible, setIsLabelVisible] = useState(true)

    useEffect(() => {
      if (typeof window === 'undefined' || !window.matchMedia) return

      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      const updateReducedMotion = () => {
        setIsReducedMotion(mediaQuery.matches)
      }

      updateReducedMotion()

      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', updateReducedMotion)
        return () => mediaQuery.removeEventListener('change', updateReducedMotion)
      }

      mediaQuery.addListener(updateReducedMotion)
      return () => mediaQuery.removeListener(updateReducedMotion)
    }, [])

    useEffect(() => {
      if (isOpen || isHovered) return

      const intervalId = window.setInterval(() => {
        if (isReducedMotion) {
          setLabelIndex(current => (current + 1) % DOCK_LABELS.length)
          return
        }

        setIsLabelVisible(false)
        window.setTimeout(() => {
          setLabelIndex(current => (current + 1) % DOCK_LABELS.length)
          setIsLabelVisible(true)
        }, 160)
      }, LABEL_ROTATE_INTERVAL)

      return () => window.clearInterval(intervalId)
    }, [isHovered, isOpen, isReducedMotion])

    const currentLabel = DOCK_LABELS[labelIndex]

    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          // 基础样式
          'group absolute right-0 z-40 flex flex-col items-center rounded-l-xl border-y border-l py-2.5 px-2 transition-all duration-300',
          // 颜色主题（深色橙色主题）
          'bg-[hsl(var(--surface-elevated))] border-[hsl(var(--border))]',
          // 悬停效果：背景变化 + 向左扩展
          'hover:bg-[hsl(var(--surface))] hover:px-3',
          // 打开状态
          isOpen && 'bg-primary/10 border-primary/30',
          // 位置：与直播控制台页面内容区使用同一定位基准，避免受全局 Header 高度影响
          'top-6',
        )}
        aria-label="打开帮助与反馈"
        aria-expanded={isOpen}
      >
        {/* 图标 */}
        <div className="relative">
          <HelpCircle
            className={cn(
              'h-5 w-5 transition-colors duration-200',
              isOpen ? 'text-primary' : 'text-muted-foreground',
            )}
          />
          {/* 新内容提示点（首发期） */}
          {hasNotification && !isOpen && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </div>

        {/* 文案 - 帮助反馈 */}
        <span className="mt-1 flex h-[14px] items-center overflow-hidden">
          <span
            className={cn(
              'text-[10px] font-medium whitespace-nowrap transition-all duration-200',
              isOpen ? 'text-primary' : 'text-muted-foreground',
              isReducedMotion || isLabelVisible
                ? 'translate-y-0 opacity-100'
                : 'translate-y-1 opacity-0',
            )}
          >
            {currentLabel}
          </span>
        </span>
      </button>
    )
  },
)

HelpDockTrigger.displayName = 'HelpDockTrigger'
