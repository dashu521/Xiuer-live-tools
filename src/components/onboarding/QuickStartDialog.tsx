import { CheckCircle, Monitor, Rocket, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface QuickStartDialogProps {
  isOpen: boolean
  onClose: () => void
  onConnect: () => void
}

export function QuickStartDialog({ isOpen, onClose, onConnect }: QuickStartDialogProps) {
  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent
        aria-describedby="quick-start-description"
        className="w-full max-w-md overflow-hidden rounded-2xl border p-0"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'hsla(var(--border), 0.95)',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        {/* 顶部装饰 */}
        <div
          className="relative h-28"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,107,53,0.98) 0%, rgba(247,147,30,0.92) 100%)',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Rocket className="h-7 w-7 text-white" />
            </div>
          </div>
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
          <div className="mb-6 text-center">
            <h2 className="mb-2 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              登录完成，准备进入工作流
            </h2>
            <p id="quick-start-description" style={{ color: 'var(--text-secondary)' }}>
              连接直播中控台后，自动发言、自动弹窗和自动回复功能才能正常启用。
            </p>
          </div>

          {/* 步骤展示 */}
          <div className="mb-6 space-y-4">
            <div
              className="flex items-center gap-4 rounded-xl p-4"
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)' }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/12 text-emerald-100">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  完成登录
                </h4>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  当前账号权限和配置已可用
                </p>
              </div>
            </div>

            <div
              className="flex items-center gap-4 rounded-xl p-4 ring-1"
              style={{
                backgroundColor: 'rgba(255, 107, 53, 0.12)',
                borderColor: 'rgba(255, 107, 53, 0.28)',
              }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
                <Monitor className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  连接直播中控台
                </h4>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  这是所有自动化能力的前置条件
                </p>
              </div>
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            </div>

            <div
              className="flex items-center gap-4 rounded-xl p-4 opacity-80"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white">
                <span className="text-sm font-bold">3</span>
              </div>
              <div>
                <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  开启自动化
                </h4>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  再配置发言、弹窗、回复等任务
                </p>
              </div>
            </div>
          </div>

          {/* 提示文案 */}
          <div
            className="mb-6 rounded-lg p-4 text-sm"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.14)',
              color: 'rgb(253 230 138)',
            }}
          >
            <span className="font-semibold">提示：</span>
            连接成功后，再进入左侧各功能页完成配置，流程会更顺畅。
          </div>

          {/* 按钮区域 */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              稍后再说
            </Button>
            <Button className="flex-1 gap-2" onClick={onConnect}>
              <Monitor className="h-4 w-4" />
              立即连接
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
