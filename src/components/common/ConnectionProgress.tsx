import { CheckIcon, XIcon } from 'lucide-react'
import React from 'react'
import type { ConnectionPhase } from '@/config/platformConfig'
import { cn } from '@/lib/utils'

export interface ConnectionStep {
  id: ConnectionPhase
  label: string
  description?: string
}

export interface ConnectionProgressProps {
  phase: ConnectionPhase
  streamState: 'unknown' | 'offline' | 'live'
  hasTaskRunning: boolean
  errorMessage?: string
  className?: string
}

// 定义所有步骤
const connectionSteps: Omit<ConnectionStep, 'id'>[] = [
  { label: '准备连接', description: '初始化连接参数' },
  { label: '启动浏览器', description: '正在打开 Chrome...' },
  { label: '扫码登录', description: '请使用手机扫码' },
  { label: '开始直播', description: '等待开始直播...' },
  { label: '任务运行中', description: '自动功能正在运行' },
]

// 获取阶段索引
const getPhaseIndex = (phase: ConnectionPhase): number => {
  const phaseMap: Record<ConnectionPhase, number> = {
    idle: 0,
    preparing: 0,
    launching_browser: 1,
    waiting_for_login: 2,
    streaming: 3,
    tasks_running: 4,
    error: 0,
  }
  return phaseMap[phase] ?? 0
}

export const ConnectionProgress = React.memo(
  ({ phase, streamState, hasTaskRunning, errorMessage, className }: ConnectionProgressProps) => {
    const currentStepIndex = getPhaseIndex(phase)
    const isError = phase === 'error'

    // 判断每个步骤的状态
    const getStepStatus = (index: number): 'completed' | 'current' | 'pending' => {
      // 前3个步骤（准备连接、启动浏览器、扫码登录）根据 phase 判断
      if (index < 3) {
        if (index < currentStepIndex) return 'completed'
        if (index === currentStepIndex) return 'current'
        return 'pending'
      }

      // 第4步：开始直播
      if (index === 3) {
        if (streamState === 'live' || hasTaskRunning) return 'completed'
        if (currentStepIndex >= 3) return 'current'
        return 'pending'
      }

      // 第5步：任务运行中
      if (index === 4) {
        if (hasTaskRunning) return 'current'
        return 'pending'
      }

      return 'pending'
    }

    return (
      <div className={cn('w-full', className)}>
        {/* 步骤条 */}
        <div className="relative">
          {/* 背景线 */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted" />

          {/* 进度线 - 根据已完成步骤计算 */}
          <div
            className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500"
            style={{
              width: `${Math.min((currentStepIndex / (connectionSteps.length - 1)) * 100, 100)}%`,
            }}
          />

          {/* 步骤点 */}
          <div className="relative flex justify-between">
            {connectionSteps.map((step, index) => {
              const status = getStepStatus(index)
              const isCompleted = status === 'completed'
              const isCurrent = status === 'current'
              const isPending = status === 'pending'

              return (
                <div key={index} className="flex flex-col items-center">
                  {/* 步骤圆圈 */}
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 bg-background',
                      isCompleted && 'border-primary bg-primary text-primary-foreground',
                      isCurrent && !isError && 'border-green-500 text-green-500',
                      isError && isCurrent && 'border-destructive text-destructive',
                      isPending && 'border-muted-foreground/30 text-muted-foreground',
                    )}
                  >
                    {isCompleted ? (
                      <CheckIcon className="w-5 h-5" />
                    ) : isError && isCurrent ? (
                      <XIcon className="w-5 h-5" />
                    ) : isCurrent ? (
                      <div className="w-3 h-3 rounded-full bg-white" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>

                  {/* 步骤标签 */}
                  <div className="mt-2 text-center">
                    <div
                      className={cn(
                        'text-sm font-medium transition-colors',
                        isCompleted && 'text-primary',
                        isCurrent && !isError && 'text-green-600',
                        isCurrent && isError && 'text-destructive',
                        isPending && 'text-muted-foreground',
                      )}
                    >
                      {step.label}
                    </div>
                    {isCurrent && step.description && (
                      <div className="text-xs text-muted-foreground mt-1 max-w-[120px]">
                        {step.description}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 错误提示 */}
        {isError && errorMessage && (
          <div className="mt-4 p-3 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-destructive">
              <XIcon className="w-4 h-4" />
              <span className="text-sm font-medium">连接失败</span>
            </div>
            <p className="text-sm text-destructive/80 mt-1">{errorMessage}</p>
          </div>
        )}
      </div>
    )
  },
)

ConnectionProgress.displayName = 'ConnectionProgress'
