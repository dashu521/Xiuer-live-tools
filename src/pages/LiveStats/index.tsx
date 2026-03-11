import { useMemoizedFn } from 'ahooks'
import { useState } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAccounts } from '@/hooks/useAccounts'
import { useAutoReply, useAutoReplyStore } from '@/hooks/useAutoReply'
import { useAutoReplyConfig } from '@/hooks/useAutoReplyConfig'
import { useAutoStopOnGateLoss } from '@/hooks/useAutoStopOnGateLoss'
import { useCurrentLiveControl } from '@/hooks/useLiveControl'
import { useLiveFeatureGate } from '@/hooks/useLiveFeatureGate'
import { useLiveStats } from '@/hooks/useLiveStats'
import { useToast } from '@/hooks/useToast'
import {
  exportLiveStats,
  type LiveStatsExportData,
  openExportFolder,
} from '@/utils/exportLiveStats'
import { stopAllLiveTasks } from '@/utils/stopAllLiveTasks'
import DanmuMonitor from './components/DanmuMonitor'
import EventTimeline from './components/EventTimeline'
import FansGroupChanges from './components/FansGroupChanges'
import StatsOverview from './components/StatsOverview'

export default function LiveStats() {
  const {
    stats,
    isListening,
    resetStats,
    setListening,
    danmuList,
    fansClubChanges,
    events,
    startTime,
  } = useLiveStats()
  const { currentAccountId } = useAccounts()
  const { config } = useAutoReplyConfig()
  const gate = useLiveFeatureGate()
  const { toast } = useToast()
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // 获取账号名称
  const accountName = useCurrentLiveControl(ctx => ctx.accountName)

  // 获取自动回复的监听状态设置函数（用于同步状态）
  const { setIsListening: setAutoReplyListening } = useAutoReply()

  // 检查自动回复是否正在运行
  const autoReplyIsRunning = useAutoReplyStore(
    state => state.contexts[currentAccountId]?.isRunning ?? false,
  )

  // 自动停止：当直播结束或断开连接时，自动停止数据监控
  useAutoStopOnGateLoss({
    gate,
    taskIsRunning: isListening,
    stopAll: useMemoizedFn(async reason => {
      console.log(`[LiveStats] Gate lost, reason: ${reason}, isListening: ${isListening}`)
      await stopAllLiveTasks(currentAccountId, reason, false)
    }),
  })

  // 开始监听
  const startListening = async () => {
    try {
      setListening(true)
      resetStats()

      const result = await window.ipcRenderer.invoke(
        IPC_CHANNELS.tasks.autoReply.startCommentListener,
        currentAccountId,
        {
          source: config.entry,
          ws: config.ws?.enable ? { port: config.ws.port } : undefined,
        },
      )

      if (!result) {
        throw new Error('启动监听失败')
      }

      // 同步自动回复的监听状态
      setAutoReplyListening('listening')

      toast.success('数据监控已启动')
    } catch (error) {
      setListening(false)
      toast.error('启动监控失败')
      console.error('[LiveStats] Failed to start listening:', error)
    }
  }

  // 停止监听前的确认
  const handleStopClick = () => {
    if (autoReplyIsRunning) {
      // 如果自动回复正在运行，显示确认对话框
      setShowStopConfirm(true)
    } else {
      // 否则直接停止
      doStopListening()
    }
  }

  // 实际停止监听
  const doStopListening = async () => {
    try {
      // 停止前先自动保存数据
      await autoSaveOnStop()

      await window.ipcRenderer.invoke(
        IPC_CHANNELS.tasks.autoReply.stopCommentListener,
        currentAccountId,
      )
      setListening(false)
      // 同步自动回复的监听状态
      setAutoReplyListening('stopped')
      // 如果自动回复正在运行，同时停止它
      if (autoReplyIsRunning) {
        useAutoReplyStore.getState().setIsRunning(currentAccountId, false)
      }
      toast.success('数据监控已停止')
    } catch (error) {
      toast.error('停止监控失败')
      console.error('[LiveStats] Failed to stop listening:', error)
    }
  }

  // 重置数据
  const handleReset = () => {
    resetStats()
    toast.success('数据已重置')
  }

  // 构建导出数据
  const buildExportData = (): LiveStatsExportData => {
    return {
      accountName: accountName || '未知账号',
      startTime,
      endTime: Date.now(),
      duration: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
      stats,
      danmuList: danmuList.map(item => ({
        nickName: item.nick_name,
        content: (item as any).content || '',
        time: item.time,
      })),
      fansClubChanges,
      events,
    }
  }

  // 导出数据
  const handleExport = async () => {
    if (isExporting) return

    setIsExporting(true)
    try {
      const data = buildExportData()
      const result = await exportLiveStats(data)

      if (result.success) {
        toast.success(`数据已导出到：${result.filePath}`)
      } else {
        toast.error(result.error || '导出失败')
      }
    } catch (error) {
      toast.error('导出失败')
      console.error('[LiveStats] Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  // 打开导出目录
  const handleOpenFolder = () => {
    openExportFolder()
  }

  // 停止时自动保存数据
  const autoSaveOnStop = async () => {
    // 只有有数据时才自动保存
    if (stats.commentCount > 0 || stats.likeCount > 0 || stats.enterCount > 0) {
      try {
        const data = buildExportData()
        const result = await exportLiveStats(data)
        if (result.success) {
          toast.success(`数据已自动保存到：${result.filePath}`)
        }
      } catch (error) {
        console.error('[LiveStats] Auto save failed:', error)
      }
    }
  }

  return (
    <>
      <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
        {/* 顶部统计卡片 */}
        <StatsOverview
          stats={stats}
          isListening={isListening}
          onStart={startListening}
          onStop={handleStopClick}
          onReset={handleReset}
          onExport={handleExport}
          onOpenFolder={handleOpenFolder}
          isExporting={isExporting}
          gate={gate}
        />

        {/* 标签页内容 */}
        <Tabs defaultValue="danmu" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="danmu">弹幕监控</TabsTrigger>
            <TabsTrigger value="fansclub">粉丝团变化</TabsTrigger>
            <TabsTrigger value="timeline">事件时间线</TabsTrigger>
          </TabsList>

          <TabsContent value="danmu" className="flex-1 mt-4">
            <DanmuMonitor />
          </TabsContent>

          <TabsContent value="fansclub" className="flex-1 mt-4">
            <FansGroupChanges />
          </TabsContent>

          <TabsContent value="timeline" className="flex-1 mt-4">
            <EventTimeline />
          </TabsContent>
        </Tabs>
      </div>

      {/* 停止监听确认对话框 */}
      <AlertDialog open={showStopConfirm} onOpenChange={setShowStopConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认停止监听？</AlertDialogTitle>
            <AlertDialogDescription>
              停止监听将同时<span className="text-destructive font-medium">停止自动回复功能</span>。
              确定要继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={doStopListening}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认停止
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
