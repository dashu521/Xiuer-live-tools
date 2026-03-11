import { useMemoizedFn } from 'ahooks'
import { Title } from '@/components/common/Title'
import { useAccounts } from '@/hooks/useAccounts'
import { useAutoPopUpActions, useCurrentAutoPopUp, useShortcutListener } from '@/hooks/useAutoPopUp'
import { useAutoStopOnGateLoss } from '@/hooks/useAutoStopOnGateLoss'
import { useLiveFeatureGate } from '@/hooks/useLiveFeatureGate'
import { useTaskControl } from '@/hooks/useTaskControl'
import { stopAllLiveTasks } from '@/utils/stopAllLiveTasks'
import GoodsListCard from './components/GoodsListCard'
import TaskControlCard from './components/TaskControlCard'

const useAutoPopUpTaskControl = () => {
  const isRunning = useCurrentAutoPopUp(context => context.isRunning)
  const config = useCurrentAutoPopUp(context => context.config)
  const { setIsRunning } = useAutoPopUpActions()

  return useTaskControl({
    taskType: 'auto-popup',
    getIsRunning: () => isRunning,
    getConfig: () => config,
    setIsRunning,
    startSuccessMessage: '自动弹窗任务已启动',
    startFailureMessage: '自动弹窗任务启动失败',
  })
}

export default function AutoPopUp() {
  const { isRunning, onStartTask, onStopTask } = useAutoPopUpTaskControl()
  const gate = useLiveFeatureGate()
  const { currentAccountId } = useAccounts()

  // 自动停机：当 Gate 条件不满足时，自动停止任务
  useAutoStopOnGateLoss({
    gate,
    taskIsRunning: isRunning,
    stopAll: useMemoizedFn(async reason => {
      await stopAllLiveTasks(currentAccountId, reason, false)
    }),
  })

  const handleTaskButtonClick = useMemoizedFn(async () => {
    if (!isRunning) {
      onStartTask()
    } else {
      // 停止任务（不需要登录检查）
      onStopTask()
    }
  })

  useShortcutListener()

  return (
    <div className="w-full py-6 flex flex-col gap-6 min-h-0 overflow-auto">
      <div className="shrink-0">
        <Title title="自动弹窗" description="配置自动弹出商品的规则" />
      </div>

      <div className="flex flex-col gap-6 min-w-0 flex-1 min-h-0">
        {/* 任务控制卡片（包含弹窗间隔、随机弹窗） */}
        <TaskControlCard isRunning={isRunning} gate={gate} onStartStop={handleTaskButtonClick} />

        {/* 商品列表卡片 */}
        <GoodsListCard />
      </div>
    </div>
  )
}
