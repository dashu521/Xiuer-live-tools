import { ArrowLeft, ArrowRight, Crown, Sparkles, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PLAN_COLOR_MAP, PLAN_ICON_MAP, TIER_BENEFITS } from '@/config/userCenter'
import { PLAN_TEXT_MAP, type PlanType, useAccessContext } from '@/domain/access'

interface AccountLimitDialogProps {
  isOpen: boolean
  onClose: () => void
  onContinue?: () => void
}

// 套餐升级建议配置
const UPGRADE_SUGGESTIONS: Record<
  PlanType,
  { title: string; description: string; nextPlan: string; nextPlanLimit: number }
> = {
  free: {
    title: '升级专业版，解锁更多功能',
    description: '专业版支持自动回复、自动发言、AI 助手等高级功能',
    nextPlan: '专业版',
    nextPlanLimit: 1,
  },
  trial: {
    title: '试用期即将结束，升级继续使用全部功能',
    description: '专业版支持自动回复、自动发言、AI 助手等高级功能',
    nextPlan: '专业版',
    nextPlanLimit: 1,
  },
  pro: {
    title: '升级专业增强版，管理更多直播间',
    description: '专业增强版支持添加 3 个直播账号，适合多店铺运营',
    nextPlan: '专业增强版',
    nextPlanLimit: 3,
  },
  pro_max: {
    title: '升级旗舰版，无限添加直播账号',
    description: '旗舰版不限制直播账号数量，适合大型运营团队',
    nextPlan: '旗舰版',
    nextPlanLimit: -1,
  },
  ultra: {
    title: '您已是旗舰版会员',
    description: '如有特殊需求，请联系客服定制方案',
    nextPlan: '定制方案',
    nextPlanLimit: -1,
  },
}

const MEMBERSHIP_OVERVIEW: Record<
  Exclude<PlanType, 'free'>,
  { price: string; accountLimit: string; summary: string }
> = {
  trial: {
    price: '免费试用 3 天',
    accountLimit: '最多添加 1 个直播账号',
    summary: '适合短期体验全部核心功能',
  },
  pro: {
    price: '29 元 / 月',
    accountLimit: '最多添加 1 个直播账号',
    summary: '适合单店铺稳定运营',
  },
  pro_max: {
    price: '39 元 / 月',
    accountLimit: '最多添加 3 个直播账号',
    summary: '适合多店铺并行运营',
  },
  ultra: {
    price: '59 元 / 月',
    accountLimit: '直播账号数量无限制',
    summary: '适合团队化和多账号重度运营',
  },
}

export function AccountLimitDialog({ isOpen, onClose, onContinue }: AccountLimitDialogProps) {
  const [view, setView] = useState<'limit' | 'benefits'>('limit')

  // 【重构】使用 AccessControl 权限层获取上下文
  const context = useAccessContext()

  // 从权限上下文获取数据
  const plan = context.plan
  const planName = PLAN_TEXT_MAP[plan]
  const maxAccounts = context.maxLiveAccounts
  const currentCount = context.currentAccountCount

  const suggestion = UPGRADE_SUGGESTIONS[plan]
  const membershipPlans = useMemo(
    () =>
      ['trial', 'pro', 'pro_max', 'ultra'] as const satisfies readonly Exclude<PlanType, 'free'>[],
    [],
  )

  useEffect(() => {
    if (!isOpen) {
      setView('limit')
    }
  }, [isOpen])

  const handleViewMembership = () => {
    setView('benefits')
  }

  const handleContinue = () => {
    if (onContinue) {
      onContinue()
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={view === 'benefits' ? 'sm:max-w-4xl' : 'sm:max-w-md'}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>{view === 'benefits' ? '会员等级权益总览' : '账号数量限制'}</DialogTitle>
          </div>
          {view === 'benefits' ? (
            <DialogDescription className="pt-2">
              查看各会员等级支持的功能和直播账号上限。您当前是{' '}
              <span className="font-semibold text-primary">{planName}</span>。
            </DialogDescription>
          ) : (
            <DialogDescription className="pt-2">
              您当前的会员等级是 <span className="font-semibold text-primary">{planName}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        {view === 'benefits' ? (
          <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {membershipPlans.map(planKey => {
                const color = PLAN_COLOR_MAP[planKey]
                const Icon = PLAN_ICON_MAP[planKey]
                const benefits = TIER_BENEFITS[planKey]
                const overview = MEMBERSHIP_OVERVIEW[planKey]
                const isCurrent = planKey === plan

                return (
                  <div
                    key={planKey}
                    className={`rounded-xl border p-4 space-y-4 ${isCurrent ? color.gradient : 'bg-muted/30 border-border/60'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${isCurrent ? color.icon : 'bg-muted text-muted-foreground'}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground">
                            {PLAN_TEXT_MAP[planKey]}
                          </div>
                          <div className="text-xs text-muted-foreground">{overview.summary}</div>
                        </div>
                      </div>
                      {isCurrent && (
                        <span className={`text-xs px-2 py-1 rounded-md ${color.badge}`}>
                          当前等级
                        </span>
                      )}
                    </div>

                    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 space-y-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">订阅价格</span>
                        <span className="font-semibold text-foreground">{overview.price}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">账号上限</span>
                        <span className="font-medium text-foreground">{overview.accountLimit}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {benefits.map(benefit => {
                        const BenefitIcon = benefit.icon
                        return (
                          <div
                            key={`${planKey}-${benefit.name}`}
                            className="flex items-start gap-3"
                          >
                            <BenefitIcon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-foreground">
                                {benefit.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {benefit.description}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setView('limit')} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                返回账号限制
              </Button>
              <Button onClick={handleContinue}>{plan === 'ultra' ? '我知道了' : '继续添加'}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* 当前等级信息 */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">当前会员</span>
                <span className="font-medium">{planName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">可添加账号数</span>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {maxAccounts === -1 ? '无限制' : `${maxAccounts} 个`}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">已添加账号</span>
                <span className="font-medium text-primary">{currentCount} 个</span>
              </div>
            </div>

            {/* 升级建议 */}
            {plan !== 'ultra' && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium text-primary">{suggestion.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">升级后：</span>
                  <span className="font-medium text-primary">
                    {suggestion.nextPlanLimit === -1
                      ? '无限制'
                      : `${suggestion.nextPlanLimit} 个账号`}
                  </span>
                </div>
              </div>
            )}

            {/* 提示信息 */}
            <div className="text-sm text-muted-foreground text-center">
              {plan === 'ultra'
                ? '您已达到最高会员等级，如有特殊需求请联系客服'
                : '升级会员等级即可添加更多直播账号，享受更多权益'}
            </div>
          </div>
        )}

        {view === 'limit' && (
          <div className="flex flex-col gap-2">
            {plan !== 'ultra' && (
              <Button onClick={handleViewMembership} className="w-full gap-2">
                <Crown className="h-4 w-4" />
                了解会员权益
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" onClick={handleContinue} className="w-full">
              {plan === 'ultra' ? '我知道了' : '继续添加'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
