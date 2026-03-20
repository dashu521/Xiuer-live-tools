import { BookOpen, Code2, MessageCircle, Sparkles } from 'lucide-react'
import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/useToast'

interface HelpSidebarContentProps {
  onOpenTutorial?: () => void
  onOpenWechatQR?: () => void
  onOpenFeedback?: () => void
  onOpenFeatureRequest?: () => void
}

export const HelpSidebarContent = React.memo(
  ({
    onOpenTutorial,
    onOpenWechatQR,
    onOpenFeedback,
    onOpenFeatureRequest,
  }: HelpSidebarContentProps) => {
    const { toast } = useToast()

    const handleQuickStart = () => {
      onOpenTutorial?.()
    }

    const handleViewFAQ = () => {
      toast.info({
        title: '即将上线',
        description: '常见问题功能正在开发中',
      })
    }

    const handleFeedback = () => {
      onOpenFeedback?.()
    }

    const handleContactDeveloper = () => {
      onOpenWechatQR?.()
    }

    const handleOpenFeatureRequest = () => {
      onOpenFeatureRequest?.()
    }

    const handleViewFeaturePlan = () => {
      toast.info({
        title: '直接提需求即可',
        description: '提交后会进入后台列表，方便统一评估和排期',
      })
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="px-1">
          <h3 className="text-base font-semibold text-foreground">帮助与反馈</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            快速开始使用，遇到问题或有新需求都可以直接提交
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-primary" />
              新手指南
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              从连接中控台到开始使用，按步骤快速完成配置
            </p>
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={handleQuickStart} className="w-full text-xs">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                3分钟快速上手
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleViewFAQ}
                className="w-full text-xs"
              >
                查看常见问题
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageCircle className="h-4 w-4 text-primary" />
                联系开发者
              </CardTitle>
              <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[10px]">
                首发支持
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              遇到使用异常或不清楚怎么操作时，可直接提交问题或联系作者
            </p>
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={handleFeedback} className="w-full text-xs">
                立即反馈问题
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleContactDeveloper}
                className="w-full text-xs"
              >
                联系开发者
              </Button>
            </div>
            <p className="text-center text-[10px] text-muted-foreground/70">
              建议附上截图或问题描述，处理更快
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Code2 className="h-4 w-4 text-primary" />
              功能开发
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              有任何功能需求、流程优化想法或自动化诉求，都可以直接提交给我们
            </p>
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={handleOpenFeatureRequest} className="w-full text-xs">
                提交功能需求
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleViewFeaturePlan}
                className="w-full text-xs"
              >
                查看提交说明
              </Button>
            </div>
            <p className="text-center text-[10px] text-muted-foreground/70">
              提交后会自动进入后台管理列表，便于评估和排期
            </p>
          </CardContent>
        </Card>
      </div>
    )
  },
)

HelpSidebarContent.displayName = 'HelpSidebarContent'
