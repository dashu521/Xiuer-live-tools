import { BookOpen, Copy, FileDown, MessageCircle, Sparkles, Wrench } from 'lucide-react'
import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/useToast'

/**
 * HelpSidebarContent - 帮助与反馈内容组件
 *
 * 纯内容组件，不包含任何状态管理
 * 被 HelpDrawer 包裹使用
 */

interface HelpSidebarContentProps {
  /** 打开快速上手教程的回调 */
  onOpenTutorial?: () => void
  /** 打开微信二维码弹窗的回调 */
  onOpenWechatQR?: () => void
  /** 打开反馈弹窗的回调 */
  onOpenFeedback?: () => void
}

export const HelpSidebarContent = React.memo(
  ({ onOpenTutorial, onOpenWechatQR, onOpenFeedback }: HelpSidebarContentProps) => {
    const { toast } = useToast()

    // ===== 卡片1：新手指南 - 按钮处理函数 =====

    /**
     * 打开快速上手教程
     */
    const handleQuickStart = () => {
      console.log('[HelpSidebar] 打开快速上手教程')
      onOpenTutorial?.()
    }

    /**
     * TODO: 接入常见问题页面
     * 后续接入方式：
     * 1. 打开 FAQ 弹窗
     * 2. 或跳转到 FAQ 页面
     */
    const handleViewFAQ = () => {
      console.log('[HelpSidebar] 查看常见问题')
      toast.info({
        title: '即将上线',
        description: '常见问题功能正在开发中',
      })
      // 接入点：openFAQDialog() 或 router.push('/faq')
    }

    // ===== 卡片2：联系开发者 - 按钮处理函数 =====

    /**
     * 打开问题反馈弹窗
     */
    const handleFeedback = () => {
      console.log('[HelpSidebar] 打开问题反馈')
      onOpenFeedback?.()
    }

    /**
     * 打开微信二维码弹窗
     */
    const handleContactDeveloper = () => {
      console.log('[HelpSidebar] 打开微信二维码')
      onOpenWechatQR?.()
    }

    // ===== 卡片3：自助排查 - 按钮处理函数 =====

    /**
     * TODO: 接入版本号复制功能
     * 后续接入方式：
     * 1. 从 package.json 或 app 信息中读取版本号
     * 2. 复制到剪贴板
     */
    const handleCopyVersion = async () => {
      console.log('[HelpSidebar] 复制版本号')
      // 接入点：const version = await window.ipcRenderer.invoke('app:getVersion')
      const mockVersion = 'v1.0.0' // 占位版本号
      try {
        await navigator.clipboard.writeText(mockVersion)
        toast.success({
          title: '已复制版本号',
          description: mockVersion,
        })
      } catch {
        toast.error({
          title: '复制失败',
          description: '请手动复制版本号',
        })
      }
    }

    /**
     * TODO: 接入诊断信息复制功能
     * 后续接入方式：
     * 1. 收集系统信息、配置信息、运行状态
     * 2. 格式化为 JSON 或文本
     * 3. 复制到剪贴板
     */
    const handleCopyDiagnostics = async () => {
      console.log('[HelpSidebar] 复制诊断信息')
      // 接入点：const diagnostics = await collectDiagnostics()
      const mockDiagnostics = JSON.stringify(
        {
          version: 'v1.0.0',
          platform: process.platform,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      )
      try {
        await navigator.clipboard.writeText(mockDiagnostics)
        toast.success({
          title: '已复制诊断信息',
          description: '可将信息粘贴给开发者',
        })
      } catch {
        toast.error({
          title: '复制失败',
          description: '请手动复制诊断信息',
        })
      }
    }

    /**
     * TODO: 接入日志导出功能
     * 后续接入方式：
     * 1. 调用 IPC 导出日志文件
     * 2. 打开保存对话框
     * 3. 或自动保存到下载目录
     */
    const handleExportLogs = async () => {
      console.log('[HelpSidebar] 导出日志')
      // 接入点：await window.ipcRenderer.invoke('app:exportLogs')
      toast.info({
        title: '即将上线',
        description: '日志导出功能正在开发中',
      })
    }

    return (
      <div className="flex flex-col gap-4">
        {/* 顶部标题区 */}
        <div className="px-1">
          <h3 className="text-base font-semibold text-foreground">帮助与反馈</h3>
          <p className="text-xs text-muted-foreground mt-1">
            快速开始使用，遇到问题可直接反馈给开发者
          </p>
        </div>

        {/* 卡片1：新手指南 */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 px-4 py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              新手指南
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              从连接中控台到开始使用，按步骤快速完成配置
            </p>
            <div className="flex flex-col gap-2">
              {/* 主按钮：3分钟快速上手 */}
              <Button size="sm" onClick={handleQuickStart} className="w-full text-xs">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                3分钟快速上手
              </Button>
              {/* 次按钮：查看常见问题 */}
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

        {/* 卡片2：联系开发者 */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                联系开发者
              </CardTitle>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                首发支持
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              遇到使用异常、功能建议或不清楚怎么操作时，可直接联系开发者
            </p>
            <div className="flex flex-col gap-2">
              {/* 主按钮：立即反馈问题 */}
              <Button size="sm" onClick={handleFeedback} className="w-full text-xs">
                立即反馈问题
              </Button>
              {/* 次按钮：联系开发者 */}
              <Button
                size="sm"
                variant="secondary"
                onClick={handleContactDeveloper}
                className="w-full text-xs"
              >
                联系开发者
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/70 text-center">
              建议附上截图或问题描述，处理更快
            </p>
          </CardContent>
        </Card>

        {/* 卡片3：自助排查 */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 px-4 py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              自助排查
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              反馈前可先复制当前版本和诊断信息，便于快速定位问题
            </p>
            <div className="grid grid-cols-2 gap-2">
              {/* 复制版本号 */}
              <Button size="sm" variant="outline" onClick={handleCopyVersion} className="text-xs">
                <Copy className="mr-1 h-3 w-3" />
                复制版本号
              </Button>
              {/* 复制诊断信息 */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyDiagnostics}
                className="text-xs"
              >
                <Copy className="mr-1 h-3 w-3" />
                诊断信息
              </Button>
            </div>
            {/* 导出日志 - 全宽按钮 */}
            <Button
              size="sm"
              variant="secondary"
              onClick={handleExportLogs}
              className="w-full text-xs"
            >
              <FileDown className="mr-1.5 h-3.5 w-3.5" />
              导出日志
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  },
)

HelpSidebarContent.displayName = 'HelpSidebarContent'
