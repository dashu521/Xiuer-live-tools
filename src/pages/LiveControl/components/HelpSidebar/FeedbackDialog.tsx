import { Lightbulb, Loader2, MessageSquare, Send, X } from 'lucide-react'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentLiveControl } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import { submitFeedback } from '@/services/apiClient'
import appPackage from '../../../../../package.json'

type FeedbackDialogMode = 'issue' | 'feature'

interface FeedbackDialogProps {
  /** 是否打开 */
  isOpen: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 弹窗模式 */
  mode?: FeedbackDialogMode
}

interface IssueFormData {
  category: string
  content: string
  contact: string
}

interface FeatureFormData {
  title: string
  module: string
  scenario: string
  expectedOutcome: string
  details: string
  contact: string
}

const ISSUE_CATEGORIES = [
  { value: 'connection', label: '连接问题', description: '无法连接中控台或连接失败' },
  { value: 'login', label: '登录问题', description: '扫码登录失败或账号异常' },
  { value: 'function', label: '功能异常', description: '自动发言/弹窗/回复等功能异常' },
  { value: 'suggestion', label: '建议反馈', description: '产品改进意见或体验建议' },
  { value: 'other', label: '其他', description: '其他问题或咨询' },
] as const

const FEATURE_MODULES = [
  { value: 'live_control', label: '直播流程' },
  { value: 'auto_message', label: '自动发言' },
  { value: 'auto_reply', label: '自动回复' },
  { value: 'auto_popup', label: '自动弹窗' },
  { value: 'live_stats', label: '数据统计' },
  { value: 'account_management', label: '账号管理' },
  { value: 'other', label: '其它' },
] as const

function formatErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message
    }
    if ('code' in error && typeof (error as { code: unknown }).code === 'string') {
      return (error as { code: string }).code
    }
  }
  return JSON.stringify(error)
}

function inferOsName() {
  if (navigator.userAgent.includes('Win')) return 'Windows'
  if (navigator.userAgent.includes('Mac')) return 'macOS'
  if (navigator.userAgent.includes('Linux')) return 'Linux'
  return 'Other'
}

