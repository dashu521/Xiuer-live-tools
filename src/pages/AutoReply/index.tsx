import { useMemoizedFn } from 'ahooks'
import { Settings2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { autoReplyPlatforms } from '@/abilities'
import { TaskControlButton } from '@/components/business/TaskControlButton'
import { Title } from '@/components/common/Title'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/hooks/useAccounts'
import { useRequireAuthForAction } from '@/hooks/useAuth'
import { useAutoReply } from '@/hooks/useAutoReply'
import { useAutoStopOnGateLoss } from '@/hooks/useAutoStopOnGateLoss'
import { useCurrentLiveControl } from '@/hooks/useLiveControl'
import { useLiveFeatureGate } from '@/hooks/useLiveFeatureGate'
import { useTaskManager } from '@/hooks/useTaskManager'
import { useToast } from '@/hooks/useToast'
import CommentList from '@/pages/AutoReply/components/CommentList'
import PreviewList from '@/pages/AutoReply/components/PreviewList'
import { stopAllLiveTasks } from '@/utils/stopAllLiveTasks'

export default function AutoReply() {
  const { isRunning, isListening } = useAutoReply()
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null)
  const gate = useLiveFeatureGate()
  const { currentAccountId } = useAccounts()
  const navigate = useNavigate()
  const { startTask, stopTask } = useTaskManager()
  const { toast } = useToast()

  // 自动停机：当 Gate 条件不满足时，自动停止任务
  // 注意：自动回复的实际运行状态是 isListening，不是 isRunning
  // isRunning 只是功能开关，isListening === 'listening' || 'waiting' 才是任务运行状态
  const taskIsRunning = isListening === 'listening' || isListening === 'waiting'

  useAutoStopOnGateLoss({
    gate,
    taskIsRunning,
    stopAll: useMemoizedFn(async reason => {
      console.log(
        `[autostop] Auto reply gate lost, reason: ${reason}, isListening: ${isListening}, isRunning: ${isRunning}`,
      )
      // stopAllLiveTasks 会显示 toast，useAutoStopOnGateLoss 也会显示 toast
      // 为了避免重复，这里传入 showToast=false，让 useAutoStopOnGateLoss 统一显示
      await stopAllLiveTasks(currentAccountId, reason, false)
    }),
  })

  // 引入登录检查 Hook
  const { requireAuthForAction } = useRequireAuthForAction('auto-reply')

  const handleAutoReplyToggle = useMemoizedFn(async () => {
    if (!taskIsRunning) {
      await requireAuthForAction(async () => {
        await startTask('autoReply')
      })
    } else {
      await stopTask('autoReply', 'manual')
      toast.success('自动回复已停止')
    }
  })

  const connectState = useCurrentLiveControl(context => context.connectState)
  const platform = connectState.platform
  if (!autoReplyPlatforms.includes(platform as LiveControlPlatform)) {
    return null
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden p-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-start md:justify-between shrink-0">
        <div className="min-w-0 shrink-0">
          <Title title="自动回复" description="查看直播间的实时评论并自动回复" />
        </div>
        <div className="flex w-full shrink-0 items-center gap-2 md:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('settings')}
            title="设置"
            className="h-8 text-sm"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span>设置</span>
          </Button>
          <TaskControlButton
            isRunning={taskIsRunning}
            onStart={handleAutoReplyToggle}
            onStop={handleAutoReplyToggle}
            gate={gate}
            size="sm"
            startText="开始任务"
            stopText="停止任务"
          />
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(20rem,1.35fr)_minmax(16rem,1fr)] gap-4 xl:grid-cols-2 xl:grid-rows-1">
        <CommentList highlight={highlightedCommentId} />
        <PreviewList setHighLight={setHighlightedCommentId} />
      </div>
    </div>
  )
}
