/**
 * 自动回复任务实现
 */

import { IPC_CHANNELS } from 'shared/ipcChannels'
import { useAutoReplyStore } from '@/hooks/useAutoReply'
import { createDefaultConfig, useAutoReplyConfigStore } from '@/hooks/useAutoReplyConfig'
import { BaseTask, type StopReason, type TaskContext } from './types'

export class AutoReplyTask extends BaseTask {
  private accountId: string | null = null

  constructor() {
    super('autoReply')
  }

  async start(ctx: TaskContext): Promise<void> {
    // 【修复】如果任务之前已经启动过，先清理旧的事件监听器
    // 防止重复注册导致的事件监听泄漏
    if (this.accountId && this.accountId !== ctx.accountId) {
      console.log(`[AutoReplyTask] Cleaning up old listeners for account ${this.accountId}`)
      this.executeDisposers()
    }

    this.accountId = ctx.accountId
    const config =
      useAutoReplyConfigStore.getState().contexts[ctx.accountId]?.config ?? createDefaultConfig()

    // 更新状态为 waiting
    useAutoReplyStore.getState().setIsListening(ctx.accountId, 'waiting')

    try {
      // 启动评论监听
      const result = await ctx.ipcInvoke<boolean>(
        IPC_CHANNELS.tasks.autoReply.startCommentListener,
        ctx.accountId,
        {
          source: config.entry,
          ws: config.ws?.enable ? { port: config.ws.port } : undefined,
        },
      )

      if (!result) {
        throw new Error('监听评论失败')
      }

      // 注册 IPC 事件监听器（用于后端主动停止时同步状态）
      // 【P2方案】使用账号隔离的事件通道，避免全局广播干扰
      const handleListenerStopped = (accountId: string) => {
        // 由于使用账号隔离的事件，这里不需要再检查 accountId
        if (this.status === 'running') {
          console.log(`[AutoReplyTask] Listener stopped by backend for account ${accountId}`)
          this.stop('error')
        }
      }

      // 监听后端停止事件
      if (window.ipcRenderer) {
        // 【P2方案】监听账号隔离的事件通道
        const eventChannel = IPC_CHANNELS.tasks.autoReply.listenerStoppedFor(ctx.accountId)
        const unsubscribe = window.ipcRenderer.on(
          eventChannel as `tasks:autoReply:listenerStopped:${string}`,
          handleListenerStopped as (accountId: string) => void,
        )
        this.registerDisposable(() => unsubscribe())
      }

      // 更新状态为 listening
      useAutoReplyStore.getState().setIsListening(ctx.accountId, 'listening')
      useAutoReplyStore.getState().setIsRunning(ctx.accountId, true)
      this.status = 'running'

      ctx.toast.success('监听评论成功')
      console.log(`[AutoReplyTask] Started successfully for account ${ctx.accountId}`)
    } catch (error) {
      console.error('[AutoReplyTask] Failed to start:', error)
      useAutoReplyStore.getState().setIsListening(ctx.accountId, 'error')
      useAutoReplyStore.getState().setIsRunning(ctx.accountId, false)
      this.status = 'error'
      ctx.toast.error('监听评论失败')
      throw error
    }
  }

  async stop(reason: StopReason): Promise<void> {
    if (this.status === 'stopped' || this.status === 'idle') {
      return
    }

    console.log(`[AutoReplyTask] Stopping, reason: ${reason}`)
    this.status = 'stopping'

    // 执行清理器（移除 IPC 监听器等）
    // 这会清理所有注册的清理函数，包括：
    // - IPC 事件监听器（listenerStopped）
    // - 任何其他定时器、websocket 等资源
    this.executeDisposers()

    // 调用 IPC 停止监听（后端会清理 interval/websocket/listener）
    if (this.accountId) {
      try {
        if (window.ipcRenderer) {
          await window.ipcRenderer.invoke(
            IPC_CHANNELS.tasks.autoReply.stopCommentListener,
            this.accountId,
          )
          console.log('[AutoReplyTask] IPC stopCommentListener invoked successfully')
        }
      } catch (error) {
        console.error('[AutoReplyTask] Error stopping IPC listener:', error)
      }

      // 更新状态
      useAutoReplyStore.getState().setIsListening(this.accountId, 'stopped')
      useAutoReplyStore.getState().setIsRunning(this.accountId, false)
      console.log('[AutoReplyTask] Store state updated: isListening=stopped, isRunning=false')
    }

    this.status = 'stopped'
    this.isStopped = true
    console.log(`[AutoReplyTask] Stopped successfully, reason: ${reason}`)
  }

  protected reset(): void {
    super.reset()
    this.accountId = null
  }
}
