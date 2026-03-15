/**
 * Task 模块统一导出
 *
 * 自动回复、自动发言、自动弹窗统一由 TaskManager 管理。
 */

import { AutoPopupTask } from './autoPopupTask'
import { AutoReplyTask } from './autoReplyTask'
import { AutoSpeakTask } from './autoSpeakTask'
import { taskManager } from './TaskManager'

taskManager.register(AutoReplyTask)
taskManager.register(AutoPopupTask)
taskManager.register(AutoSpeakTask)

export type { StopReason, TaskContext, TaskId, TaskStatus } from './types'
export { AutoPopupTask, AutoReplyTask, AutoSpeakTask, taskManager }
