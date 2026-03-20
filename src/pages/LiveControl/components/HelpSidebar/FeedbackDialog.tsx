import { Loader2, MessageSquare, Send, X } from 'lucide-react'
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
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import { submitFeedback } from '@/services/apiClient'

/**
 * FeedbackDialog - 问题反馈弹窗组件
 *
 * 用户提交问题反馈到服务器（需要登录）
 * 包含问题类型、描述、联系方式等字段
 */

interface FeedbackDialogProps {
  /** 是否打开 */
  isOpen: boolean
  /** 关闭回调 */
  onClose: () => void
}

interface FeedbackFormData {
  category: string
  content: string
  contact: string
}

const FEEDBACK_CATEGORIES = [
  { value: 'connection', label: '连接问题', description: '无法连接中控台或连接失败' },
  { value: 'login', label: '登录问题', description: '扫码登录失败或账号异常' },
  { value: 'function', label: '功能异常', description: '自动发言/弹窗/回复等功能异常' },
  { value: 'suggestion', label: '建议反馈', description: '功能建议或改进意见' },
  { value: 'other', label: '其他', description: '其他问题或咨询' },
]

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

export const FeedbackDialog = React.memo(({ isOpen, onClose }: FeedbackDialogProps) => {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<FeedbackFormData>({
    category: '',
    content: '',
    contact: '',
  })

  const getPlatformInfo = () => {
    return {
      platform: 'unknown',
      appVersion: 'v1.0.0',
      osInfo: `${navigator.platform} ${navigator.userAgent.includes('Win') ? 'Windows' : navigator.userAgent.includes('Mac') ? 'macOS' : 'Other'}`,
    }
  }

  const handleSubmit = async () => {
    if (!formData.category) {
      toast.error({
        title: '请选择问题类型',
        description: '请选择最符合你问题类型的选项',
      })
      return
    }

    if (!formData.content || formData.content.length < 10) {
      toast.error({
        title: '问题描述太短',
        description: '请至少输入10个字符的问题描述',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const platformInfo = getPlatformInfo()

      console.log('[Feedback] 准备提交反馈')
      console.log('[Feedback] 请求:', {
        category: formData.category,
        content: formData.content,
        contact: formData.contact || undefined,
        platform: platformInfo.platform,
        app_version: platformInfo.appVersion,
        os_info: platformInfo.osInfo,
      })

      const result = await submitFeedback({
        category: formData.category,
        content: formData.content,
        contact: formData.contact || undefined,
        platform: platformInfo.platform,
        app_version: platformInfo.appVersion,
        os_info: platformInfo.osInfo,
        diagnostic_info: {
          userAgent: navigator.userAgent,
          screenSize: `${window.screen.width}x${window.screen.height}`,
          timestamp: new Date().toISOString(),
        },
      })

      console.log('[Feedback] 响应结果:', result)

      if (result.ok && result.data?.success) {
        toast.success({
          title: '反馈提交成功',
          description: '我们会尽快处理你的反馈',
        })
        setFormData({ category: '', content: '', contact: '' })
        onClose()
      } else {
        const errorMsg = result.ok
          ? formatErrorMessage(result.data)
          : formatErrorMessage(result.error || '提交失败')
        console.error('[Feedback] 业务错误:', result.ok ? result.data : result.error)
        toast.error({
          title: '提交失败',
          description: errorMsg,
        })
      }
    } catch (error) {
      console.error('[Feedback] 网络错误:', error)
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
      {/* 遮罩层 */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200',
        )}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* 弹窗面板 */}
      <div
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
          'w-[90vw] max-w-[480px] max-h-[90vh]',
          'bg-[hsl(var(--surface))] rounded-2xl',
          'border border-[hsl(var(--border))]',
          'shadow-2xl',
          'flex flex-col',
          'animate-in fade-in zoom-in-95 duration-200',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="提交问题反馈"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">提交问题反馈</h3>
              <p className="text-xs text-muted-foreground">你的反馈会帮助我们改进产品</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'text-muted-foreground hover:text-foreground hover:bg-muted',
              isSubmitting && 'opacity-50 cursor-not-allowed',
            )}
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 表单内容 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 问题类型 */}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium">
              问题类型 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.category}
              onValueChange={value => setFormData(prev => ({ ...prev, category: value }))}
              disabled={isSubmitting}
            >
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="请选择问题类型" />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_CATEGORIES.map(cat => (
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

          {/* 问题描述 */}
          <div className="space-y-2">
            <Label htmlFor="content" className="text-sm font-medium">
              问题描述 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="content"
              placeholder="请详细描述你遇到的问题，包括：
1. 问题发生的场景
2. 具体操作步骤
3. 期望结果 vs 实际结果
4. 是否可复现"
              value={formData.content}
              onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
              disabled={isSubmitting}
              className="min-h-[120px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              至少输入10个字符，建议附上截图或录屏说明问题
            </p>
          </div>

          {/* 联系方式 */}
          <div className="space-y-2">
            <Label htmlFor="contact" className="text-sm font-medium">
              联系方式 <span className="text-muted-foreground font-normal">（可选）</span>
            </Label>
            <Input
              id="contact"
              type="text"
              placeholder="手机号或微信号，方便我们联系你"
              value={formData.contact}
              onChange={e => setFormData(prev => ({ ...prev, contact: e.target.value }))}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">如需跟进处理进度，建议留下联系方式</p>
          </div>

          {/* 自动收集信息提示 */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">自动收集信息：</span>
              提交时会自动附带软件版本、操作系统等诊断信息，帮助我们更快定位问题。
            </p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-5 border-t border-[hsl(var(--border))] shrink-0">
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
                  提交反馈
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
})

FeedbackDialog.displayName = 'FeedbackDialog'
