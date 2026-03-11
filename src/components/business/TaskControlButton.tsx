/**
 * 任务控制按钮组件
 *
 * 统一规范：
 * - 开始任务：使用 GateButton，需要检查权限
 * - 停止任务：使用普通 Button，variant="secondary"
 * - 图标：开始用 Play，停止用 Square
 *
 * @example
 * <TaskControlButton
 *   isRunning={isRunning}
 *   onStart={handleStart}
 *   onStop={handleStop}
 *   gate={gate}
 *   startText="开始任务"
 *   stopText="停止任务"
 * />
 */

import { Play, Square } from 'lucide-react'
import { GateButton } from '@/components/GateButton'
import { Button } from '@/components/ui/button'
import type { LiveFeatureGate } from '@/hooks/useLiveFeatureGate'

interface TaskControlButtonProps {
  /** 是否正在运行 */
  isRunning: boolean
  /** 开始任务回调 */
  onStart: () => void
  /** 停止任务回调 */
  onStop: () => void
  /** 权限检查 */
  gate: LiveFeatureGate
  /** 开始按钮文字 */
  startText?: string
  /** 停止按钮文字 */
  stopText?: string
  /** 按钮尺寸 */
  size?: 'default' | 'sm' | 'lg'
  /** 自定义类名 */
  className?: string
}

const BUTTON_HEIGHT = {
  default: 'h-10',
  sm: 'h-9',
  lg: 'h-11',
}

const BUTTON_PADDING = {
  default: 'px-6',
  sm: 'px-4',
  lg: 'px-8',
}

export function TaskControlButton({
  isRunning,
  onStart,
  onStop,
  gate,
  startText = '开始任务',
  stopText = '停止任务',
  size = 'default',
  className = '',
}: TaskControlButtonProps) {
  const heightClass = BUTTON_HEIGHT[size]
  const paddingClass = BUTTON_PADDING[size]

  if (isRunning) {
    // 停止任务：使用普通 Button，不受 gate 限制
    return (
      <Button
        onClick={onStop}
        size={size}
        variant="secondary"
        className={`${heightClass} ${paddingClass} gap-2 ${className}`}
      >
        <Square className="h-4 w-4" />
        {stopText}
      </Button>
    )
  }

  // 开始任务：使用 GateButton，需要检查权限
  return (
    <GateButton
      gate={gate}
      onClick={onStart}
      size={size}
      className={`${heightClass} ${paddingClass} gap-2 ${className}`}
    >
      <Play className="h-4 w-4" />
      {startText}
    </GateButton>
  )
}

export default TaskControlButton
