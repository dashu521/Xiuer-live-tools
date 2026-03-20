import { X } from 'lucide-react'
import React, { useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { HelpSidebarContent } from './HelpSidebarContent'

/**
 * HelpDrawer - 帮助抽屉组件
 *
 * 从右侧滑出的抽屉面板
 * 包含遮罩层、关闭按钮和内容区
 */

interface HelpDrawerProps {
  /** 是否打开 */
  isOpen: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 打开快速上手教程的回调 */
  onOpenTutorial?: () => void
  /** 打开微信二维码弹窗的回调 */
  onOpenWechatQR?: () => void
  /** 打开反馈弹窗的回调 */
  onOpenFeedback?: () => void
}

export const HelpDrawer = React.memo(
  ({ isOpen, onClose, onOpenTutorial, onOpenWechatQR, onOpenFeedback }: HelpDrawerProps) => {
    // ESC 键关闭
    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isOpen) {
          onClose()
        }
      },
      [isOpen, onClose],
    )

    useEffect(() => {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    // 禁止背景滚动
    useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = 'hidden'
      } else {
        document.body.style.overflow = ''
      }
      return () => {
        document.body.style.overflow = ''
      }
    }, [isOpen])

    return (
      <>
        {/* 遮罩层 */}
        <div
          className={cn(
            'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300',
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
          onClick={onClose}
          aria-hidden="true"
        />

        {/* 抽屉面板 */}
        <div
          className={cn(
            'fixed top-0 right-0 z-50 h-full transition-transform duration-300 ease-out',
            'w-full sm:w-[360px]',
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
          aria-label="帮助与反馈"
        >
          {/* 头部 - 带关闭按钮 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
            <h2 className="text-sm font-semibold text-foreground">帮助与反馈</h2>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 内容区 - 可滚动 */}
          <div className="h-[calc(100%-52px)] overflow-y-auto p-4">
            <HelpSidebarContent
              onOpenTutorial={onOpenTutorial}
              onOpenWechatQR={onOpenWechatQR}
              onOpenFeedback={onOpenFeedback}
            />
          </div>
        </div>
      </>
    )
  },
)

HelpDrawer.displayName = 'HelpDrawer'
