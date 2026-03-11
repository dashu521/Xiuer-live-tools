import { useMemoizedFn } from 'ahooks'
import { Title } from '@/components/common/Title'
import { useCurrentAutoMessage } from '@/hooks/useAutoMessage'
import { useLiveFeatureGate } from '@/hooks/useLiveFeatureGate'
import { useTaskManager } from '@/hooks/useTaskManager'
import MessageListCard from './components/MessageListCard'
import TaskControlCard from './components/TaskControlCard'

export default function AutoMessage() {
  const gate = useLiveFeatureGate()
  const { startTask, stopTask } = useTaskManager()
  // 状态源：使用 store 的 isRunning（与左侧绿点一致）
  const isRunning = useCurrentAutoMessage(context => context.isRunning)

  const handleTaskButtonClick = useMemoizedFn(async () => {
    if (!isRunning) {
      await startTask('autoSpeak')
    } else {
      // 停止任务（不需要登录检查）
      await stopTask('autoSpeak', 'manual')
    }
  })

  return (
    <div className="w-full py-6 flex flex-col gap-6 min-h-0 overflow-auto">
      <div className="shrink-0">
        <Title title="自动发言" description="配置自动发送消息的规则" />
      </div>

      <div className="flex flex-col gap-6 min-w-0 flex-1 min-h-0">
        {/* 任务控制卡片（包含一键刷屏） */}
        <TaskControlCard isRunning={isRunning} gate={gate} onStartStop={handleTaskButtonClick} />

        {/* 消息列表卡片（包含发送设置） */}
        <MessageListCard />
      </div>
    </div>
  )
}
