import { CheckCircle, Monitor, Rocket, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface QuickStartDialogProps {
  isOpen: boolean
  onClose: () => void
  onConnect: () => void
}

export function QuickStartDialog({ isOpen, onClose, onConnect }: QuickStartDialogProps) {
  if (!isOpen) return null

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
        <div className="relative h-28 bg-gradient-to-br from-indigo-400 via-purple-400 to-pink-400">
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
            <h2 className="mb-2 text-2xl font-bold text-gray-800">准备起飞啦！🚀</h2>
            <p className="text-gray-600">恭喜你登录成功！接下来只需要一步就能开始使用啦～</p>
          </div>

          {/* 步骤展示 */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-4 rounded-xl bg-green-50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">完成登录</h4>
                <p className="text-sm text-gray-600">太棒了！你已经成功登录</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl bg-purple-50 p-4 ring-2 ring-purple-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500 text-white">
                <Monitor className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800">连接直播中控台</h4>
                <p className="text-sm text-gray-600">这是使用其他功能的前提哦</p>
              </div>
              <Sparkles className="h-5 w-5 text-purple-500 animate-pulse" />
            </div>

            <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-4 opacity-60">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-400 text-white">
                <span className="text-sm font-bold">3</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">开启自动化</h4>
                <p className="text-sm text-gray-600">享受智能直播助手的便利</p>
              </div>
            </div>
          </div>

          {/* 提示文案 */}
          <div className="mb-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            <span className="font-semibold">💡 小贴士：</span>
            连接中控台后，你就可以使用自动发言、自动弹窗、AI回复等超酷功能啦！
          </div>

          {/* 按钮区域 */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              稍后再说
            </Button>
            <Button className="flex-1 gap-2 bg-purple-500 hover:bg-purple-600" onClick={onConnect}>
              <Monitor className="h-4 w-4" />
              立即连接
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
