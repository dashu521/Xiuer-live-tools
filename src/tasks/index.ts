/**
 * Task 模块统一导出
 *
 * 【止血策略】：目前只保留 autoSpeak 使用 TaskManager
 * - autoReply: 回退到旧逻辑（useTaskControl/CommentList.startListening）
 * - autoPopup: 回退到旧逻辑（useTaskControl）
 * - autoSpeak: 使用 TaskManager（统一管理）
 */

import { AutoSpeakTask } from './autoSpeakTask'
import { taskManager } from './TaskManager'

// 只注册 autoSpeak 任务模板（TaskManager 会为每个账号创建独立实例）
taskManager.register(AutoSpeakTask)

// 暂时不注册 autoReply 和 autoPopup（回退到旧逻辑）
// const autoReplyTask = new AutoReplyTask()
// const autoPopupTask = new AutoPopupTask()
// taskManager.register(autoReplyTask)
// taskManager.register(autoPopupTask)

export { taskManager }
export { AutoSpeakTask }
export type { StopReason, TaskContext, TaskId, TaskStatus } from './types'
