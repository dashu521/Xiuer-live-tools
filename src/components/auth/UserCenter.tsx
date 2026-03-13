import { Crown, Gift, Key, LogOut, RefreshCw, Ticket, User, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatGiftCardCode, isValidGiftCardCode, PLAN_DESCRIPTION_MAP } from '@/config/userCenter'
import { useAccessContext, PLAN_TEXT_MAP } from '@/domain/access'
import { useToast } from '@/hooks/useToast'
import { type RedeemGiftCardResponse, redeemGiftCard } from '@/services/apiClient'
import { useAuthStore } from '@/stores/authStore'
import type { ExpiryInfo, UserCenterProps } from '@/types/userCenter'
import { ChangePasswordDialog } from './ChangePasswordDialog'
import { LogoutConfirmDialog } from './LogoutConfirmDialog'

// 统一使用主色调样式
const PRIMARY_STYLES = {
  badge: 'border border-primary/30 text-primary bg-primary/5',
  icon: 'bg-primary/10 text-primary',
} as const

export function UserCenter({ isOpen, onClose }: UserCenterProps) {
  const { user, logout, refreshUserStatus } = useAuthStore()
  const { toast } = useToast()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [giftCardCode, setGiftCardCode] = useState('')
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [redeemResult, setRedeemResult] = useState<RedeemGiftCardResponse | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // 【重构】使用 AccessControl 权限层获取上下文
  const accessContext = useAccessContext()

  // 合并计算，优化性能
  const userInfo = useMemo(() => {
    if (!user) return null

    // 从权限上下文获取套餐信息
    const plan = accessContext.plan

    // 计算到期信息 - 统一从 accessContext 获取
    let expiry: ExpiryInfo = {
      date: null,
      isExpired: false,
      isPermanent: false,
    }

    // 优先使用试用到期时间，其次使用正式套餐到期时间
    if (accessContext.trialEndsAt) {
      const endDate = new Date(accessContext.trialEndsAt)
      expiry = {
        date: endDate,
        isExpired: accessContext.trialExpired,
        isPermanent: false,
      }
    } else if (accessContext.expiresAt) {
      const endDate = new Date(accessContext.expiresAt)
      expiry = {
        date: endDate,
        isExpired: accessContext.expiresAt < Date.now(),
        isPermanent: false,
      }
    } else {
      expiry = {
        date: null,
        isExpired: false,
        isPermanent: ['pro', 'pro_max', 'ultra'].includes(plan),
      }
    }

    // 计算剩余天数
    const remainingDays =
      expiry.date && !expiry.isExpired
        ? Math.max(0, Math.ceil((expiry.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null

    // 从权限上下文获取账号上限显示
    const maxAccounts = accessContext.maxLiveAccounts
    const accountLimitDisplay = maxAccounts < 0 ? '无限制' : `${maxAccounts} 个`

    return {
      plan,
      expiry,
      accountLimitDisplay,
      remainingDays,
    }
  }, [user, accessContext])

  const handleLogout = useCallback(async () => {
    setShowLogoutConfirm(true)
  }, [])

  const confirmLogout = useCallback(async () => {
    setIsLoggingOut(true)
    try {
      await logout()
      setShowLogoutConfirm(false)
      onClose()
    } finally {
      setIsLoggingOut(false)
    }
  }, [logout, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose],
  )

  const handleRefreshStatus = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refreshUserStatus()
      toast.success('状态已刷新')
    } catch {
      toast.error('刷新失败，请重试')
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshUserStatus, toast])

  const handleGiftCardCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatGiftCardCode(e.target.value)
      setGiftCardCode(formatted)
      // 清除之前的兑换结果
      if (redeemResult) {
        setRedeemResult(null)
      }
    },
    [redeemResult],
  )

  const handleRedeemGiftCard = useCallback(async () => {
    if (!giftCardCode.trim()) {
      toast.error('请输入兑换码')
      return
    }

    if (!isValidGiftCardCode(giftCardCode)) {
      toast.error('兑换码格式不正确')
      return
    }

    setIsRedeeming(true)
    setRedeemResult(null)

    try {
      const result = await redeemGiftCard(giftCardCode.trim())
      console.log('[GiftCard] Redeem result:', result)
      if (result.ok && result.data) {
        setRedeemResult(result.data)
        if (result.data.success) {
          toast.success('兑换成功！')
          await refreshUserStatus()
        }
      } else {
        console.error('[GiftCard] Redeem failed:', result)
        setRedeemResult({
          success: false,
          message: (!result.ok && result.error?.message) || '兑换失败，请检查后重试',
        })
      }
    } catch (error) {
      console.error('[GiftCard] Redeem error:', error)
      setRedeemResult({ success: false, message: '兑换失败，请稍后重试' })
    } finally {
      setIsRedeeming(false)
    }
  }, [giftCardCode, refreshUserStatus, toast])

  // 格式化到期日期显示
  const formatExpiryDate = useCallback((date: Date | null, isPermanent: boolean): string => {
    if (isPermanent) return '永久有效'
    if (!date) return '无到期时间'
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }, [])

  if (!isOpen) return null

  if (!user || !userInfo) {
    return (
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-busy="true"
      >
        <div
          className="w-[24rem] max-w-[92vw] bg-[var(--surface)] rounded-2xl border border-[hsl(var(--border))] overflow-hidden"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { plan, expiry, accountLimitDisplay, remainingDays } = userInfo

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
        onClick={handleBackdropClick}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            onClose()
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-center-title"
      >
        <div
          className="w-[24rem] max-w-[95vw] max-h-[85vh] bg-[var(--surface)] rounded-2xl border border-[hsl(var(--border))] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
          style={{ boxShadow: 'var(--shadow-modal)' }}
          onClick={e => e.stopPropagation()}
          role="document"
        >
          {/* Header */}
          <div className="relative px-5 pt-5 pb-4 border-b border-[hsl(var(--border))]">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-all duration-200 p-2 rounded-lg hover:bg-muted"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 pr-8">
              <div
                className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${PRIMARY_STYLES.icon}`}
              >
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id="user-center-title"
                  className="text-base font-semibold text-foreground truncate"
                >
                  {user.username}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className={`${PRIMARY_STYLES.badge} text-xs`}>{PLAN_TEXT_MAP[plan]}</Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Content - 单一页面，无 Tab */}
          <div className="px-5 py-4 overflow-y-auto">
            <div className="space-y-4">
              {/* 会员状态卡片 */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      {PLAN_TEXT_MAP[plan]}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefreshStatus}
                    disabled={isRefreshing}
                    className="h-7 w-7 p-0"
                    aria-label="刷新状态"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground mb-3">{PLAN_DESCRIPTION_MAP[plan]}</p>

                <div className="space-y-2 text-sm">
                  {/* 账号数量限制 */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">直播账号上限</span>
                    <span className="font-medium text-foreground">{accountLimitDisplay}</span>
                  </div>

                  {/* 到期日期 */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">到期时间</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium ${expiry.isExpired ? 'text-destructive' : 'text-foreground'}`}
                      >
                        {formatExpiryDate(expiry.date, expiry.isPermanent)}
                      </span>
                      {!expiry.isPermanent && !expiry.isExpired && remainingDays !== null && (
                        <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          剩 {remainingDays} 天
                        </span>
                      )}
                      {expiry.isExpired && (
                        <span className="text-xs text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                          已过期
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 礼品卡兑换 */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <Ticket className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-medium text-foreground">礼品卡兑换</h4>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      id="gift-card-code"
                      value={giftCardCode}
                      onChange={handleGiftCardCodeChange}
                      placeholder="请输入 XXXX-XXXX-XXXX 格式的兑换码"
                      className="font-mono text-sm tracking-[0.05em] pr-10 h-9 placeholder:text-xs placeholder:text-muted-foreground/50"
                      maxLength={14}
                      disabled={isRedeeming}
                      aria-invalid={giftCardCode.length > 0 && !isValidGiftCardCode(giftCardCode)}
                    />
                    <Gift className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>

                  {redeemResult && (
                    <output
                      className={`p-2.5 rounded-lg text-sm ${
                        redeemResult.success
                          ? 'bg-primary/5 border border-primary/20'
                          : 'bg-destructive/5 border border-destructive/20'
                      }`}
                      aria-live="polite"
                    >
                      {redeemResult.success ? (
                        <div className="space-y-0.5">
                          <p className="font-medium text-primary">兑换成功</p>
                          {redeemResult.data?.membershipType && (
                            <p className="text-primary/80 text-xs">
                              已开通{' '}
                              {redeemResult.data.membershipType === 'pro' ? '专业版' : '试用'} 会员
                              {redeemResult.data.membershipDays
                                ? `（${redeemResult.data.membershipDays} 天）`
                                : ''}
                              {redeemResult.data.newExpiryDate
                                ? `，有效期至 ${new Date(redeemResult.data.newExpiryDate).toLocaleDateString()}`
                                : ''}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-destructive/80 text-xs">{redeemResult.message}</p>
                      )}
                    </output>
                  )}

                  <Button
                    onClick={handleRedeemGiftCard}
                    disabled={isRedeeming || !isValidGiftCardCode(giftCardCode)}
                    className="w-full"
                    size="sm"
                    aria-busy={isRedeeming}
                  >
                    {isRedeeming ? '兑换中...' : '立即兑换'}
                  </Button>
                </div>
              </div>

              {/* 退出登录 & 修改密码 - 同一行 */}
              <div className="flex items-center justify-center gap-1 pt-2">
                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive h-8 px-3"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      退出中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs">
                      <LogOut className="h-3.5 w-3.5" />
                      退出登录
                    </span>
                  )}
                </Button>

                <span className="text-border/50">|</span>

                <button
                  onClick={() => setShowChangePassword(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  <Key className="h-3.5 w-3.5" />
                  修改密码
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      {/* Logout Confirm Dialog */}
      <LogoutConfirmDialog
        isOpen={showLogoutConfirm}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
        isLoading={isLoggingOut}
      />
    </>
  )
}