export const FeedbackDialog = React.memo(
  ({ isOpen, onClose, mode = 'issue' }: FeedbackDialogProps) => {
    const { toast } = useToast()
    const platform = useCurrentLiveControl(context => context.connectState.platform) || 'unknown'
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [issueFormData, setIssueFormData] = useState<IssueFormData>({
      category: '',
      content: '',
      contact: '',
    })
    const [featureFormData, setFeatureFormData] = useState<FeatureFormData>({
      title: '',
      module: '',
      scenario: '',
      expectedOutcome: '',
      details: '',
      contact: '',
    })

    const isFeatureMode = mode === 'feature'
    const dialogTitle = isFeatureMode ? '提交功能需求' : '提交问题反馈'
    const dialogSubtitle = isFeatureMode
      ? '告诉我们你希望新增或优化什么能力'
      : '你的反馈会帮助我们更快定位问题'

    const getPlatformInfo = () => ({
      platform,
      appVersion: `v${appPackage.version}`,
      osInfo: `${navigator.platform} ${inferOsName()}`,
    })

    const resetForms = () => {
      setIssueFormData({ category: '', content: '', contact: '' })
      setFeatureFormData({
        title: '',
        module: '',
        scenario: '',
        expectedOutcome: '',
        details: '',
        contact: '',
      })
    }

    const handleSubmit = async () => {
      const platformInfo = getPlatformInfo()

      if (!isFeatureMode) {
        if (!issueFormData.category) {
          toast.error({
            title: '请选择问题类型',
            description: '请选择最符合你问题类型的选项',
          })
          return
        }

        if (!issueFormData.content || issueFormData.content.length < 10) {
          toast.error({
            title: '问题描述太短',
            description: '请至少输入10个字符的问题描述',
          })
          return
        }
      } else {
        if (!featureFormData.title.trim()) {
          toast.error({
            title: '请填写需求标题',
            description: '用一句话描述你希望新增或优化的功能',
          })
          return
        }
        if (!featureFormData.module) {
          toast.error({
            title: '请选择需求模块',
            description: '方便我们更快归类和评估需求',
          })
          return
        }
        if (!featureFormData.scenario.trim() || featureFormData.scenario.trim().length < 10) {
          toast.error({
            title: '请补充使用场景',
            description: '至少输入10个字符，说明你在什么场景下需要它',
          })
          return
        }
        if (
          !featureFormData.expectedOutcome.trim() ||
          featureFormData.expectedOutcome.trim().length < 10
        ) {
          toast.error({
            title: '请补充期望效果',
            description: '至少输入10个字符，说明你希望软件如何处理',
          })
          return
        }
      }

      setIsSubmitting(true)

      try {
        const payload = isFeatureMode
          ? {
              category: 'feature_request',
              content: [
                `需求标题：${featureFormData.title.trim()}`,
                `所属模块：${FEATURE_MODULES.find(item => item.value === featureFormData.module)?.label || featureFormData.module}`,
                '',
                '使用场景：',
                featureFormData.scenario.trim(),
                '',
                '期望效果：',
                featureFormData.expectedOutcome.trim(),
                ...(featureFormData.details.trim()
                  ? ['', '补充说明：', featureFormData.details.trim()]
                  : []),
              ].join('\n'),
              contact: featureFormData.contact.trim() || undefined,
              platform: platformInfo.platform,
              app_version: platformInfo.appVersion,
              os_info: platformInfo.osInfo,
              diagnostic_info: {
                submission_type: 'feature_request',
                request_title: featureFormData.title.trim(),
                request_module: featureFormData.module,
                request_scenario: featureFormData.scenario.trim(),
                request_expected_outcome: featureFormData.expectedOutcome.trim(),
                request_details: featureFormData.details.trim() || undefined,
                userAgent: navigator.userAgent,
                screenSize: `${window.screen.width}x${window.screen.height}`,
                timestamp: new Date().toISOString(),
              },
            }
          : {
              category: issueFormData.category,
              content: issueFormData.content.trim(),
              contact: issueFormData.contact || undefined,
              platform: platformInfo.platform,
              app_version: platformInfo.appVersion,
              os_info: platformInfo.osInfo,
              diagnostic_info: {
                submission_type: 'issue_feedback',
                userAgent: navigator.userAgent,
                screenSize: `${window.screen.width}x${window.screen.height}`,
                timestamp: new Date().toISOString(),
              },
            }

        const result = await submitFeedback(payload)

        if (result.ok && result.data?.success) {
          toast.success({
            title: isFeatureMode ? '需求提交成功' : '反馈提交成功',
            description: isFeatureMode ? '我们会评估并安排需求' : '我们会尽快处理你的反馈',
          })
          resetForms()
          onClose()
        } else {
          const errorMsg = result.ok
            ? formatErrorMessage(result.data)
            : formatErrorMessage(result.error || '提交失败')
          toast.error({
            title: '提交失败',
            description: errorMsg,
          })
        }
      } catch (error) {
        toast.error({
          title: '网络错误',
          description: formatErrorMessage(error) || '请检查网络连接后重试',
        })
      } finally {
        setIsSubmitting(false)
      }
    }

    const handleClose = () => {
      if (!isSubmitting) {
        onClose()
      }
    }

    if (!isOpen) return null

    return (
      <>
        <div
          className={cn(
            'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200',
          )}
          onClick={handleClose}
          aria-hidden="true"
        />

        <div
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[90vw] max-w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-2xl',
            'flex flex-col animate-in fade-in zoom-in-95 duration-200',
          )}
          role="dialog"
          aria-modal="true"
          aria-label={dialogTitle}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                {isFeatureMode ? (
                  <Lightbulb className="h-4 w-4 text-primary" />
                ) : (
                  <MessageSquare className="h-4 w-4 text-primary" />
                )}
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">{dialogTitle}</h3>
                <p className="text-xs text-muted-foreground">{dialogSubtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className={cn(
                'rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                isSubmitting && 'cursor-not-allowed opacity-50',
              )}
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {!isFeatureMode ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium">
                    问题类型 <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={issueFormData.category}
                    onValueChange={value =>
                      setIssueFormData(prev => ({ ...prev, category: value }))
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="category" className="w-full">
                      <SelectValue placeholder="请选择问题类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUE_CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex flex-col items-start">
                            <span>{cat.label}</span>
                            <span className="text-xs text-muted-foreground">{cat.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content" className="text-sm font-medium">
                    问题描述 <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="content"
                    placeholder={`请详细描述你遇到的问题，包括：
1. 问题发生的场景
2. 具体操作步骤
3. 期望结果 vs 实际结果
4. 是否可复现`}
                    value={issueFormData.content}
                    onChange={e => setIssueFormData(prev => ({ ...prev, content: e.target.value }))}
                    disabled={isSubmitting}
                    className="min-h-[140px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    至少输入10个字符，建议附上截图或录屏说明问题
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="issue-contact" className="text-sm font-medium">
                    联系方式 <span className="font-normal text-muted-foreground">（可选）</span>
                  </Label>
                  <Input
                    id="issue-contact"
                    type="text"
                    placeholder="手机号或微信号，方便我们联系你"
                    value={issueFormData.contact}
                    onChange={e => setIssueFormData(prev => ({ ...prev, contact: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="feature-title" className="text-sm font-medium">
                    需求标题 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="feature-title"
                    type="text"
                    placeholder="例如：自动回复支持按关键词优先级匹配"
                    value={featureFormData.title}
                    onChange={e => setFeatureFormData(prev => ({ ...prev, title: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feature-module" className="text-sm font-medium">
                    需求模块 <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={featureFormData.module}
                    onValueChange={value =>
                      setFeatureFormData(prev => ({ ...prev, module: value }))
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="feature-module" className="w-full">
                      <SelectValue placeholder="请选择需求所属模块" />
                    </SelectTrigger>
                    <SelectContent>
                      {FEATURE_MODULES.map(item => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feature-scenario" className="text-sm font-medium">
                    使用场景 <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="feature-scenario"
                    placeholder="你在什么情况下会用到这个功能？当前痛点是什么？"
                    value={featureFormData.scenario}
                    onChange={e =>
                      setFeatureFormData(prev => ({ ...prev, scenario: e.target.value }))
                    }
                    disabled={isSubmitting}
                    className="min-h-[96px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feature-expected" className="text-sm font-medium">
                    期望效果 <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="feature-expected"
                    placeholder="希望软件最终如何工作？输入/输出、自动化流程、界面表现都可以写清楚。"
                    value={featureFormData.expectedOutcome}
                    onChange={e =>
                      setFeatureFormData(prev => ({ ...prev, expectedOutcome: e.target.value }))
                    }
                    disabled={isSubmitting}
                    className="min-h-[96px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feature-details" className="text-sm font-medium">
                    补充说明 <span className="font-normal text-muted-foreground">（可选）</span>
                  </Label>
                  <Textarea
                    id="feature-details"
                    placeholder="可补充示例、参考流程、临时替代做法，或你最在意的细节。"
                    value={featureFormData.details}
                    onChange={e =>
                      setFeatureFormData(prev => ({ ...prev, details: e.target.value }))
                    }
                    disabled={isSubmitting}
                    className="min-h-[88px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feature-contact" className="text-sm font-medium">
                    联系方式 <span className="font-normal text-muted-foreground">（可选）</span>
                  </Label>
                  <Input
                    id="feature-contact"
                    type="text"
                    placeholder="手机号或微信号，方便我们进一步确认需求"
                    value={featureFormData.contact}
                    onChange={e =>
                      setFeatureFormData(prev => ({ ...prev, contact: e.target.value }))
                    }
                    disabled={isSubmitting}
                  />
                </div>
              </>
            )}

            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">自动附带信息：</span>
                提交时会附带当前平台、软件版本、操作系统和基础诊断信息，方便后台分类和跟进。
              </p>
            </div>
          </div>

          <div className="shrink-0 border-t border-[hsl(var(--border))] p-5">
            <div className="flex gap-3">
              <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {isFeatureMode ? '提交需求' : '提交反馈'}
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                取消
              </Button>
            </div>
          </div>
        </div>
      </>
    )
  },
)

FeedbackDialog.displayName = 'FeedbackDialog'
