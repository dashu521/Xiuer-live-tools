import type { TaskId } from './types'

export type GateTaskName = 'auto-reply' | 'auto-comment' | 'auto-popup'
export type TaskDisplayKey = TaskId | GateTaskName | 'liveStats'

export const TASK_GATE_NAME_BY_ID: Record<TaskId, GateTaskName> = {
  autoReply: 'auto-reply',
  autoPopup: 'auto-popup',
  autoSpeak: 'auto-comment',
}

export const TASK_DISPLAY_NAMES: Record<TaskDisplayKey, string> = {
  autoReply: '自动回复',
  autoPopup: '自动弹窗',
  autoSpeak: '自动发言',
  'auto-reply': '自动回复',
  'auto-comment': '自动发言',
  'auto-popup': '自动弹窗',
  liveStats: '数据监控',
}

export function getGateTaskName(taskId: TaskId): GateTaskName {
  return TASK_GATE_NAME_BY_ID[taskId]
}

export function getTaskDisplayName(taskName?: string): string {
  if (!taskName) return '任务'
  return TASK_DISPLAY_NAMES[taskName as TaskDisplayKey] || taskName
}
