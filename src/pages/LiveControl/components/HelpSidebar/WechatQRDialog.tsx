import { X } from 'lucide-react'
import React from 'react'
import { WECHAT_QR_IMAGE_PATH } from '@/constants/helpSupport'
import { cn } from '@/lib/utils'

/**
 * WechatQRDialog - 微信二维码弹窗组件
 *
 * 展示开发者微信二维码，方便用户添加咨询
 */

interface WechatQRDialogProps {
  /** 是否打开 */
  isOpen: boolean
  /** 关闭回调 */
  onClose: () => void
}

export const WechatQRDialog = React.memo(({ isOpen, onClose }: WechatQRDialogProps) => {
  if (!isOpen) return null

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 弹窗面板 */}
      <div
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
          'w-[320px] sm:w-[360px]',
          'bg-[hsl(var(--surface))] rounded-2xl',
          'border border-[hsl(var(--border))]',
          'shadow-2xl',
          'p-6',
          'animate-in fade-in zoom-in-95 duration-200',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="添加开发者微信"
      >
        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'absolute top-3 right-3 p-1.5 rounded-lg transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-muted',
          )}
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 标题 */}
        <div className="text-center mb-5">
          <h3 className="text-base font-semibold text-foreground">添加开发者微信</h3>
          <p className="text-xs text-muted-foreground mt-1">扫码添加，获取一对一支持</p>
        </div>

        {/* 二维码图片 */}
        <div className="flex justify-center mb-5">
          <div className="p-3 bg-white rounded-xl">
            <img
              src={WECHAT_QR_IMAGE_PATH}
              alt="开发者微信二维码"
              className="w-[200px] h-[200px] object-contain"
              onError={event => {
                const target = event.currentTarget
                target.style.display = 'none'
                const fallback = target.nextElementSibling as HTMLElement | null
                if (fallback) fallback.hidden = false
              }}
            />
            <p
              className="w-[200px] h-[200px] flex items-center justify-center text-center text-xs text-slate-500"
              hidden
            >
              二维码图片未找到
              <br />
              请确认资源文件已打包
            </p>
          </div>
        </div>

        {/* 提示文字 */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            添加时请备注 <span className="text-primary font-medium">【秀儿直播助手】</span>
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-2">以便更快处理你的问题</p>
        </div>
      </div>
    </>
  )
})

WechatQRDialog.displayName = 'WechatQRDialog'
