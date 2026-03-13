import { ArrowRight, Crown, Sparkles, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAccessContext, PLAN_TEXT_MAP, type PlanType } from '@/domain/access'

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
    description: '专业版支持自动回复、自动发言、AI助手等高级功能',
    nextPlan: '专业版',
    nextPlanLimit: 1,
  },
  trial: {
    title: '试用期即将结束，升级继续享受全部功能',
    description: '专业版支持自动回复、自动发言、AI助手等高级功能',
    nextPlan: '专业版',
    nextPlanLimit: 1,
  },
  pro: {
    title: '升级专业增强版，管理更多直播间',
    description: '专业增强版支持添加3个直播账号，适合多店铺运营',
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
    title: '您已是旗舰版用户',
    description: '如有特殊需求，请联系客服定制方案',
    nextPlan: '定制方案',
    nextPlanLimit: -1,
  },
}

export function AccountLimitDialog({ isOpen, onClose, onContinue }: AccountLimitDialogProps) {
  // 【重构】使用 AccessControl 权限层获取上下文
  const context = useAccessContext()

  // 从权限上下文获取数据
  const plan = context.plan
  const planName = PLAN_TEXT_MAP[plan]
  const maxAccounts = context.maxLiveAccounts
  const currentCount = context.currentAccountCount

  const suggestion = UPGRADE_SUGGESTIONS[plan]

  const handleViewMembership = () => {
    // 触发打开会员中心或订阅页面
    window.dispatchEvent(new CustomEvent('user:center'))
    onClose()
  }

  const handleContinue = () => {
    if (onContinue) {
      onContinue()
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>账号数量限制</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            亲爱哒，您的当前会员等级为{' '}
            <span className="font-semibold text-primary">{planName}</span>
          </DialogDescription>
        </DialogHeader>

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

        {/* 操作按钮 */}
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
      </DialogContent>
    </Dialog>
  )
}
