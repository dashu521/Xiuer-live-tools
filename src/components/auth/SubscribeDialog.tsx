/**
 * 订阅/试用弹窗：免费试用 3 天（服务端），不接支付。支持“试用已结束”模式。
 * 方案三变体：开通试用后同步到本地 trialStore
 */
import { Gift, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getServerTime } from '@/services/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { useGateStore } from '@/stores/gateStore'
import { useTrialStore } from '@/stores/trialStore'

interface SubscribeDialogProps {
  isOpen: boolean
  onClose: () => void
  actionName?: string
  /** 试用已结束（进入应用或切换平台时由服务端 userStatus 判定） */
  trialExpired?: boolean
}

export function SubscribeDialog({
  isOpen,
  onClose,
  actionName,
  trialExpired = false,
}: SubscribeDialogProps) {
  const { runPendingActionAndClear } = useGateStore()
  const startTrialAndRefresh = useAuthStore(s => s.startTrialAndRefresh)
  const trialStore = useTrialStore()
  const [loading, setLoading] = useState(false)
  const [trialError, setTrialError] = useState<string | null>(null)

  const handleStartTrial = async () => {
    setTrialError(null)
    setLoading(true)
    try {
      const result = await startTrialAndRefresh()
      if (result.success) {
        // 同步试用状态到本地 trialStore（方案三变体）
        const { status } = result
        if (status?.trial?.is_active && status.trial.end_at) {
          // 尝试获取服务端时间
          const serverTime = await getServerTime()
          const endTime = new Date(status.trial.end_at).getTime()
          const startTime = status.trial.start_at
            ? new Date(status.trial.start_at).getTime()
            : (serverTime ?? Date.now())

          trialStore.syncFromServer({
            trialStartedAt: startTime,
            trialEndsAt: endTime,
            serverTime: serverTime ?? Date.now(),
          })
          console.log('[SubscribeDialog] Trial synced to local store:', {
            startTime,
            endTime,
            serverTime,
          })
        } else {
          // 后端没有返回完整试用信息，使用本地计算
          const serverTime = await getServerTime()
          trialStore.startTrial(serverTime ?? undefined)
          console.log('[SubscribeDialog] Trial started locally with server time:', serverTime)
        }

        // 【修复】强制刷新用户状态，确保账户中心等 UI 立即显示正确的到期时间
        // 虽然 startTrialAndRefresh 已更新 userStatus，但某些场景下需要显式刷新
        try {
          await useAuthStore.getState().refreshUserStatus()
          console.log('[SubscribeDialog] User status refreshed after trial activation')
        } catch (error) {
          console.warn('[SubscribeDialog] Failed to refresh user status:', error)
          // 刷新失败不影响主流程，继续执行
        }

        // 先执行 pendingAction，再关闭弹窗（避免组件卸载导致 action 无法执行）
        runPendingActionAndClear()
        onClose()
        return
      }
      if (result.errorCode === 'trial_already_used') {
        setTrialError('试用机会已用完，升级会员后就能继续使用全部功能')
        return
      }
      setTrialError(result.message ?? '网络不太好，稍后再试一下')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            {trialExpired ? '试用已结束' : '开通试用'}
          </DialogTitle>
          <DialogDescription>
            {trialExpired
              ? '试用已经结束，升级会员后就能继续使用全部功能'
              : actionName
                ? '开通免费试用 3 天或升级会员后，就可以使用这个功能了'
                : '免费试用 3 天开通后，就可以体验全部功能'}
          </DialogDescription>
          {trialError && (
            <p className="text-sm text-destructive mt-2" role="alert">
              {trialError}
            </p>
          )}
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={handleStartTrial} disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '免费试用 3 天'}
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            {trialExpired ? '关闭' : '暂不开通'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
