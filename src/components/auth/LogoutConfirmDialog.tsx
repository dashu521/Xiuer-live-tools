import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface LogoutConfirmDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function LogoutConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
}: LogoutConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onCancel()}>
      <DialogContent
        aria-labelledby="logout-confirm-title"
        aria-describedby="logout-confirm-description"
        className="w-[20rem] max-w-[92vw] overflow-hidden rounded-2xl border p-0"
        onPointerDownOutside={event => {
          if (isLoading) {
            event.preventDefault()
          }
        }}
        onEscapeKeyDown={event => {
          if (isLoading) {
            event.preventDefault()
          }
        }}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <button
            type="button"
            onClick={onCancel}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-all duration-200 p-2 rounded-lg hover:bg-muted"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h2 id="logout-confirm-title" className="text-lg font-bold text-foreground">
              确认退出登录？
            </h2>
            <p id="logout-confirm-description" className="mt-1 text-sm text-muted-foreground">
              退出后需要重新登录才能使用完整功能
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-2 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isLoading}>
            取消
          </Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                退出中...
              </div>
            ) : (
              '确认退出'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
